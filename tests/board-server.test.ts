import {systemPresetIdSchema} from '../packages/contracts/board.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
test('board HTTP and sockets expose counts only; saved templates remain owner-scoped and commands reject injection',async()=>{
 const app=await createServer({dbPath:':memory:'});await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address()!;if(typeof address==='string')throw Error('address');const base=`http://127.0.0.1:${address.port}`;
 async function session(){return (await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];}
 async function request(cookie:string,path:string,body?:unknown){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});}
 let socket:Socket|undefined;try{
  const h=await session(),g=await session();const view=await (await request(h,'/api/rooms',{nickname:'Host',requestId:randomUUID()})).json();const path='/api/rooms/'+view.room.id;
  await request(g,'/api/rooms/join',{code:view.room.code,nickname:'Guest'});
  const library=await (await request(h,'/api/boards')).json();assert.deepEqual(library.presets.map((p:{id:string})=>p.id).sort(),[...systemPresetIdSchema.options].sort());
  const input={name:'My armor',id:null,revision:0,composition:{seatCount:2,roles:{mechanicalWolf:1,armoredWolf:1}}};const saved=await (await request(h,'/api/boards',input)).json();
  assert.deepEqual((await (await request(g,'/api/boards')).json()).custom,[]);
  assert.equal((await request(g,path+'/board',{selection:{kind:'custom',id:saved.id},settingsRevision:0})).status,403);
  const forbidden=await request(g,'/api/boards',{...input,id:saved.id,revision:1});assert.equal(forbidden.status,404);
  assert.equal((await request(h,'/api/boards',{...input,composition:{...input.composition,ruleset:'standard'}})).status,400);
  for(const composition of [{seatCount:2,roles:{witch:2}},{seatCount:15,roles:{wolf:2}},{seatCount:2,roles:{unknown:2}},{seatCount:257,roles:{wolf:257}}])assert.equal((await request(h,'/api/boards',{...input,composition})).status,400);
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:g},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:view.room.id},()=>resolve()));
  const broadcast=new Promise<any>(resolve=>socket!.once('room:snapshot',resolve));
  const selected=await request(h,path+'/board',{selection:{kind:'custom',id:saved.id},settingsRevision:0});assert.equal(selected.status,200);
  const publicView=(await selected.json()).room;assert.equal(publicView.board.composition.ruleset,'mechanical-armor');assert.equal(publicView.seats.length,2);assert.deepEqual(await broadcast,publicView);
  const serialized=JSON.stringify(publicView);for(const secret of ['owner','originalRole','mimickedRole','copiedFrom','capacity','skills'])assert.equal(serialized.includes('"'+secret+'"'),false);
  assert.equal((await request(h,path+'/board',{selection:{kind:'preset',id:'standard-12'},settingsRevision:0})).status,409);
  assert.equal((await request(h,path+'/seat',{seat:3})).status,400);assert.equal((await request(h,path+'/deal',{})).status,409);
  assert.equal((await request(h,'/api/boards?owner=someone')).status,400);
  assert.equal((await fetch(base+'/api/boards')).status,401);
 }finally{socket?.disconnect();await app.close();}
});
