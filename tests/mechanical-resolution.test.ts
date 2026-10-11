import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEngineState,appendNightAction,copyEngineAbilities,settleEngineNight,type ResolutionStrategy} from '../packages/domain/engine.js';
import type {EngineState,EngineSeed,NightActionCommand,ResolutionDecision} from '../packages/contracts/engine.js';
import type {RoomBoardSnapshot,Ruleset} from '../packages/contracts/board.js';
import type {SkillSnapshot} from '../packages/domain/skills.js';
import {createMechanicalResolutionStrategy} from '../packages/domain/mechanicalResolution.js';

function strategy(ruleset:Ruleset):ResolutionStrategy{
 return createMechanicalResolutionStrategy(ruleset);
}
function fixture(armor=false):EngineState{
 const seeds:EngineSeed[]=[{seat:1,role:'mechanicalWolf',knifeGroup:'mechanical'},{seat:2,role:'villager',knifeGroup:'none'},
 {seat:3,role:'villager',knifeGroup:'none'},{seat:4,role:'guard',knifeGroup:'none'},
 {seat:5,role:'witch',knifeGroup:'none'},{seat:6,role:'wolf',knifeGroup:'shared'},{seat:7,role:'hunter',knifeGroup:'none'},
 ...(armor?[{seat:8,role:'armoredWolf' as const,knifeGroup:'armor' as const}]:[])];
 const board:RoomBoardSnapshot={id:'synthetic-resolution',name:'Synthetic resolution fixture',ruleVersion:'2026-10-10-v1',
 composition:{seatCount:seeds.length,roleCounts:{mechanicalWolf:1,villager:2,guard:1,witch:1,wolf:1,hunter:1,...(armor?{armoredWolf:1}:{})},ruleset:armor?'mechanical-armor':'mechanical-seer',playable:false}};
 const state=createEngineState(board,seeds,2);
 state.players[5].alive=false;state.players[5].publicState.canVote=false;
 return state;
}
function grant(state:EngineState,seat:number,kind:SkillSnapshot['skills'][number]['kind'],parameters:Record<string,string|boolean>,id:string=kind){
 state.players.find(p=>p.seat===seat)!.abilities.skills.push({id,kind,capacity:kind==='guard'?null:1,remaining:kind==='guard'?null:1,
 availableFromNight:1,parameters,copiedFrom:null,uses:[],lastTarget:null});
 return id;
}
function copiedGuard(input:EngineState,owner=1):EngineState{
 const state=structuredClone(input);
 // M2 accepts a generic frozen copy profile; real profile generation is tested separately.
 grant(state,4,'guard',{protection:state.board.composition.ruleset==='mechanical-armor'?'invincible':'mechanical-reflect'});
 const copied=copyEngineAbilities(state,owner,4,{copyId:`copy-${owner}`,availableFromNight:2});
 copied.players[3].abilities.skills[0].parameters={protection:'ordinary'};
 return copied;
}
function act(input:EngineState,kind:NightActionCommand['abilityType'],casterId:number,targetId:number|null,id:string=kind):EngineState{
 const ability=input.players.find(p=>p.seat===casterId)!.abilities.skills.find(s=>s.kind===kind);
 return appendNightAction(input,{id,requestId:id,casterId,targetId,abilityType:kind,abilityId:kind==='wolf-knife'?null:ability!.id,stage:'synthetic',at:100});
}
function resolved(state:EngineState){
 const result=settleEngineNight(state,strategy(state.board.composition.ruleset));
 assert.equal(result.resolution?.status,'settled');
 if(result.resolution?.status!=='settled')throw Error('expected settled');
 return {...result,resolution:result.resolution};
}
function outcome(state:EngineState){return resolved(state).resolution.effects.map(e=>[e.actionId,e.outcome,e.reflectTarget,e.preventedBy]);}
function poison(input:EngineState,seat=5){grant(input,seat,'poison',{damage:'witch-poison'});return input;}
function extra(input:EngineState){grant(input,1,'extra-knife',{damage:'ordinary-wolf-knife',...(input.board.composition.ruleset==='mechanical-seer'?{pierceOrdinaryGuard:true}:{})});return input;}

test('DMG-01 and DMG-07 mechanical guard blocks knives and reflects poison to the actual caster',()=>{
 let state=poison(copiedGuard(fixture()));
 state=act(state,'guard',1,2,'mechanical-guard');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'poison',5,2,'witch-poison');
 const result=resolved(state);
 assert.deepEqual(result.resolution.effects.map(e=>[e.actionId,e.outcome,e.reflectTarget,e.preventedBy]),[
 ['knife','prevented',null,['mechanical-guard']],['witch-poison','killed',5,[]]]);
 assert.equal(result.players[1].alive,true);assert.equal(result.players[4].alive,false);
 assert.deepEqual(result.resolution.deaths,[{seat:5,sourceEffectIds:['witch-poison']}]);
 let self=copiedGuard(fixture());self=act(self,'guard',1,1,'self-guard');self=act(self,'wolf-knife',1,1,'self-knife');
 assert.equal(resolved(self).players[0].alive,true);
});

test('DMG-02 independent witch-type poison sources reflect separately even when a caster is also knifed',()=>{
 let state=poison(poison(copiedGuard(fixture()),1));
 state=act(state,'guard',1,2,'mechanical-guard');state=act(state,'poison',5,2,'native-poison');state=act(state,'poison',1,2,'copied-poison');state=act(state,'wolf-knife',1,5,'knife');
 const result=resolved(state);
 assert.deepEqual(result.resolution.effects.map(e=>[e.actionId,e.outcome,e.reflectTarget]),[
 ['native-poison','killed',5],['copied-poison','killed',1],['knife','killed',null]]);
 assert.deepEqual(result.resolution.deaths,[{seat:5,sourceEffectIds:['native-poison','knife']},{seat:1,sourceEffectIds:['copied-poison']}]);
 assert.equal(result.players[1].alive,true);
});

test('DMG-03 self-guarded self-poison still kills its caster once through reflection',()=>{
 let state=poison(copiedGuard(fixture()),1);state=act(state,'guard',1,1,'self-guard');state=act(state,'poison',1,1,'self-poison');
 const result=resolved(state);assert.equal(result.players[0].alive,false);
 assert.deepEqual(result.resolution.effects.map(e=>[e.outcome,e.reflectTarget]),[['killed',1]]);
 assert.deepEqual(result.resolution.deaths,[{seat:1,sourceEffectIds:['self-poison']}]);
});

test('ordinary guard never prevents original or reflected poison and overlapping guards do not cancel',()=>{
 let state=poison(copiedGuard(fixture()));state=act(state,'guard',1,2,'mechanical-guard');state=act(state,'guard',4,5,'ordinary-guard');state=act(state,'poison',5,2,'poison');
 assert.equal(resolved(state).players[4].alive,false);
 let ordinary=poison(fixture());grant(ordinary,4,'guard',{protection:'ordinary'});
 ordinary=act(ordinary,'guard',4,2,'ordinary-guard');ordinary=act(ordinary,'poison',5,2,'poison');
 assert.deepEqual(outcome(ordinary),[['poison','killed',null,[]]]);
 let overlap=copiedGuard(fixture());overlap=act(overlap,'guard',4,2,'ordinary-guard');overlap=act(overlap,'guard',1,2,'mechanical-guard');overlap=act(overlap,'wolf-knife',1,2,'knife');
 assert.equal(resolved(overlap).players[1].alive,true);
});

test('DMG-04 antidote protects only ordinary wolf knife and preserves extra-knife death provenance',()=>{
 let state=extra(fixture());grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});
 state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,2,'extra');state=act(state,'antidote',5,2,'antidote');
 const result=resolved(state);assert.deepEqual(outcome(state),[['knife','prevented',null,['antidote']],['extra','killed',null,[]]]);
 assert.deepEqual(result.resolution.deaths,[{seat:2,sourceEffectIds:['extra']}]);
 const independent=act(act(extra(fixture()),'wolf-knife',1,2,'knife'),'extra-knife',1,3,'extra');
 assert.deepEqual(resolved(independent).resolution.deaths,[{seat:2,sourceEffectIds:['knife']},{seat:3,sourceEffectIds:['extra']}]);
});

test('mechanical extra knife pierces ordinary guard but cannot pierce mechanical guard',()=>{
 let state=extra(fixture());grant(state,4,'guard',{protection:'ordinary'});state=act(state,'guard',4,2,'guard');state=act(state,'extra-knife',1,2,'extra');
 assert.deepEqual(outcome(state),[['extra','killed',null,[]]]);
 let protectedState=extra(copiedGuard(fixture()));protectedState=act(protectedState,'guard',1,2,'mechanical-guard');protectedState=act(protectedState,'extra-knife',1,2,'extra');
 assert.deepEqual(outcome(protectedState),[['extra','prevented',null,['mechanical-guard']]]);
});

test('DMG-05 armor ordinary knife stacking breaks only ordinary protection on the same target',()=>{
 let state=extra(fixture(true));grant(state,4,'guard',{protection:'ordinary'});
 state=act(state,'guard',4,2,'guard');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,2,'extra');
 const result=resolved(state);assert.deepEqual(outcome(state),[['knife','killed',null,[]],['extra','killed',null,[]]]);
 assert.deepEqual(result.resolution.deaths,[{seat:2,sourceEffectIds:['knife','extra']}]);
 let split=extra(fixture(true));grant(split,4,'guard',{protection:'ordinary'});split=act(split,'guard',4,2,'guard');split=act(split,'wolf-knife',1,3,'knife');split=act(split,'extra-knife',1,2,'extra');
 assert.deepEqual(outcome(split),[['knife','killed',null,[]],['extra','prevented',null,['guard']]]);
});

test('DMG-06 armor invincible shield blocks all knives and poison without any reflection',()=>{
 let state=poison(extra(copiedGuard(fixture(true))));state=act(state,'guard',1,2,'invincible');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,2,'extra');state=act(state,'poison',5,2,'poison');
 assert.deepEqual(outcome(state),[['knife','prevented',null,['invincible']],['extra','prevented',null,['invincible']],['poison','prevented',null,['invincible']]]);
 assert.equal(resolved(state).resolution.deaths.length,0);
});

test('plain wolf knife is blocked by ordinary guard and antidote independently',()=>{
 let guarded=fixture();grant(guarded,4,'guard',{protection:'ordinary'});guarded=act(guarded,'guard',4,2,'guard');guarded=act(guarded,'wolf-knife',1,2,'knife');
 assert.deepEqual(outcome(guarded),[['knife','prevented',null,['guard']]]);
 let saved=fixture();grant(saved,5,'antidote',{healing:'ordinary-wolf-knife'});saved=act(saved,'wolf-knife',1,1,'self-knife');saved=act(saved,'antidote',5,1,'save');
 assert.deepEqual(outcome(saved),[['self-knife','prevented',null,['save']]]);
});

test('all simultaneous sources settle before wolf-priority victory and original input stays immutable',()=>{
 let state=poison(extra(fixture()));state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,3,'extra');state=act(state,'poison',5,1,'poison');
 const before=structuredClone(state);const result=resolved(state);
 assert.deepEqual(result.victory,{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
 assert.equal(result.players[0].alive,false);assert.equal(result.resolution.effects.length,3);assert.deepEqual(state,before);
 assert.deepEqual(settleEngineNight(result,strategy('mechanical-seer')),result);
});

test('passing every attack emits one no-effect source and empty protective targets protect nobody',()=>{
 let state=poison(extra(fixture()));grant(state,4,'guard',{protection:'ordinary'});grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});
 state=act(state,'guard',4,null,'guard-pass');state=act(state,'antidote',5,null,'antidote-pass');
 state=act(state,'wolf-knife',1,null,'knife-pass');state=act(state,'extra-knife',1,null,'extra-pass');state=act(state,'poison',5,null,'poison-pass');
 assert.deepEqual(outcome(state),[['knife-pass','no-effect',null,[]],['extra-pass','no-effect',null,[]],['poison-pass','no-effect',null,[]]]);
});

function blocked(state:EngineState,questionId:string){
 const decision:ResolutionDecision=strategy(state.board.composition.ruleset).resolve(state);
 assert.deepEqual(decision,{status:'blocked',reason:'product-decision',questionIds:[questionId]});
 assert.equal(settleEngineNight(state,strategy(state.board.composition.ruleset)).players.every(p=>p.seat===6||p.alive),true);
}
test('confirmed guard and antidote overlap kills the ordinary knife target for both guard types',()=>{
 for(const mechanical of [false,true]){
  let state=mechanical?copiedGuard(fixture()):fixture();if(!mechanical)grant(state,4,'guard',{protection:'ordinary'});
  grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});state=act(state,'guard',mechanical?1:4,2,'guard');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'antidote',5,2,'antidote');
  assert.deepEqual(outcome(state),[['knife','killed',null,[]]]);
  assert.equal(resolved(state).players[1].alive,false);
 }
});
test('guard-antidote overlap does not erase mechanical poison reflection or extra knife sources',()=>{
 let state=poison(extra(copiedGuard(fixture())));grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});
 state=act(state,'guard',1,2,'guard');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,2,'extra');state=act(state,'antidote',5,2,'antidote');state=act(state,'poison',5,2,'poison');
 assert.deepEqual(outcome(state),[['knife','killed',null,[]],['extra','prevented',null,['guard']],['poison','killed',5,[]]]);
});
test('confirmed armor invincible shield and antidote overlap kills only the ordinary knife source',()=>{
 let state=poison(extra(copiedGuard(fixture(true))));grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});
 state=act(state,'guard',1,2,'invincible');state=act(state,'wolf-knife',1,2,'knife');state=act(state,'extra-knife',1,2,'extra');state=act(state,'antidote',5,2,'antidote');state=act(state,'poison',5,2,'poison');
 const result=resolved(state);
 assert.deepEqual(result.resolution.effects.map(e=>[e.actionId,e.outcome,e.reflectTarget,e.preventedBy]),[
 ['knife','killed',null,[]],['extra','prevented',null,['invincible']],['poison','prevented',null,['invincible']]]);
 assert.deepEqual(result.resolution.deaths,[{seat:2,sourceEffectIds:['knife']}]);
 assert.equal(result.players[4].alive,true);
});
test('antidote directed only at hidden extra knife remains a product decision',()=>{
 let state=extra(fixture());grant(state,5,'antidote',{healing:'ordinary-wolf-knife'});state=act(state,'extra-knife',1,2,'extra');state=act(state,'antidote',5,2,'antidote');
 blocked(state,'MW-EXTRA-KNIFE-ANTIDOTE');
});
test('undefined reflected poison into another mechanical shield blocks but self-reflection is settled',()=>{
 let state=poison(copiedGuard(fixture()));
 // Repeated same skill use remains a locked M2 action; legality belongs to collection/profile layer.
 state=act(state,'guard',1,2,'target-shield');state=act(state,'guard',1,5,'caster-shield');state=act(state,'poison',5,2,'poison');
 blocked(state,'MW-REFLECTION-CHAIN');
});
test('unknown damage profile never silently gains witch reflection or shield piercing',()=>{
 let state=fixture();grant(state,5,'poison',{damage:'custom-poison'});state=act(state,'poison',5,2,'poison');blocked(state,'CUSTOM-DAMAGE-UNRESOLVED');
 let armor=extra(fixture(true));armor.players[0].abilities.skills[0].parameters.pierceOrdinaryGuard=true;armor=act(armor,'extra-knife',1,2,'extra');blocked(armor,'CUSTOM-DAMAGE-UNRESOLVED');
});
test('direct strategy input validates provenance and never trusts undeclared player protection flags',()=>{
 let state=fixture();grant(state,4,'guard',{protection:'mechanical-reflect'});state=act(state,'guard',4,2,'forged-native-shield');state=act(state,'wolf-knife',1,2,'knife');
 assert.throws(()=>strategy('mechanical-seer').resolve(state),/INVALID_ENGINE_STATE/);
 const invalid=act(fixture(),'wolf-knife',1,2,'knife');invalid.actions[0].casterId=2;
 assert.throws(()=>strategy('mechanical-seer').resolve(invalid),/INVALID_ENGINE_STATE/);
 assert.throws(()=>strategy('mechanical-seer').resolve(fixture(true)),/ENGINE_RULESET_MISMATCH/);
 assert.throws(()=>strategy('standard'),/ENGINE_RULESET_MISMATCH/);
});

test('maximum-length valid locked action IDs still produce schema-valid independent death evidence',()=>{
 const knifeId='k'.repeat(200),extraId='e'.repeat(200);
 let state=extra(fixture());state=act(state,'wolf-knife',1,2,knifeId);state=act(state,'extra-knife',1,2,extraId);
 const result=resolved(state);
 assert.equal(result.resolution.effects.length,2);
 assert.deepEqual(result.resolution.effects.map(e=>e.actionId),[knifeId,extraId]);
 assert.equal(new Set(result.resolution.deaths[0].sourceEffectIds).size,2);
});
