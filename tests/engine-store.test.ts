import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {EngineStore} from '../packages/storage/engine.js';
import {createEngineState,appendNightAction,copyEngineAbilities,settleEngineNight} from '../packages/domain/engine.js';
import type {RoomBoardSnapshot} from '../packages/contracts/board.js';
const board:RoomBoardSnapshot={id:'private',name:'Synthetic',ruleVersion:'2026-10-10-v1',composition:{seatCount:3,roleCounts:{mechanicalWolf:1,villager:1,witch:1},ruleset:'mechanical-seer',playable:false}};
function fixture(){const state=createEngineState(board,[{seat:1,role:'mechanicalWolf',knifeGroup:'mechanical'},{seat:2,role:'villager',knifeGroup:'none'},{seat:3,role:'witch',knifeGroup:'none'}],2);state.players[2].abilities.skills=[{id:'poison',kind:'poison',capacity:1,remaining:0,availableFromNight:1,parameters:{damage:'witch-poison'},copiedFrom:null,uses:[{requestId:'spent',night:1,target:2}]}];return copyEngineAbilities(state,1,3,{copyId:'copy',availableFromNight:3});}
test('internal engine snapshot restores copied inventory, provenance and version after restart, rejecting stale writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-engine-'));const file=join(dir,'db.sqlite');let db=new Database(file);db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES (\'room\');');let store=new EngineStore(db,()=>board);
 try{
  const state=fixture();const first=store.save('room',state,0);assert.equal(first.revision,1);
  state.players[0].abilities.skills[0].remaining=0;assert.equal(store.load('room')!.state.players[0].abilities.skills[0].remaining,1);
  assert.throws(()=>store.save('room',first.state,0),/STALE_ENGINE/);
  db.close();db=new Database(file);store=new EngineStore(db,()=>board);const restored=store.load('room')!;
  assert.equal(restored.revision,1);assert.equal(restored.state.players[0].learning!.sourceSnapshot.skills[0].remaining,0);
  assert.equal(restored.state.players[0].abilities.skills[0].remaining,1);assert.equal(restored.state.players[0].camp,'wolves');
  restored.state.night=3;const used=appendNightAction(restored.state,{id:'poison',requestId:'use',casterId:1,targetId:2,abilityType:'poison',abilityId:'copy:poison',stage:'mechanical',at:100});
  store.save('room',used,1);assert.equal(store.load('room')!.state.players[0].abilities.skills[0].remaining,0);
  assert.equal(store.load('room')!.state.players[0].abilities.skills[0].lastTarget,2);
  const settled=settleEngineNight(used,{ruleset:'mechanical-seer',ruleVersion:'2026-10-10-v1',resolve(context){return {status:'settled',effects:context.actions.map(a=>({id:'effect:'+a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:'killed',reflectTarget:null,preventedBy:[]}))};}});
  store.save('room',settled,2);db.close();db=new Database(file);store=new EngineStore(db,()=>board);
  assert.deepEqual(store.load('room'),{revision:3,state:settled});
  const unsupported={...used,formatVersion:99};db.prepare('UPDATE board_engine_states SET state=? WHERE room_id=?').run(JSON.stringify(unsupported),'room');assert.throws(()=>store.load('room'),/ENGINE_VERSION_UNSUPPORTED/);
  db.prepare('UPDATE board_engine_states SET state=? WHERE room_id=?').run('{invalid','room');assert.throws(()=>store.load('room'),/INVALID_ENGINE_STATE/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('internal store rejects configuration drift and inconsistent true-role/camp state before writing',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES (\'room\');');try{
  const store=new EngineStore(db,()=>board),state=fixture();state.players[0].camp='good';assert.throws(()=>store.save('room',state,0),/INVALID_ENGINE_STATE/);assert.equal(store.load('room'),null);
  const changed=new EngineStore(db,()=>({...board,id:'different-template'}));assert.throws(()=>changed.save('room',fixture(),0),/ENGINE_BOARD_MISMATCH/);
 }finally{db.close();}
});


test('internal store fails closed on corrupt revisions and prevents safe-integer overflow',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES (\'room\');');try{
  const store=new EngineStore(db,()=>board),state=fixture();store.save('room',state,0);
  for(const revision of [-5,0,1.5,Number.MAX_SAFE_INTEGER+1]){
   db.prepare('UPDATE board_engine_states SET revision=? WHERE room_id=?').run(revision,'room');assert.throws(()=>store.load('room'),/INVALID_ENGINE_STATE/);
  }
  db.prepare('UPDATE board_engine_states SET revision=? WHERE room_id=?').run(Number.MAX_SAFE_INTEGER,'room');
  assert.equal(store.load('room')!.revision,Number.MAX_SAFE_INTEGER);assert.throws(()=>store.save('room',state,Number.MAX_SAFE_INTEGER),/INVALID_ENGINE_STATE/);
 }finally{db.close();}
});
