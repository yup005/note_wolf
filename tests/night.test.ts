import {test} from 'node:test';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createNight,beginNight,advanceNight,nightCommand,privateNight,publicNight,type NightPlayer} from '../packages/domain/night.js';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
const players:NightPlayer[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','seer','hunter','idiot'].map((role,i)=>({seat:i+1,role:role as NightPlayer['role']}));
function game(){const s=createNight(players,1000);beginNight(s,1000,()=>0);return s;}
test('host starts night without repeated player readiness; wolf deadline, vote changes, tie and privacy are authoritative',()=>{
 const waiting=createNight(players,1000);beginNight(waiting,1000,()=>0);assert.equal(waiting.phase,'wolves');assert.equal('readySeats' in publicNight(waiting,1000),false);
 const s=game();assert.equal(s.deadline,181000);assert.equal(s.confirmer,1);let turnId=s.turnId;
 nightCommand(s,1,{action:'vote',target:5,turnId},2000);nightCommand(s,1,{action:'vote',target:6,turnId},3000);nightCommand(s,2,{action:'vote',target:7,turnId},3000);
 assert.equal(privateNight(s,3).votes!.find(v=>v.seat===1)!.target,6);assert.deepEqual(privateNight(s,5),{turnId,kind:'waiting'});
 assert.throws(()=>nightCommand(s,5,{action:'vote',target:1,turnId},3000),/NOT_YOUR_TURN/);
 assert.throws(()=>nightCommand(s,2,{action:'confirm_wolves',turnId},3000),/CONFIRMER_ONLY/);
 nightCommand(s,1,{action:'confirm_wolves',turnId},4000,()=>1);assert.equal(s.knife,7);assert.equal(s.phase,'eyes_closed');assert.equal(s.deadline,9000);
 assert.throws(()=>nightCommand(s,1,{action:'vote',target:5,turnId},5000),/STALE_TURN/);
 const publicJson=JSON.stringify(publicNight(s,4000));for(const secret of ['knife','confirmer','votes','role','result','poison'])assert.equal(publicJson.includes(secret),false);
 advanceNight(s,8999);assert.equal(s.phase,'eyes_closed');advanceNight(s,9000);assert.equal(s.phase,'witch');assert.equal(s.deadline,69000);
});
test('full night times out with empty knife and no unconfirmed medication; all role windows remain',()=>{
 const s=game();advanceNight(s,181000);assert.equal(s.knife,null);assert.equal(s.deadline,186000);advanceNight(s,185999);assert.equal(s.phase,'eyes_closed');advanceNight(s,186000);assert.equal(s.phase,'witch');advanceNight(s,246000);assert.equal(s.antidote,true);assert.equal(s.poison,true);assert.equal(s.deadline,251000);advanceNight(s,250999);assert.equal(s.phase,'eyes_closed');advanceNight(s,251000);assert.equal(s.phase,'seer');advanceNight(s,281000);assert.equal(s.deadline,286000);advanceNight(s,285999);assert.equal(s.phase,'eyes_closed');advanceNight(s,286000);assert.equal(s.phase,'hunter');advanceNight(s,316000);assert.equal(s.phase,'first_night_complete');assert.equal(s.deadline,null);
});
test('witch cannot self-save or use both drugs, retries do not consume twice; poisoned hunter only sees skill status',()=>{
 const s=game();nightCommand(s,1,{action:'vote',target:9,turnId:s.turnId},1100);nightCommand(s,1,{action:'confirm_wolves',turnId:s.turnId},1200);advanceNight(s,11200);
 const turnId=s.turnId;assert.equal(privateNight(s,9).knife,9);assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'save',target:9,turnId},12000),/CANNOT_SELF_SAVE/);
 nightCommand(s,9,{action:'witch',choice:'poison',target:11,turnId},12000);const count=s.events.length;nightCommand(s,9,{action:'witch',choice:'poison',target:11,turnId},12500);assert.equal(s.events.length,count);
 assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'save',target:9,turnId},13000),/ALREADY_COMMITTED/);assert.equal(s.phase,'eyes_closed');assert.equal(s.antidote,true);assert.equal(s.poison,false);
 advanceNight(s,60000);assert.equal(s.phase,'hunter');assert.equal(privateNight(s,11).canShoot,false);assert.equal('knife' in privateNight(s,11),false);
});
test('seer only sees good or wolf during own window, cannot recheck, and absent roles still keep windows',()=>{
 const s=game();advanceNight(s,251000);let turnId=s.turnId;nightCommand(s,10,{action:'seer',target:1,turnId},252000);assert.equal(privateNight(s,10).result,'wolf');assert.equal('role' in privateNight(s,10),false);
 assert.throws(()=>nightCommand(s,10,{action:'seer',target:2,turnId},253000),/ALREADY_COMMITTED/);advanceNight(s,281000);assert.equal(privateNight(s,10).skillReceipt?.result,'wolf');assert.equal(privateNight(s,5).skillReceipt,undefined);advanceNight(s,286000);assert.deepEqual(privateNight(s,10),{turnId:s.turnId,kind:'waiting'});
 const virtual=game();virtual.players=virtual.players.map(p=>p.role==='seer'?{...p,role:'villager'}:p);advanceNight(virtual,251000);assert.equal(virtual.phase,'seer');assert.equal(virtual.deadline,281000);
});
function testRoom(db:LobbyStore){const {room}=db.create('host','房主');db.select('host',room.id,1);db.fillTestPlayers('host',room.id);db.setReady('host',room.id,true,0);db.deal('host',room.id);db.confirmIdentity('host',room.id);db.start('host',room.id);db.enterNight('host',room.id);return room.id;}
test('store persists deadlines, rejects host role substitution, synthetic-only test control and phase retries',()=>{
 let now=1000;const db=new LobbyStore(':memory:',()=>42,true,()=>now);try{
  const id=testRoom(db);assert.equal(db.snapshot(id).night!.phase,'wolves');
  const wolf=db.snapshot(id).seats.find(s=>s.isTestPlayer&&db.testPlayerIdentity('host',id,s.memberId!).role==='wolf')!;
  const p=db.testNightPrivate('host',id,wolf.memberId!);assert.equal(p.kind,'wolves');db.testNightCommand('host',id,wolf.memberId!,{action:'vote',turnId:p.turnId,target:12});
  const rev=db.snapshot(id).revision;db.testNightCommand('host',id,wolf.memberId!,{action:'vote',turnId:p.turnId,target:11});assert.equal(db.snapshot(id).revision,rev);
  assert.throws(()=>db.testNightPrivate('host',id,db.view('host',id).me.id),/NOT_TEST_PLAYER/);
  const before=db.snapshot(id).night!.deadline;db.enterNight('host',id);assert.equal(db.snapshot(id).night!.deadline,before);
  now=181000;db.tickNights();assert.equal(db.snapshot(id).night!.phase,'eyes_closed');assert.throws(()=>db.testNightCommand('host',id,wolf.memberId!,{action:'vote',turnId:p.turnId,target:12}),/STALE_TURN/);
 }finally{db.close();}
});
test('HTTP night public messages exclude secrets; ordinary host cannot target another player and test routes stay gated',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',allowTestPlayers:true,now:()=>now});try{
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const base=`http://127.0.0.1:${address.port}`;
  const cookie=(await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];const headers={cookie,'Content-Type':'application/json'};
  const post=(path:string,data:unknown={})=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(data)});
  const view=await (await post('/api/rooms',{nickname:'房主',requestId:crypto.randomUUID()})).json();const path='/api/rooms/'+view.room.id;
  await post(path+'/seat',{seat:1});await post(path+'/test-players');await post(path+'/ready',{ready:true,settingsRevision:0});await post(path+'/deal');await post(path+'/identity/confirm');await post(path+'/start');await post(path+'/night/enter');
  let snap=await (await fetch(base+path,{headers})).json();assert.equal(snap.room.night.phase,'wolves');assert.equal((await post(path+'/night/ready',{turnId:snap.room.night.turnId})).status,404);
  snap=await (await fetch(base+path,{headers})).json();for(const secret of ['knife','votes','confirmer','canShoot','result'])assert.equal(JSON.stringify(snap.room).includes(secret),false);
  assert.equal((await fetch(base+path+'/night/private?actorId=x',{headers})).status,400);
  assert.equal((await post(path+'/night/command',{action:'vote',turnId:snap.room.night.turnId,target:3,actorId:'x'})).status,400);
  const guestCookie=(await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];await fetch(base+'/api/rooms/join',{method:'POST',headers:{...headers,cookie:guestCookie},body:JSON.stringify({nickname:'访客',code:view.room.code})});
  const bot=snap.room.seats.find((s:{isTestPlayer:boolean})=>s.isTestPlayer);assert.equal((await fetch(base+path+`/test-players/${bot.memberId}/night/private`,{headers:{cookie:guestCookie}})).status,403);
  now=400000;await fetch(base+'/api/health');snap=await (await fetch(base+path,{headers})).json();assert.equal(snap.room.night.phase,'first_night_complete');assert.equal(snap.room.seats.filter((s:{memberId:string})=>s.memberId).length,12);
 }finally{await app.close();}
});


test('SQLite restart preserves night deadline, confirmer, votes and medication without restarting the night',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wolf-night-'));const file=join(folder,'night.db');let now=1000;let db=new LobbyStore(file,()=>42,true,()=>now);
 try{
  const id=testRoom(db);
  const wolf=db.snapshot(id).seats.find(s=>s.isTestPlayer&&db.testPlayerIdentity('host',id,s.memberId!).role==='wolf')!;
  const before=db.testNightPrivate('host',id,wolf.memberId!);db.testNightCommand('host',id,wolf.memberId!,{action:'vote',target:12,turnId:before.turnId});const deadline=db.snapshot(id).night!.deadline;
  db.close();now=5000;db=new LobbyStore(file,()=>42,true,()=>now);assert.equal(db.snapshot(id).night!.deadline,deadline);const after=db.testNightPrivate('host',id,wolf.memberId!);assert.equal(after.confirmer,before.confirmer);assert.equal(after.myVote,12);
  db.testNightAdvance('host',id);db.testNightAdvance('host',id);const witch=db.snapshot(id).seats.find(s=>s.isTestPlayer&&db.testPlayerIdentity('host',id,s.memberId!).role==='witch');
  const witchId=witch?.memberId??db.view('host',id).me.id;const witchCard=witch?db.testNightPrivate('host',id,witchId):db.nightPrivate('host',id);
  const cmd={action:'witch' as const,choice:'poison' as const,target:12,turnId:witchCard.turnId};if(witch)db.testNightCommand('host',id,witchId,cmd);else db.nightCommand('host',id,cmd);
  db.close();db=new LobbyStore(file,()=>42,true,()=>now);const restored=witch?db.testNightPrivate('host',id,witchId):db.nightPrivate('host',id);assert.equal(restored.poison,false);assert.equal(restored.committed,true);
  now=1000000;db.tickNights();assert.equal(db.snapshot(id).night!.phase,'first_night_complete');
 }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});

test('independent real HTTP players keep night role permissions even when the host is a seer',async()=>{
 const app=await createServer({dbPath:':memory:',now:()=>1000});try{
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const base=`http://127.0.0.1:${address.port}`;
  const tokens=Array.from({length:12},(_,i)=>(i+1).toString(16).padStart(64,'0'));for(const token of tokens)app.store.issueSession(token);
  const roles=['seer','wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','hunter','idiot'] as const;
  const room=app.store.create(tokens[0],'真实房主').room;app.store.configure(tokens[0],room.id,{dealMethod:'physical',gameMode:'automatic'});
  for(let i=0;i<12;i++){if(i)app.store.join(tokens[i],room.code,'玩家'+i);app.store.select(tokens[i],room.id,i+1);app.store.setReady(tokens[i],room.id,true,1);}app.store.deal(tokens[0],room.id);
  for(let i=0;i<12;i++)app.store.submitIdentity(tokens[i],room.id,roles[i]);app.store.start(tokens[0],room.id);app.store.enterNight(tokens[0],room.id);
  const turnId=app.store.snapshot(room.id).night!.turnId;
  const request=(player:number,path:string,body?:unknown)=>fetch(base+`/api/rooms/${room.id}`+path,{method:body?'POST':'GET',headers:{cookie:`wolf_session=${tokens[player]}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.deepEqual(await (await request(0,'/night/private')).json(),{turnId,kind:'waiting'});
  assert.equal((await request(1,'/night/enter',{})).status,403);assert.equal((await request(1,'/night/begin',{turnId})).status,403);
  assert.equal((await request(0,'/night/command',{action:'vote',turnId,target:6})).status,403);
  assert.equal((await request(1,'/night/command',{action:'vote',turnId,target:6})).status,200);
  const peer=await (await request(2,'/night/private')).json();assert.equal(peer.votes[0].target,6);assert.equal(peer.kind,'wolves');
  assert.deepEqual(await (await request(5,'/night/private')).json(),{turnId,kind:'waiting'});
  assert.equal((await request(0,`/test-players/${app.store.view(tokens[1],room.id).me.id}/night/private`)).status,404);
  assert.equal((await request(0,'/night/private?seat=2')).status,400);
 }finally{await app.close();}
});


test('old phone-ready rooms migrate to host-only waiting without inventing readiness or resetting active games',()=>{
 const folder=mkdtempSync(join(tmpdir(),'wolf-readiness-'));const file=join(folder,'night.db');let db=new LobbyStore(file,()=>42,true,()=>1000);
 try{
  const id=testRoom(db);const publicState=db.snapshot(id).night!;db.close();
  const old=new Database(file);const row=old.prepare('SELECT state FROM night_games WHERE room_id=?').get(id) as {state:string};const state=JSON.parse(row.state);state.phase='phone_ready';state.deadline=null;state.readySeats=[2,3];state.confirmer=null;old.prepare('UPDATE night_games SET state=? WHERE room_id=?').run(JSON.stringify(state),id);old.close();
  db=new LobbyStore(file,()=>42,true,()=>1000);const migrated=db.snapshot(id).night!;assert.equal(migrated.phase,'awaiting_host');assert.equal(migrated.turnId,publicState.turnId);assert.equal('readySeats' in migrated,false);
  db.enterNight('host',id);assert.equal(db.snapshot(id).night!.phase,'wolves');const deadline=db.snapshot(id).night!.deadline;
  db.close();db=new LobbyStore(file,()=>42,true,()=>5000);assert.equal(db.snapshot(id).night!.phase,'wolves');assert.equal(db.snapshot(id).night!.deadline,deadline);
 }finally{db.close();rmSync(folder,{recursive:true,force:true});}
});

test('development night actor recommendation follows the actionable role and is host-only',()=>{
 const db=new LobbyStore(':memory:',()=>42,true,()=>1000);try{
  const id=testRoom(db);const wolf=db.testNightActor('host',id);assert.equal(typeof wolf.actorId,'string');
  const privateState=wolf.actorId===db.view('host',id).me.id?db.nightPrivate('host',id):db.testNightPrivate('host',id,wolf.actorId!);assert.equal(privateState.kind,'wolves');assert.equal(privateState.confirmer,db.snapshot(id).seats.find(s=>s.memberId===wolf.actorId)!.number);
  db.join('guest',db.snapshot(id).code,'访客');assert.throws(()=>db.testNightActor('guest',id),/HOST_ONLY/);
  db.testNightAdvance('host',id);assert.equal(db.testNightActor('host',id).actorId,null);
  for(const expected of ['witch','seer','hunter']){
   db.testNightAdvance('host',id);const next=db.testNightActor('host',id);assert.equal((next.actorId===db.view('host',id).me.id?db.nightPrivate('host',id):db.testNightPrivate('host',id,next.actorId!)).kind,expected);db.testNightAdvance('host',id);
  }
  assert.equal(db.testNightActor('host',id).actorId,null);
 }finally{db.close();}
});
