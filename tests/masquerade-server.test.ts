import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import {roles} from './masquerade-fixture.js';

test('masquerade real-player HTTP/socket privacy, draft restart, timeout penalties and daytime access cutoff',{timeout:30000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'masquerade-'));const file=join(dir,'game.db');let now=1000;let app=await createServer({dbPath:file,now:()=>now});let socket:Socket|undefined;
 const listen=async()=>{await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const a=app.http.address()!;if(typeof a==='string')throw Error('address');return `http://127.0.0.1:${a.port}`;};let base=await listen();
 const request=(cookie:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const json=async(cookie:string,path:string,body?:unknown)=>{const r=await request(cookie,path,body);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const noSecrets=(value:unknown)=>{const text=JSON.stringify(value);for(const key of ['"masquerade":','"danced"','"inspected"','"masked"','"inspection"','"penalties"','"engine"','"danceDraft"'])assert.equal(text.includes(key),false,key);};
 try{
  const cookies:string[]=[];for(let i=0;i<13;i++)cookies.push((await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0]);const tokens=cookies.map(c=>c.split('=')[1]);
  const view=await json(cookies[0],'/api/rooms',{nickname:'合成假面房主',requestId:randomUUID()}),id=view.room.id,path='/api/rooms/'+id;
  await json(cookies[0],path+'/board',{selection:{kind:'preset',id:'masquerade-12'},settingsRevision:0});app.store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  for(let i=0;i<12;i++){if(i)app.store.join(tokens[i],view.room.code,`合成 ${i}`);app.store.select(tokens[i],id,i+1);app.store.setReady(tokens[i],id,true,app.store.snapshot(id).preparation.settingsRevision);}
  app.store.deal(tokens[0],id);for(let i=0;i<12;i++)app.store.submitIdentity(tokens[i],id,roles[i]);app.store.start(tokens[0],id);await json(cookies[0],path+'/night/enter',{});
  async function move(phase:string){for(let i=0;i<45&&app.store.snapshot(id).night!.phase!==phase;i++){now=app.store.snapshot(id).night!.deadline!;noSecrets(await json(cookies[0],path));}assert.equal(app.store.snapshot(id).night!.phase,phase);}
  await move('first_night_complete');await json(cookies[0],path+'/day/enter',{});
  const day=async(c:Record<string,unknown>)=>json(cookies[0],path+'/day/command',{...c,turnId:app.store.snapshot(id).day!.turnId});await day({action:'close_signup'});while(app.store.snapshot(id).day!.phase!=='day_direction')await day({action:'continue'});await day({action:'speech_mode',mode:'free'});await day({action:'end_speech'});await day({action:'start_vote',method:'offline',visibility:'totals',seconds:30});await day({action:'offline_results',counts:app.store.snapshot(id).day!.vote!.candidates.map(seat=>({seat,votes:0}))});await day({action:'continue'});await json(cookies[0],path+'/night/enter',{});assert.equal(app.store.snapshot(id).night!.phase,'dancer');
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:cookies[0]},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});noSecrets(await new Promise(resolve=>socket!.emit('room:subscribe',{roomId:id},resolve)));socket.on('room:snapshot',noSecrets);
  const draft={action:'dance_draft',turnId:app.store.snapshot(id).night!.turnId,requestId:randomUUID(),expectedRevision:0,targets:[5,6]};assert.equal((await request(cookies[0],path+'/night/command',draft)).status,403);await json(cookies[11],path+'/night/command',draft);await json(cookies[11],path+'/night/command',draft);assert.deepEqual((await json(cookies[11],path+'/night/private')).masquerade.draft,[5,6]);
  socket.disconnect();socket=undefined;await app.close();app=await createServer({dbPath:file,now:()=>now});base=await listen();assert.deepEqual((await json(cookies[11],path+'/night/private')).masquerade.draft,[5,6]);await move('mask');
  const maskDraft={action:'mask_draft',step:'inspect',target:5,turnId:app.store.snapshot(id).night!.turnId,requestId:randomUUID(),expectedRevision:0};await json(cookies[3],path+'/night/command',maskDraft);assert.equal((await request(cookies[0],path+'/night/command',maskDraft)).status,403);
  assert.equal((await request(cookies[12],path+'/night/private')).status,403);assert.equal((await request(cookies[0],path+'/night/private?seat=4')).status,400);
  await move('wolves');const receipt=(await json(cookies[3],path+'/night/private')).masquerade;assert.equal(receipt.inspection.target,5);assert.equal(receipt.inspection.inPool,true);assert.deepEqual((await json(cookies[0],path+'/night/private')).wolves,[1,2,3]);noSecrets(await json(cookies[4],path+'/night/private'));assert.equal(receipt.mask.source,'random');
  await move('first_night_complete');assert.equal((await json(cookies[3],path+'/night/private')).masquerade,undefined);await json(cookies[0],path+'/day/enter',{});assert.equal((await json(cookies[3],path+'/night/private')).masquerade,undefined);assert.notEqual((await request(cookies[3],path+'/night/command',maskDraft)).status,200);
  noSecrets(await json(cookies[0],path));
 }finally{socket?.disconnect();await app.close();rmSync(dir,{recursive:true});}
});
