import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {manualGame,endManual} from './helpers/rematch.js';
import {ParticipationStore} from '../packages/storage/participation.js';
test('live legacy backfill proves owners without inventing any expired game identity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-participation-')),file=join(dir,'db');const {s,tokens,id}=manualGame(file),db=new Database(file),map=new ParticipationStore(db);
 try{const owner=s.auth.owner(tokens[0]);db.prepare('DELETE FROM game_participants WHERE game_id=?').run(id);db.prepare('DELETE FROM game_statistics_eligibility WHERE game_id=?').run(id);assert.deepEqual(map.games(owner),[]);map.backfillLive();assert.deepEqual(map.games(owner),[id]);assert.deepEqual(map.games('unrelated-owner'),[]);assert.deepEqual(map.identity(id,owner),{seat:1,role:'wolf'});}finally{db.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
test('frozen owner correspondence survives cleanup without zipping old participant arrays',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-participation-')),file=join(dir,'db');const {s,tokens,id}=manualGame(file),db=new Database(file),map=new ParticipationStore(db);
 try{const owner=s.auth.owner(tokens[0]);map.capture(id);assert.deepEqual(map.identity(id,owner),{seat:1,role:'wolf'});
  endManual(s,tokens[0],id);s.cleanupExpiredRooms();db.prepare('DELETE FROM rooms WHERE id=?').run(id);assert.deepEqual(map.identity(id,owner),{seat:1,role:'wolf'});
  db.prepare('DELETE FROM game_participants WHERE game_id=?').run(id);db.prepare('DELETE FROM game_statistics_eligibility WHERE game_id=?').run(id);map.capture(id);assert.equal(map.identity(id,owner),null,'an expired old archive never gains a guessed positional identity');
 }finally{db.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
test('capture refuses inconsistent frozen rosters and owner ambiguity is not resolved by seat order',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-participation-')),file=join(dir,'db');const {s,tokens,id}=manualGame(file),db=new Database(file),map=new ParticipationStore(db);
 try{db.prepare('DELETE FROM game_participants WHERE game_id=?').run(id);db.prepare('DELETE FROM game_statistics_eligibility WHERE game_id=?').run(id);const owner=s.auth.owner(tokens[0]),other=s.auth.owner(tokens[1]),original=(db.prepare('SELECT roles FROM record_rooms WHERE room_id=?').get(id) as {roles:string}).roles;
  db.prepare("UPDATE record_rooms SET roles='[]' WHERE room_id=?").run(id);map.capture(id);assert.equal(map.identity(id,owner),null);db.prepare("UPDATE record_rooms SET roles='not-json' WHERE room_id=?").run(id);assert.doesNotThrow(()=>map.capture(id),'malformed legacy evidence is omitted rather than breaking all statistics');db.prepare('UPDATE record_rooms SET roles=? WHERE room_id=?').run(original,id);db.prepare('UPDATE identities SET confirmed=0 WHERE room_id=? AND member_id=(SELECT id FROM members WHERE room_id=? AND seat=1)').run(id,id);map.capture(id);assert.equal(map.identity(id,owner),null,'unconfirmed live identities cannot prove old participation');db.prepare('UPDATE identities SET confirmed=1 WHERE room_id=?').run(id);map.capture(id);assert.ok(map.identity(id,owner));
  db.prepare('UPDATE game_participants SET owner=? WHERE game_id=? AND owner=?').run(owner,id,other);assert.equal(map.identity(id,owner),null,'two proven seats must stay ambiguous');
 }finally{db.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
test('simulated eligibility remains excluded after its runtime test marker is removed',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-participation-')),file=join(dir,'db');const {s,tokens,id}=manualGame(file),db=new Database(file),map=new ParticipationStore(db);
 try{db.prepare('DELETE FROM game_participants WHERE game_id=?').run(id);db.prepare('DELETE FROM game_statistics_eligibility WHERE game_id=?').run(id);db.prepare('INSERT INTO test_rooms(room_id) VALUES (?)').run(id);map.capture(id);assert.equal(map.identity(id,s.auth.owner(tokens[0])),null);db.prepare('DELETE FROM test_rooms WHERE room_id=?').run(id);assert.equal(map.identity(id,s.auth.owner(tokens[0])),null);assert.equal((db.prepare('SELECT kind FROM game_statistics_eligibility WHERE game_id=?').get(id) as {kind:string}).kind,'test');
 }finally{db.close();s.close();rmSync(dir,{recursive:true,force:true});}
});
