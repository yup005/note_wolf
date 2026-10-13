import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
import {emptyRecord} from '../packages/contracts/records.js';
function setup(s:LobbyStore,wolves=false,tokens=['h','p']){
 const [h,p]=tokens;if(!s.hasSession(h))s.issueSession(h);if(!s.hasSession(p))s.issueSession(p);const room=s.create(h,'H').room;
 s.configureBoard(h,room.id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:2,roles:wolves?{wolf:1,villager:1}:{witch:1,villager:1}}}});s.configure(h,room.id,{gameMode:'manual',dealMethod:'physical'});s.join(p,room.code,'P');
 for(const [i,t] of tokens.entries()){s.select(t,room.id,i+1);s.setReady(t,room.id,true,2);}s.deal(h,room.id);s.submitIdentity(h,room.id,'villager');s.submitIdentity(p,room.id,wolves?'wolf':'witch');s.start(h,room.id);s.recordsList(h,room.id);return room.id;
}
const finish=(s:LobbyStore,token:string,id:string,input:unknown)=>s.finishManualRecord(token,id,input as import('../packages/contracts/records.js').ManualFinish);

test('wolf-free finish requires the current host, explicit confirmation, matching game and draft versions',()=>{
 const s=new LobbyStore(':memory:');try{
  const id=setup(s),body={confirmed:true,version:0,revision:0};assert.throws(()=>finish(s,'p',id,body),/HOST_ONLY/);assert.throws(()=>finish(s,'outside',id,body),/PARTICIPANT_ONLY/);
  for(const input of [{...body,confirmed:false},{...body,winner:'good'},{...body,actor:'h'}])assert.throws(()=>finish(s,'h',id,input),/INVALID_INPUT/);
  assert.throws(()=>finish(s,'h',id,{...body,version:1}),/STALE_RECORD/);assert.throws(()=>finish(s,'h',id,{...body,revision:1}),/STALE_RECORD/);assert.equal(s.snapshot(id).manual!.status,'playing');
  assert.throws(()=>s.publishRecord('h',id,0),/PHASE_LOCKED/);assert.deepEqual(s.snapshot(id).manual!.revealed,[]);
  finish(s,'h',id,body);assert.equal(s.snapshot(id).manual!.status,'ended');assert.equal(s.snapshot(id).manual!.winner,null);assert.equal(s.snapshot(id).manual!.outcomeSource,'record-only');assert.equal(s.manualHistory('h',id).length,1);
  assert.throws(()=>finish(s,'h',id,body),/PHASE_LOCKED|STALE_RECORD/);assert.equal(s.manualHistory('h',id).length,1);const post=s.publishRecord('h',id,0);assert.equal(s.recordPost('p',post.id).outcome,null);assert.equal(s.recordPost('p',post.id).outcomeSource,'record-only');
 }finally{s.close();}
});

test('HTTP record-only finish rejects nonhosts and forged bodies and returns no private draft',async()=>{
 const app=await createServer({dbPath:':memory:'});await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address()!;if(typeof address==='string')throw Error('address');const base=`http://127.0.0.1:${address.port}`;
 try{
  const h=(await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0],p=(await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];
  const id=setup(app.store,false,[h.split('=')[1],p.split('=')[1]]),path=base+`/api/rooms/${id}/manual/finish-record`,body={confirmed:true,version:0,revision:0};
  const post=(cookie:string,data:unknown=body,url=path)=>fetch(url,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post(p)).status,403);assert.equal((await post(h,{...body,winner:'good'})).status,400);assert.equal((await post(h,{...body,confirmed:false})).status,400);assert.equal((await post(h,body,path+'?actor=h')).status,400);
  const response=await post(h);assert.equal(response.status,200);const result=await response.json();assert.equal(result.outcomeSource,'record-only');assert.equal(Object.hasOwn(result,'document'),false);const view=app.store.snapshot(id);assert.equal(view.manual!.winner,null);assert.equal(view.manual!.status,'ended');
 }finally{await app.close();}
});

test('record-only finish cannot end an ordinary manual Werewolf game',()=>{
 const s=new LobbyStore(':memory:');try{const id=setup(s,true);assert.throws(()=>finish(s,'h',id,{confirmed:true,version:0,revision:0}),/INVALID_INPUT/);assert.equal(s.snapshot(id).manual!.status,'playing');}finally{s.close();}
});

test('finished wolf-free records retain no-verdict provenance through corrections, restart and room deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-record-only-')),file=join(dir,'db');let s=new LobbyStore(file);try{
  const id=setup(s);s.saveRecord('h',id,0,{...emptyRecord(),notes:'Private until publish'});finish(s,'h',id,{confirmed:true,version:0,revision:1});assert.equal(s.snapshot(id).manual!.winner,null);const post=s.publishRecord('h',id,1);s.close();
  const db=new Database(file);db.pragma('foreign_keys=ON');db.prepare('DELETE FROM rooms WHERE id=?').run(id);db.close();s=new LobbyStore(file);
  assert.equal(s.recordPost('p',post.id).outcomeSource,'record-only');s.saveRecord('h',id,1,{...emptyRecord(),notes:'Corrected'});s.commitManual('h',id,2);s.publishRecord('h',id,2);assert.equal(s.recordPost('p',post.id).outcomeSource,'record-only');assert.equal(s.recordPost('p',post.id,1).document.notes,'Private until publish');assert.equal(s.manualHistory('h',id)[0].outcomeSource,'record-only');
 }finally{s.close();rmSync(dir,{recursive:true});}
});
