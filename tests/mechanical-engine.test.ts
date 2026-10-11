import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {EngineStore} from '../packages/storage/engine.js';
import {validateEngineState,settleEngineNight} from '../packages/domain/engine.js';
import {createMechanicalResolutionStrategy} from '../packages/domain/mechanicalResolution.js';
import {createConfirmedEngineState,learnConfirmedEngineAbility,appendConfirmedEngineAction,validateConfirmedEngineState} from '../packages/domain/mechanicalEngine.js';
import type {RoomBoardSnapshot} from '../packages/contracts/board.js';
import type {EngineState,NightActionCommand} from '../packages/contracts/engine.js';
const board:RoomBoardSnapshot={id:'synthetic-confirmed',name:'Synthetic confirmed engine',ruleVersion:'2026-10-10-v1',composition:{seatCount:4,roleCounts:{mechanicalWolf:1,witch:1,guard:1,villager:1},ruleset:'mechanical-seer',playable:false}};
function fixture(){return createConfirmedEngineState(board,[{seat:1,role:'mechanicalWolf',knifeGroup:'mechanical'},{seat:2,role:'witch',knifeGroup:'none'},{seat:3,role:'guard',knifeGroup:'none'},{seat:4,role:'villager',knifeGroup:'none'}]);}
function learned(state:EngineState,target:number){const result=learnConfirmedEngineAbility(state,1,target,{copyId:'copy',at:100});assert.equal(result.status,'learned');if(result.status!=='learned')throw Error('learning failed');return result.state;}
function command(state:EngineState,seat:number,kind:NightActionCommand['abilityType'],targetId:number|null,id:string=kind):NightActionCommand{return {id,requestId:id,casterId:seat,targetId,abilityType:kind,abilityId:kind==='wolf-knife'?null:state.players.find(p=>p.seat===seat)!.abilities.skills.find(s=>s.kind===kind)!.id,stage:'synthetic',at:100};}
function append(state:EngineState,c:NightActionCommand){const result=appendConfirmedEngineAction(state,c);assert.equal(result.status,'committed');if(result.status!=='committed')throw Error('action blocked');return result.state;}

test('confirmed learning keeps real witch inventory but copies poison only through durable engine restart',()=>{
 const state=learned(fixture(),2);assert.equal(state.players[0].learning!.sourceSnapshot.skills.length,2);assert.equal(state.players[0].abilities.skills.length,1);assert.equal(state.players[0].abilities.skills[0].kind,'poison');
 const db=new Database(':memory:');try{db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES ('synthetic');");const store=new EngineStore(db,()=>board);store.save('synthetic',state,0);const restored=store.load('synthetic')!.state;assert.deepEqual(validateConfirmedEngineState(restored),state);assert.deepEqual(validateEngineState(restored),state);}finally{db.close();}
});
test('confirmed projected guard profile rejects forged capabilities, premature timing and removed provenance',()=>{
 const state=learned(fixture(),3);assert.equal(state.players[0].abilities.skills[0].parameters.protection,'mechanical-reflect');
 for(const mutate of [(s:EngineState)=>{s.players[0].learning!.copyProfileSnapshot!.skills[0].parameters.protection='invincible';},(s:EngineState)=>{s.players[0].abilities.skills[0].availableFromNight=1;},(s:EngineState)=>{delete s.players[0].learning!.copyProfileSnapshot;}]){const bad=structuredClone(state);mutate(bad);assert.throws(()=>validateConfirmedEngineState(bad),/INVALID_ENGINE_STATE/);}
});
test('confirmed action collector preserves legal learning and poison timing without allowing self-save',()=>{
 let state=learned(fixture(),2);assert.throws(()=>appendConfirmedEngineAction(state,command(state,1,'poison',4)),/SKILL_NOT_ACTIVE/);state.night=2;const used=append(state,command(state,1,'poison',4));assert.equal(used.players[0].abilities.skills[0].remaining,0);assert.equal(used.players.every(p=>p.alive),true);
 for(const night of [1,2]){const witch=fixture();witch.night=night;const knife=append(witch,command(witch,1,'wolf-knife',2));assert.throws(()=>appendConfirmedEngineAction(knife,command(knife,2,'antidote',2)),/WITCH_SELF_SAVE_FORBIDDEN/);}
});
test('consumable pass locks this night without consuming inventory, and retries remain idempotent',()=>{
 let state=learned(fixture(),2);state.night=2;const c=command(state,1,'poison',null);state=append(state,c);assert.equal(state.players[0].abilities.skills[0].remaining,1);assert.equal(state.players[0].abilities.skills[0].uses.length,0);assert.deepEqual(append(state,c),state);assert.throws(()=>appendConfirmedEngineAction(state,{...c,id:'later',requestId:'later',targetId:4}),/ALREADY_COMMITTED/);
});
test('confirmed collection and resolution compose copied mechanical guard with native poison',()=>{
 let state=learned(fixture(),3);state.night=2;state=append(state,command(state,1,'guard',4));state=append(state,command(state,2,'poison',4));state=append(state,command(state,1,'wolf-knife',4));const settled=settleEngineNight(state,createMechanicalResolutionStrategy('mechanical-seer'));assert.equal(settled.players[3].alive,true);assert.equal(settled.players[1].alive,false);assert.equal(settled.resolution?.status,'settled');
});
test('native confirmed profiles cannot be forged, and learning pass keeps the later opportunity',()=>{
 const state=fixture();state.players[2].abilities.skills[0].parameters.protection='invincible';assert.throws(()=>validateConfirmedEngineState(state),/INVALID_ENGINE_STATE/);const initial=fixture();const passed=learnConfirmedEngineAbility(initial,1,null,{copyId:'pass'});assert.equal(passed.status,'passed');assert.equal(initial.players[0].learning,null);assert.equal(learned(initial,3).players[0].learning!.sourceSeat,3);
});
test('historical native and nested copied capability limits cannot be forged together',()=>{
 const native=learned(fixture(),2);const owner=native.players[0];
 for(const snapshot of [owner.learning!.sourceSnapshot,owner.learning!.copyProfileSnapshot!,owner.abilities]){const poison=snapshot.skills.find(s=>s.kind==='poison')!;poison.capacity=2;poison.remaining=2;}
 assert.throws(()=>validateConfirmedEngineState(native),/INVALID_ENGINE_STATE/);
 const forgedKnife=fixture();forgedKnife.players[3].knifeGroup='shared';assert.throws(()=>appendConfirmedEngineAction(forgedKnife,command(forgedKnife,4,'wolf-knife',2)),/INVALID_ENGINE_STATE/);
});
test('private inspection results survive lost response, retry and internal persistence',()=>{
 const inspectBoard:RoomBoardSnapshot={...board,composition:{...board.composition,seatCount:5,roleCounts:{...board.composition.roleCounts,spiritSeer:1}}};
 const state=createConfirmedEngineState(inspectBoard,[...fixture().players.map(({seat,role,knifeGroup})=>({seat,role,knifeGroup})),{seat:5,role:'spiritSeer',knifeGroup:'none'}]);
 const c=command(state,5,'inspect',1);const first=appendConfirmedEngineAction(state,c);assert.equal(first.status,'committed');if(first.status!=='committed')throw Error('inspection blocked');assert.deepEqual(first.inspection,{status:'visible',role:'mechanicalWolf'});
 const retry=appendConfirmedEngineAction(first.state,c);assert.deepEqual(retry,first);
 const db=new Database(':memory:');try{db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES ('synthetic');");const store=new EngineStore(db,()=>inspectBoard);store.save('synthetic',first.state,0);assert.deepEqual(appendConfirmedEngineAction(store.load('synthetic')!.state,c),first);}finally{db.close();}
 const forged=structuredClone(first.state);forged.actions[0].privateInspection={status:'visible',role:'witch'};assert.throws(()=>validateConfirmedEngineState(forged),/INVALID_ENGINE_STATE/);
});
test('armor frozen multi-level copy retains independent charges and rejects forged historical inventory',()=>{
 const armorBoard:RoomBoardSnapshot={...board,composition:{...board.composition,seatCount:5,ruleset:'mechanical-armor',roleCounts:{...board.composition.roleCounts,armoredWolf:1}}};
 let state=createConfirmedEngineState(armorBoard,[...fixture().players.map(({seat,role,knifeGroup})=>({seat,role,knifeGroup})),{seat:5,role:'armoredWolf',knifeGroup:'armor'}]);
 state=learned(state,2);const result=learnConfirmedEngineAbility(state,5,1,{copyId:'armor-copy'});assert.equal(result.status,'learned');if(result.status!=='learned')throw Error('armor learning blocked');
 assert.equal(result.state.players[4].abilities.skills[0].remaining,1);assert.equal(result.state.players[4].learning!.sourceSnapshot.mimickedRole,'witch');
 result.state.night=2;const used=append(result.state,command(result.state,1,'poison',4));assert.equal(used.players[0].abilities.skills[0].remaining,0);assert.equal(used.players[4].abilities.skills[0].remaining,1);
 const bad=structuredClone(used);for(const snapshot of [bad.players[4].learning!.sourceSnapshot,bad.players[4].learning!.copyProfileSnapshot!,bad.players[4].abilities]){snapshot.skills[0].capacity=2;snapshot.skills[0].remaining=2;}assert.throws(()=>validateConfirmedEngineState(bad),/INVALID_ENGINE_STATE/);
});

test('confirmed idiot learning persists mimic and exact inspection without inventing a night skill',()=>{
 const idiotBoard:RoomBoardSnapshot={...board,composition:{...board.composition,seatCount:5,roleCounts:{mechanicalWolf:1,witch:1,idiot:1,villager:1,spiritSeer:1}}};
 const seeds=[...fixture().players.map(({seat,role,knifeGroup})=>({seat,role:seat===3?'idiot' as const:role,knifeGroup})),{seat:5,role:'spiritSeer' as const,knifeGroup:'none' as const}];
 const state=learned(createConfirmedEngineState(idiotBoard,seeds),3);
 assert.equal(state.players[0].abilities.mimickedRole,'idiot');assert.deepEqual(state.players[0].abilities.skills,[]);
 const inspection=appendConfirmedEngineAction(state,command(state,5,'inspect',1));assert.equal(inspection.status,'committed');if(inspection.status!=='committed')throw Error('inspection');
 assert.deepEqual(inspection.inspection,{status:'visible',role:'idiot'});
 const db=new Database(':memory:');try{db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY); INSERT INTO rooms VALUES ('synthetic');");const store=new EngineStore(db,()=>idiotBoard);store.save('synthetic',inspection.state,0);assert.deepEqual(validateConfirmedEngineState(store.load('synthetic')!.state),inspection.state);}finally{db.close();}
});
