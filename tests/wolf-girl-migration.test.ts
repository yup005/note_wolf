import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {boardRoleSchema} from '../packages/contracts/board.js';
import {migrateIdentityRoles} from '../packages/storage/identityMigration.js';
import {ParticipationStore} from '../packages/storage/participation.js';

test('old mechanical identity and participation constraints upgrade without losing locked cards or historical owners',()=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');const oldRoles=boardRoleSchema.options.filter(r=>r!=='wolfGirl'&&r!=='poisoner').map(r=>`'${r}'`).join(',');
 try{
  db.exec(`CREATE TABLE rooms(id TEXT PRIMARY KEY);CREATE TABLE members(id TEXT PRIMARY KEY);CREATE TABLE record_rooms(room_id TEXT PRIMARY KEY);
   CREATE TABLE identities(room_id TEXT REFERENCES rooms(id),member_id TEXT REFERENCES members(id),role TEXT NOT NULL CHECK(role IN (${oldRoles})),confirmed INTEGER NOT NULL,PRIMARY KEY(room_id,member_id));
   CREATE TABLE game_participants(game_id TEXT NOT NULL REFERENCES record_rooms(room_id) ON DELETE CASCADE,owner TEXT NOT NULL,seat INTEGER NOT NULL CHECK(seat BETWEEN 1 AND 256),role TEXT NOT NULL CHECK(role IN (${oldRoles})),PRIMARY KEY(game_id,owner,seat));
   INSERT INTO rooms VALUES ('r');INSERT INTO members VALUES ('old'),('girl'),('poisoner');INSERT INTO record_rooms VALUES ('g');INSERT INTO identities VALUES ('r','old','mechanicalWolf',1);INSERT INTO game_participants VALUES ('g','old-owner',1,'mechanicalWolf');`);
  migrateIdentityRoles(db);new ParticipationStore(db);
  assert.doesNotThrow(()=>db.exec("INSERT INTO identities VALUES ('r','girl','wolfGirl',1),('r','poisoner','poisoner',1);INSERT INTO game_participants VALUES ('g','girl-owner',2,'wolfGirl'),('g','poison-owner',3,'poisoner')"));
  migrateIdentityRoles(db);new ParticipationStore(db);assert.equal((db.prepare('SELECT COUNT(*) n FROM identities WHERE confirmed=1').get() as {n:number}).n,3);assert.deepEqual(db.prepare("SELECT owner,seat,role FROM game_participants WHERE owner='old-owner'").get(),{owner:'old-owner',seat:1,role:'mechanicalWolf'});assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
