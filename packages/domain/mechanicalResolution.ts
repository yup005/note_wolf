import {LobbyError} from '../contracts/index.js';
import {boardRuleVersion,type Ruleset} from '../contracts/board.js';
import type {EngineState,NightAction,NightEffect,ResolutionDecision} from '../contracts/engine.js';
import {validateEngineState,type ResolutionStrategy} from './engine.js';

type MechanicalRuleset=Extract<Ruleset,'mechanical-seer'|'mechanical-armor'>;
type Protection='ordinary'|'mechanical-reflect'|'invincible';
type ProtectedAction={action:NightAction;protection:Protection};
const attackTypes=new Set(['wolf-knife','extra-knife','poison','shot']);

function blocked(questionIds:string[]):ResolutionDecision{
 return {status:'blocked',reason:'product-decision',questionIds:[...new Set(questionIds)]};
}
function ability(state:EngineState,action:NightAction){
 return state.players.find(p=>p.seat===action.casterId)!.abilities.skills.find(s=>s.id===action.abilityId)!;
}
function sourceEffect(action:NightAction):NightEffect{
 // Exactly one attack effect per locked action permits the same unique ID and
 // avoids exceeding the contract's 200-character limit by adding a prefix.
 return {id:action.id,actionId:action.id,casterId:action.casterId,targetId:action.targetId,
  abilityType:action.abilityType,sourceRole:action.sourceRole,ruleset:action.ruleset,night:action.night,
  outcome:action.targetId===null?'no-effect':'killed',reflectTarget:null,preventedBy:[]};
}

// These strategies consume authenticated, locked actions. Profile generation,
// action eligibility, timing and witch self-save legality belong to collection.
// Protection comes from the validated owned skill/copy evidence, never command flags.
function resolve(input:Readonly<EngineState>,ruleset:MechanicalRuleset):ResolutionDecision{
 const state=validateEngineState(input);
 if(state.board.composition.ruleset!==ruleset||state.board.ruleVersion!==boardRuleVersion)throw new LobbyError('ENGINE_RULESET_MISMATCH',409);
 const guards:ProtectedAction[]=[];
 const questions:string[]=[];
 for(const action of state.actions.filter(a=>a.targetId!==null)){
  if(action.abilityType==='guard'){
   const skill=ability(state,action),protection=skill.parameters.protection;
   // A native guard cannot manufacture a mechanical shield by changing parameters.
   if(skill.copiedFrom===null&&protection!=='ordinary')throw new LobbyError('INVALID_ENGINE_STATE');
   if(protection==='ordinary'||protection===(ruleset==='mechanical-armor'?'invincible':'mechanical-reflect')){
    guards.push({action,protection});
   }else questions.push('CUSTOM-PROTECTION-UNRESOLVED');
  }else if(action.abilityType==='poison'){
   if(ability(state,action).parameters.damage!=='witch-poison')questions.push('CUSTOM-DAMAGE-UNRESOLVED');
  }else if(action.abilityType==='extra-knife'){
   const parameters=ability(state,action).parameters;
   if(parameters.damage!=='ordinary-wolf-knife'||
    ruleset==='mechanical-seer'&&parameters.pierceOrdinaryGuard!==true||
    ruleset==='mechanical-armor'&&Object.hasOwn(parameters,'pierceOrdinaryGuard'))questions.push('CUSTOM-DAMAGE-UNRESOLVED');
  }else if(action.abilityType==='antidote'){
   if(ability(state,action).parameters.healing!=='ordinary-wolf-knife')questions.push('CUSTOM-HEALING-UNRESOLVED');
  }else if(action.abilityType==='shot')questions.push('CUSTOM-DAMAGE-UNRESOLVED');
 }
 if(questions.length)return blocked(questions);
 const attacks=state.actions.filter(a=>attackTypes.has(a.abilityType));
 const antidotes=state.actions.filter(a=>a.abilityType==='antidote'&&a.targetId!==null);
 const guardsOn=(seat:number|null)=>guards.filter(g=>g.action.targetId===seat);
 const antidotesOn=(seat:number|null)=>antidotes.filter(a=>a.targetId===seat);

 // Fail the whole batch before changing life/victory if any source requires a decision.
 for(const action of attacks.filter(a=>a.targetId!==null)){
  const protection=guardsOn(action.targetId),healing=antidotesOn(action.targetId);
  if(action.abilityType==='extra-knife'&&healing.length&&!attacks.some(a=>a.abilityType==='wolf-knife'&&a.targetId===action.targetId)){
   questions.push('MW-EXTRA-KNIFE-ANTIDOTE');
  }
  if(action.abilityType==='poison'&&protection.some(g=>g.protection==='mechanical-reflect')&&
   action.casterId!==action.targetId&&guardsOn(action.casterId).some(g=>g.protection!=='ordinary'))questions.push('MW-REFLECTION-CHAIN');
 }
 if(questions.length)return blocked(questions);

 const effects=attacks.map(action=>{
  const effect=sourceEffect(action);
  if(action.targetId===null)return effect;
  const protection=guardsOn(action.targetId);
  // Owner-confirmed simultaneous guard + antidote kills through the ordinary
  // knife. Other attack sources still use their own protection rules below.
  if(action.abilityType==='wolf-knife'&&protection.length&&antidotesOn(action.targetId).length)return effect;
  const invincible=protection.filter(g=>g.protection==='invincible');
  if(invincible.length){effect.outcome='prevented';effect.preventedBy=invincible.map(g=>g.action.id);return effect;}
  if(action.abilityType==='poison'){
   if(protection.some(g=>g.protection==='mechanical-reflect'))effect.reflectTarget=action.casterId;
   return effect;
  }
  const mechanical=protection.filter(g=>g.protection==='mechanical-reflect');
  const stacked=ruleset==='mechanical-armor'&&attacks.filter(a=>a.targetId===action.targetId&&['wolf-knife','extra-knife'].includes(a.abilityType)).length>=2;
  const piercing=ruleset==='mechanical-seer'&&action.abilityType==='extra-knife';
  const effectiveGuards=[...mechanical,...(!stacked&&!piercing?protection.filter(g=>g.protection==='ordinary'):[])];
  const healing=action.abilityType==='wolf-knife'?antidotesOn(action.targetId):[];
  effect.preventedBy=[...effectiveGuards.map(g=>g.action.id),...healing.map(a=>a.id)];
  if(effect.preventedBy.length)effect.outcome='prevented';
  return effect;
 });
 return {status:'settled',effects};
}

export function createMechanicalResolutionStrategy(ruleset:Ruleset):ResolutionStrategy{
 if(ruleset!=='mechanical-seer'&&ruleset!=='mechanical-armor')throw new LobbyError('ENGINE_RULESET_MISMATCH',409);
 return {ruleset,ruleVersion:boardRuleVersion,resolve:state=>resolve(state,ruleset)};
}
export function createMechanicalSeerResolutionStrategy():ResolutionStrategy{return createMechanicalResolutionStrategy('mechanical-seer');}
export function createMechanicalArmorResolutionStrategy():ResolutionStrategy{return createMechanicalResolutionStrategy('mechanical-armor');}
