import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {sessionHash} from '../packages/storage/auth.js';
test('migration registers legacy replay-only favorites whose runtime and record archive are gone',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-legacy-replay-')),path=join(dir,'db'),token=randomBytes(32).toString('hex');let s=new LobbyStore(path);
 try{
  s.issueSession(token);s.close();const db=new Database(path);db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run(sessionHash(token),'legacy-only','1234','good',1,JSON.stringify({winner:'good',roles:[],rounds:[]}));db.close();
  s=new LobbyStore(path);const view=s.favoriteLibrary(token);assert.equal(view.items[0].id,'legacy-only');assert.equal(view.items[0].available,true);
 }finally{try{s.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});

test('legacy_first_game_ids_survive_two_reopens',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-games-')),path=join(dir,'db');
 const token=randomBytes(32).toString('hex');let s=new LobbyStore(path);
 try{
  s.issueSession(token);const first=s.create(token,'合成房主').room;s.select(token,first.id,1);
  assert.equal(first.gameId,first.id);assert.equal(first.gameNumber,1);
  s.close();
  // Recreate the exact pre-feature schema, with no game registration tables.
  const db=new Database(path);db.pragma('foreign_keys=ON');db.exec('DROP TABLE room_game_heads; DROP TABLE rematch_receipts; DROP TABLE room_games');db.close();
  for(let n=0;n<2;n++){
   s=new LobbyStore(path);const current=s.view(token,first.id).room;
   assert.equal(current.gameId,first.id);assert.equal(current.gameNumber,1);assert.equal(current.code,first.code);
   assert.equal(current.seats[0].nickname,'合成房主');s.close();
  }
  const inspect=new Database(path);assert.equal((inspect.prepare('SELECT COUNT(*) AS n FROM room_games').get() as {n:number}).n,1);
  inspect.pragma('foreign_keys=ON');inspect.prepare('DELETE FROM rooms WHERE id=?').run(first.id);
  assert.equal((inspect.prepare('SELECT COUNT(*) AS n FROM room_games').get() as {n:number}).n,1);
  assert.equal((inspect.prepare('SELECT COUNT(*) AS n FROM room_game_heads').get() as {n:number}).n,0);inspect.close();
 }finally{try{s.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});
