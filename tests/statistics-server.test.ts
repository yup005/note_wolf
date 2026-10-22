import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';
import {emptyRecord,type RecordDocument} from '../packages/contracts/records.js';
import type {Role} from '../packages/contracts/index.js';
import {backupDatabase,restoreDatabase} from '../packages/storage/databaseBackup.js';
import {manualGame,endManual,prepareManual} from './helpers/rematch.js';
const document=(seats:number[],notes=''):RecordDocument=>({...emptyRecord(),notes,deaths:seats.map(seat=>({seat,round:1,period:'night',cause:'unrecorded'}))});
const register=(s:LobbyStore,token:string)=>s.auth.register(token,'stats_'+randomUUID().replaceAll('-','').slice(0,12),'synthetic-password','合成统计玩家');
test('a verified final mixer camp counts its own outcome and remains known after cleanup',async()=>{
 let now=1000;const {s,tokens,id}=custom(['villager','mechanicalWolf','mixer','guard'],'automatic',':memory:',()=>now);try{const mixer=await register(s,tokens[2]);s.enterNight(tokens[0],id);
  for(let step=0;step<30&&s.snapshot(id).night!.phase!=='mixer';step++){const deadline=s.snapshot(id).night!.deadline;assert.notEqual(deadline,null);now=deadline!;s.tickNights();}
  assert.equal(s.snapshot(id).night!.phase,'mixer');s.nightCommand(mixer.token,id,{action:'mixer',target:2,turnId:s.snapshot(id).night!.turnId});s.switchManual(tokens[0],id,true);const d=s.recordsList(tokens[0],id).own!;s.saveRecord(tokens[0],id,d.revision,document([1,4]));s.commitManual(tokens[0],id,d.revision+1);assert.equal(s.snapshot(id).manual!.winner,'wolves');const result=s.statistics(mixer.token);assert.equal(result.played,1);assert.equal(result.resolved,1);assert.equal(result.wins,1);assert.equal(result.roles[0].role,'mixer');now+=25*3600000;assert.deepEqual(s.cleanupExpiredRooms(),[id]);assert.deepEqual(s.statistics(mixer.token),result);
 }finally{s.close();}
});
test('statistics remain a read while another connection saves authoritative facts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-stats-reader-')),file=join(dir,'db'),{s,tokens,id}=custom(['villager','mechanicalWolf','mixer','guard'],'automatic',file),peer=new Database(file);
 try{const mixer=await register(s,tokens[2]);s.enterNight(tokens[0],id);s.switchManual(tokens[0],id,true);s.recordsList(tokens[0],id);s.adjudicateManual(tokens[0],id,{confirmed:true,winner:'wolves',version:0,revision:0});
  peer.prepare('DELETE FROM game_board_archives WHERE game_id=?').run(id); // Legacy live archive without its optional board snapshot.
  peer.transaction(()=>{peer.prepare('UPDATE record_rooms SET code=code WHERE room_id=?').run(id);const result=s.statistics(mixer.token);assert.equal(result.played,1);assert.equal(result.resolved,0);}).immediate();
  assert.equal((peer.prepare('SELECT COUNT(*) AS n FROM game_board_archives WHERE game_id=?').get(id) as {n:number}).n,0);
 }finally{peer.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
test('actual automatic terminal facts remain reliable after runtime cleanup',async()=>{
 let now=1000;const {s,tokens,id}=manualGame(':memory:',()=>now,'automatic');try{tokens[0]=(await register(s,tokens[0])).token;
  const day=(action:string,extra={})=>s.dayCommand(tokens[0],id,{action,turnId:s.snapshot(id).day!.turnId,...extra} as never);
  for(let round=1;round<=4;round++){
   s.enterNight(tokens[0],id);now+=500000;s.tickNights();assert.equal(s.snapshot(id).night!.phase,'first_night_complete');s.enterDay(tokens[0],id);if(round===1)day('close_signup');day('continue');day('continue');day('speech_mode',{mode:'free'});day('end_speech');day('start_vote',{method:'offline',visibility:'individual',seconds:30});day('offline_vote',{voter:5,target:round});day('close_vote');day('continue');
   for(let step=0;step<10&&!['day_complete','ended'].includes(s.snapshot(id).day!.phase);step++){const current=s.snapshot(id).day!;if(current.phase==='last_words')day('end_speech');else{assert.notEqual(current.deadline,null);now=current.deadline!;s.tickNights();}}
  }
  assert.equal(s.snapshot(id).day!.phase,'ended');assert.equal(s.snapshot(id).day!.winner,'good');const result=s.statistics(tokens[0]);assert.equal(result.played,1);assert.equal(result.resolved,1);assert.equal(result.losses,1);now+=25*3600000;assert.deepEqual(s.cleanupExpiredRooms(),[id]);assert.deepEqual(s.statistics(tokens[0]),result);
 }finally{s.close();}
});
function custom(roles:Role[],mode:'manual'|'automatic'='manual',file=':memory:',clock=()=>1000){const s=new LobbyStore(file,undefined,false,clock),tokens=roles.map(()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));const room=s.create(tokens[0],'合成参赛房主').room,id=room.id,counts:Partial<Record<Role,number>>={};for(const role of roles)counts[role]=(counts[role]??0)+1;s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:roles.length,roles:counts}}});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:mode});tokens.forEach((t,i)=>{if(i)s.join(t,room.code,'合成玩家'+i);s.select(t,id,i+1);s.setReady(t,id,true,s.snapshot(id).preparation.settingsRevision);});s.deal(tokens[0],id);tokens.forEach((t,i)=>s.submitIdentity(t,id,roles[i]));s.start(tokens[0],id);return {s,tokens,id};}

test('current account sees only its ended ordinary participation and binding retains the true role',async()=>{
 const {s,tokens,id}=manualGame();try{assert.throws(()=>s.statistics(tokens[0]),/LOGIN_REQUIRED/);const oldGuest=tokens[0],host=await register(s,tokens[0]);tokens[0]=host.token;assert.equal(s.statistics(host.token).played,0);endManual(s,host.token,id);const result=s.statistics(host.token);assert.equal(result.played,1);assert.equal(result.resolved,1);assert.equal(result.wins,0);assert.equal(result.losses,1);assert.equal(result.roles[0].role,'wolf');assert.equal(result.roles.length,1);assert.doesNotMatch(JSON.stringify(result),new RegExp(id+'|owner|seat|notes|participants'));assert.deepEqual(s.statistics(host.token),result);
  const good=await register(s,tokens[4]);assert.equal(s.statistics(good.token).wins,1);assert.equal(s.statistics(good.token).roles[0].role,'villager');const unrelated=randomBytes(32).toString('hex');s.issueSession(unrelated);const stranger=await register(s,unrelated);assert.equal(s.statistics(stranger.token).played,0);assert.throws(()=>s.statistics(oldGuest),/UNAUTHORIZED/);
 }finally{s.close();}
});
test('same-room rounds count independently while versions, private drafts and official corrections use current facts',async()=>{
 const {s,tokens,id}=manualGame();try{tokens[0]=(await register(s,tokens[0])).token;endManual(s,tokens[0],id);const next=s.rematch(tokens[0],id,{requestId:randomUUID(),expectedGameId:id});prepareManual(s,id,tokens);const second=next.game.gameId;let draft=s.recordsList(tokens[0],second).own!;draft=s.saveRecord(tokens[0],second,draft.revision,document([5,6,7,8]));s.commitManual(tokens[0],second,draft.revision);s.publishRecord(tokens[0],second,draft.revision);draft=s.saveRecord(tokens[0],second,draft.revision,document([5,6,7,8],'published notes'));s.publishRecord(tokens[0],second,draft.revision);const baseline=s.statistics(tokens[0]);assert.equal(baseline.played,2);assert.equal(baseline.winRate,.5);assert.equal(baseline.boards[0].played,2);
  draft=s.saveRecord(tokens[0],second,draft.revision,document([],'PRIVATE_NOT_STATISTICS'));assert.deepEqual(s.statistics(tokens[0]),baseline);draft=s.saveRecord(tokens[0],second,draft.revision,document([1,2,3,4]));s.commitManual(tokens[0],second,draft.revision);assert.equal(s.statistics(tokens[0]).wins,0);const old=s.recordsList(tokens[0],id).own!;s.saveRecord(tokens[0],id,old.revision,document([5,6,7,8]));s.commitManual(tokens[0],id,old.revision+1);assert.equal(s.statistics(tokens[0]).wins,1);
 }finally{s.close();}
});
test('guest mapping migrates after cleanup, persists through backup, and own deletion excludes until explicit recreation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-statistics-')),file=join(dir,'db');let now=1000;let {s,tokens,id}=manualGame(file,()=>now);try{endManual(s,tokens[0],id);const draft=s.recordsList(tokens[0],id).own!;now+=25*3600000;assert.deepEqual(s.cleanupExpiredRooms(),[id]);const account=await register(s,tokens[0]);tokens[0]=account.token;assert.equal(s.statistics(account.token).played,1);s.close();s=new LobbyStore(file);assert.equal(s.statistics(account.token).roles[0].role,'wolf');
  const backup=await backupDatabase({source:file,output:join(dir,'backup')});await restoreDatabase({source:backup.path,output:join(dir,'restored'),sha256:backup.sha256});const restored=new LobbyStore(join(dir,'restored'));try{assert.deepEqual(restored.statistics(account.token),s.statistics(account.token));}finally{restored.close();}
  s.deleteRecord(account.token,draft.id,{requestId:randomUUID(),confirmed:true,revision:draft.revision,publishedVersion:null,withdrawn:false});assert.equal(s.statistics(account.token).played,0);s.createRecord(account.token,id,{requestId:randomUUID(),confirmed:true});assert.equal(s.statistics(account.token).played,1);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('binding two expired seats to one account retains ambiguity instead of assigning the first role',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-statistics-overlap-')),file=join(dir,'db');let now=1000;const {s,tokens,id}=manualGame(file,()=>now);try{endManual(s,tokens[0],id);const username='overlap_'+randomUUID().slice(0,8),account=await s.auth.register(tokens[0],username,'synthetic-password','合成玩家');now+=25*3600000;s.cleanupExpiredRooms();assert.equal(s.statistics(account.token).played,1);const merged=await s.auth.login(tokens[1],username,'synthetic-password');assert.equal(s.statistics(merged.token).played,0);assert.throws(()=>s.statistics(account.token),/UNAUTHORIZED/);}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('running private actions never alter the exact aggregate',async()=>{
 let now=1000;const {s,tokens,id}=manualGame(':memory:',()=>now,'automatic');try{tokens[0]=(await register(s,tokens[0])).token;const baseline=s.statistics(tokens[0]);s.enterNight(tokens[0],id);s.nightCommand(tokens[0],id,{action:'vote',target:5,turnId:s.snapshot(id).night!.turnId});assert.deepEqual(s.statistics(tokens[0]),baseline);now+=190000;s.tickNights();assert.deepEqual(s.statistics(tokens[0]),baseline);s.switchManual(tokens[0],id,true);const d=s.recordsList(tokens[0],id).own!;s.saveRecord(tokens[0],id,d.revision,document([1,2,3,4],'UNPUBLISHED'));assert.deepEqual(s.statistics(tokens[0]),baseline);}finally{s.close();}
});
test('unknown official outcomes and unknown mixer camp stay outside the win denominator',async()=>{
 const {s,tokens,id}=custom(['villager','wolf','mixer','guard']);try{tokens[0]=(await register(s,tokens[0])).token;const mixer=await register(s,tokens[2]);s.recordsList(tokens[0],id);s.adjudicateManual(tokens[0],id,{confirmed:true,winner:'wolves',version:0,revision:0});assert.equal(s.statistics(tokens[0]).losses,1);const result=s.statistics(mixer.token);assert.equal(result.played,1);assert.equal(result.resolved,0);assert.equal(result.winRate,null);assert.equal(result.roles[0].role,'mixer');}finally{s.close();}
 const recordOnly=custom(['seer','villager']);try{const token=(await register(recordOnly.s,recordOnly.tokens[0])).token;recordOnly.s.recordsList(token,recordOnly.id);recordOnly.s.finishManualRecord(token,recordOnly.id,{confirmed:true,version:0,revision:0});const result=recordOnly.s.statistics(token);assert.equal(result.played,1);assert.equal(result.resolved,0);assert.equal(result.winRate,null);}finally{recordOnly.s.close();}
 const plain=manualGame();try{const token=(await register(plain.s,plain.tokens[0])).token;endManual(plain.s,token,plain.id);const d=plain.s.recordsList(token,plain.id).own!;plain.s.saveRecord(token,plain.id,d.revision,document([]));plain.s.commitManual(token,plain.id,d.revision+1);assert.equal(plain.s.snapshot(plain.id).manual!.status,'ended');assert.equal(plain.s.statistics(token).played,1);assert.equal(plain.s.statistics(token).resolved,0);}finally{plain.s.close();}
});
test('admin simulated games never become personal statistics after runtime cleanup',async()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,true,()=>now),guest=randomBytes(32).toString('hex');s.issueSession(guest);try{await s.auth.createAccount('stats_admin','synthetic-password','合成管理员','admin');const {token}=await s.auth.login(guest,'stats_admin','synthetic-password'),room=s.create(token,'合成管理员').room;s.configure(token,room.id,{dealMethod:'online',gameMode:'manual'});s.select(token,room.id,1);s.fillTestPlayers(token,room.id);s.setReady(token,room.id,true,s.snapshot(room.id).preparation.settingsRevision);s.deal(token,room.id);s.confirmIdentity(token,room.id);s.start(token,room.id);const d=s.recordsList(token,room.id).own!;s.saveRecord(token,room.id,d.revision,document(Array.from({length:12},(_,i)=>i+1)));s.commitManual(token,room.id,d.revision+1);assert.equal(s.snapshot(room.id).manual!.status,'ended');assert.equal(s.statistics(token).played,0);now+=25*3600000;assert.deepEqual(s.cleanupExpiredRooms(),[room.id]);assert.equal(s.statistics(token).played,0);}finally{s.close();}
});
