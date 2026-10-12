import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import type Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
import {seedTestAdmin} from './helpers/test-admin.js';
import {io,type Socket} from 'socket.io-client';
import {sessionHash} from '../packages/storage/auth.js';

const token=()=>randomBytes(32).toString('hex');
test('ordinary and guest hosts have no test capability and cannot convert their rooms',async()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const guest=token();s.issueSession(guest);
  const account=await s.auth.register(guest,'ordinary_test_host','synthetic-password','Ordinary');
  for(const host of [token(),account.token]){
   if(!s.hasSession(host))s.issueSession(host);const v=s.create(host,'Host');s.select(host,v.room.id,1);
   assert.equal(s.view(host,v.room.id).testPlayersEnabled,false);
   assert.throws(()=>s.fillTestPlayers(host,v.room.id),/ADMIN_ONLY/);
   assert.equal(s.snapshot(v.room.id).testRoom,false);
  }
 }finally{s.close();}
});
test('admin test rooms reject other humans and preserve owner recovery across login takeover',async()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const admin=token();seedTestAdmin(s,admin);const v=s.create(admin,'Admin');s.select(admin,v.room.id,1);
  assert.equal(v.testPlayersEnabled,true);s.fillTestPlayers(admin,v.room.id);
  const outsider=token();s.issueSession(outsider);
  assert.throws(()=>s.join(outsider,v.room.code,'Human'),/TEST_ROOM_PRIVATE/);
  assert.equal(s.snapshot(v.room.id).seats.filter(p=>p.memberId).length,12);
  const next=await s.auth.login(outsider,'fixture_admin','synthetic-admin-password');
  assert.equal(s.hasSession(admin),false);
  assert.equal(s.join(next.token,v.room.code,'Admin').me.id,v.me.id);
  assert.equal(s.view(next.token,v.room.id).testPlayersEnabled,true);
  assert.throws(()=>s.testRoles(admin,v.room.id),/UNAUTHORIZED/);
 }finally{s.close();}
});
test('test APIs recheck isolation of legacy contaminated test rooms before reading or mutating',()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const admin=token();seedTestAdmin(s,admin);const v=s.create(admin,'Admin');s.select(admin,v.room.id,1);const filled=s.fillTestPlayers(admin,v.room.id);
  const actor=filled.room.seats[1].memberId!;
  const db=(s as unknown as {db:Database.Database}).db;
  // Represents a room persisted by the old implementation, which allowed observers.
  db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run('legacy-human',v.room.id,'legacy-human-owner','Human');
  const before=s.snapshot(v.room.id);
  assert.equal(s.view(admin,v.room.id).testPlayersEnabled,false);
  for(const read of [()=>s.testRoles(admin,v.room.id),()=>s.testPlayerIdentity(admin,v.room.id,actor),()=>s.testNightActor(admin,v.room.id),()=>s.testDayActor(admin,v.room.id)])assert.throws(read,/TEST_ROOM_NOT_EMPTY/);
  for(const write of [()=>s.fillTestPlayers(admin,v.room.id),()=>s.testPlayerReady(admin,v.room.id,actor,false,0),()=>s.testNightAdvance(admin,v.room.id),()=>s.testDayAdvance(admin,v.room.id)])assert.throws(write,/TEST_ROOM_NOT_EMPTY/);
  assert.deepEqual(s.snapshot(v.room.id),before);
 }finally{s.close();}
});
test('ordinary configuration and deal cannot automate actors in a contaminated legacy test room',()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const admin=token();seedTestAdmin(s,admin);const v=s.create(admin,'Admin');s.select(admin,v.room.id,1);s.fillTestPlayers(admin,v.room.id);s.setReady(admin,v.room.id,true,0);
  const db=(s as unknown as {db:Database.Database}).db;
  db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run('legacy-human',v.room.id,'legacy-owner','Human');
  const before=s.snapshot(v.room.id);
  assert.throws(()=>s.configure(admin,v.room.id,{dealMethod:'online',gameMode:'manual'}),/TEST_ROOM_NOT_EMPTY/);
  assert.throws(()=>s.configureBoard(admin,v.room.id,{settingsRevision:0,selection:{kind:'preset',id:'mechanical-12'}}),/TEST_ROOM_NOT_EMPTY/);
  assert.throws(()=>s.deal(admin,v.room.id),/TEST_ROOM_NOT_EMPTY/);
  assert.deepEqual(s.snapshot(v.room.id),before);
 }finally{s.close();}
});
test('legacy human memberships do not retain HTTP or Socket access to a simulated test room',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});let socket:Socket|undefined;try{
  const admin=token(),guest=token();seedTestAdmin(app.store,admin);app.store.issueSession(guest);
  const v=app.store.create(admin,'Admin');app.store.select(admin,v.room.id,1);app.store.fillTestPlayers(admin,v.room.id);
  const db=(app.store as unknown as {db:Database.Database}).db;
  db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run('legacy-human',v.room.id,sessionHash(guest),'Human');
  assert.throws(()=>app.store.view(guest,v.room.id),/TEST_ROOM_PRIVATE/);assert.deepEqual(app.store.roomsFor(guest),[]);
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('address');const base=`http://127.0.0.1:${a.port}`;
  assert.equal((await fetch(base+`/api/rooms/${v.room.id}`,{headers:{cookie:`wolf_session=${guest}`}})).status,403);
  socket=io(base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${guest}`},reconnection:false});
  await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  const ack=await new Promise<{error?:string}>(resolve=>socket!.emit('room:subscribe',{roomId:v.room.id},resolve));assert.equal(ack.error,'TEST_ROOM_PRIVATE');
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM members WHERE id=?').get('legacy-human') as {n:number}).n,1);
 }finally{socket?.disconnect();await app.close();}
});
test('admin cannot use simulated-player routes in real rooms or target their own real identity',()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const admin=token();seedTestAdmin(s,admin);const real=s.create(admin,'Real');s.select(admin,real.room.id,1);
  for(const read of [()=>s.testPlayerIdentity(admin,real.room.id,real.me.id),()=>s.testNightPrivate(admin,real.room.id,real.me.id),()=>s.testDayPrivate(admin,real.room.id,real.me.id)])assert.throws(read,/NOT_TEST_PLAYER/);
  s.fillTestPlayers(admin,real.room.id);
  assert.throws(()=>s.testPlayerIdentity(admin,real.room.id,real.me.id),/NOT_TEST_PLAYER/);
 }finally{s.close();}
});
test('simulated role list excludes the real admin while their own ordinary identity remains accessible',()=>{
 const s=new LobbyStore(':memory:',undefined,true);try{
  const admin=token();seedTestAdmin(s,admin);const v=s.create(admin,'Admin');s.select(admin,v.room.id,1);s.fillTestPlayers(admin,v.room.id);s.setReady(admin,v.room.id,true,0);s.deal(admin,v.room.id);
  const roles=s.testRoles(admin,v.room.id).roles;
  assert.equal(roles.length,11);assert.equal(roles.some(p=>p.memberId===v.me.id),false);
  assert.ok(s.identity(admin,v.room.id).role);
 }finally{s.close();}
});
test('HTTP test endpoints refuse ordinary hosts and do not change public Socket state',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});let socket:Socket|undefined;try{
  const h=token();app.store.issueSession(h);const v=app.store.create(h,'Guest');app.store.select(h,v.room.id,1);
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('address');
  const base=`http://127.0.0.1:${a.port}/api/rooms/${v.room.id}`;
  socket=io(`http://127.0.0.1:${a.port}`,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${h}`},reconnection:false});
  await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:v.room.id},()=>resolve()));
  const frames:unknown[]=[];socket.on('room:snapshot',frame=>frames.push(frame));
  for(const [path,body] of [['/test-players',{}],['/test-roles',undefined],['/night/test-actor',undefined],['/day/test-actor',undefined],['/night/test-advance',{}],['/day/test-advance',{}],['/test-players/forged/identity',undefined],['/test-players/forged/ready',{ready:true,settingsRevision:0}],['/test-players/forged/identity/confirm',{}],['/test-players/forged/night/private',undefined],['/test-players/forged/day/private',undefined],['/test-players/forged/night/command',{action:'vote',target:2,turnId:'00000000-0000-4000-8000-000000000001'}],['/test-players/forged/day/command',{action:'signup',join:false,turnId:'00000000-0000-4000-8000-000000000001'}]] as const){
   const before=app.store.snapshot(v.room.id);
   const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:`wolf_session=${h}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   assert.equal(response.status,403,path);assert.equal((await response.json()).error,'ADMIN_ONLY',path);assert.deepEqual(app.store.snapshot(v.room.id),before);
  }
  await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:v.room.id},()=>resolve()));assert.deepEqual(frames,[]);
 }finally{socket?.disconnect();await app.close();}
});
test('admin HTTP takeover and logout revoke test secrets, commands and connected sockets',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});let socket:Socket|undefined;try{
  const admin=token(),nextGuest=token();seedTestAdmin(app.store,admin);app.store.issueSession(nextGuest);
  const v=app.store.create(admin,'Admin');app.store.select(admin,v.room.id,1);const filled=app.store.fillTestPlayers(admin,v.room.id);const actor=filled.room.seats[1].memberId!;
  app.store.setReady(admin,v.room.id,true,0);app.store.deal(admin,v.room.id);
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('address');const base=`http://127.0.0.1:${a.port}`,path=`/api/rooms/${v.room.id}`;
  const request=(cookie:string,p:string,body?:unknown)=>fetch(base+p,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  socket=io(base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${admin}`},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:v.room.id},()=>resolve()));
  const disconnected=new Promise<string>(resolve=>socket!.once('disconnect',resolve));
  const login=await request(`wolf_session=${nextGuest}`,'/api/auth/login',{username:'fixture_admin',password:'synthetic-admin-password'});assert.equal(login.status,200);assert.equal(await disconnected,'io server disconnect');
  const cookie=login.headers.get('set-cookie')!.split(';')[0];const card=app.store.identity(cookie.split('=')[1],v.room.id);
  assert.equal((await request(cookie,path+'/test-roles')).status,200);
  for(const suffix of ['/test-roles',`/test-players/${actor}/identity`,`/test-players/${actor}/night/private`])assert.equal((await request(`wolf_session=${admin}`,path+suffix)).status,401);
  assert.equal((await request(`wolf_session=${admin}`,path+`/test-players/${actor}/identity/confirm`,{})).status,401);
  socket.disconnect();socket=io(base,{transports:['websocket'],extraHeaders:{cookie},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:v.room.id},()=>resolve()));const logoutDisconnect=new Promise<string>(resolve=>socket!.once('disconnect',resolve));
  assert.equal((await request(cookie,'/api/auth/logout',{})).status,200);assert.equal(await logoutDisconnect,'io server disconnect');assert.equal((await request(cookie,path+'/test-roles')).status,401);
  assert.ok(card.role);assert.equal(app.store.snapshot(v.room.id).seats.filter(p=>p.memberId).length,12);
 }finally{socket?.disconnect();await app.close();}
});
test('production helpers need the explicit authorized Render trial scope and service identity',async()=>{
 const saved={...process.env};try{
  for(const [scope,render,service,enabled,want] of [
   [undefined,undefined,undefined,true,404],[undefined,'true','srv-db5gd37lot8c73esepqg',true,404],['unapproved-scope','true','srv-db5gd37lot8c73esepqg',true,404],['render-trial','true','other-service',true,404],['render-trial',undefined,'srv-db5gd37lot8c73esepqg',true,404],['render-trial','true','srv-db5gd37lot8c73esepqg',false,404],['render-trial','true','srv-db5gd37lot8c73esepqg',true,200]
  ] as const){
   process.env.NODE_ENV='production';for(const [k,value] of [['RENDER',render],['RENDER_SERVICE_ID',service]] as const){if(value===undefined)delete process.env[k];else process.env[k]=value;}
   const app=await createServer({dbPath:':memory:',allowTestPlayers:enabled,testPlayerScope:scope} as Parameters<typeof createServer>[0]);try{
    const h=token();seedTestAdmin(app.store,h);const v=app.store.create(h,'Admin');app.store.select(h,v.room.id,1);
    await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('address');
    const response=await fetch(`http://127.0.0.1:${a.port}/api/rooms/${v.room.id}/test-players`,{method:'POST',headers:{cookie:`wolf_session=${h}`,'content-type':'application/json'},body:'{}'});
    assert.equal(response.status,want,JSON.stringify({scope,render,service,enabled}));
   }finally{await app.close();}
  }
 }finally{for(const k of ['NODE_ENV','RENDER','RENDER_SERVICE_ID']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
