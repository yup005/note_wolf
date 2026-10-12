import {seedTestAdmin} from './helpers/test-admin.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
import type {DayCommand} from '../packages/contracts/day.js';
const roles=['seer','wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','hunter','idiot'] as const;
const tokens=roles.map((_,i)=>(i+1).toString(16).padStart(64,'0'));
function realRoom(db:LobbyStore){for(const token of tokens)db.issueSession(token);const room=db.create(tokens[0],'房主').room;db.configure(tokens[0],room.id,{dealMethod:'physical',gameMode:'automatic'});for(let i=0;i<12;i++){if(i)db.join(tokens[i],room.code,'玩家'+(i+1));db.select(tokens[i],room.id,i+1);db.setReady(tokens[i],room.id,true,1);}db.deal(tokens[0],room.id);for(let i=0;i<12;i++)db.submitIdentity(tokens[i],room.id,roles[i]);db.start(tokens[0],room.id);db.enterNight(tokens[0],room.id);return room.id;}
test('real HTTP players keep day permissions, public voting is secret until result and forged actor fields are rejected',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',now:()=>now});try{
  const id=realRoom(app.store);now=1000000;app.store.tickNights();await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const root=`http://127.0.0.1:${address.port}/api/rooms/${id}`;
  const req=(seat:number,path:string,body?:unknown)=>fetch(root+path,{method:body?'POST':'GET',headers:{cookie:`wolf_session=${tokens[seat-1]}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.equal((await req(2,'/day/enter',{})).status,403);assert.equal((await req(1,'/day/enter',{})).status,200);const start=app.store.snapshot(id).day!.turnId;await req(1,'/day/enter',{});assert.equal(app.store.snapshot(id).day!.turnId,start);
  const command=(seat:number,body:Record<string,unknown>)=>req(seat,'/day/command',{...body,turnId:app.store.snapshot(id).day!.turnId});
  assert.equal((await command(2,{action:'close_signup'})).status,403);await command(2,{action:'signup',join:true});await command(3,{action:'signup',join:true});await command(1,{action:'close_signup'});while(app.store.snapshot(id).day!.phase==='sheriff_speech')await command(1,{action:'end_speech'});await command(1,{action:'close_withdraw'});await command(1,{action:'start_vote',method:'phone',visibility:'totals',seconds:30});
  assert.equal((await command(2,{action:'vote',target:2})).status,403);assert.equal((await command(4,{action:'vote',target:2,actorId:app.store.view(tokens[4],id).me.id})).status,400);assert.equal((await command(4,{action:'vote',target:2})).status,200);
  const mine=await (await req(4,'/day/private')).json();const peer=await (await req(5,'/day/private')).json();assert.equal(mine.myVote,2);assert.equal(peer.myVote,null);assert.equal((await req(4,'/day/private?seat=5')).status,400);
  const pub=await (await req(5,'')).json();assert.equal(pub.room.day.result,null);assert.equal('ballots' in pub.room.day.vote,false);assert.equal(JSON.stringify(pub.room.day).includes('role'),false);
  now+=30000;await req(1,'');const result=app.store.snapshot(id).day!;assert.equal(result.phase,'vote_result');assert.equal(result.result!.ballots,undefined);assert.deepEqual(result.result!.leaders,[2]);assert.equal((await req(1,'/test-players/'+app.store.view(tokens[1],id).me.id+'/day/private')).status,404);assert.equal((await req(1,'/day/test-actor')).status,404);
  await command(1,{action:'continue'});await command(1,{action:'continue'});await command(1,{action:'continue'});await command(1,{action:'speech_mode',mode:'free'});await command(1,{action:'end_speech'});assert.equal((await command(1,{action:'start_vote',method:'offline',visibility:'totals',seconds:5})).status,200);const counts=app.store.snapshot(id).day!.vote!.candidates.map(seat=>({seat,votes:seat===3?2:0}));assert.equal((await command(4,{action:'offline_results',counts})).status,403);assert.equal((await command(1,{action:'offline_results',counts:[{seat:3,votes:-1}]})).status,400);assert.equal((await command(1,{action:'offline_results',counts:[...counts,{seat:257,votes:1}]})).status,400);assert.equal(app.store.snapshot(id).day!.deadline,null);now+=60000;app.store.tickNights();assert.equal(app.store.snapshot(id).day!.phase,'voting');assert.equal((await command(1,{action:'offline_results',counts})).status,200);assert.deepEqual(app.store.snapshot(id).day!.result!.leaders,[3]);assert.equal(app.store.snapshot(id).day!.result!.ballots,undefined);

 }finally{await app.close();}
});
test('SQLite restart preserves first-day turn, votes and deadline; retries do not duplicate or reset the day',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wolf-day-'));const file=join(folder,'day.db');let now=1000;let db=new LobbyStore(file,()=>42,false,()=>now);try{
  const id=realRoom(db);now=1000000;db.tickNights();db.enterDay(tokens[0],id);const cmd=(seat:number,body:Record<string,unknown>)=>db.dayCommand(tokens[seat-1],id,{...body,turnId:db.snapshot(id).day!.turnId} as DayCommand);
  cmd(2,{action:'signup',join:true});cmd(3,{action:'signup',join:true});cmd(1,{action:'close_signup'});while(db.snapshot(id).day!.phase==='sheriff_speech')cmd(1,{action:'end_speech'});cmd(1,{action:'close_withdraw'});cmd(1,{action:'start_vote',method:'phone',visibility:'individual',seconds:30});cmd(4,{action:'vote',target:2});const before=db.snapshot(id).day!;
  db.close();now+=5000;db=new LobbyStore(file,()=>42,false,()=>now);assert.equal(db.snapshot(id).day!.deadline,before.deadline);assert.equal(db.snapshot(id).day!.turnId,before.turnId);assert.equal(db.dayPrivate(tokens[3],id).myVote,2);db.enterDay(tokens[0],id);assert.equal(db.snapshot(id).day!.deadline,before.deadline);cmd(4,{action:'vote',target:2});assert.equal(db.snapshot(id).day!.vote!.submittedCount,1);now=before.deadline!;db.tickNights();assert.equal(db.snapshot(id).day!.phase,'vote_result');
 }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});

test('development day helpers authorize host, never act as a real player and are absent without enablement',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',allowTestPlayers:true,now:()=>now});try{
  const host='a'.repeat(64);seedTestAdmin(app.store,host);const room=app.store.create(host,'测试房主').room;app.store.select(host,room.id,1);app.store.fillTestPlayers(host,room.id);app.store.setReady(host,room.id,true,0);app.store.deal(host,room.id);app.store.confirmIdentity(host,room.id);app.store.start(host,room.id);app.store.enterNight(host,room.id);now=1000000;app.store.tickNights();app.store.enterDay(host,room.id);
  const guest='b'.repeat(64);app.store.issueSession(guest);assert.throws(()=>app.store.join(guest,room.code,'访客'),/TEST_ROOM_PRIVATE/);assert.throws(()=>app.store.testDayActor(guest,room.id),/ADMIN_ONLY/);assert.throws(()=>app.store.testDayPrivate(host,room.id,app.store.view(host,room.id).me.id),/NOT_TEST_PLAYER/);
  const bot=app.store.snapshot(room.id).seats.find(s=>s.isTestPlayer)!;const card=app.store.testDayPrivate(host,room.id,bot.memberId!);assert.equal(card.seat,bot.number);assert.throws(()=>app.store.testDayCommand(host,room.id,bot.memberId!,{action:'close_signup',turnId:card.turnId}),/HOST_ONLY/);assert.equal(app.store.testDayActor(host,room.id).actorId,app.store.view(host,room.id).me.id);
  app.store.dayCommand(host,room.id,{action:'signup',join:false,turnId:card.turnId});assert.equal(app.store.testDayActor(host,room.id).actorId,app.store.snapshot(room.id).seats[1].memberId);
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const base=`http://127.0.0.1:${address.port}`;
  const headers={cookie:`wolf_session=${host}`};for(let i=0;i<305;i++)assert.equal((await fetch(base+'/api/health',{headers})).status,200);assert.equal(app.store.isDevelopmentTestHost(guest),false);
 }finally{await app.close();}
});
