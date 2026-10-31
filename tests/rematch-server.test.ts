import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from '../apps/server/app.js';
import {manualGame,endManual} from './helpers/rematch.js';
import {io} from 'socket.io-client';
test('explicit game official commit broadcasts ended state to another participant',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-broadcast-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const draft=s.recordsList(t[0],id).own!;
 s.saveRecord(t[0],id,draft.revision,{...draft.document,deaths:[1,2,3,4].map(seat=>({seat,round:1,period:'night',cause:'unrecorded'}))});s.close();
 const server=await createServer({dbPath:file,now:()=>1000});await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${(server.http.address() as {port:number}).port}`;
 const socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:`wolf_session=${t[1]}`},reconnection:false});
 try{
  await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});await new Promise<void>(resolve=>socket.emit('room:subscribe',{roomId:id},()=>resolve()));
  let ended=false;socket.on('room:snapshot',room=>{if(room.manual?.status==='ended')ended=true;});
  const response=await fetch(base+`/api/games/${id}/manual/commit`,{method:'POST',headers:{Cookie:`wolf_session=${t[0]}`,'Content-Type':'application/json'},body:JSON.stringify({revision:1})});assert.equal(response.status,200);
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(ended,true);
 }finally{socket.disconnect();await server.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP scopes every second-game private read/write and permits lost-response rematch retry',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-http-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);
 endManual(s,t[0],id);s.close();const server=await createServer({dbPath:file,now:()=>1000});
 await new Promise<void>(resolve=>server.http.listen(0,'127.0.0.1',resolve));const a=server.http.address() as {port:number},base=`http://127.0.0.1:${a.port}`;
 const request=(path:string,body?:unknown,gameId?:string,token=t[0])=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:`wolf_session=${token}`,'Content-Type':'application/json',...(gameId?{'X-Wolf-Game-Id':gameId}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const c={requestId:randomUUID(),expectedGameId:id};const first=await request(`/api/rooms/${id}/rematch`,c,id);
  assert.equal(first.status,200);const result=await first.json();assert.equal(result.game.gameNumber,2);const next=result.game.gameId;
  const retry=await request(`/api/rooms/${id}/rematch`,c,id);assert.equal(retry.status,200);assert.equal((await retry.json()).game.gameId,next);
  for(const path of ['identity','night/private','day/private','day/self','judge/private','control/defaults','night/test-actor','test-roles']){
   const r=await request(`/api/rooms/${id}/${path}`,undefined,id);assert.equal(r.status,409,path);assert.equal((await r.json()).error,'STALE_GAME',path);
   assert.equal((await request(`/api/rooms/${id}/${path}`)).status,409,path);
  }
  for(const path of ['ready','deal','start','identity','night/command','day/command','judge/appoint','manual/switch','voice','board','test-players'])assert.equal((await request(`/api/rooms/${id}/${path}`,{},id)).status,409,path);
  assert.equal((await request(`/api/rooms/${id}/ready`,{ready:true,settingsRevision:2},next)).status,200);
  const current=await request(`/api/rooms/${id}`);assert.equal(current.status,200);assert.equal((await current.json()).room.gameId,next);
  const old=await request(`/api/rooms/${id}/records`);assert.equal(old.status,200);assert.equal((await old.json()).own.document.notes,'合成私密笔记');
  assert.equal((await request(`/api/games/${id}/record-context`)).status,200);
  const revoked=await request(`/api/rooms/${id}/identity`,undefined,next,'f'.repeat(64));assert.equal(revoked.status,401);
 }finally{await server.close();rmSync(dir,{recursive:true,force:true});}
});
