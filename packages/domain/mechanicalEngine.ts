import {LobbyError} from '../contracts/index.js';
import {nightActionCommandSchema,type EngineState,type EngineSeed,type NightActionCommand} from '../contracts/engine.js';
import type {RoomBoardSnapshot} from '../contracts/board.js';
import {createEngineState,validateEngineState,appendNightAction} from './engine.js';
import {createNativeAbilityProfile,learnMechanicalAbility,useConfirmedAbility,type ProductDecisionBlocked,type LearningFeedback,type InspectionResult} from './mechanicalAbilities.js';
import {knifeAuthorityAtNightStart} from './knifeAuthority.js';
import {playerCamp} from './victory.js';
import type {SkillSnapshot} from './skills.js';

function assertCapabilities(snapshot:SkillSnapshot,expected:SkillSnapshot){
 if(snapshot.originalRole!==expected.originalRole||snapshot.ownerSeat!==expected.ownerSeat||snapshot.mimickedRole!==expected.mimickedRole||snapshot.skills.length!==expected.skills.length||snapshot.skills.some(s=>{
  const e=expected.skills.find(n=>n.id===s.id);
  return !e||s.kind!==e.kind||s.capacity!==e.capacity||s.availableFromNight!==e.availableFromNight||JSON.stringify(s.copiedFrom)!==JSON.stringify(e.copiedFrom)||JSON.stringify(s.parameters)!==JSON.stringify(e.parameters);
 }))throw new LobbyError('INVALID_ENGINE_STATE');
}

/** Internal collection adapter; no public routes or new-board dealing are enabled. */
export function validateConfirmedEngineState(input:unknown):EngineState{
 const state=validateEngineState(input),ruleset=state.board.composition.ruleset;
 if(ruleset==='standard')throw new LobbyError('ENGINE_RULESET_MISMATCH',409);
 for(const player of state.players){
  const group=player.role==='wolf'?'shared':player.role==='mechanicalWolf'?'mechanical':player.role==='armoredWolf'?'armor':'none';
  if(player.knifeGroup!==group)throw new LobbyError('INVALID_ENGINE_STATE');
  const snapshot=player.abilities;
  if(player.learning){
   const learning=player.learning;if(!learning.copyProfileSnapshot)throw new LobbyError('INVALID_ENGINE_STATE');
   const source=state.players.find(p=>p.seat===learning.sourceSeat)!;
   if(learning.sourceSnapshot.mimickedRole===null)assertCapabilities(learning.sourceSnapshot,createNativeAbilityProfile(source.role,source.seat,ruleset));
   else{
    if(!source.learning||source.learning.night>learning.night)throw new LobbyError('INVALID_ENGINE_STATE');
    assertCapabilities(learning.sourceSnapshot,source.abilities);
   }
   if(learning.sourceSnapshot.skills.some(s=>s.uses.some(u=>u.night>learning.night)))throw new LobbyError('INVALID_ENGINE_STATE');
  }
  else{
   const native=createNativeAbilityProfile(player.role,player.seat,ruleset);
   assertCapabilities(snapshot,native);
  }
  for(const skill of snapshot.skills){
   if(skill.capacity!==null&&skill.remaining!==skill.capacity-skill.uses.length||new Set(skill.uses.map(u=>u.night)).size!==skill.uses.length)throw new LobbyError('INVALID_ENGINE_STATE');
   if(skill.kind==='guard'&&skill.uses.some(u=>u.target!==null&&skill.uses.some(previous=>previous.night===u.night-1&&previous.target===u.target)))throw new LobbyError('INVALID_ENGINE_STATE');
   if(skill.kind==='inspect'&&skill.uses.some(u=>u.target===player.seat)||skill.kind==='antidote'&&skill.uses.some(u=>u.target===player.seat))throw new LobbyError('INVALID_ENGINE_STATE');
  }
  if(player.role==='witch'&&snapshot.skills.find(s=>s.kind==='antidote')?.uses.some(u=>snapshot.skills.find(s=>s.kind==='poison')?.uses.some(p=>p.night===u.night)))throw new LobbyError('INVALID_ENGINE_STATE');
 }
 for(const action of state.actions){
  const actor=state.players.find(p=>p.seat===action.casterId)!,skill=actor.abilities.skills.find(s=>s.id===action.abilityId);
  if(action.abilityType==='inspect'&&action.targetId!==null){
   const target=state.players.find(p=>p.seat===action.targetId)!,result=action.privateInspection;
   if(!result||!skill)throw new LobbyError('INVALID_ENGINE_STATE');
   if(skill.parameters.inspection==='camp'){
    if(result.status!=='camp'||result.camp!==playerCamp(target.role))throw new LobbyError('INVALID_ENGINE_STATE');
   }else{
    const roles=[target.role];
    if(target.learning&&target.learning.night<=action.night&&target.abilities.mimickedRole){if(target.learning.night<action.night)roles.length=0;roles.push(target.abilities.mimickedRole);}
    if(result.status!=='visible'||!roles.includes(result.role))throw new LobbyError('INVALID_ENGINE_STATE');
   }
  }else if(action.privateInspection)throw new LobbyError('INVALID_ENGINE_STATE');
 }
 return state;
}
export function createConfirmedEngineState(board:RoomBoardSnapshot,seeds:readonly EngineSeed[],night=1):EngineState{
 const state=createEngineState(board,seeds,night);
 for(const player of state.players)player.abilities=createNativeAbilityProfile(player.role,player.seat,board.composition.ruleset);
 return validateConfirmedEngineState(state);
}
export function learnConfirmedEngineAbility(input:EngineState,ownerSeat:number,targetSeat:number|null,metadata:{copyId:string;at?:number}):ProductDecisionBlocked|{status:'passed';state:EngineState}|{status:'learned';state:EngineState;feedback:LearningFeedback}{
 const state=validateConfirmedEngineState(input);if(state.stage!=='collecting')throw new LobbyError('PHASE_LOCKED',409);
 const result=learnMechanicalAbility(state.players,ownerSeat,targetSeat,{...metadata,night:state.night,ruleset:state.board.composition.ruleset});
 if(result.status==='blocked')return result;
 if(result.status==='passed')return {status:'passed',state};
 const owner=state.players.find(p=>p.seat===ownerSeat)!;owner.abilities=result.abilities;owner.learning=result.learning;
 return {status:'learned',state:validateConfirmedEngineState(state),feedback:result.feedback};
}
export function appendConfirmedEngineAction(input:EngineState,command:NightActionCommand):ProductDecisionBlocked|{status:'committed';state:EngineState;inspection?:InspectionResult}{
 const state=validateConfirmedEngineState(input),parsed=nightActionCommandSchema.safeParse(command);if(!parsed.success)throw new LobbyError('INVALID_NIGHT_ACTION');const c=parsed.data;
 const previous=state.actions.find(a=>a.casterId===c.casterId&&a.requestId===c.requestId);
 if(previous){const {night,sourceRole,ruleset,privateInspection,...original}=previous;if(JSON.stringify(original)!==JSON.stringify(c))throw new LobbyError('ALREADY_COMMITTED',409);return {status:'committed',state,...(privateInspection?{inspection:privateInspection}:{})};}
 if(state.stage!=='collecting')throw new LobbyError('PHASE_LOCKED',409);
 if(state.actions.some(a=>a.id===c.id||a.casterId===c.casterId&&a.abilityType===c.abilityType||a.abilityType==='wolf-knife'&&c.abilityType==='wolf-knife'))throw new LobbyError('ALREADY_COMMITTED',409);
 if(c.abilityType==='wolf-knife')return {status:'committed',state:validateConfirmedEngineState(appendNightAction(state,c))};
 // Shot requires a separate, already-settled death/victory window, outside night collection.
 if(c.abilityType==='shot')throw new LobbyError('SHOT_NOT_AUTHORIZED',409);
 const actor=state.players.find(p=>p.seat===c.casterId);if(!actor)throw new LobbyError('INVALID_TARGET');
 const skill=actor.abilities.skills.find(s=>s.id===c.abilityId&&s.kind===c.abilityType);if(!skill)throw new LobbyError('SKILL_NOT_FOUND',409);
 const authority=knifeAuthorityAtNightStart(state.players.map(({seat,alive,knifeGroup})=>({seat,alive,knifeGroup})));
 const result=useConfirmedAbility(actor.abilities,skill.id,{requestId:c.requestId,night:state.night,target:c.targetId},{ruleset:state.board.composition.ruleset,players:state.players,inheritedWolfKnife:authority.inheritedKnifeSeat===actor.seat,witchKnifeTarget:state.actions.find(a=>a.abilityType==='wolf-knife')?.targetId});
 if(result.status==='blocked')return result;
 actor.abilities=result.abilities;
 state.actions.push({...c,night:state.night,sourceRole:actor.role,ruleset:state.board.composition.ruleset,...(result.status==='used'&&result.inspection?{privateInspection:result.inspection}:{})});
 return {status:'committed',state:validateConfirmedEngineState(state),...(result.status==='used'&&result.inspection?{inspection:result.inspection}:{})};
}
