import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';

test('development actors fill once, prepare and confirm only their own online cards',()=>{
 const db=new LobbyStore(':memory:',()=>42,true);try{
  const {room}=db.create('h','Host');assert.throws(()=>db.fillTestPlayers('h',room.id),/HOST_NOT_SEATED/);
  db.select('h',room.id,1);const filled=db.fillTestPlayers('h',room.id);
  assert.equal(filled.room.testRoom,true);assert.equal(filled.room.seats.filter(s=>s.memberId).length,12);
  assert.equal(filled.room.seats.filter(s=>s.ready).length,11);assert.equal(filled.room.seats[0].ready,false);
  assert.deepEqual(db.fillTestPlayers('h',room.id).room.seats,filled.room.seats);
  db.configure('h',room.id,{dealMethod:'online',gameMode:'manual'});assert.equal(db.snapshot(room.id).seats.filter(s=>s.ready).length,11);
  assert.throws(()=>db.configure('h',room.id,{dealMethod:'physical',gameMode:'manual'}),/TEST_ONLINE_ONLY/);
  db.setReady('h',room.id,true,db.snapshot(room.id).preparation.settingsRevision);db.deal('h',room.id);
  assert.equal(db.snapshot(room.id).preparation.confirmedCount,11);assert.equal(db.identity('h',room.id).confirmed,false);
  assert.throws(()=>db.fillTestPlayers('h',room.id),/PHASE_LOCKED/);assert.throws(()=>db.start('h',room.id),/IDENTITY_INCOMPLETE/);
  db.confirmIdentity('h',room.id);assert.equal(db.start('h',room.id).room.preparation.phase,'started');
 }finally{db.close();}
});
test('test actors cannot be injected into a real multi-player room or used without explicit enablement',()=>{
 const disabled=new LobbyStore(':memory:');try{const {room}=disabled.create('h','H');assert.throws(()=>disabled.fillTestPlayers('h',room.id),/TEST_PLAYERS_DISABLED/);}finally{disabled.close();}
 const db=new LobbyStore(':memory:',()=>42,true);try{
  const {room}=db.create('h','H');db.select('h',room.id,1);db.join('g',room.code,'G');
  assert.throws(()=>db.fillTestPlayers('g',room.id),/HOST_ONLY/);
  assert.throws(()=>db.fillTestPlayers('h',room.id),/TEST_ROOM_NOT_EMPTY/);assert.equal(db.snapshot(room.id).testRoom,false);
 }finally{db.close();}
});
test('development helper API is absent by default and in production',async()=>{
 for(const production of [false,true]){
  const previous=process.env.NODE_ENV;if(production)process.env.NODE_ENV='production';
  const app=await createServer({dbPath:':memory:',allowTestPlayers:production});
  try{
   await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('addr');
   const r=await fetch(`http://127.0.0.1:${a.port}/api/rooms/any/test-players`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,404);
   const roles=await fetch(`http://127.0.0.1:${a.port}/api/rooms/any/test-roles`);assert.equal(roles.status,404);
  }finally{await app.close();if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
 }
});

test('test console controls synthetic players only and never grants real-player identity access',()=>{
 const db=new LobbyStore(':memory:',()=>42,true);try{
  const {room}=db.create('h','H');db.select('h',room.id,1);const f=db.fillTestPlayers('h',room.id);
  const bot=f.room.seats.find(s=>s.isTestPlayer)!.memberId!;
  db.testPlayerReady('h',room.id,bot,false,0);assert.equal(db.snapshot(room.id).seats.find(s=>s.memberId===bot)!.ready,false);
  db.testPlayerReady('h',room.id,bot,true,0);db.setReady('h',room.id,true,0);db.deal('h',room.id);
  assert.ok(db.testPlayerIdentity('h',room.id,bot).role);
  assert.throws(()=>db.testPlayerIdentity('h',room.id,f.me.id),/NOT_TEST_PLAYER/);
  db.join('guest',room.code,'G');assert.throws(()=>db.testPlayerIdentity('guest',room.id,bot),/HOST_ONLY/);
  assert.throws(()=>db.testPlayerIdentity('h',room.id,db.view('guest',room.id).me.id),/NOT_TEST_PLAYER/);
 }finally{db.close();}
});

test('test-control HTTP reads only simulated identities and requires host authority',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});try{
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const base=`http://127.0.0.1:${address.port}`;
  async function session(){return (await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];}
  async function request(cookie:string,path:string,body?:unknown){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
  const h=await session();const created=await (await request(h,'/api/rooms',{nickname:'H',requestId:crypto.randomUUID()})).json();const path=`/api/rooms/${created.room.id}`;
  await request(h,path+'/seat',{seat:1});const filled=await (await request(h,path+'/test-players',{})).json();const actor=filled.room.seats[1].memberId;
  await request(h,path+'/ready',{ready:true,settingsRevision:0});await request(h,path+'/deal',{});
  const own=await request(h,path+`/test-players/${created.me.id}/identity`);assert.equal(own.status,403);
  const card=await request(h,path+`/test-players/${actor}/identity`);assert.equal(card.status,200);assert.equal(card.headers.get('cache-control'),'no-store');assert.ok((await card.json()).role);
  const g=await session();await request(g,'/api/rooms/join',{nickname:'G',code:created.room.code});assert.equal((await request(g,path+`/test-players/${actor}/identity`)).status,403);
  const publicView=await (await request(g,path)).json();assert.equal(publicView.room.testRoom,true);assert.equal(JSON.stringify(publicView.room).includes('"role"'),false);
 }finally{await app.close();}
});

test('independent authenticated players do not share a request limit on the same network',async()=>{
 const app=await createServer({dbPath:':memory:'});
 try{
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');
  const base=`http://127.0.0.1:${address.port}`;
  const a=await fetch(base+'/api/session');const cookieA=a.headers.get('set-cookie')!.split(';')[0];
  const b=await fetch(base+'/api/session');const cookieB=b.headers.get('set-cookie')!.split(';')[0];
  for(let i=0;i<300;i++)assert.equal((await fetch(base+'/api/session',{headers:{cookie:cookieA}})).status,200);
  assert.equal((await fetch(base+'/api/session',{headers:{cookie:cookieA}})).status,429);
  assert.equal((await fetch(base+'/api/session',{headers:{cookie:cookieB}})).status,200);
 }finally{await app.close();}
});
