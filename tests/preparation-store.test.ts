import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';
import type {Role} from '../packages/contracts/index.js';
function full(db:LobbyStore){
 const {room}=db.create('h','Host');const tokens=['h',...Array.from({length:11},(_,i)=>'p'+i)];
 tokens.forEach((t,i)=>{if(i)db.join(t,room.code,t);db.select(t,room.id,i+1);db.setReady(t,room.id,true,db.snapshot(room.id).preparation.settingsRevision);});
 return {id:room.id,tokens};
}
test('seat correction preserves uniqueness and clears only affected readiness',()=>{
 const db=new LobbyStore(':memory:');try{
  const {room}=db.create('h','H');db.join('g',room.code,'G');db.select('h',room.id,1);db.setReady('h',room.id,true,db.snapshot(room.id).preparation.settingsRevision);
  db.select('g',room.id,2);assert.throws(()=>db.select('h',room.id,2),/SEAT_TAKEN/);
  assert.equal(db.view('h',room.id).me.seat,1);db.select('h',room.id,3);
  assert.equal(db.view('h',room.id).room.seats.filter(s=>s.memberId===db.view('h',room.id).me.id).length,1);
  assert.equal(db.view('h',room.id).room.seats[2].ready,false);
  db.unseat('h',room.id);assert.equal(db.view('h',room.id).me.seat,null);
 }finally{db.close();}
});
test('host settings reset preparation; dealing locks settings and seats',()=>{
 const db=new LobbyStore(':memory:');try{
  const {id,tokens}=full(db);assert.throws(()=>db.configure(tokens[1],id,{dealMethod:'physical',gameMode:'manual'}),/HOST_ONLY/);
  db.configure('h',id,{dealMethod:'online',gameMode:'automatic'});assert.equal(db.snapshot(id).seats.every(s=>s.ready),true);
  db.configure('h',id,{dealMethod:'physical',gameMode:'manual'});assert.equal(db.snapshot(id).seats.some(s=>s.ready),false);
  assert.throws(()=>db.deal('h',id),/NOT_ALL_READY/);tokens.forEach(t=>db.setReady(t,id,true,db.snapshot(id).preparation.settingsRevision));db.deal('h',id);
  assert.throws(()=>db.unseat('h',id),/PHASE_LOCKED/);assert.throws(()=>db.select('h',id,1),/PHASE_LOCKED/);
  assert.throws(()=>db.configure('h',id,{dealMethod:'online',gameMode:'automatic'}),/PHASE_LOCKED/);
 }finally{db.close();}
});
for(const gameMode of ['automatic','manual'] as const)for(const dealMethod of ['online','physical'] as const){
 test(`${dealMethod}/${gameMode}: private identities validate, start once and cannot be modified`,()=>{
  const db=new LobbyStore(':memory:');try{
   const {id,tokens}=full(db);db.configure('h',id,{dealMethod,gameMode});tokens.forEach(t=>db.setReady(t,id,true,db.snapshot(id).preparation.settingsRevision));
   assert.throws(()=>db.deal(tokens[1],id),/HOST_ONLY/);db.deal('h',id);assert.throws(()=>db.identity('intruder',id),/NOT_MEMBER/);
   if(dealMethod==='physical'){
    tokens.forEach(t=>db.submitIdentity(t,id,'wolf'));assert.equal(db.snapshot(id).preparation.validation,'mismatch');
    assert.throws(()=>db.start('h',id),/ROLE_MISMATCH/);
    const roles:Role[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
    tokens.forEach((t,i)=>db.submitIdentity(t,id,roles[i]));
   }else{
    assert.throws(()=>db.submitIdentity('h',id,'wolf'),/PHASE_LOCKED/);
    assert.throws(()=>db.start('h',id),/IDENTITY_INCOMPLETE/);
    tokens.forEach(t=>db.confirmIdentity(t,id));
   }
   const before=tokens.map(t=>db.identity(t,id).role);db.deal('h',id);assert.deepEqual(tokens.map(t=>db.identity(t,id).role),before);
   const snapshot=db.snapshot(id);assert.equal(JSON.stringify(snapshot).includes('"role"'),false);
   assert.equal(db.start('h',id).room.preparation.phase,'started');const revision=db.snapshot(id).revision;
   db.start('h',id);db.deal('h',id);assert.equal(db.snapshot(id).revision,revision);
   assert.throws(()=>db.submitIdentity('h',id,'wolf'),/PHASE_LOCKED/);assert.equal(db.identity('h',id).locked,true);
  }finally{db.close();}
 });
}
test('old SQLite structure migrates without losing membership; cards survive restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-prep-'));const file=join(dir,'db.sqlite');
 const old=new Database(file);old.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL); CREATE TABLE members(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,session_hash TEXT NOT NULL,nickname TEXT NOT NULL,is_host INTEGER NOT NULL DEFAULT 0,seat INTEGER,UNIQUE(room_id,session_hash),UNIQUE(room_id,seat));');old.exec('CREATE TABLE sessions(session_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL);');
 old.prepare('INSERT INTO rooms(id,code,created_at) VALUES (?,?,?)').run('old-room','0007',1);
 old.prepare('INSERT INTO sessions VALUES (?,?)').run(createHash('sha256').update('old-token').digest('hex'),1);
 old.prepare('INSERT INTO members(id,room_id,session_hash,nickname,is_host,seat) VALUES (?,?,?,?,?,?)').run('old-member','old-room',createHash('sha256').update('old-token').digest('hex'),'Existing',1,7);
 old.close();
 let db=new LobbyStore(file);try{
  assert.equal(db.hasSession('old-token'),true);assert.equal(db.view('old-token','old-room').me.seat,7);assert.equal(db.view('old-token','old-room').me.id,'old-member');
  const {id,tokens}=full(db);db.issueSession('h');db.deal('h',id);const roles=tokens.map(t=>db.identity(t,id).role);const member=db.view('h',id).me.id;
  db.close();db=new LobbyStore(file);assert.equal(db.hasSession('h'),true);assert.equal(db.view('h',id).me.id,member);
  db.deal('h',id);assert.deepEqual(tokens.map(t=>db.identity(t,id).role),roles);
 }finally{db.close();rmSync(dir,{recursive:true});}
});

test('a delayed ready command cannot approve a newer host configuration',()=>{
 const db=new LobbyStore(':memory:');try{
  const {id}=full(db);const accepted=db.snapshot(id).preparation.settingsRevision;
  db.configure('h',id,{dealMethod:'physical',gameMode:'manual'});
  assert.throws(()=>db.setReady('h',id,true,accepted),/SETTINGS_CHANGED/);
  assert.equal(db.snapshot(id).seats.some(s=>s.ready),false);
 }finally{db.close();}
});
