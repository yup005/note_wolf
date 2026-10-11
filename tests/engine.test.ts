import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngineState,appendNightAction,settleEngineNight,copyEngineAbilities,validateEngineState,type ResolutionStrategy} from '../packages/domain/engine.js';
import {copySkills,useSkill,type SkillSnapshot} from '../packages/domain/skills.js';
import {evaluateVictory} from '../packages/domain/victory.js';
import type {RoomBoardSnapshot} from '../packages/contracts/board.js';
export const engineBoard:RoomBoardSnapshot={id:'custom',name:'Synthetic engine fixture',ruleVersion:'2026-10-10-v1',composition:{seatCount:3,roleCounts:{mechanicalWolf:1,villager:1,guard:1},ruleset:'mechanical-seer',playable:false}};
export function engineFixture(){return createEngineState(engineBoard,[{seat:1,role:'mechanicalWolf',knifeGroup:'mechanical'},{seat:2,role:'villager',knifeGroup:'none'},{seat:3,role:'guard',knifeGroup:'none'}],2);}
const action={id:'knife-1',requestId:'request-1',casterId:1,targetId:2,abilityId:null,abilityType:'wolf-knife' as const,stage:'wolf',at:100};

test('engine roles/camps are separate from copied ability and nested source snapshots freeze independently',()=>{
 const snapshot:SkillSnapshot={ownerSeat:3,originalRole:'guard',mimickedRole:null,skills:[{id:'guard',kind:'guard',capacity:null,remaining:null,availableFromNight:1,parameters:{shield:{blocks:['knife','poison'],mode:'invincible'}},copiedFrom:null,uses:[{requestId:'old',night:1,target:2}],lastTarget:2}]};
 const state=engineFixture();state.players[2].abilities=snapshot;
 const copied=copyEngineAbilities(state,1,3,{copyId:'learn',availableFromNight:3,at:99});
 assert.equal(copied.players[0].role,'mechanicalWolf');assert.equal(copied.players[0].camp,'wolves');assert.equal(copied.players[0].abilities.mimickedRole,'guard');
 assert.equal(copied.players[0].abilities.skills[0].lastTarget,null);
 assert.equal(copied.players[0].learning!.sourceSeat,3);assert.equal(copied.players[0].learning!.night,2);assert.equal(copied.players[0].learning!.at,99);
 assert.equal(copied.players[0].learning!.sourceSnapshot.skills[0].lastTarget,2);
 (snapshot.skills[0].parameters.shield as {blocks:string[]}).blocks.push('unknown');
 assert.deepEqual(copied.players[0].abilities.skills[0].parameters.shield,{blocks:['knife','poison'],mode:'invincible'});
 assert.throws(()=>copyEngineAbilities(copied,1,2,{copyId:'again',availableFromNight:3}),/ALREADY_LEARNED/);
 const source=copySkills(snapshot,{copyId:'armor',ownerSeat:2,originalRole:'armoredWolf',night:2,availableFromNight:3});
 const used=useSkill(source,'armor:guard',{requestId:'guard',night:3,target:2});assert.equal(used.skills[0].lastTarget,2);assert.equal(source.skills[0].lastTarget,null);
});

test('submitted actions lock provenance and remain alive until a complete night settlement',()=>{
 const initial=engineFixture();const submitted=appendNightAction(initial,action);
 assert.equal(initial.actions.length,0);assert.equal(submitted.players.every(p=>p.alive),true);
 assert.equal(submitted.actions[0].sourceRole,'mechanicalWolf');assert.equal(submitted.actions[0].ruleset,'mechanical-seer');assert.equal(submitted.actions[0].night,2);
 assert.deepEqual(appendNightAction(submitted,action),submitted);
 assert.throws(()=>appendNightAction(submitted,{...action,targetId:3}),/ALREADY_COMMITTED/);
 assert.throws(()=>appendNightAction(initial,{...action,casterId:2}),/KNIFE_NOT_AUTHORIZED/);
 assert.throws(()=>appendNightAction(initial,{...action,targetId:4}),/INVALID_TARGET/);
 const blocked=settleEngineNight(submitted);assert.equal(blocked.resolution!.status,'blocked');assert.equal(blocked.players[1].alive,true);
 assert.throws(()=>appendNightAction(blocked,{...action,id:'late',requestId:'late'}),/PHASE_LOCKED/);
});

test('resolution strategy records independent damage evidence, deduplicates death and evaluates victory after all damage',()=>{
 const initial=engineFixture();initial.players[0].abilities.skills=[{id:'extra',kind:'extra-knife',capacity:1,remaining:1,availableFromNight:2,parameters:{damage:'wolf-knife'},copiedFrom:null,uses:[]}];
 const first=appendNightAction(initial,action);const submitted=appendNightAction(first,{...action,id:'extra',requestId:'extra',stage:'mechanical',abilityId:'extra',abilityType:'extra-knife'});
 assert.equal(submitted.players[0].abilities.skills[0].remaining,0);
 const strategy:ResolutionStrategy={ruleset:'mechanical-seer',ruleVersion:'2026-10-10-v1',resolve(context){return {status:'settled',effects:context.actions.map(a=>({id:'effect:'+a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId!,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:'killed',reflectTarget:null,preventedBy:[]}))};}};
 const result=settleEngineNight(submitted,strategy);assert.equal(result.players[1].alive,false);assert.equal(result.resolution!.status,'settled');
 if(result.resolution?.status!=='settled')throw Error('resolution');assert.deepEqual(result.resolution.deaths,[{seat:2,sourceEffectIds:['effect:knife-1','effect:extra']}]);
 assert.deepEqual(result.victory,{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
 assert.equal(result.stage,'ended');assert.deepEqual(settleEngineNight(result,strategy),result);
 assert.equal(submitted.players[1].alive,true);
});

test('framework refuses mismatched strategy, fabricated source effects and silent unresolved decisions',()=>{
 const submitted=appendNightAction(engineFixture(),action);
 const blocked:ResolutionStrategy={ruleset:'mechanical-seer',ruleVersion:'2026-10-10-v1',resolve(){return {status:'blocked',reason:'product-decision',questionIds:['CUSTOM-DAMAGE-UNRESOLVED']};}};
 const result=settleEngineNight(submitted,blocked);assert.equal(result.players.every(p=>p.alive),true);assert.equal(result.stage,'awaiting-resolution');
 assert.throws(()=>settleEngineNight(submitted,{...blocked,ruleset:'mechanical-armor'}),/ENGINE_RULESET_MISMATCH/);
 const missing:ResolutionStrategy={...blocked,resolve(){return {status:'settled',effects:[]};}};
 assert.throws(()=>settleEngineNight(submitted,missing),/INVALID_RESOLUTION/);
 const injected:ResolutionStrategy={...blocked,resolve(){return {status:'settled',effects:[{id:'bad',actionId:action.id,casterId:2,targetId:2,abilityType:'wolf-knife',sourceRole:'villager',ruleset:'mechanical-seer',night:2,outcome:'killed',reflectTarget:null,preventedBy:[]}]};}};
 assert.throws(()=>settleEngineNight(submitted,injected),/INVALID_RESOLUTION/);
 assert.equal(submitted.players.every(p=>p.alive),true);
});

test('latest explicit armor inheritance uses the base simultaneous wolf-priority policy',()=>{
 assert.deepEqual(evaluateVictory([{seat:1,role:'armoredWolf',alive:false},{seat:2,role:'villager',alive:false},{seat:3,role:'guard',alive:true}],'mechanical-armor'),{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
});


test('durable state rejects altered death evidence, terminal verdicts and learning provenance',()=>{
 const submitted=appendNightAction(engineFixture(),action);
 const result=settleEngineNight(submitted,{ruleset:'mechanical-seer',ruleVersion:'2026-10-10-v1',resolve(context){return {status:'settled',effects:context.actions.map(a=>({id:'effect:'+a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:'killed',reflectTarget:null,preventedBy:[]}))};}});
 const changedDeaths=structuredClone(result);if(changedDeaths.resolution?.status!=='settled')throw Error('resolution');changedDeaths.resolution.deaths[0].seat=3;
 assert.throws(()=>validateEngineState(changedDeaths),/INVALID_ENGINE_STATE/);
 const changedAlive=structuredClone(result);changedAlive.players[1].alive=true;assert.throws(()=>validateEngineState(changedAlive),/INVALID_ENGINE_STATE/);
 const changedWinner=structuredClone(result);changedWinner.victory={status:'ended',winner:'good',reason:'all-wolves-dead'};assert.throws(()=>validateEngineState(changedWinner),/INVALID_ENGINE_STATE/);
 const collecting=engineFixture();collecting.victory={status:'ended',winner:'wolves',reason:'all-gods-dead'};assert.throws(()=>validateEngineState(collecting),/INVALID_ENGINE_STATE/);
 const copied=copyEngineAbilities(engineFixture(),1,3,{copyId:'learn',availableFromNight:3});copied.players[0].learning!.sourceSnapshot.ownerSeat=2;
 assert.throws(()=>validateEngineState(copied),/INVALID_ENGINE_STATE/);
});


test('restored copies cannot rewrite source capabilities or recharge inventory while retaining uses',()=>{
 const initial=engineFixture();initial.players[2].abilities.skills=[{id:'poison',kind:'poison',capacity:1,remaining:1,availableFromNight:1,parameters:{damage:{kind:'poison'}},copiedFrom:null,uses:[]}];
 const copied=copyEngineAbilities(initial,1,3,{copyId:'copy',availableFromNight:2});
 for(const alter of [(s:typeof copied)=>{s.players[0].abilities.skills[0].copiedFrom=null;s.players[0].abilities.skills[0].capacity=2;s.players[0].abilities.skills[0].remaining=2;},(s:typeof copied)=>{s.players[0].abilities.skills=[];},(s:typeof copied)=>{s.players[0].abilities.skills[0].copiedFrom={seat:2,skillId:'unrelated',night:999};},(s:typeof copied)=>{s.players[0].abilities.skills[0].parameters.damage={kind:'knife'};},(s:typeof copied)=>{s.players[0].abilities.skills[0].capacity=2;},(s:typeof copied)=>{s.players[0].abilities.skills[0].availableFromNight=1;}]){
  const changed=structuredClone(copied);alter(changed);assert.throws(()=>validateEngineState(changed),/INVALID_ENGINE_STATE/);
 }
 const used=appendNightAction(copied,{...action,abilityType:'poison',abilityId:'copy:poison'});
 for(const alter of [(s:typeof used)=>{s.players[0].abilities.skills[0].remaining=1;},(s:typeof used)=>{s.players[0].abilities.skills[0].lastTarget=3;},(s:typeof used)=>{s.players[0].abilities.skills[0].uses.push(s.players[0].abilities.skills[0].uses[0]);}]){
  const changed=structuredClone(used);alter(changed);assert.throws(()=>validateEngineState(changed),/INVALID_ENGINE_STATE/);
 }
});
