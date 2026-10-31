import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import {manualGame,endManual,prepareManual} from './helpers/rematch.js';
import {backupDatabase,inspectBackup,restoreDatabase} from '../packages/storage/databaseBackup.js';
import Database from 'better-sqlite3';
test('conflicting account receipt aborts binding without changing either game or guest authority',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-bind-conflict-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{
  endManual(s,t[0],id);const c={requestId:randomUUID(),expectedGameId:id};const next=s.rematch(t[0],id,c);
  const account=await s.auth.createAccount('rematch_conflict_owner','synthetic-conflict-password','合成账号');
  db.prepare('INSERT INTO rematch_receipts VALUES (?,?,?,?,?)').run('account:'+account.id,id,c.requestId,JSON.stringify(c),next.game.gameId);
  await assert.rejects(s.auth.login(t[0],'rematch_conflict_owner','synthetic-conflict-password'),/RECORD_ACCOUNT_CONFLICT/);
  assert.equal(s.hasSession(t[0]),true);assert.equal(s.view(t[0],id).me.isHost,true);assert.equal(s.rematch(t[0],id,c).game.gameId,next.game.gameId);assert.equal(s.recordsList(t[0],id).own!.document.notes,'合成私密笔记');
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
test('two game shares remain independent through unpublished edits, deletion and retention',async()=>{
 let now=1000;const {s,tokens:t,id}=manualGame(':memory:',()=>now);
 try{
  const account=await s.auth.register(t[0],'rematch_share_author','synthetic-share-password','合成作者');t[0]=account.token;
  const admin=randomBytes(32).toString('hex');s.issueSession(admin);await s.auth.createAccount('rematch_share_admin','synthetic-admin-password','合成管理员','admin');const logged=await s.auth.login(admin,'rematch_share_admin','synthetic-admin-password');s.auth.setVip(logged.token,account.account.id,true,null);
  const first=endManual(s,t[0],id,'第一局发布');const p1=s.publishRecord(t[0],id,first.revision),link1=s.shareRecord(t[0],p1.id,{action:'create',revision:0});
  const next=s.rematch(t[0],id,{requestId:randomUUID(),expectedGameId:id});prepareManual(s,id,t);
  const second=endManual(s,t[0],next.game.gameId,'第二局发布');const p2=s.publishRecord(t[0],next.game.gameId,second.revision),link2=s.shareRecord(t[0],p2.id,{action:'create',revision:0});
  s.saveRecord(t[0],id,first.revision,{...first.document,notes:'旧局未发布秘密'});
  assert.equal(s.sharedRecord(link1.token!).document.notes,'第一局发布');assert.equal(s.sharedRecord(link2.token!).document.notes,'第二局发布');
  s.deleteRecord(t[0],p1.id,{requestId:randomUUID(),confirmed:true,revision:2,publishedVersion:1,withdrawn:false});
  assert.throws(()=>s.sharedRecord(link1.token!));assert.equal(s.sharedRecord(link2.token!).document.notes,'第二局发布');assert.equal(s.snapshot(id).gameId,next.game.gameId);
  now+=86400001;assert.deepEqual(s.cleanupExpiredRooms(),[]);
 }finally{s.close();}
});
test('backup refuses a head pointing at another room game even when SQLite foreign keys are valid',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-corrupt-')),file=join(dir,'db'),output=join(dir,'copy');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{
  const other=s.create(t[0],'合成第二房间').room.id;
  db.exec('DELETE FROM room_game_heads');db.prepare('INSERT INTO room_game_heads VALUES (?,?)').run(id,other);db.prepare('INSERT INTO room_game_heads VALUES (?,?)').run(other,id);
  assert.deepEqual(db.pragma('foreign_key_check'),[]);
  await assert.rejects(backupDatabase({source:file,output}),/INVALID_DATABASE/);
 }finally{db.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
test('backup restored into a new file retains both games, current head and exact retry',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-backup-')),file=join(dir,'live.db'),backup=join(dir,'backup.db'),restored=join(dir,'restored.db');const {s,tokens:t,id}=manualGame(file);let copy:LobbyStore|undefined;
 try{
  const first=endManual(s,t[0],id);s.publishRecord(t[0],id,first.revision);const c={requestId:randomUUID(),expectedGameId:id};const second=s.rematch(t[0],id,c);
  prepareManual(s,id,t);endManual(s,t[0],second.game.gameId,'第二局独立私稿');
  const result=await backupDatabase({source:file,output:backup});assert.ok((await inspectBackup({source:backup})).bytes>0);await restoreDatabase({source:backup,output:restored,sha256:result.sha256});
  copy=new LobbyStore(restored);assert.equal(copy.snapshot(id).gameId,second.game.gameId);assert.equal(copy.rematch(t[0],id,c).game.gameId,second.game.gameId);
  assert.equal(copy.recordPost(t[0],first.id).document.notes,'合成私密笔记');assert.equal(copy.recordsList(t[0],second.game.gameId).own!.document.notes,'第二局独立私稿');
 }finally{s.close();copy?.close();rmSync(dir,{recursive:true,force:true});}
});
test('second game favorite protects its original room and cleanup retains both games',()=>{
 let now=1000;const {s,tokens:t,id}=manualGame(':memory:',()=>now);
 try{
  const first=endManual(s,t[0],id);s.publishRecord(t[0],id,first.revision);const next=s.rematch(t[0],id,{requestId:randomUUID(),expectedGameId:id});
  prepareManual(s,id,t);const second=endManual(s,t[0],next.game.gameId);const post=s.publishRecord(t[0],next.game.gameId,second.revision);s.saveRecordFavorite(t[0],post.id);
  now+=86400001;assert.deepEqual(s.cleanupExpiredRooms(),[]);
  s.removeRecordFavorite(t[0],post.id);now+=86400001;assert.deepEqual(s.cleanupExpiredRooms(),[id]);
  assert.equal(s.recordPost(t[0],first.id).document.notes,'合成私密笔记');assert.equal(s.recordPost(t[0],post.id).document.notes,'合成私密笔记');
 }finally{s.close();}
});
test('guest rematch receipt and archived participants survive account binding and restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-owner-')),file=join(dir,'db');const f=manualGame(file);let s=f.s;
 try{
  const first=endManual(s,f.tokens[0],f.id);s.publishRecord(f.tokens[0],f.id,first.revision);const c={requestId:randomUUID(),expectedGameId:f.id};const next=s.rematch(f.tokens[0],f.id,c);
  const account=await s.auth.register(f.tokens[0],'rematch_account','safe-synthetic-password','合成账号');
  assert.equal(s.rematch(account.token,f.id,c).game.gameId,next.game.gameId);
  assert.equal(s.recordPost(account.token,first.id).id,first.id);assert.throws(()=>s.rematch(f.tokens[0],f.id,c),/UNAUTHORIZED/);
  s.close();s=new LobbyStore(file);assert.equal(s.rematch(account.token,f.id,c).game.gameId,next.game.gameId);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
