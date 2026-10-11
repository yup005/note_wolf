import {LobbyError} from '../contracts/index.js';
import {engineStateSchema,engineSeedSchema,nightActionCommandSchema,resolutionDecisionSchema,type EngineState,type EngineSeed,type NightActionCommand,type ResolutionDecision,type NightEffect} from '../contracts/engine.js';
import {boardRuleVersion,type RoomBoardSnapshot,type Ruleset} from '../contracts/board.js';
import {createBoardConfiguration} from './boardConfig.js';
import {playerCamp,evaluateVictory} from './victory.js';
import {knifeAuthorityAtNightStart} from './knifeAuthority.js';
import {copySkills,useSkill} from './skills.js';
import {projectMechanicalCopyProfile} from './mechanicalAbilities.js';

const attacks=new Set(['wolf-knife','extra-knife','poison','shot']);
export interface ResolutionStrategy {ruleset:Ruleset;ruleVersion:typeof boardRuleVersion;resolve(context:Readonly<EngineState>):ResolutionDecision}

export function validateEngineState(input:unknown):EngineState{
 if(typeof input==='object'&&input!==null&&'formatVersion' in input&&input.formatVersion!==1)throw new LobbyError('ENGINE_VERSION_UNSUPPORTED',409);
 const parsed=engineStateSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_ENGINE_STATE');const state=parsed.data;
 const b=state.board.composition;const derived=createBoardConfiguration({seatCount:b.seatCount,roles:b.roleCounts});
 if(derived.ruleset!==b.ruleset||derived.playable!==b.playable||state.players.length!==b.seatCount||
  new Set(state.players.map(p=>p.seat)).size!==state.players.length||state.players.some(p=>p.seat>b.seatCount||p.camp!==playerCamp(p.role)||p.abilities.ownerSeat!==p.seat||p.abilities.originalRole!==p.role)||
  Object.entries(derived.roles).some(([role,count])=>state.players.filter(p=>p.role===role).length!==count)||
  state.players.some(p=>!derived.roles[p.role]))throw new LobbyError('INVALID_ENGINE_STATE');
 const seats=new Set(state.players.map(p=>p.seat));
 if(new Set(state.actions.map(a=>a.id)).size!==state.actions.length||
  new Set(state.actions.map(a=>`${a.casterId}:${a.requestId}`)).size!==state.actions.length||
  state.actions.some(a=>!seats.has(a.casterId)||a.targetId!==null&&!seats.has(a.targetId)||a.night!==state.night||a.ruleset!==b.ruleset||a.sourceRole!==state.players.find(p=>p.seat===a.casterId)!.role)||
  state.players.some(p=>p.learning&&(!seats.has(p.learning.sourceSeat)||p.learning.sourceSeat===p.seat||p.learning.night>state.night)||p.model&&(!seats.has(p.model.seat)||p.model.seat===p.seat||playerCamp(state.players.find(x=>x.seat===p.model!.seat)!.role)!==p.model.camp)))throw new LobbyError('INVALID_ENGINE_STATE');
 if(['collecting','awaiting-resolution'].includes(state.stage)&&state.victory.status!=='playing'||state.stage==='collecting'&&state.resolution!==null||state.stage==='awaiting-resolution'&&state.resolution?.status!=='blocked'||
  ['resolved','awaiting-decision','ended'].includes(state.stage)&&state.resolution?.status!=='settled'||
  state.stage==='ended'&&state.victory.status!=='ended'||state.stage==='awaiting-decision'&&state.victory.status!=='unresolved')throw new LobbyError('INVALID_ENGINE_STATE');
 for(const player of state.players){
  let copySource=player.learning?.sourceSnapshot;
  if(player.learning?.copyProfileSnapshot){
   const projected=projectMechanicalCopyProfile(player.learning.sourceSnapshot,player.role,b.ruleset);
   if('status' in projected||JSON.stringify(projected)!==JSON.stringify(player.learning.copyProfileSnapshot))throw new LobbyError('INVALID_ENGINE_STATE');
   copySource=player.learning.copyProfileSnapshot;
   if(player.abilities.skills.length!==copySource.skills.length)throw new LobbyError('INVALID_ENGINE_STATE');
  }
  if(player.learning){
   const source=state.players.find(p=>p.seat===player.learning!.sourceSeat)!;
   if(player.learning.sourceSnapshot.ownerSeat!==source.seat||player.learning.sourceSnapshot.originalRole!==source.role||
    player.abilities.mimickedRole!==(player.learning.sourceSnapshot.mimickedRole??source.role))throw new LobbyError('INVALID_ENGINE_STATE');
  }
  for(const snapshot of [player.abilities,...(player.learning?[player.learning.sourceSnapshot,...(player.learning.copyProfileSnapshot?[player.learning.copyProfileSnapshot]:[])]:[])]){
   for(const skill of snapshot.skills){
    if(new Set(skill.uses.map(use=>use.requestId)).size!==skill.uses.length||
     skill.remaining!==null&&skill.capacity!==null&&skill.remaining+skill.uses.length>skill.capacity||
     skill.lastTarget!==undefined&&skill.lastTarget!==(skill.uses.at(-1)?.target??null)||
     skill.uses.some(use=>use.night>state.night||use.night<skill.availableFromNight||use.target!==null&&!seats.has(use.target)))throw new LobbyError('INVALID_ENGINE_STATE');
   }
  }
  if(player.learning){
   for(const source of copySource!.skills){
    const copied=player.abilities.skills.find(skill=>skill.id===`${player.learning!.copyId}:${source.id}`);
    if(!copied?.copiedFrom)throw new LobbyError('INVALID_ENGINE_STATE');
   }
  }
  for(const skill of player.abilities.skills.filter(skill=>skill.copiedFrom!==null)){
   const learning=player.learning;
   const source=copySource?.skills.find(s=>s.id===skill.copiedFrom!.skillId);
   if(!learning||!source||skill.copiedFrom!.seat!==learning.sourceSeat||skill.copiedFrom!.night!==learning.night||
    skill.id!==`${learning.copyId}:${source.id}`||skill.kind!==source.kind||skill.capacity!==source.capacity||
    JSON.stringify(skill.parameters)!==JSON.stringify(source.parameters)||skill.availableFromNight<learning.night||
    learning.copyProfileSnapshot&&skill.availableFromNight!==learning.night+(['shot','extra-knife'].includes(skill.kind)?0:1))throw new LobbyError('INVALID_ENGINE_STATE');
  }
 }
 for(const action of state.actions){
  if(action.abilityType==='wolf-knife'){if(action.abilityId!==null)throw new LobbyError('INVALID_ENGINE_STATE');continue;}
  const skill=state.players.find(p=>p.seat===action.casterId)!.abilities.skills.find(s=>s.id===action.abilityId);
  const consumablePass=action.targetId===null&&['poison','antidote','extra-knife','shot'].includes(action.abilityType);
  if(!skill||skill.kind!==action.abilityType||!consumablePass&&!skill.uses.some(u=>u.requestId===action.requestId&&u.night===action.night&&u.target===action.targetId))throw new LobbyError('INVALID_ENGINE_STATE');
 }
 if(state.resolution?.status==='settled'){
  validateEffects(state,state.resolution.effects);
  const deaths=deathEvidence(state.resolution.effects);
  const normalize=(items:typeof deaths)=>items.map(d=>({...d,sourceEffectIds:[...d.sourceEffectIds].sort()})).sort((a,b)=>a.seat-b.seat);
  if(JSON.stringify(normalize(deaths))!==JSON.stringify(normalize(state.resolution.deaths))||
   deaths.some(d=>state.players.find(p=>p.seat===d.seat)!.alive||state.players.find(p=>p.seat===d.seat)!.publicState.canVote)||
   JSON.stringify(state.victory)!==JSON.stringify(victoryFor(state))||state.stage!==stageFor(state.victory))throw new LobbyError('INVALID_ENGINE_STATE');
 }
 return state;
}

export function createEngineState(board:RoomBoardSnapshot,seeds:readonly EngineSeed[],night=1):EngineState{
 const players=seeds.map(seed=>{const parsed=engineSeedSchema.safeParse(seed);if(!parsed.success)throw new LobbyError('INVALID_ENGINE_STATE');const p=parsed.data;return {...p,camp:playerCamp(p.role),alive:true,abilities:{ownerSeat:p.seat,originalRole:p.role,mimickedRole:null,skills:[]},publicState:{revealedRole:null,canVote:true,canInterject:false},learning:null,model:null};});
 return validateEngineState({formatVersion:1,board,night,stage:'collecting',players,actions:[],resolution:null,victory:{status:'playing'}});
}

// Generic copy caller supplies the confirmed ability profile/timing. This framework
// never grants role-specific skills or substitutes for a player's authenticated route.
export function copyEngineAbilities(input:EngineState,ownerSeat:number,sourceSeat:number,metadata:{copyId:string;availableFromNight:number;at?:number}):EngineState{
 const state=validateEngineState(input);if(state.stage!=='collecting')throw new LobbyError('PHASE_LOCKED',409);
 const owner=state.players.find(p=>p.seat===ownerSeat),source=state.players.find(p=>p.seat===sourceSeat);
 if(!owner||!source||owner===source||!owner.alive||!source.alive)throw new LobbyError('INVALID_TARGET');
 if(owner.learning)throw new LobbyError('ALREADY_LEARNED',409);
 const sourceSnapshot=structuredClone(source.abilities);
 owner.abilities=copySkills(sourceSnapshot,{ownerSeat,originalRole:owner.role,night:state.night,copyId:metadata.copyId,availableFromNight:metadata.availableFromNight});
 owner.learning={copyId:metadata.copyId,sourceSeat,night:state.night,at:metadata.at??null,sourceSnapshot};
 return validateEngineState(state);
}

export function appendNightAction(input:EngineState,command:NightActionCommand):EngineState{
 const state=validateEngineState(input);const parsed=nightActionCommandSchema.safeParse(command);if(!parsed.success)throw new LobbyError('INVALID_NIGHT_ACTION');const c=parsed.data;
 const previous=state.actions.find(a=>a.casterId===c.casterId&&a.requestId===c.requestId);
 if(previous){const {night,sourceRole,ruleset,privateInspection,...original}=previous;if(JSON.stringify(original)!==JSON.stringify(c))throw new LobbyError('ALREADY_COMMITTED',409);return state;}
 if(state.stage!=='collecting')throw new LobbyError('PHASE_LOCKED',409);
 if(state.actions.some(a=>a.id===c.id))throw new LobbyError('ALREADY_COMMITTED',409);
 const actor=state.players.find(p=>p.seat===c.casterId),target=state.players.find(p=>p.seat===c.targetId);
 if(!actor?.alive||c.targetId!==null&&!target?.alive)throw new LobbyError('INVALID_TARGET');
 const authority=knifeAuthorityAtNightStart(state.players.map(({seat,alive,knifeGroup})=>({seat,alive,knifeGroup})));
 const inherited=authority.inheritedKnifeSeat===actor.seat;
 if(c.abilityType==='wolf-knife'){
  if(c.abilityId!==null||!authority.sharedKnifeSeats.includes(actor.seat)&&authority.inheritedKnifeSeat!==actor.seat)throw new LobbyError('KNIFE_NOT_AUTHORIZED',409);
 }else{
  const skill=actor.abilities.skills.find(s=>s.id===c.abilityId);
  if(!skill||skill.kind!==c.abilityType)throw new LobbyError('SKILL_NOT_FOUND',409);
  actor.abilities=useSkill(actor.abilities,skill.id,{requestId:c.requestId,night:state.night,target:c.targetId},{inheritedWolfKnife:inherited});
 }
 state.actions.push({...c,night:state.night,sourceRole:actor.role,ruleset:state.board.composition.ruleset});
 return validateEngineState(state);
}

function validateEffects(state:EngineState,effects:readonly NightEffect[]){
 if(new Set(effects.map(e=>e.id)).size!==effects.length)throw new LobbyError('INVALID_RESOLUTION');
 for(const effect of effects){
  const action=state.actions.find(a=>a.id===effect.actionId);
  if(!action||action.casterId!==effect.casterId||action.targetId!==effect.targetId||action.sourceRole!==effect.sourceRole||action.abilityType!==effect.abilityType||action.night!==effect.night||action.ruleset!==effect.ruleset||
   effect.reflectTarget!==null&&(effect.abilityType!=='poison'||effect.reflectTarget!==effect.casterId)||
   effect.outcome==='killed'&&(effect.targetId===null||!attacks.has(effect.abilityType))||
   effect.preventedBy.some(id=>!state.actions.some(a=>a.id===id&&['guard','antidote'].includes(a.abilityType))))throw new LobbyError('INVALID_RESOLUTION');
 }
 for(const action of state.actions.filter(a=>attacks.has(a.abilityType))){if(effects.filter(e=>e.actionId===action.id).length!==1)throw new LobbyError('INVALID_RESOLUTION');}
}

function deathEvidence(effects:readonly NightEffect[]){
 const deaths=new Map<number,string[]>();
 for(const effect of effects.filter(e=>e.outcome==='killed')){
  const seat=effect.reflectTarget??effect.targetId!;
  const ids=deaths.get(seat)??[];ids.push(effect.id);deaths.set(seat,ids);
 }
 return [...deaths].map(([seat,sourceEffectIds])=>({seat,sourceEffectIds}));
}
function victoryFor(state:EngineState){
 return evaluateVictory(state.players.map(p=>({seat:p.seat,role:p.role,alive:p.alive,
  ...(p.abilities.mimickedRole?{learnedRole:p.abilities.mimickedRole}:{}),
  ...(p.model?{modelSeat:p.model.seat,modelCamp:p.model.camp}:{})})),state.board.composition.ruleset);
}
function stageFor(victory:EngineState['victory']):EngineState['stage']{
 return victory.status==='ended'?'ended':victory.status==='unresolved'?'awaiting-decision':'resolved';
}

export function settleEngineNight(input:EngineState,strategy?:ResolutionStrategy):EngineState{
 const state=validateEngineState(input);if(['resolved','ended','awaiting-decision'].includes(state.stage))return state;
 if(strategy&&(strategy.ruleset!==state.board.composition.ruleset||strategy.ruleVersion!==state.board.ruleVersion))throw new LobbyError('ENGINE_RULESET_MISMATCH',409);
 const decision=strategy?.resolve(structuredClone(state))??{status:'blocked',reason:'unimplemented',questionIds:['M3-RESOLUTION-NOT-IMPLEMENTED']};
 const parsed=resolutionDecisionSchema.safeParse(decision);if(!parsed.success)throw new LobbyError('INVALID_RESOLUTION');
 if(parsed.data.status==='blocked'){state.stage='awaiting-resolution';state.resolution=parsed.data;return validateEngineState(state);}
 const effects=parsed.data.effects;validateEffects(state,effects);
 const deaths=deathEvidence(effects);
 for(const player of state.players){if(deaths.some(d=>d.seat===player.seat)){player.alive=false;player.publicState.canVote=false;}}
 state.resolution={status:'settled',effects,deaths};
 state.victory=victoryFor(state);state.stage=stageFor(state.victory);return validateEngineState(state);
}
