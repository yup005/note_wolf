import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {manualGame,endManual,prepareManual} from './helpers/rematch.js';
import {EngineStore} from '../packages/storage/engine.js';
import {createEngineState} from '../packages/domain/engine.js';
import {syntheticRoles} from './helpers/rematch.js';
test('optional standalone engine state is cleared along with active day and night state',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-engine-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{
  const engine=new EngineStore(db,roomId=>s.snapshot(roomId).board);
  engine.save(id,createEngineState(s.snapshot(id).board,syntheticRoles.map((role,i)=>({seat:i+1,role,knifeGroup:role==='wolf'?'shared' as const:'none' as const}))),0);assert.equal(engine.load(id)!.revision,1);
  endManual(s,t[0],id);s.rematch(t[0],id,command(id));assert.equal(engine.load(id),null);
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
const command=(expectedGameId:string)=>({requestId:randomUUID(),expectedGameId});
test('ended_game_restarts_in_same_seats_without_identities and old commands cannot advance third game',()=>{
 const {s,tokens:t,id}=manualGame();try{
  const original=s.snapshot(id);assert.throws(()=>s.rematch(t[0],id,command(id)),/PHASE_LOCKED/);
  const draft=endManual(s,t[0],id);const post=s.publishRecord(t[0],id,draft.revision);s.saveRecordFavorite(t[1],post.id);
  assert.throws(()=>s.rematch(t[1],id,command(id)),/HOST_ONLY/);
  const c=command(id),next=s.rematch(t[0],id,c),room=next.view.room;
  assert.equal(room.id,id);assert.equal(room.code,original.code);assert.notEqual(room.gameId,id);assert.equal(room.gameNumber,2);
  assert.deepEqual(room.board,original.board);assert.equal(room.preparation.phase,'lobby');
  assert.ok(room.seats.every(seat=>!seat.ready));assert.deepEqual(room.seats.map(seat=>seat.memberId),original.seats.map(seat=>seat.memberId));
  assert.ok(room.revision>original.revision);assert.ok(room.preparation.settingsRevision>original.preparation.settingsRevision);
  assert.equal(room.night,null);assert.equal(room.day,null);assert.equal(room.manual,null);
  assert.throws(()=>s.identity(t[0],id),/IDENTITY_UNAVAILABLE/);
  assert.equal(s.rematch(t[0],id,c).game.gameId,room.gameId);
  assert.throws(()=>s.rematch(t[0],id,{...c,expectedGameId:room.gameId}),/REMATCH_REQUEST_CONFLICT/);
  assert.throws(()=>s.rematch(t[0],id,command(id)),/STALE_GAME/);
  prepareManual(s,id,t);assert.notEqual(s.recordsList(t[0],room.gameId).own!.id,post.id);
  const second=endManual(s,t[0],room.gameId,'第二局笔记');s.publishRecord(t[0],room.gameId,second.revision);
  const third=s.rematch(t[0],id,command(room.gameId));assert.equal(third.game.gameNumber,3);
  assert.equal(s.rematch(t[0],id,c).game.gameId,room.gameId);assert.equal(s.rematch(t[0],id,c).view.room.gameNumber,3);
  assert.equal(s.recordPost(t[1],post.id).document.notes,'合成私密笔记');
 }finally{s.close();}
});
for(const [table,event] of [['record_official_snapshots','INSERT'],['identities','DELETE'],['room_game_heads','UPDATE']] as const){
 test(`failed ${table} operation rolls back archive, reset and receipt`,()=>{
  const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-fault-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
  try{
   endManual(s,t[0],id);const before=s.snapshot(id),own=s.recordsList(t[0],id).own;
   db.exec(`CREATE TRIGGER synthetic_fault BEFORE ${event} ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic-failure'); END`);
   const c=command(id);assert.throws(()=>s.rematch(t[0],id,c),/synthetic-failure/);
   assert.deepEqual(s.snapshot(id),before);assert.deepEqual(s.recordsList(t[0],id).own,own);
   assert.equal((db.prepare('SELECT COUNT(*) AS n FROM rematch_receipts').get() as {n:number}).n,0);
   db.exec('DROP TRIGGER synthetic_fault');assert.equal(s.rematch(t[0],id,c).game.gameNumber,2);
  }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
 });
}
test('persistent receipt survives process restart and two competing host connections',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-restart-')),file=join(dir,'db');const f=manualGame(file);let s=f.s;let second:LobbyStore|undefined;
 try{
  endManual(s,f.tokens[0],f.id);const c=command(f.id);second=new LobbyStore(file);
  const next=s.rematch(f.tokens[0],f.id,c);
  assert.throws(()=>second!.rematch(f.tokens[0],f.id,command(f.id)),/STALE_GAME/);
  second.close();second=undefined;s.close();s=new LobbyStore(file);
  assert.equal(s.rematch(f.tokens[0],f.id,c).game.gameId,next.game.gameId);assert.equal(s.snapshot(f.id).gameNumber,2);
 }finally{s.close();second?.close();rmSync(dir,{recursive:true,force:true});}
});
test('new game clears active public audit without deleting old public or private audits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-rematch-audit-')),file=join(dir,'db');const {s,tokens:t,id}=manualGame(file);const db=new Database(file);
 try{
  endManual(s,t[0],id);const state=JSON.stringify({phase:'ended',round:null,version:0,status:'running',tempSeat:null,voteSeconds:30,voteVisibility:'individual',sheriff:null,badge:null});
  db.prepare('INSERT INTO room_management_history(room_id,at,operator_member,operator_seat,operator_name,action,before_state,after_state) VALUES (?,0,?,1,?,?,?,?)').run(id,s.view(t[0],id).me.id,'合成房主','pause',state,state);
  db.prepare('INSERT INTO judge_audit(room_id,at,operator_member,operator_seat,action,detail) VALUES (?,0,?,1,?,?)').run(id,s.view(t[0],id).me.id,'synthetic','{"private":"synthetic-only"}');
  assert.equal(s.managementHistory(t[0],id,{}).items.length,1);
  s.rematch(t[0],id,command(id));assert.equal(s.managementHistory(t[0],id,{}).items.length,0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM room_management_history').get() as {n:number}).n,1);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM game_judge_audits').get() as {n:number}).n,1);
 }finally{s.close();db.close();rmSync(dir,{recursive:true,force:true});}
});
