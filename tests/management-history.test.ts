import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {managementFixture} from './helpers/management-fixture.js';
function read(s:LobbyStore,token:string,id:string,query:unknown={}){const fn=(s as any).managementHistory;assert.equal(typeof fn,'function','missing authorized management history');return fn.call(s,token,id,query) as {items:any[];next:string|null};}

test('host and temporary manager actions keep exact safe before/after values and actual operators',()=>{
 const s=new LobbyStore(':memory:');try{const f=managementFixture(s);assert.deepEqual(read(s,f.tokens[0],f.id).items,[]);f.command(1,'delegate',{seat:6});f.command(6,'pause');f.command(6,'defaults',{voteSeconds:45,voteVisibility:'totals'});f.command(6,'resume');
 const rows=read(s,f.tokens[0],f.id).items;assert.deepEqual(rows.map(r=>r.action),['resume','defaults','pause','delegate']);assert.equal(rows[0].operator.seat,6);assert.equal(rows[0].operator.nickname,'玩家6');assert.equal(rows[0].before.status,'paused');assert.equal(rows[0].after.status,'resuming');assert.equal(rows[1].before.voteSeconds,30);assert.equal(rows[1].after.voteSeconds,45);assert.equal(rows[1].after.voteVisibility,'totals');assert.equal(rows[3].before.tempSeat,null);assert.equal(rows[3].after.tempSeat,6);
 const json=JSON.stringify(rows);for(const forbidden of [...f.tokens,'seer','wolf','witch','turnId','remainingMs','deadline','session_hash','operator_member','antidote'])assert.ok(!json.includes(forbidden),forbidden);assert.equal(read(s,f.tokens[5],f.id).items.length,4);
 }finally{s.close();}
});

test('read authority is current, rejects outsiders and admins, and stale rejected actions add no events',async()=>{
 const s=new LobbyStore(':memory:');try{const f=managementFixture(s),other=managementFixture(s);read(s,f.tokens[0],f.id);assert.throws(()=>read(s,f.tokens[1],f.id),/HOST_ONLY/);assert.throws(()=>read(s,other.tokens[0],f.id),/NOT_MEMBER/);await s.auth.createAccount('audit_admin','correct-password','管理员','admin');const admin=await s.auth.login(other.tokens[1],'audit_admin','correct-password');assert.throws(()=>read(s,admin.token,f.id),/NOT_MEMBER/);
 f.command(1,'delegate',{seat:6});assert.equal(read(s,f.tokens[5],f.id).items.length,1);f.command(1,'delegate',{seat:null});assert.throws(()=>read(s,f.tokens[5],f.id),/HOST_ONLY/);assert.throws(()=>s.gameControl(f.tokens[0],f.id,{action:'pause',confirmed:true,version:0}),/STALE_CONTROL/);assert.throws(()=>f.command(2,'pause'),/HOST_ONLY/);assert.equal(read(s,f.tokens[0],f.id).items.length,2);assert.throws(()=>read(s,f.tokens[0],f.id,{before:'1 OR 1=1'}),/INVALID_INPUT/);assert.throws(()=>read(s,f.tokens[0],f.id,{limit:100000}),/INVALID_INPUT/);
 }finally{s.close();}
});

test('pagination survives new events and restart without losing or duplicating accepted operations',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-management-')),file=join(dir,'db');let s=new LobbyStore(file,undefined,false,()=>1000);try{const f=managementFixture(s);read(s,f.tokens[0],f.id);for(let i=0;i<25;i++)f.command(1,'delegate',{seat:i%2?null:6});const first=read(s,f.tokens[0],f.id);assert.equal(first.items.length,20);assert.ok(first.next);f.command(1,'pause');const second=read(s,f.tokens[0],f.id,{before:first.next});assert.equal(second.items.length,5);assert.equal(second.next,null);assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,25);s.close();s=new LobbyStore(file,undefined,false,()=>1000);const latest=read(s,f.tokens[0],f.id);assert.equal(latest.items[0].action,'pause');assert.equal(latest.items[0].after.status,'paused');assert.equal(read(s,f.tokens[0],f.id,{before:latest.next}).items.length,6);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('a failed audit write rolls back the business action and exposes no successful history',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-management-rollback-')),file=join(dir,'db');const s=new LobbyStore(file);const db=new Database(file);try{const f=managementFixture(s);read(s,f.tokens[0],f.id);db.exec("CREATE TRIGGER block_management_history BEFORE INSERT ON room_management_history BEGIN SELECT RAISE(ABORT,'synthetic fault'); END");const before=s.snapshot(f.id);assert.throws(()=>f.command(1,'pause'),/synthetic fault/);assert.equal(s.snapshot(f.id).control!.status,'running');assert.equal(s.snapshot(f.id).revision,before.revision);assert.equal(read(s,f.tokens[0],f.id).items.length,0);db.exec('DROP TRIGGER block_management_history');f.command(1,'pause');assert.equal(read(s,f.tokens[0],f.id).items.length,1);
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test('public badge takeover is audited while ordinary dead-sheriff transfer is not misclassified',()=>{
 for(const takeover of [true,false]){let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now);try{const f=managementFixture(s);read(s,f.tokens[0],f.id);now+=500000;s.tickNights();s.enterDay(f.tokens[0],f.id);const d=(seat:number,action:string,extra={})=>s.dayCommand(f.tokens[seat-1],f.id,{action,turnId:s.snapshot(f.id).day!.turnId,...extra} as never);
 d(6,'signup',{join:true});d(1,'close_signup');d(1,'continue');d(1,'continue');d(1,'speech_mode',{mode:'free'});d(1,'end_speech');d(1,'start_vote',{method:'offline',visibility:'individual',seconds:30});d(1,'offline_vote',{voter:2,target:6});d(1,'close_vote');d(1,'continue');while(['death_skill','last_words'].includes(s.snapshot(f.id).day!.phase)){const day=s.snapshot(f.id).day!;if(day.phase==='last_words')d(1,'end_speech');else{now=day.deadline!;s.tickNights();}}assert.equal(s.snapshot(f.id).day!.phase,'badge_transfer');d(takeover?1:6,'transfer_badge',{target:7,takeover:true});const rows=read(s,f.tokens[0],f.id).items;if(!takeover){assert.equal(rows.length,0);continue;}assert.equal(rows.length,1);assert.equal(rows[0].action,'badge-takeover');assert.equal(rows[0].operator.seat,1);assert.equal(rows[0].before.sheriff,6);assert.equal(rows[0].after.sheriff,7);assert.equal(rows[0].after.badge,'elected');s.appointJudge(f.tokens[0],f.id,{confirmed:true,version:0,seat:6});f.command(6,'pause');assert.equal(read(s,f.tokens[5],f.id).items[0].operator.seat,6);s.appointJudge(f.tokens[0],f.id,{confirmed:true,version:1,seat:null});assert.throws(()=>read(s,f.tokens[5],f.id),/HOST_ONLY/);
 f.command(1,'resume');now+=5000;s.tickNights();assert.equal(s.snapshot(f.id).day!.phase,'day_complete');s.enterNight(f.tokens[0],f.id);assert.equal(s.snapshot(f.id).night!.night,2);assert.equal(s.snapshot(f.id).day!.sheriff,7);f.command(1,'pause');const laterNight=read(s,f.tokens[0],f.id).items[0];assert.equal(laterNight.before.phase,'night');assert.equal(laterNight.before.round,2);for(const state of [laterNight.before,laterNight.after]){assert.equal(state.sheriff,7);assert.equal(state.badge,'elected');}
 }finally{s.close();}}
});

test('runtime room cleanup preserves stored history without granting archived or administrator access',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-management-retain-')),file=join(dir,'db');let now=1000;const s=new LobbyStore(file,undefined,false,()=>now),db=new Database(file);try{const f=managementFixture(s);read(s,f.tokens[0],f.id);f.command(1,'pause');now+=86400001;assert.deepEqual(s.cleanupExpiredRooms(),[f.id]);assert.equal((db.prepare('SELECT COUNT(*) AS n FROM room_management_history WHERE room_id=?').get(f.id) as {n:number}).n,1);assert.throws(()=>read(s,f.tokens[0],f.id),/ROOM_NOT_FOUND/);}finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
