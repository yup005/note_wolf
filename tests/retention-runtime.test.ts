import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import {createDay} from '../packages/domain/day.js';
import type {NightState} from '../packages/domain/night.js';
import {firstDayRules} from '../packages/contracts/day.js';

const day=86400000,token='1'.repeat(64);
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'wolf-retention-runtime-')),file=join(dir,'synthetic.sqlite');let now=1000;
 const app=await createServer({dbPath:file,allowTestPlayers:true,now:()=>now});app.store.issueSession(token);
 await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));
 const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
 const base=`http://127.0.0.1:${address.port}`,db=new Database(file);db.pragma('foreign_keys=ON');
 const request=(path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:`wolf_session=${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const create=async()=>{const response=await request('/api/rooms',{nickname:'Synthetic',requestId:randomUUID()});assert.equal(response.status,200);return (await response.json()).room as {id:string;code:string};};
 const activity=(id:string)=>(db.prepare('SELECT last_activity_at AS at FROM rooms WHERE id=?').get(id) as {at:number}|undefined)?.at;
 let stopped=false;const stop=async()=>{if(!stopped){stopped=true;await app.close();}};
 return {stop,app,db,file,base,request,create,activity,getNow:()=>now,setNow:(value:number)=>{now=value;},async close(){await stop();db.close();rmSync(dir,{recursive:true,force:true});}};
}
function beginGame(f:Awaited<ReturnType<typeof fixture>>,id:string){
 const s=f.app.store;s.select(token,id,1);s.configure(token,id,{dealMethod:'online',gameMode:'automatic'});s.fillTestPlayers(token,id);s.setReady(token,id,true,s.snapshot(id).preparation.settingsRevision);s.deal(token,id);s.confirmIdentity(token,id);s.start(token,id);s.enterNight(token,id);
}

test('successful profile edits extend affected memberships but rejected edits do not',async()=>{
 const f=await fixture();try{
  const room=await f.create();
  const registration=await f.request('/api/auth/register',{username:'retention_profile',password:'synthetic-password',nickname:'Profile'});
  assert.equal(registration.status,200);const cookie=registration.headers.get('set-cookie')!.split(';')[0];
  const edit=(nickname:string)=>fetch(f.base+'/api/auth/profile',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({nickname})});
  f.setNow(2000);assert.equal((await edit('Updated')).status,200);assert.equal(f.activity(room.id),2000);
  f.setNow(3000);assert.equal((await edit('')).status,400);assert.equal(f.activity(room.id),2000);
 }finally{await f.close();}
});

test('runtime activity extends successful room writes, but reads, polling, subscription, failed writes and ticks do not',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const f=await fixture();let socket:Socket|undefined;
 try{
  const r=await f.create();assert.equal(f.activity(r.id),1000);
  f.setNow(2000);assert.equal((await f.request(`/api/rooms/${r.id}/seat`,{seat:1})).status,200);assert.equal(f.activity(r.id),2000);
  beginGame(f,r.id);
  f.setNow(3000);assert.equal((await f.request(`/api/rooms/${r.id}`)).status,200);await f.request('/api/session');
  assert.equal((await f.request(`/api/rooms/${r.id}/seat`,{seat:99})).status,400);
  const clientId=randomUUID();assert.equal((await f.request(`/api/rooms/${r.id}/voice`,{action:'claim',clientId})).status,200);
  assert.equal((await f.request(`/api/rooms/${r.id}/voice`,{action:'poll',clientId})).status,200);
  socket=io(f.base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${token}`},reconnection:false});
  await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:r.id},()=>resolve()));
  t.mock.timers.tick(1000);assert.equal(f.activity(r.id),2000);
  f.setNow(2000+day-1);t.mock.timers.tick(60000);assert.ok(f.activity(r.id));
  f.setNow(2000+day);t.mock.timers.tick(60000);assert.equal(f.activity(r.id),undefined);
 }finally{socket?.disconnect();await f.close();}
});

test('minute cleanup removes playing and paused games, notifies sockets and never rebuilds deleted control rows',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const f=await fixture();const sockets:Socket[]=[];
 try{
  const playing=await f.create(),paused=await f.create();beginGame(f,playing.id);beginGame(f,paused.id);
  const control=f.app.store.snapshot(paused.id).control!;assert.equal((await f.request(`/api/rooms/${paused.id}/control`,{action:'pause',confirmed:true,version:control.version})).status,200);
  for(const r of [playing,paused]){
   const socket=io(f.base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${token}`},reconnection:false});sockets.push(socket);
   await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
   await new Promise<void>(resolve=>socket.emit('room:subscribe',{roomId:r.id},()=>resolve()));
  }
  const events=sockets.map(socket=>new Promise<unknown>(resolve=>socket.once('room:expired',resolve))),disconnected=sockets.map(socket=>new Promise<string>(resolve=>socket.once('disconnect',resolve)));
  f.setNow(1000+day);t.mock.timers.tick(60000);
  assert.equal((f.db.prepare('SELECT COUNT(*) AS n FROM rooms').get() as {n:number}).n,0);
  assert.deepEqual(await Promise.all(events),[playing,paused].map(r=>({roomId:r.id,error:'ROOM_NOT_FOUND',message:'房间已清理，请返回首页'})));
  assert.deepEqual(await Promise.all(disconnected),['io server disconnect','io server disconnect']);
  assert.equal((f.db.prepare('SELECT COUNT(*) AS n FROM room_controls').get() as {n:number}).n,0);assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
  await f.stop();t.mock.timers.tick(60000);
 }finally{sockets.forEach(socket=>socket.disconnect());await f.close();}
});

test('startup cleanup honors both favorites and renewable shares and removes only unprotected expired rooms',async()=>{
 const f=await fixture();try{
  const ids=[];for(let i=0;i<4;i++)ids.push((await f.create()).id);
  f.db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run('synthetic-other',ids[0],'0000','good',0,'{}');
  for(const id of ids.slice(1,3)){
   f.db.prepare('INSERT INTO record_rooms VALUES (?,?,?,?,?,1)').run(id,'0000','[]','[]','synthetic-owner');
   f.db.prepare('INSERT INTO record_drafts(id,room_id,owner,author,official,draft) VALUES (?,?,?,?,1,?)').run('draft:'+id,id,'synthetic-owner','Synthetic','{}');
  }
  f.db.prepare('INSERT INTO record_favorites VALUES (?,?,0)').run('synthetic-other','draft:'+ids[1]);
  f.db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?,0)').run('synthetic','synthetic','Synthetic','fake-hash','fake-salt','user','disabled');
  f.db.prepare('INSERT INTO record_share_links VALUES (?,?,?,0,1,0)').run('draft:'+ids[2],'synthetic','a'.repeat(64));
  await f.stop();f.setNow(1000+day);
  const restarted=await createServer({dbPath:f.file,now:f.getNow});try{assert.deepEqual((f.db.prepare('SELECT id FROM rooms ORDER BY id').all() as {id:string}[]).map(r=>r.id),ids.slice(0,3).sort());}finally{await restarted.close();}
 }finally{await f.close();}
});

test('legacy runtime migration grants a single 24h window instead of deleting old rooms on first startup',async()=>{
 const f=await fixture();try{
  const r=await f.create();await f.stop();
  if((f.db.pragma('table_info(rooms)') as {name:string}[]).some(c=>c.name==='last_activity_at'))f.db.exec('DROP INDEX IF EXISTS rooms_last_activity; ALTER TABLE rooms DROP COLUMN last_activity_at;');f.setNow(5*day);
  let restarted=await createServer({dbPath:f.file,now:f.getNow});assert.equal(f.activity(r.id),5*day);await restarted.close();
  f.setNow(6*day-1);restarted=await createServer({dbPath:f.file,now:f.getNow});assert.equal(f.activity(r.id),5*day);await restarted.close();
  f.setNow(6*day);restarted=await createServer({dbPath:f.file,now:f.getNow});assert.equal(f.activity(r.id),undefined);await restarted.close();
 }finally{await f.close();}
});

test('offline clients learn that a room expired on resubscription without treating existing nonmembership as expiry',async()=>{
 const f=await fixture();const sockets:Socket[]=[];
 const subscribe=async(cookie:string,id:string)=>{
  const socket=io(f.base,{transports:['websocket'],extraHeaders:{cookie},reconnection:false});sockets.push(socket);
  await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  return await new Promise<{error?:string}>(resolve=>socket.emit('room:subscribe',{roomId:id},resolve));
 };
 try{
  const expired=await f.create();f.setNow(1000+day);f.app.cleanupExpiredRooms();
  assert.equal((await subscribe(`wolf_session=${token}`,expired.id)).error,'ROOM_NOT_FOUND');
  const kept=await f.create(),outsider='2'.repeat(64);f.app.store.issueSession(outsider);
  assert.equal((await subscribe(`wolf_session=${outsider}`,kept.id)).error,'NOT_MEMBER');
 }finally{sockets.forEach(socket=>socket.disconnect());await f.close();}
});


test('cleanup preserves completed unpublished automatic records, final evidence and author access after restart',async()=>{
 const f=await fixture();let restarted:Awaited<ReturnType<typeof createServer>>|undefined;
 try{
  const {id}=await f.create();beginGame(f,id);
  // Synthetic terminal fixture exercises persistence rather than gameplay acceptance.
  const n=JSON.parse((f.db.prepare('SELECT state FROM night_games WHERE room_id=?').get(id) as {state:string}).state) as NightState;
  n.phase='first_night_complete';n.knife=null;n.witchChoice=null;
  const d=createDay(n,firstDayRules,1000);d.phase='ended';d.winner='good';d.deadline=null;
  d.revealed=d.players.map(({seat,role})=>({seat,role}));
  d.players.filter(p=>p.role==='wolf').forEach(p=>{p.alive=false;d.deaths.push({seat:p.seat,reason:'exile'});d.events.push({type:'death_exile',seat:p.seat,at:1000});});
  f.db.prepare('INSERT INTO day_games VALUES (?,?)').run(id,JSON.stringify(d));
  const original=f.app.store.recordsList(token,id).own!;
  f.app.store.saveRecord(token,id,original.revision,{...original.document,notes:'Synthetic private note'});
  const imported=f.app.store.importAutomaticRecord(token,id,1);
  assert.equal((f.db.prepare('SELECT ended FROM record_rooms WHERE room_id=?').get(id) as {ended:number}).ended,0);
  f.setNow(1000+day);assert.deepEqual(f.app.store.cleanupExpiredRooms(),[id]);await f.stop();
  restarted=await createServer({dbPath:f.file,now:f.getNow});
  assert.deepEqual(restarted.store.recordsList(token,id).own,imported);
  const published=restarted.store.publishRecord(token,id,imported.revision);
  assert.deepEqual(restarted.store.recordPost(token,published.id).document,imported.document);
  const restored=restarted.store.importAutomaticRecord(token,id,imported.revision);
  assert.deepEqual(restored.document,imported.document);
  const outsider='3'.repeat(64);restarted.store.issueSession(outsider);
  assert.throws(()=>restarted!.store.recordsList(outsider,id),/PARTICIPANT_ONLY/);
  const changed=restarted.store.saveRecord(token,id,restored.revision,{...restored.document,deaths:[]});
  assert.throws(()=>restarted!.store.publishRecord(token,id,changed.revision),/OFFICIAL_UNCOMMITTED/);
  restarted.store.commitManual(token,id,changed.revision);
  assert.equal(restarted.store.publishRecord(token,id,changed.revision).version,2);
  assert.equal(restarted.store.recordPost(token,published.id,1).document.deaths.length,4);
  assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
 }finally{await restarted?.close();await f.close();}
});

test('cleanup preserves ongoing private drafts without granting publish permission or exposing pending night actions',async()=>{
 const f=await fixture();try{
  const {id}=await f.create();beginGame(f,id);const draft=f.app.store.recordsList(token,id).own!;
  const saved=f.app.store.saveRecord(token,id,draft.revision,{...draft.document,notes:'Synthetic ongoing note'});
  f.setNow(1000+day);assert.deepEqual(f.app.store.cleanupExpiredRooms(),[id]);
  assert.deepEqual(f.app.store.recordsList(token,id).own,saved);
  assert.throws(()=>f.app.store.publishRecord(token,id,saved.revision),/PHASE_LOCKED/);
  assert.deepEqual(f.app.store.importAutomaticRecord(token,id,saved.revision).document.deaths,[]);
 }finally{await f.close();}
});
