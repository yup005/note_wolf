import {LobbyError} from '../contracts/index.js';
import {boardRoleSchema,rulesetSchema,type BoardRole,type Ruleset} from '../contracts/board.js';
import {snapshotSchema,useSchema,type SkillSnapshot,type SkillUse} from '../contracts/abilities.js';
import type {EnginePlayer} from '../contracts/engine.js';
import {copySkills,useSkill} from './skills.js';
import {playerCamp,type VictoryResult} from './victory.js';

export type AbilityPlayer=Pick<EnginePlayer,'seat'|'role'|'alive'|'abilities'|'learning'>;
export type ProductDecisionBlocked={status:'blocked';reason:'product-decision';questionIds:string[]};
export interface MechanicalLearning {
 copyId:string;sourceSeat:number;night:number;at:number|null;
 /** Actual source inventory, including prior consumption and nested copy provenance. */
 sourceSnapshot:SkillSnapshot;
 /** Confirmed skill projection; copied instances derive from this, not native inventory. */
 copyProfileSnapshot:SkillSnapshot;
}
export type LearningFeedback={status:'private';role:BoardRole;civilianEasterEgg?:{text:string;emphasis:string;color:'red'}}|ProductDecisionBlocked;
export type MechanicalLearnResult={status:'passed'}|ProductDecisionBlocked|{status:'learned';abilities:SkillSnapshot;learning:MechanicalLearning;feedback:LearningFeedback};
const blocked=(...questionIds:string[]):ProductDecisionBlocked=>({status:'blocked',reason:'product-decision',questionIds});
function checkedSnapshot(input:SkillSnapshot):SkillSnapshot{
 const parsed=snapshotSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_SKILL_STATE');return parsed.data;
}
function profile(role:BoardRole,seat:number,skills:SkillSnapshot['skills']):SkillSnapshot{
 return checkedSnapshot({ownerSeat:seat,originalRole:role,mimickedRole:null,skills});
}
function skill(seat:number,kind:SkillSnapshot['skills'][number]['kind'],capacity:number|null,parameters:SkillSnapshot['skills'][number]['parameters']):SkillSnapshot['skills'][number]{
 return {id:`native:${seat}:${kind}`,kind,capacity,remaining:capacity,availableFromNight:1,parameters,copiedFrom:null,uses:[]};
}
/** Internal profiles only; this does not enable dealing or expose private inventory. */
export function createNativeAbilityProfile(role:BoardRole,seat:number,ruleset:Ruleset):SkillSnapshot{
 if(!boardRoleSchema.safeParse(role).success||!rulesetSchema.safeParse(ruleset).success||ruleset!=='mechanical-armor'&&role==='armoredWolf'||ruleset==='standard'&&['mechanicalWolf','armoredWolf','guard','spiritSeer','mixer'].includes(role))throw new LobbyError('INVALID_SKILL_STATE');
 let skills:SkillSnapshot['skills']=[];
 if(role==='witch')skills=[skill(seat,'antidote',1,{healing:'ordinary-wolf-knife'}),skill(seat,'poison',1,{damage:'witch-poison'})];
 if(role==='poisoner')skills=[skill(seat,'poison',1,{damage:'witch-poison'})];
 if(role==='guard')skills=[skill(seat,'guard',null,{protection:'ordinary'})];
 if(role==='spiritSeer'||role==='seer')skills=[skill(seat,'inspect',null,{inspection:role==='spiritSeer'?'exact-role':'camp'})];
 if(role==='hunter'||role==='blackWolf')skills=[skill(seat,'shot',1,{damage:role==='blackWolf'?'black-wolf-shot':'hunter-shot'})];
 if(role==='whiteWolf')skills=[skill(seat,'explode-take',1,{damage:'white-wolf-take'})];
 return profile(role,seat,skills);
}
/** Reconstructible projection: never trust a caller-supplied copied capability profile. */
export function projectMechanicalCopyProfile(source:SkillSnapshot,ownerRole:BoardRole,ruleset:Ruleset):SkillSnapshot|ProductDecisionBlocked{
 const snapshot=checkedSnapshot(source);
 if(!rulesetSchema.safeParse(ruleset).success||ruleset==='standard'||!['mechanicalWolf','armoredWolf'].includes(ownerRole)||ownerRole==='armoredWolf'&&ruleset!=='mechanical-armor')throw new LobbyError('INVALID_SKILL_STATE');
 const role=snapshot.mimickedRole??snapshot.originalRole;
 // Idiot learning/mimic is confirmed; its exile-only extra-night trigger is a
 // separate daytime state machine, never a fabricated active night skill.
 if(role==='seer')return blocked('MA-COPY-SEER');
 // Only the armor→already-learned mechanical chain is confirmed. Its profile is
 // frozen verbatim; consumption resets in copySkills, including nested provenance.
 if(ownerRole==='armoredWolf'&&snapshot.originalRole==='mechanicalWolf'&&snapshot.mimickedRole!==null)return snapshot;
 if(snapshot.mimickedRole!==null){if(['blackWolf','whiteWolf'].includes(role)&&['mechanicalWolf','armoredWolf'].includes(snapshot.originalRole))return snapshot;return blocked('MA-COPY-UNDEFINED-CHAIN');}
 const projected=structuredClone(snapshot);
 if(role==='witch')projected.skills=projected.skills.filter(s=>s.kind==='poison');
 else if(role==='guard')projected.skills=projected.skills.map(s=>s.kind==='guard'?{...s,parameters:{protection:ruleset==='mechanical-armor'?'invincible':'mechanical-reflect'}}:s);
 else if(role==='wolf'||ruleset==='mechanical-armor'&&(role==='armoredWolf'||role==='mechanicalWolf')){
  projected.skills=[skill(snapshot.ownerSeat,'extra-knife',1,{damage:'ordinary-wolf-knife',...(ruleset==='mechanical-seer'?{pierceOrdinaryGuard:true}:{})})];
 }else if(role==='villager'||role==='mixer')projected.skills=[];
 else if(role==='mechanicalWolf')return blocked('MA-COPY-UNDEFINED-CHAIN');
 return projected;
}
export function learnMechanicalAbility(players:readonly AbilityPlayer[],ownerSeat:number,targetSeat:number|null,metadata:{ruleset:Ruleset;night:number;copyId:string;at?:number}):MechanicalLearnResult{
 const owner=players.find(p=>p.seat===ownerSeat);
 if(!owner?.alive||!['mechanicalWolf','armoredWolf'].includes(owner.role))throw new LobbyError('LEARNING_NOT_AUTHORIZED',409);
 if(owner.learning||owner.abilities.mimickedRole!==null)throw new LobbyError('ALREADY_LEARNED',409);
 if(targetSeat===null)return {status:'passed'};
 const target=players.find(p=>p.seat===targetSeat);
 if(!target?.alive||target===owner)throw new LobbyError('INVALID_TARGET');
 const sourceSnapshot=checkedSnapshot(target.abilities);
 if(sourceSnapshot.ownerSeat!==target.seat||sourceSnapshot.originalRole!==target.role||metadata.at!==undefined&&(!Number.isFinite(metadata.at)||metadata.at<0))throw new LobbyError('INVALID_SKILL_STATE');
 const copyProfileSnapshot=projectMechanicalCopyProfile(sourceSnapshot,owner.role,metadata.ruleset);
 if('status' in copyProfileSnapshot)return copyProfileSnapshot;
 const abilities=copySkills(copyProfileSnapshot,{copyId:metadata.copyId,ownerSeat,originalRole:owner.role,night:metadata.night,availableFromNight:metadata.night+1});
 for(const instance of abilities.skills)if(['shot','extra-knife','explode-take'].includes(instance.kind))instance.availableFromNight=metadata.night;
 const role=abilities.mimickedRole!;
 const feedback:LearningFeedback={status:'private',role,
  ...(role==='villager'?{civilianEasterEgg:{text:'你就是个「普通村民」！',emphasis:'普通村民',color:'red' as const}}:{})};
 return {status:'learned',abilities,learning:{copyId:metadata.copyId,sourceSeat:targetSeat,night:metadata.night,at:metadata.at??null,sourceSnapshot,copyProfileSnapshot},feedback};
}

export type InspectionResult={status:'visible';role:BoardRole}|{status:'camp';camp:'wolves'|'good'};
/** Internal result. Authenticated projection must release it only to the inspecting player. */
export function visibleInspectionRole(player:AbilityPlayer):Extract<InspectionResult,{status:'visible'}>|ProductDecisionBlocked{
 const snapshot=checkedSnapshot(player.abilities);
 const role=snapshot.mimickedRole??player.role;
 return {status:'visible',role};
}
export interface ConfirmedAbilityContext{
 ruleset:Ruleset;players:readonly AbilityPlayer[];inheritedWolfKnife?:boolean;
 /** Must be the verdict after all relevant deaths have settled, never a pre-death prediction. */
 settledVictory?:VictoryResult;deathCauses?:readonly ('wolf-knife'|'extra-knife'|'poison'|'exile'|'shot'|'white-wolf'|'explosion')[];
 /** Only the ordinary wolf-stage target; hidden extra attacks cannot supply this. */
 witchKnifeTarget?:number|null;
}
export type ConfirmedAbilityUseResult={status:'used';abilities:SkillSnapshot;inspection?:InspectionResult}|{status:'passed';abilities:SkillSnapshot}|ProductDecisionBlocked;
export function useConfirmedAbility(input:SkillSnapshot,skillId:string,command:SkillUse,context:ConfirmedAbilityContext):ConfirmedAbilityUseResult{
 const snapshot=checkedSnapshot(input);
 const parsed=useSchema.safeParse(command);if(!parsed.success||!rulesetSchema.safeParse(context.ruleset).success)throw new LobbyError('INVALID_SKILL_STATE');const use=parsed.data;
 const instance=snapshot.skills.find(s=>s.id===skillId);if(!instance)throw new LobbyError('SKILL_NOT_FOUND',409);
 const actor=context.players.find(p=>p.seat===snapshot.ownerSeat),target=context.players.find(p=>p.seat===use.target);
 if(!actor||actor.role!==snapshot.originalRole||use.target!==null&&!target?.alive)throw new LobbyError('INVALID_TARGET');
 if(use.night<instance.availableFromNight)throw new LobbyError('SKILL_NOT_ACTIVE',409);
 const previous=instance.uses.find(u=>u.requestId===use.requestId);
 if(previous&&(previous.target!==use.target||previous.night!==use.night))throw new LobbyError('ALREADY_COMMITTED',409);
 if(!previous&&instance.uses.some(u=>u.night===use.night))throw new LobbyError('ALREADY_COMMITTED',409);
 if(!previous&&instance.uses.some(u=>u.night>use.night))throw new LobbyError('INVALID_SKILL_STATE');
 if(instance.kind==='explode-take')throw new LobbyError('DAY_SKILL_ONLY',409);
 if(instance.kind==='shot'){
  if(context.settledVictory?.status==='unresolved')return blocked(context.settledVictory.questionId);
  if(actor.alive||context.settledVictory?.status!=='playing'||!context.deathCauses?.some(c=>c==='wolf-knife'||c==='extra-knife'||c==='exile'||instance.parameters.damage==='black-wolf-shot'&&(c==='shot'||c==='white-wolf'))||context.deathCauses.some(c=>c==='poison'||c==='explosion')||use.target===actor.seat)throw new LobbyError('SHOT_NOT_AUTHORIZED',409);
 }else if(!actor.alive)throw new LobbyError('INVALID_TARGET');
 if(instance.kind==='inspect'&&use.target===actor.seat&&context.ruleset!=='puppet')throw new LobbyError('INVALID_TARGET');
 if(instance.kind==='guard'&&!previous&&use.target!==null&&instance.uses.some(u=>u.night===use.night-1&&u.target===use.target))throw new LobbyError('GUARD_CONSECUTIVE_TARGET',409);
 if(instance.kind==='poison'||instance.kind==='antidote'){
  if(snapshot.originalRole==='witch'&&snapshot.skills.some(s=>s.kind!==instance.kind&&['poison','antidote'].includes(s.kind)&&s.uses.some(u=>u.night===use.night)))throw new LobbyError('WITCH_TWO_MEDICINES',409);
 }
 if(instance.kind==='antidote'&&use.target!==null){
  if(use.target!==context.witchKnifeTarget)throw new LobbyError('INVALID_TARGET');
  if(use.target===actor.seat&&context.ruleset!=='standard'){
   throw new LobbyError('WITCH_SELF_SAVE_FORBIDDEN',409);
  }
 }
 // Declining a consumable keeps even exhausted inventory and performs no attack.
 // The orchestrator locks the phase; unlimited passes still record night history.
 if(use.target===null&&!['guard','inspect'].includes(instance.kind))return {status:'passed',abilities:snapshot};
 if(instance.kind==='extra-knife'&&context.inheritedWolfKnife!==true)throw new LobbyError('KNIFE_NOT_INHERITED',409);
 if(instance.kind==='extra-knife'&&instance.copiedFrom?.night===use.night)return blocked('MA-COPY-EXTRA-KNIFE-LEARNING-NIGHT');
 if(instance.remaining===0&&!previous)throw new LobbyError('SKILL_EXHAUSTED',409);
 let inspection:InspectionResult|undefined;
 if(instance.kind==='inspect'&&target){
  const visible=visibleInspectionRole(target);if(visible.status==='blocked')return visible;
  if(instance.parameters.inspection==='camp'){
   // Ordinary seer follows the frozen visible identity. Mixed-blood always
   // reports good; true camp/model allegiance remains a victory concern.
   inspection={status:'camp',camp:playerCamp(visible.role)??'good'};
  }else inspection=visible;
 }
 const next=useSkill(snapshot,skillId,use,{inheritedWolfKnife:context.inheritedWolfKnife===true});
 return {status:'used',abilities:next,...(inspection?{inspection}:{})};
}
