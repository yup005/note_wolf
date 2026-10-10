import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io, type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import type {LobbyView,RoomSnapshot} from '../packages/contracts/index.js';

async function fixture(dbPath=':memory:'){
 const app=await createServer({dbPath,codeStart:()=>42});
 await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));
 const addr=app.http.address();if(typeof addr==='string'||addr===null)throw Error('no address');
 const base=`http://127.0.0.1:${addr.port}`;
 const session=async()=>{const res=await fetch(base+'/api/session');return res.headers.get('set-cookie')!.split(';')[0];};
 const request=async(cookie:string,path:string,body?:unknown)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 return {app,base,session,request};
}
function connected(s:Socket){return new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});}
function subscribe(s:Socket,id:string){return new Promise<{room?:RoomSnapshot;error?:string}>(resolve=>s.emit('room:subscribe',{roomId:id},resolve));}
function snapshot(s:Socket,revision:number){return new Promise<RoomSnapshot>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('snapshot timeout')),3000);const listener=(r:RoomSnapshot)=>{if(r.revision>=revision){clearTimeout(timeout);s.off('room:snapshot',listener);resolve(r);}};s.on('room:snapshot',listener);});}

test('real clients join, subscribe, race for seats, reconnect and cannot forge access',async()=>{
 const f=await fixture();const sockets:Socket[]=[];
 try{
  assert.equal((await fetch(f.base+'/api/health')).status,200);
  assert.equal((await f.request('','/api/rooms',{nickname:'X',requestId:randomUUID()})).status,401);
  const [h,g,a]=await Promise.all([f.session(),f.session(),f.session()]);
  const requestId=randomUUID();const body={nickname:'房主',requestId};
  const first=await (await f.request(h,'/api/rooms',body)).json() as LobbyView;
  const again=await (await f.request(h,'/api/rooms',body)).json() as LobbyView;
  assert.equal(first.room.id,again.room.id);assert.equal(first.room.code,'0042');
  assert.equal((await f.request(a,`/api/rooms/${first.room.id}`)).status,403);
  const joined=await (await f.request(g,'/api/rooms/join',{code:'0042',nickname:'玩家'})).json() as LobbyView;
  assert.equal(joined.me.isHost,false);
  for(const cookie of [h,g,a]){const s=io(f.base,{transports:['websocket'],extraHeaders:{Cookie:cookie},reconnection:false});sockets.push(s);await connected(s);}
  assert.equal((await subscribe(sockets[2],first.room.id)).error,'NOT_MEMBER');
  for(const s of sockets.slice(0,2))assert.ok((await subscribe(s,first.room.id)).room);
  const received=snapshot(sockets[1],joined.room.revision+1);
  const results=await Promise.all([f.request(h,`/api/rooms/${first.room.id}/seat`,{seat:5}),f.request(g,`/api/rooms/${first.room.id}/seat`,{seat:5})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const updated=await received;assert.ok(updated.seats[4].memberId);
  assert.equal(updated.seats.filter(s=>s.memberId).length,1);
  assert.equal(JSON.stringify(updated).includes('session'),false);
  sockets[1].disconnect();sockets[1].connect();await connected(sockets[1]);
  assert.equal((await subscribe(sockets[1],first.room.id)).room?.revision,updated.revision);
  assert.equal((await (await f.request(h,'/api/session')).json()).rooms[0].room.id,first.room.id);
  const evil=await fetch(f.base+'/api/rooms',{method:'POST',headers:{cookie:h,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({nickname:'X',requestId:randomUUID()})});
  assert.equal(evil.status,403);
 }finally{sockets.forEach(s=>s.disconnect());await f.app.close();}
});
test('invalid API input and unknown routes return JSON; forged cookie is rejected',async()=>{
 const f=await fixture();try{
  const cookie=await f.session();
  assert.equal((await f.request(cookie,'/api/rooms/join',{code:42,nickname:'X'})).status,400);
  assert.equal((await f.request(cookie,'/api/rooms/join',{code:'9999',nickname:'X'})).status,404);
  assert.equal((await f.request('wolf_session='+ 'a'.repeat(64),'/api/rooms',{nickname:'X',requestId:randomUUID()})).status,401);
  assert.equal((await f.request(cookie,'/api/unknown')).status,404);
  const bad=await fetch(f.base+'/api/rooms',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{broken'});
  assert.equal(bad.status,400);assert.equal((await bad.json()).error,'INVALID_INPUT');
 }finally{await f.app.close();}
});

 test('service restart retains session cookie authority and realtime room membership',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'wolf-server-'));const dbPath=join(dir,'lobby.db');
  let f=await fixture(dbPath);let socket:Socket|undefined;
  try{
   const cookie=await f.session();
   const v=await (await f.request(cookie,'/api/rooms',{nickname:'房主',requestId:randomUUID()})).json() as LobbyView;
   await f.request(cookie,`/api/rooms/${v.room.id}/seat`,{seat:8});
   await f.app.close();f=await fixture(dbPath);
   const restored=await (await f.request(cookie,`/api/rooms/${v.room.id}`)).json() as LobbyView;
   assert.equal(restored.me.seat,8);assert.equal(restored.me.isHost,true);
   const session=await f.request(cookie,'/api/session');assert.equal(session.headers.get('set-cookie'),null);
   socket=io(f.base,{transports:['websocket'],extraHeaders:{Cookie:cookie},reconnection:false});await connected(socket);
   const subscribed=await subscribe(socket,v.room.id);assert.equal(subscribed.room?.seats[7].nickname,'房主');
  }finally{socket?.disconnect();await f.app.close();rmSync(dir,{recursive:true});}
 });
