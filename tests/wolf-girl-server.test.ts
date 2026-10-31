import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import {roles} from './wolf-girl-fixture.js';

test('wolf girl HTTP/socket secrets, player authorization, confession restart, guard and poison inventory',{timeout:20000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-girl-'));let now=1000;const file=join(dir,'game.db');let app=await createServer({dbPath:file,now:()=>now}),socket:Socket|undefined;
 const listen=async()=>{await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address()!;if(typeof address==='string')throw Error('address');return `http://127.0.0.1:${address.port}`;};let base=await listen();
 const request=(cookie:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const json=async(cookie:string,path:string,body?:unknown)=>{const r=await request(cookie,path,body);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const noSecrets=(value:unknown)=>{const text=JSON.stringify(value);for(const key of ['"engine"','"confession":','"accepted"','"personalCamp"','"girl_confession"','"abilities"'])assert.equal(text.includes(key),false,key);};
 try{
  const cookies:string[]=[];for(let i=0;i<13;i++)cookies.push((await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0]);const tokens=cookies.map(c=>c.split('=')[1]);
  const view=await json(cookies[0],'/api/rooms',{nickname:'Synthetic girl host',requestId:randomUUID()}),id=view.room.id,path='/api/rooms/'+id;
  await json(cookies[0],path+'/board',{selection:{kind:'preset',id:'wolf-girl-12'},settingsRevision:0});app.store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  for(let i=0;i<12;i++){if(i)app.store.join(tokens[i],view.room.code,`Synthetic ${i}`);app.store.select(tokens[i],id,i+1);app.store.setReady(tokens[i],id,true,app.store.snapshot(id).preparation.settingsRevision);}
  app.store.deal(tokens[0],id);for(let i=0;i<12;i++)app.store.submitIdentity(tokens[i],id,roles[i]);assert.deepEqual(Object.keys(await json(cookies[3],path+'/identity')).sort(),['confirmed','locked','role']);app.store.start(tokens[0],id);await json(cookies[0],path+'/night/enter',{});
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:cookies[0]},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});noSecrets(await new Promise(resolve=>socket!.emit('room:subscribe',{roomId:id},resolve)));socket.on('room:snapshot',noSecrets);
  async function move(phase:string){for(let i=0;i<35&&app.store.snapshot(id).night!.phase!==phase;i++){const deadline=app.store.snapshot(id).night!.deadline;assert.notEqual(deadline,null);now=deadline!;noSecrets(await json(cookies[0],path));}assert.equal(app.store.snapshot(id).night!.phase,phase);}
  await move('confession');assert.deepEqual((await json(cookies[3],path+'/night/private')).wolves,[1,2,3,4]);assert.equal((await json(cookies[0],path+'/night/private')).wolves,undefined);const confession={action:'confess',turnId:app.store.snapshot(id).night!.turnId,target:5};
  assert.equal((await request(cookies[0],path+'/night/command',confession)).status,403);assert.equal((await request(cookies[12],path+'/night/private')).status,403);assert.equal((await request(cookies[0],path+'/night/private?seat=4')).status,400);
  await json(cookies[3],path+'/night/command',confession);await move('wolves');const wolves=await json(cookies[0],path+'/night/private');assert.equal(wolves.recognitionOnly,true);assert.equal(wolves.confession,undefined);
  assert.equal((await request(cookies[0],path+'/night/command',{action:'vote',turnId:app.store.snapshot(id).night!.turnId,target:6})).status,409);
  await move('poisoner');await json(cookies[9],path+'/night/command',{action:'poisoner',turnId:app.store.snapshot(id).night!.turnId,target:8});await move('confession_notice');assert.deepEqual((await json(cookies[4],path+'/night/private')).confession,{accepted:true,girl:4});
  socket.disconnect();socket=undefined;await app.close();app=await createServer({dbPath:file,now:()=>now});base=await listen();assert.deepEqual((await json(cookies[4],path+'/night/private')).confession,{accepted:true,girl:4});assert.equal((await json(cookies[0],path+'/night/private')).confession,undefined);noSecrets(await json(cookies[0],path));await move('first_night_complete');
  await json(cookies[0],path+'/day/enter',{});const command=async(action:Record<string,unknown>)=>json(cookies[0],path+'/day/command',{...action,turnId:app.store.snapshot(id).day!.turnId});
  await command({action:'close_signup'});while(app.store.snapshot(id).day!.phase!=='day_direction'){const d=app.store.snapshot(id).day!;if(d.deadline!==null){now=d.deadline;await json(cookies[0],path);}else await command({action:'continue'});}
  const personal=await json(cookies[4],path+'/day/self');assert.deepEqual(personal.confession,{accepted:true,girl:4});assert.equal((await json(cookies[0],path+'/day/self')).confession,undefined);
  await command({action:'speech_mode',mode:'free'});await command({action:'end_speech'});await command({action:'start_vote',method:'offline',visibility:'totals',seconds:30});
  const candidates=app.store.snapshot(id).day!.vote!.candidates;await command({action:'offline_results',counts:candidates.map(seat=>({seat,votes:seat===6?8:0}))});
  const turnId=app.store.snapshot(id).day!.turnId;await json(cookies[3],path+'/day/command',{action:'explode',confirmed:true,turnId});assert.equal((await request(cookies[0],path+'/day/command',{action:'continue',turnId})).status,409);assert.equal(app.store.snapshot(id).day!.dead.includes(6),false);assert.equal(app.store.snapshot(id).day!.dead.includes(5),true);
  app.store.switchManual(tokens[0],id,true);const record=app.store.recordsList(tokens[0],id).own!;assert.equal(record.document.votes.some(v=>v.kind==='exile'),false);

 }finally{socket?.disconnect();await app.close();rmSync(dir,{recursive:true});}
});
