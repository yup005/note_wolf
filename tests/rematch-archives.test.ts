import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import Database from 'better-sqlite3';
import {RecordsStore} from '../packages/storage/records.js';
import {emptyRecord} from '../packages/contracts/records.js';
import {manualGame,endManual} from './helpers/rematch.js';
import {LobbyStore} from '../packages/storage/lobby.js';
test('restart never backfills the first standard game with the second game dual-category policy',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-policy-isolation-')),file=join(dir,'db');const f=manualGame(file);let s=f.s;const db=new Database(file);
 try{
  endManual(s,f.tokens[0],f.id);s.rematch(f.tokens[0],f.id,{requestId:randomUUID(),expectedGameId:f.id});
  s.configureBoard(f.tokens[0],f.id,{settingsRevision:s.snapshot(f.id).preparation.settingsRevision,selection:{kind:'composition',composition:{seatCount:14,roles:{wolf:4,villager:6,seer:1,witch:1,hunter:1,idiot:1},idiotPolicy:'dual-category-14'}}});
  s.close();s=new LobbyStore(file);
  assert.equal((db.prepare('SELECT idiot_policy FROM record_rooms WHERE room_id=?').get(f.id) as {idiot_policy:string|null}).idiot_policy,null);
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
test('upgrading an ended live archive fills its missing public board before rematch',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-old-live-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{endManual(s,t[0],id);db.exec('DELETE FROM game_board_archives');const next=s.rematch(t[0],id,{requestId:randomUUID(),expectedGameId:id});assert.equal(next.game.gameNumber,2);assert.equal(s.recordContext(t[0],id).board?.id,'standard-12');}
 finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
test('expired legacy archive without a board snapshot remains editable without inventing a configuration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-old-expired-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);db.pragma('foreign_keys=ON');
 try{
  const draft=endManual(s,t[0],id);s.publishRecord(t[0],id,draft.revision);
  db.exec('DELETE FROM game_board_archives');db.prepare('DELETE FROM rooms WHERE id=?').run(id);
  const context=s.recordContext(t[0],id);assert.equal(context.board,null);assert.equal(context.ended,true);
  const saved=s.saveRecord(t[0],id,draft.revision,{...draft.document,notes:'旧归档新笔记'});assert.equal(s.publishRecord(t[0],id,saved.revision).version,2);
  assert.equal(s.recordPost(t[0],draft.id).document.notes,'旧归档新笔记');
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test('first_game_read_never_uses_second_game_runtime',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-archive-scope-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{
  const draft=endManual(s,t[0],id);const post=s.publishRecord(t[0],id,draft.revision);s.saveRecordFavorite(t[1],post.id);
  const before=s.recordPost(t[1],post.id);
  const records=new RecordsStore(db,s.auth,()=>1000,()=>s.gameReplay(t[0],id));
  records.archiveEnded(id,id);
  const second=randomUUID();db.prepare('INSERT INTO room_games VALUES (?,?,2,1001)').run(second,id);db.prepare('UPDATE room_game_heads SET game_id=? WHERE room_id=?').run(second,id);
  db.prepare("UPDATE preparations SET game_mode='automatic' WHERE room_id=?").run(id);
  db.prepare("UPDATE manual_games SET status='playing',official=?,version=900 WHERE room_id=?").run(JSON.stringify(emptyRecord()),id);
  assert.deepEqual(s.recordPost(t[1],post.id),before);
  const edited=s.saveRecord(t[0],id,draft.revision,{...draft.document,notes:'旧局新私稿'});s.commitManual(t[0],id,edited.revision);
  assert.equal((db.prepare('SELECT version FROM manual_games WHERE room_id=?').get(id) as {version:number}).version,900);
  assert.equal(s.recordsList(t[0],id).own!.document.notes,'旧局新私稿');
  const stranger=randomBytes(32).toString('hex');s.issueSession(stranger);s.join(stranger,s.snapshot(id).code,'第二局才加入');
  assert.throws(()=>s.recordPost(stranger,post.id),/PARTICIPANT_ONLY/);
  assert.equal(s.recordFavorites(t[1])[0].id,post.id);
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
