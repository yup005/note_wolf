import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {sharingFixture} from './helpers/sharing-fixture.js';
import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';

test('ordinary host privately collects an ended unpublished official draft without publication or new public access',async()=>{
 const f=await sharingFixture();const {s,token,id,recordId,document,players,admin}=f;
 try{
  s.auth.setVip(admin,f.account.id,false,null);
  assert.throws(()=>s.saveRecordFavorite(token,recordId),/PHASE_LOCKED/);
  s.saveRecord(token,id,0,document);s.commitManual(token,id,1);
  assert.deepEqual(s.saveRecordFavorite(token,recordId),{saved:true});s.saveRecordFavorite(token,recordId);
  const favorites=s.recordFavorites(token);assert.equal(favorites.length,1);assert.equal(favorites[0].privateRecord,true);assert.equal(favorites[0].version,0);
  const library=s.favoriteLibrary(token);assert.equal(library.advanced,false);assert.equal(library.items[0].privateRecord,true);assert.equal(JSON.stringify(library).includes(document.notes),false);
  assert.deepEqual(s.privateRecordFavorite(token,recordId).document,document);
  assert.equal(s.recordsList(token,id).own!.publishedVersion,null);assert.equal(s.recordsList(token,id).posts.length,0);
  for(const other of [players[1],admin]){
   assert.throws(()=>s.saveRecordFavorite(other,recordId),/NOT_FOUND/);assert.throws(()=>s.privateRecordFavorite(other,recordId),/NOT_FOUND/);assert.throws(()=>s.recordPost(other,recordId),/NOT_FOUND/);
  }
  assert.throws(()=>s.communityRead(token,{scope:{kind:'record',id:recordId}}),/NOT_FOUND/);
  assert.throws(()=>s.shareRecord(token,recordId,{action:'create',revision:0}),/VIP_ONLY/);
  s.auth.setVip(admin,f.account.id,true,null);assert.throws(()=>s.shareRecord(token,recordId,{action:'create',revision:0}),/SHARE_UNPUBLISHED/);
  assert.equal(s.favoriteLibrary(token,{q:document.notes}).items.length,0);
 }finally{s.close();}
});

test('private official favorite follows saved draft only, publication switches to immutable public versions and withdrawal stays locked',async()=>{
 const f=await sharingFixture();const {s,token,id,recordId,document}=f;
 try{
  s.saveRecord(token,id,0,document);s.commitManual(token,id,1);s.saveRecordFavorite(token,recordId);
  const date=s.recordFavorites(token)[0].savedAt;
  s.saveRecord(token,id,1,{...document,notes:'PRIVATE saved revision'});assert.equal(s.privateRecordFavorite(token,recordId).document.notes,'PRIVATE saved revision');
  s.publishRecord(token,id,2);assert.equal(s.favoriteLibrary(token).items[0].privateRecord,undefined);assert.equal(s.recordFavorites(token)[0].savedAt,date);assert.throws(()=>s.privateRecordFavorite(token,recordId),/NOT_FOUND/);
  s.saveRecord(token,id,2,{...document,notes:'PRIVATE never published'});assert.equal(s.recordPost(token,recordId).document.notes,'PRIVATE saved revision');
  s.withdrawRecord(token,id,3);assert.equal(s.favoriteLibrary(token).items[0].available,false);assert.throws(()=>s.privateRecordFavorite(token,recordId),/NOT_FOUND/);
 }finally{s.close();}
});

test('private favorites survive account takeover and restart; cancellation and deletion revoke their private bodies',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-private-favorite-')),path=join(dir,'db'),f=await sharingFixture(path);let s=f.s;
 try{
  s.auth.setVip(f.admin,f.account.id,false,null);s.saveRecord(f.token,f.id,0,f.document);s.commitManual(f.token,f.id,1);s.saveRecordFavorite(f.token,f.recordId);
  const guest=randomBytes(32).toString('hex');s.issueSession(guest);const login=await s.auth.login(guest,'share_author','correct-password');
  assert.throws(()=>s.privateRecordFavorite(f.token,f.recordId),/UNAUTHORIZED/);const db=new Database(path);db.pragma('foreign_keys=ON');db.prepare('DELETE FROM rooms WHERE id=?').run(f.id);db.close();s.close();s=new LobbyStore(path,undefined,true);
  assert.equal(s.privateRecordFavorite(login.token,f.recordId).document.notes,f.document.notes);
  s.removeRecordFavorite(login.token,f.recordId);assert.throws(()=>s.privateRecordFavorite(login.token,f.recordId),/NOT_FOUND/);
  s.saveRecordFavorite(login.token,f.recordId);s.deleteRecord(login.token,f.recordId,{requestId:randomUUID(),confirmed:true,revision:1,publishedVersion:null,withdrawn:false});
  assert.throws(()=>s.privateRecordFavorite(login.token,f.recordId),/NOT_FOUND/);assert.equal(s.favoriteLibrary(login.token).items[0].available,false);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('VIP personal unpublished records do not gain the owner-only official favorite exception',async()=>{
 const f=await sharingFixture();try{
  f.publish();const peer=await f.s.auth.register(f.players[1],'private_personal','correct-password','个人作者');f.s.auth.setVip(f.admin,peer.account.id,true,null);
  const own=f.s.recordsList(peer.token,f.id).own!;f.s.saveRecord(peer.token,f.id,0,{...f.document,notes:'PRIVATE personal draft'});
  assert.throws(()=>f.s.saveRecordFavorite(peer.token,own.id),/NOT_FOUND/);assert.throws(()=>f.s.privateRecordFavorite(peer.token,own.id),/NOT_FOUND/);assert.deepEqual(f.s.recordFavorites(peer.token),[]);
 }finally{f.s.close();}
});

test('a guest host keeps the same private favorite when binding a non-VIP account',async()=>{
 const s=new LobbyStore(':memory:',undefined,true),guest=randomBytes(32).toString('hex');s.issueSession(guest);
 try{
  const id=s.create(guest,'游客房主').room.id;s.select(guest,id,1);s.configure(guest,id,{dealMethod:'online',gameMode:'manual'});const players=fillRealPlayers(s,guest,id);s.setReady(guest,id,true,1);s.deal(guest,id);confirmRealPlayers(s,id,players);s.confirmIdentity(guest,id);s.start(guest,id);
  const own=s.recordsList(guest,id).own!,document={deaths:players.flatMap((p,i)=>s.identity(i===0?guest:p,id).role==='wolf'?[{seat:i+1,round:1,period:'night' as const,cause:'unrecorded' as const}]:[]),badges:[],exiles:[],votes:[],notes:'PRIVATE guest draft'};
  s.saveRecord(guest,id,0,document);s.commitManual(guest,id,1);s.saveRecordFavorite(guest,own.id);const before=s.recordFavorites(guest)[0];
  const account=await s.auth.register(guest,'guest_private_favorite','correct-password','绑定房主');assert.equal(account.account.vip?.active??false,false);assert.throws(()=>s.privateRecordFavorite(guest,own.id),/UNAUTHORIZED/);
  assert.deepEqual(s.recordFavorites(account.token),[before]);assert.equal(s.privateRecordFavorite(account.token,own.id).document.notes,document.notes);
 }finally{s.close();}
});
