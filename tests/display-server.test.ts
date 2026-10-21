import {backupDatabase,restoreDatabase} from '../packages/storage/databaseBackup.js';
import {managementFixture} from './helpers/management-fixture.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
import {manualGame,endManual} from './helpers/rematch.js';
const command=(action:'create'|'rotate'|'revoke',revision:number)=>({action,revision,confirmed:true as const});
test('real public timed day freezes through pause and resumes after the shared countdown',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now);
 try{const f=managementFixture(s),link=s.displayCommand(f.tokens[0],f.id,command('create',0));now+=500000;s.tickNights();s.enterDay(f.tokens[0],f.id);
  const d=(action:string,seat=1,extra={})=>s.dayCommand(f.tokens[seat-1],f.id,{action,turnId:s.snapshot(f.id).day!.turnId,...extra} as never);
  d('signup',2,{join:true});d('signup',3,{join:true});d('close_signup');assert.equal(s.readDisplay(link.token!).phase.label,'警长竞选发言');assert.ok(s.readDisplay(link.token!).timer?.running);
  now+=1234;f.command(1,'pause');assert.equal(s.snapshot(f.id).day!.deadline,null);const remaining=s.snapshot(f.id).control!.remainingMs!;assert.ok(remaining>0);assert.deepEqual(s.readDisplay(link.token!).timer,{milliseconds:remaining,running:false});now+=100000;s.tickNights();assert.deepEqual(s.readDisplay(link.token!).timer,{milliseconds:remaining,running:false});
  f.command(1,'resume');assert.deepEqual(s.readDisplay(link.token!).timer,{milliseconds:5000,running:true});now+=5000;s.tickNights();assert.equal(s.readDisplay(link.token!).status,'running');assert.deepEqual(s.readDisplay(link.token!).timer,{milliseconds:remaining,running:true});
 }finally{s.close();}
});
test('display link persists, rotates with CAS and follows a rematch without revealing old facts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-display-')),file=join(dir,'db');let {s,tokens,id}=manualGame(file);
 try{const link=s.displayCommand(tokens[0],id,command('create',0));assert.ok(link.token);assert.throws(()=>s.displayStatus(tokens[1],id),/HOST_ONLY/);assert.throws(()=>s.displayCommand(tokens[1],id,command('revoke',1)),/HOST_ONLY/);
  s.close();s=new LobbyStore(file);assert.deepEqual(s.displayStatus(tokens[0],id),link);const competing=new LobbyStore(file);try{const next=s.displayCommand(tokens[0],id,command('rotate',1));assert.notEqual(next.token,link.token);assert.throws(()=>competing.displayCommand(tokens[0],id,command('rotate',1)),/STALE_DISPLAY/);assert.throws(()=>s.readDisplay(link.token!),/DISPLAY_UNAVAILABLE/);
   endManual(s,tokens[0],id);assert.equal(s.readDisplay(next.token!).phase.kind,'ended');s.rematch(tokens[0],id,{requestId:randomUUID(),expectedGameId:id});const view=s.readDisplay(next.token!);assert.equal(view.gameNumber,2);assert.equal(view.phase.kind,'preparation');assert.deepEqual(view.dead,[]);
   s.displayCommand(tokens[0],id,command('revoke',2));assert.throws(()=>s.readDisplay(next.token!),/DISPLAY_UNAVAILABLE/);
  }finally{competing.close();}
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('observer reads do not extend room retention and cleanup revokes the capability',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now),token=randomBytes(32).toString('hex');s.issueSession(token);const id=s.create(token,'Synthetic').room.id;
 try{const link=s.displayCommand(token,id,command('create',0));for(let hour=1;hour<=25;hour++){now=1000+hour*3600000;assert.ok(s.readDisplay(link.token!));}assert.deepEqual(s.cleanupExpiredRooms(),[id]);assert.throws(()=>s.readDisplay(link.token!),/DISPLAY_UNAVAILABLE/);}finally{s.close();}
});
test('anonymous display GET creates no session and grants no player or manager API authority',async()=>{
 const app=await createServer({dbPath:':memory:'}),s=app.store,host=randomBytes(32).toString('hex'),guest=randomBytes(32).toString('hex');s.issueSession(host);s.issueSession(guest);const {room}=s.create(host,'Synthetic');s.join(guest,room.code,'Other');
 try{await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();assert.ok(a&&typeof a!=='string');const base='http://127.0.0.1:'+a.port,path='/api/rooms/'+room.id+'/display';const headers={cookie:'wolf_session='+host,'content-type':'application/json','X-Wolf-Game-Id':room.gameId};
  assert.equal((await fetch(base+path,{headers:{cookie:'wolf_session='+guest}})).status,403);
  const created=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(command('create',0))});assert.equal(created.status,200);const link=await created.json();const response=await fetch(base+'/api/displays/'+link.token);assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).roomCode,room.code);
  for(const suffix of ['', '/identity','/night/private'])assert.equal((await fetch(base+'/api/rooms/'+room.id+suffix,{headers:{cookie:'wolf_session='+link.token}})).status,401);
  assert.equal((await fetch(base+'/api/rooms/'+room.id+'/seat',{method:'POST',headers:{...headers,cookie:'wolf_session='+link.token},body:'{"seat":1}'})).status,401);
  assert.equal((await fetch(base+path,{method:'POST',headers,body:JSON.stringify(command('rotate',0))})).status,409);assert.equal((await fetch(base+'/api/displays/'+link.token+'?secret=1')).status,400);
  const revoke=await fetch(base+path,{method:'POST',headers,body:JSON.stringify(command('revoke',1))});assert.equal(revoke.status,200);assert.equal((await fetch(base+'/api/displays/'+link.token)).status,404);assert.equal(s.snapshot(room.id).seats.filter(x=>x.memberId).length,0);
 }finally{await app.close();}
});

test('display links survive verified backup and restore with their room ownership',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-display-backup-')),file=join(dir,'db'),s=new LobbyStore(file),host=randomBytes(32).toString('hex');s.issueSession(host);const room=s.create(host,'Synthetic').room;
 try{const link=s.displayCommand(host,room.id,command('create',0));const info=await backupDatabase({source:file,output:join(dir,'backup')});await restoreDatabase({source:info.path,output:join(dir,'restored'),sha256:info.sha256});const restored=new LobbyStore(join(dir,'restored'));try{assert.deepEqual(restored.displayStatus(host,room.id),link);assert.equal(restored.readDisplay(link.token!).roomCode,room.code);}finally{restored.close();}}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('temporary management does not grant display link management',()=>{
 const s=new LobbyStore(':memory:');try{const f=managementFixture(s);f.command(1,'delegate',{seat:6});assert.throws(()=>s.displayStatus(f.tokens[5],f.id),/HOST_ONLY/);assert.ok(s.displayCommand(f.tokens[0],f.id,command('create',0)).enabled);}finally{s.close();}
});
test('an isolated admin test room cannot issue a display link',async()=>{
 const s=new LobbyStore(':memory:',undefined,true),guest=randomBytes(32).toString('hex');s.issueSession(guest);try{await s.auth.createAccount('display_admin','synthetic-password','Synthetic','admin');const {token}=await s.auth.login(guest,'display_admin','synthetic-password'),room=s.create(token,'Synthetic').room;s.select(token,room.id,1);s.fillTestPlayers(token,room.id);assert.throws(()=>s.displayCommand(token,room.id,command('create',0)),/TEST_ROOM_PRIVATE/);}finally{s.close();}
});
