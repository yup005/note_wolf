import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';

test('real mechanical runtime isolates learning and exact inspection across HTTP, sockets and restart',{timeout:15000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-runtime-privacy-')),file=join(dir,'db');let now=1000;
 let app=await createServer({dbPath:file,now:()=>now});let socket:Socket|undefined;
 const listen=async()=>{await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address()!;if(typeof address==='string')throw Error('address');return `http://127.0.0.1:${address.port}`;};
 let base=await listen();
 const request=(cookie:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const json=async(cookie:string,path:string,body?:unknown)=>{const res=await request(cookie,path,body);assert.equal(res.status,200,await res.clone().text());return res.json();};
 const noSecrets=(value:unknown)=>{const text=JSON.stringify(value);for(const key of ['"engine"','"learning"','"learningReceipt"','"inspectionRole"','"abilities"','"mimickedRole"','"copiedFrom"','"model"'])assert.equal(text.includes(key),false,key);};
 try{
  const cookies:string[]=[];for(let i=0;i<13;i++)cookies.push((await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0]);
  const tokens=cookies.map(c=>c.split('=')[1]),host=cookies[0],outsider=cookies[12];
  const view=await json(host,'/api/rooms',{nickname:'Synthetic host',requestId:randomUUID()}),id=view.room.id,path='/api/rooms/'+id;
  await json(host,path+'/board',{selection:{kind:'preset',id:'mechanical-12'},settingsRevision:0});
  app.store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  const roles=['villager','wolf','wolf','wolf','villager','villager','villager','spiritSeer','witch','hunter','guard','mechanicalWolf'] as const;
  for(let i=0;i<12;i++){if(i)app.store.join(tokens[i],view.room.code,`Synthetic ${i}`);app.store.select(tokens[i],id,i+1);app.store.setReady(tokens[i],id,true,app.store.snapshot(id).preparation.settingsRevision);}
  app.store.deal(tokens[0],id);for(let i=0;i<12;i++)app.store.submitIdentity(tokens[i],id,roles[i]);app.store.start(tokens[0],id);
  await json(host,path+'/night/enter',{});
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:host},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  noSecrets(await new Promise<unknown>(resolve=>socket!.emit('room:subscribe',{roomId:id},resolve)));
  socket.on('room:snapshot',noSecrets);
  async function move(phase:string){for(let i=0;i<30&&app.store.snapshot(id).night!.phase!==phase;i++){now=app.store.snapshot(id).night!.deadline!;noSecrets(await json(host,path));}assert.equal(app.store.snapshot(id).night!.phase,phase);}
  await move('mechanical');const turn=app.store.snapshot(id).night!.turnId;
  const learn={action:'ability',turnId:turn,choice:'learn',target:8};
  assert.equal((await request(host,path+'/night/command',learn)).status,403);
  const learned=await json(cookies[11],path+'/night/command',learn);assert.equal(learned.learningReceipt.role,'spiritSeer');
  assert.equal((await json(host,path+'/night/private')).kind,'waiting');
  assert.equal((await request(outsider,path+'/night/private')).status,403);
  assert.equal((await request(host,path+'/night/private?seat=12')).status,400);
  noSecrets(await json(host,path));noSecrets(await json(cookies[7],path));
  await move('spiritSeer');const inspect={action:'ability',turnId:app.store.snapshot(id).night!.turnId,choice:'inspect',target:12};
  assert.equal((await json(cookies[7],path+'/night/command',inspect)).inspectionRole,'spiritSeer');
  assert.equal((await json(host,path+'/night/private')).inspectionRole,undefined);
  socket.disconnect();socket=undefined;await app.close();
  app=await createServer({dbPath:file,now:()=>now});base=await listen();
  assert.equal((await json(cookies[7],path+'/night/private')).inspectionRole,'spiritSeer');
  noSecrets(await json(host,path));assert.equal((await json(host,path+'/night/private')).inspectionRole,undefined);
  for(const suffix of ['/test-roles','/night/test-actor','/test-players/fake/night/private'])assert.equal((await request(host,path+suffix)).status,404);
 }finally{socket?.disconnect();await app.close();rmSync(dir,{recursive:true});}
});
