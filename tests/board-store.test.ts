import {seedTestAdmin} from './helpers/test-admin.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {boardPreset as preset} from '../packages/domain/boardConfig.js';
function boardPreset(id:Parameters<typeof preset>[0]){const {seatCount,roles}=preset(id);return {seatCount,roles};}

test('private saved boards survive restart and room snapshots do not track later edits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-boards-'));const file=join(dir,'db.sqlite');let store=new LobbyStore(file);
 try{
  const saved=store.saveBoard('h',{name:'Mixer 13',composition:boardPreset('mechanical-mixer-13'),id:null,revision:0});
  assert.equal(store.boardLibrary('g').custom.length,0);
  const room=store.create('h','H').room;store.configureBoard('h',room.id,{selection:{kind:'custom',id:saved.id},settingsRevision:0});
  assert.equal(store.snapshot(room.id).seats.length,13);assert.equal(store.snapshot(room.id).board.ruleVersion,'2026-10-10-v1');
  store.select('h',room.id,13);store.setReady('h',room.id,true,1);
  assert.throws(()=>store.saveBoard('g',{id:saved.id,revision:saved.revision,name:saved.name,composition:boardPreset('standard-12')}),/BOARD_NOT_FOUND/);
  const updated=store.saveBoard('h',{id:saved.id,revision:saved.revision,name:saved.name,composition:boardPreset('mechanical-expanded-15')});
  assert.equal(updated.composition.seatCount,15);assert.equal(store.snapshot(room.id).board.composition.seatCount,13);
  assert.throws(()=>store.saveBoard('h',{id:saved.id,revision:saved.revision,name:'stale',composition:boardPreset('standard-12')}),/STALE_BOARD/);
  assert.throws(()=>store.configureBoard('h',room.id,{selection:{kind:'preset',id:'standard-12'},settingsRevision:1}),/OCCUPIED_SEATS_OUTSIDE_BOARD/);
  assert.equal(store.snapshot(room.id).seats[12].ready,true);
  assert.throws(()=>store.configureBoard('h',room.id,{selection:{kind:'preset',id:'mechanical-12'},settingsRevision:0}),/SETTINGS_CHANGED/);
  store.issueSession('h');store.close();store=new LobbyStore(file);
  assert.equal(store.view('h',room.id).me.seat,13);assert.equal(store.boardLibrary('h').custom[0].composition.seatCount,15);
  assert.equal(store.snapshot(room.id).board.composition.seatCount,13);
  store.unseat('h',room.id);store.configureBoard('h',room.id,{selection:{kind:'preset',id:'standard-12'},settingsRevision:1});
  assert.equal(store.snapshot(room.id).seats.length,12);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('three fixed templates cannot be overwritten, and host configuration validates both roles and revision',()=>{
 const store=new LobbyStore(':memory:',undefined,true);try{seedTestAdmin(store,'h');
  const library=store.boardLibrary('h');assert.equal(library.presets.length,3);library.presets[0].composition.roles.wolf=99;
  assert.equal(store.boardLibrary('h').presets[0].composition.roles.wolf,4);
  assert.throws(()=>store.saveBoard('h',{id:'standard-12',revision:1,name:'overwrite',composition:boardPreset('standard-12')}),/INVALID_INPUT|BOARD_NOT_FOUND/);
  const room=store.create('h','H').room;store.join('g',room.code,'G');store.select('h',room.id,1);store.setReady('h',room.id,true,0);
  assert.throws(()=>store.configureBoard('g',room.id,{selection:{kind:'preset',id:'mechanical-12'},settingsRevision:0}),/HOST_ONLY/);
  assert.throws(()=>store.configureBoard('h',room.id,{selection:{kind:'composition',composition:{seatCount:2,roles:{witch:2}}},settingsRevision:0}),/INVALID_INPUT|INVALID_BOARD_CONFIGURATION/);
  assert.equal(store.snapshot(room.id).seats[0].ready,true);
  store.configureBoard('h',room.id,{selection:{kind:'composition',composition:{seatCount:2,roles:{mechanicalWolf:1,armoredWolf:1}}},settingsRevision:0});
  assert.equal(store.snapshot(room.id).board.composition.ruleset,'mechanical-armor');assert.equal(store.snapshot(room.id).seats[0].ready,false);
  assert.throws(()=>store.select('g',room.id,3),/INVALID_SEAT/);
  assert.throws(()=>store.deal('h',room.id),/ROOM_NOT_FULL/);
  assert.throws(()=>store.fillTestPlayers('h',room.id),/TEST_ROOM_NOT_EMPTY/);
 }finally{store.close();}
});

test('guest template library follows account linkage and old session takeover cannot use it',async()=>{
 const store=new LobbyStore(':memory:');try{
  store.issueSession('guest');const saved=store.saveBoard('guest',{id:null,revision:0,name:'Mine',composition:boardPreset('mechanical-12')});
  const registered=await store.auth.register('guest','boardowner','long-test-password','Owner');
  assert.equal(store.boardLibrary(registered.token).custom[0].id,saved.id);
  const next=await store.auth.login(registered.token,'boardowner','long-test-password');
  assert.equal(store.hasSession(registered.token),false);assert.equal(store.boardLibrary(next.token).custom[0].id,saved.id);
 }finally{store.close();}
});

test('switching a development test room back to the original board retains automatic simulated readiness',()=>{
 const store=new LobbyStore(':memory:',undefined,true);try{seedTestAdmin(store,'h');
  const room=store.create('h','Host').room;store.select('h',room.id,1);store.fillTestPlayers('h',room.id);
  store.configureBoard('h',room.id,{selection:{kind:'preset',id:'mechanical-12'},settingsRevision:0});
  store.configureBoard('h',room.id,{selection:{kind:'preset',id:'standard-12'},settingsRevision:1});
  assert.equal(store.snapshot(room.id).seats.filter(s=>s.ready).length,11);
  store.setReady('h',room.id,true,2);assert.doesNotThrow(()=>store.deal('h',room.id));
 }finally{store.close();}
});

test('seat schema migration preserves existing locked cards, memberships and foreign keys',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-board-migrate-'));const file=join(dir,'db.sqlite');let store=new LobbyStore(file);
 try{
  const room=store.create('h','H').room;const tokens=Array.from({length:12},(_,i)=>i?'p'+i:'h');
  tokens.forEach((t,i)=>{if(i)store.join(t,room.code,t);store.select(t,room.id,i+1);store.setReady(t,room.id,true,0);});
  store.deal('h',room.id);tokens.forEach(t=>store.confirmIdentity(t,room.id));store.start('h',room.id);
  const cards=tokens.map(t=>store.identity(t,room.id));store.issueSession('h');store.close();
  const db=new Database(file);assert.equal((db.prepare('SELECT rule_version FROM room_boards WHERE room_id=?').get(room.id) as {rule_version:string}|undefined)?.rule_version,'2026-10-10-v1');db.pragma('foreign_keys=OFF');db.exec(`CREATE TABLE old_members(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,nickname TEXT NOT NULL,is_host INTEGER NOT NULL DEFAULT 0,seat INTEGER CHECK(seat BETWEEN 1 AND 12),ready INTEGER NOT NULL DEFAULT 0,UNIQUE(room_id,session_hash),UNIQUE(room_id,seat)); INSERT INTO old_members SELECT * FROM members; DROP TABLE members; ALTER TABLE old_members RENAME TO members;`);db.close();
  store=new LobbyStore(file);assert.deepEqual(tokens.map(t=>store.identity(t,room.id)),cards);
  assert.throws(()=>store.configureBoard('h',room.id,{selection:{kind:'preset',id:'mechanical-12'},settingsRevision:0}),/PHASE_LOCKED/);
  store.close();const check=new Database(file);assert.deepEqual(check.pragma('foreign_key_check'),[]);check.close();
  store=new LobbyStore(file);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
