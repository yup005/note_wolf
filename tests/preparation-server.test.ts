import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import type {LobbyView,PrivateIdentity,Role,RoomSnapshot} from '../packages/contracts/index.js';
async function fixture(){
 const app=await createServer({dbPath:':memory:'});await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));
 const addr=app.http.address();if(!addr||typeof addr==='string')throw Error('address');const base=`http://127.0.0.1:${addr.port}`;
 async function session(){const r=await fetch(base+'/api/session');return r.headers.get('set-cookie')!.split(';')[0];}
 async function request(cookie:string,path:string,body?:unknown){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...body!==undefined?{'content-type':'application/json'}:{}},body:body===undefined?undefined:JSON.stringify(body)});}
 const cookies=await Promise.all(Array.from({length:13},session));const created=await (await request(cookies[0],'/api/rooms',{nickname:'Host',requestId:randomUUID()})).json() as LobbyView;
 const path=`/api/rooms/${created.room.id}`;
 for(let i=0;i<12;i++){if(i)await request(cookies[i],'/api/rooms/join',{nickname:'P'+i,code:created.room.code});await request(cookies[i],path+'/seat',{seat:i+1});await request(cookies[i],path+'/ready',{ready:true,settingsRevision:0});}
 return {app,base,request,cookies,path,id:created.room.id};
}
async function socket(base:string,cookie:string,id:string){
 const s=io(base,{transports:['websocket'],extraHeaders:{Cookie:cookie},reconnection:false});
 await new Promise<void>((r,j)=>{s.once('connect',r);s.once('connect_error',j);});
 await new Promise<void>(r=>s.emit('room:subscribe',{roomId:id},()=>r()));return s;
}
function noSecrets(value:unknown){
 if(!value||typeof value!=='object')return;
 for(const [key,v] of Object.entries(value)){assert.ok(!['role','roles','identities','session_hash'].includes(key),`public leak: ${key}`);noSecrets(v);}
}
for(const gameMode of ['automatic','manual'] as const)test(`HTTP online/${gameMode} deal is private and concurrent retries never redeal`,async()=>{
 const f=await fixture();let s:Socket|undefined;try{
  if(gameMode==='manual'){
   assert.equal((await f.request(f.cookies[0],f.path+'/settings',{dealMethod:'online',gameMode})).status,200);
   for(const c of f.cookies.slice(0,12))assert.equal((await f.request(c,f.path+'/ready',{ready:true,settingsRevision:1})).status,200);
  }
  assert.equal((await f.request(f.cookies[1],f.path+'/deal',{})).status,403);
  const results=await Promise.all([f.request(f.cookies[0],f.path+'/deal',{}),f.request(f.cookies[0],f.path+'/deal',{})]);assert.deepEqual(results.map(r=>r.status),[200,200]);
  const cards=await Promise.all(f.cookies.slice(0,12).map(async c=>await (await f.request(c,f.path+'/identity')).json() as PrivateIdentity));
  assert.deepEqual(Object.fromEntries(['wolf','villager','seer','witch','hunter','idiot'].map(role=>[role,cards.filter(c=>c.role===role).length])),{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1});
  assert.equal((await f.request(f.cookies[12],f.path+'/identity')).status,403);
  assert.equal((await f.request(f.cookies[0],f.path+'/identity?seat=2')).status,400);
  assert.equal((await f.request(f.cookies[0],f.path+'/identity/confirm',{memberId:'other'})).status,400);
  assert.equal((await f.request(f.cookies[0],f.path+'/identity/other')).status,404);
  assert.equal((await f.request(f.cookies[0],f.path+'/start',{})).status,409);
  s=await socket(f.base,f.cookies[0],f.id);const broadcasts:RoomSnapshot[]=[];s.on('room:snapshot',r=>broadcasts.push(r));
  for(const c of f.cookies.slice(0,12))assert.equal((await f.request(c,f.path+'/identity/confirm',{})).status,200);
  assert.equal((await f.request(f.cookies[1],f.path+'/start',{})).status,403);
  assert.equal((await f.request(f.cookies[0],f.path+'/start',{})).status,200);
  assert.equal((await f.request(f.cookies[0],f.path+'/deal',{})).status,200);
  assert.deepEqual(await Promise.all(f.cookies.slice(0,12).map(async c=>(await (await f.request(c,f.path+'/identity')).json()).role)),cards.map(c=>c.role));
  const identity=await f.request(f.cookies[0],f.path+'/identity');assert.equal(identity.headers.get('cache-control'),'no-store');
  for(const c of f.cookies.slice(0,12)){noSecrets(await (await f.request(c,f.path)).json());noSecrets(await (await f.request(c,'/api/session')).json());}
  assert.ok(broadcasts.length>0);broadcasts.forEach(noSecrets);
  assert.equal((await f.request(f.cookies[0],f.path+'/identity',{role:'wolf'})).status,409);
 }finally{s?.disconnect();await f.app.close();}
});
for(const gameMode of ['automatic','manual'] as const)test(`HTTP physical/${gameMode} counts correct privately and lock atomically`,async()=>{
 const f=await fixture();try{
  assert.equal((await f.request(f.cookies[0],f.path+'/settings',{dealMethod:'physical',gameMode})).status,200);
  for(const c of f.cookies.slice(0,12))await f.request(c,f.path+'/ready',{ready:true,settingsRevision:1});
  await f.request(f.cookies[0],f.path+'/deal',{});
  for(const c of f.cookies.slice(0,12))await f.request(c,f.path+'/identity',{role:'wolf'});
  const views=await Promise.all(f.cookies.slice(0,12).map(async c=>(await (await f.request(c,f.path)).json()).room));
  views.forEach(v=>{assert.deepEqual(v,views[0]);noSecrets(v);});assert.equal(views[0].preparation.validation,'mismatch');
  const failure=await f.request(f.cookies[0],f.path+'/start',{});assert.equal(failure.status,409);assert.equal((await failure.json()).error,'ROLE_MISMATCH');
  const roles:Role[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
  for(let i=0;i<12;i++)await f.request(f.cookies[i],f.path+'/identity',{role:roles[i]});
  // Last role correction and start serialize. Either start wins and correction
  // is rejected, or correction wins and start refuses the incorrect deck.
  const [change,start]=await Promise.all([f.request(f.cookies[11],f.path+'/identity',{role:'wolf'}),f.request(f.cookies[0],f.path+'/start',{})]);
  assert.ok((change.status===200&&start.status===409)||(change.status===409&&start.status===200));
  if(start.status!==200){await f.request(f.cookies[11],f.path+'/identity',{role:'idiot'});assert.equal((await f.request(f.cookies[0],f.path+'/start',{})).status,200);}
  assert.equal((await f.request(f.cookies[11],f.path+'/identity',{role:'wolf'})).status,409);
 }finally{await f.app.close();}
});
test('settings versus deal cannot start with stale readiness',async()=>{
 const f=await fixture();try{
  const [settings,deal]=await Promise.all([f.request(f.cookies[0],f.path+'/settings',{dealMethod:'physical',gameMode:'automatic'}),f.request(f.cookies[0],f.path+'/deal',{})]);
  assert.ok((settings.status===200&&deal.status===409)||(settings.status===409&&deal.status===200));
 }finally{await f.app.close();}
});

test('HTTP rejects delayed ready approvals from an old settings revision',async()=>{
 const f=await fixture();try{
  await f.request(f.cookies[0],f.path+'/settings',{dealMethod:'physical',gameMode:'manual'});
  const stale=await f.request(f.cookies[1],f.path+'/ready',{ready:true,settingsRevision:0});assert.equal(stale.status,409);assert.equal((await stale.json()).error,'SETTINGS_CHANGED');
  assert.equal((await f.request(f.cookies[1],f.path+'/ready',{ready:true})).status,400);
  const view=await (await f.request(f.cookies[0],f.path)).json();assert.equal(view.room.seats.some((s:{ready:boolean})=>s.ready),false);
 }finally{await f.app.close();}
});
