import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {sharingFixture} from './helpers/sharing-fixture.js';

test('committed official corrections synchronize without republishing or exposing private draft notes',async()=>{
 const f=await sharingFixture();const {s,id,token,recordId,document}=f;
 try{
  f.publish();const link=s.shareRecord(token,recordId,{action:'create',revision:0});
  const original=s.sharedRecord(link.token!);const changed={...document,deaths:document.deaths.map(d=>({...d,cause:'poison' as const})),badges:[{round:1,seat:3}],notes:'PRIVATE unsent reasoning'};
  s.saveRecord(token,id,1,changed);
  assert.deepEqual(s.sharedRecord(link.token!).officialUpdate?.current.document.deaths,document.deaths);
  s.commitManual(token,id,2);
  const shared=s.sharedRecord(link.token!),post=s.recordPost(token,recordId,1);
  for(const body of [shared,post]){
   assert.equal(body.version,1);assert.deepEqual(body.document,original.document);
   assert.deepEqual(body.officialUpdate?.current.document,{...changed,notes:''});
   assert.equal(body.officialUpdate?.history.length,2);assert.equal(body.officialUpdate?.current.version,2);
   assert.equal(JSON.stringify(body).includes('PRIVATE'),false);
  }
  s.withdrawRecord(token,id,2);assert.throws(()=>s.sharedRecord(link.token!),/SHARE_UNAVAILABLE/);
 }finally{s.close();}
});

test('official sync survives runtime cleanup and restart, strips legacy revision notes and preserves version rows',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-official-sync-')),path=join(dir,'db'),f=await sharingFixture(path);let s=f.s;
 try{
  f.publish();const link=s.shareRecord(f.token,f.recordId,{action:'create',revision:0});
  s.saveRecord(f.token,f.id,1,{...f.document,deaths:[],notes:'PRIVATE archived draft'});
  s.commitManual(f.token,f.id,2);
  const db=new Database(path);db.pragma('foreign_keys=ON');
  db.prepare("UPDATE manual_revisions SET document=json_set(document,'$.notes','PRIVATE legacy notes') WHERE room_id=?").run(f.id);
  const versions=db.prepare('SELECT * FROM record_versions').all();db.prepare('DELETE FROM rooms WHERE id=?').run(f.id);db.close();
  s.close();s=new LobbyStore(path,undefined,true);
  let body=s.sharedRecord(link.token!);assert.equal(body.officialUpdate?.current.outcome,null);assert.deepEqual(body.officialUpdate?.current.document.deaths,[]);
  assert.equal(JSON.stringify(body).includes('PRIVATE'),false);
  s.saveRecord(f.token,f.id,2,{...f.document,badges:[{round:2,seat:null}],notes:'PRIVATE cleanup draft'});s.commitManual(f.token,f.id,3);
  body=s.sharedRecord(link.token!);assert.equal(body.officialUpdate?.current.version,3);assert.equal(body.officialUpdate?.current.outcome,'good');assert.equal(body.officialUpdate?.history.length,3);
  assert.equal(body.document.notes,'已发布复盘');assert.equal(JSON.stringify(body).includes('PRIVATE'),false);
  const check=new Database(path);assert.deepEqual(check.prepare('SELECT * FROM record_versions').all(),versions);check.close();
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('a VIP personal published version is not overwritten by official corrections',async()=>{
 const f=await sharingFixture();const {s,id,players,admin}=f;
 try{
  f.publish();const account=await s.auth.register(players[1],'personal_sync','correct-password','个人作者');s.auth.setVip(admin,account.account.id,true,null);
  s.recordsList(account.token,id);s.saveRecord(account.token,id,0,{...f.document,notes:'个人发布内容'});const personal=s.publishRecord(account.token,id,1),link=s.shareRecord(account.token,personal.id,{action:'create',revision:0});
  const original=s.sharedRecord(link.token!);s.saveRecord(f.token,id,1,{...f.document,deaths:[],notes:'PRIVATE host draft'});s.commitManual(f.token,id,2);
  assert.deepEqual(s.sharedRecord(link.token!),original);assert.equal(s.recordPost(account.token,personal.id).officialUpdate,undefined);
 }finally{s.close();}
});
