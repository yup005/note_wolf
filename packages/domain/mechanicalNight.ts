import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import type {NightCommand,NightPhase,NightPrivate} from '../contracts/night.js';
import type {NightState,NightCarry} from './night.js';
import type {RoomBoardSnapshot} from '../contracts/board.js';
import type {EngineState} from '../contracts/engine.js';
import {createConfirmedEngineState,validateConfirmedEngineState,learnConfirmedEngineAbility,appendConfirmedEngineAction} from './mechanicalEngine.js';
import {settleEngineNight} from './engine.js';
import {createMechanicalResolutionStrategy} from './mechanicalResolution.js';
import {knifeAuthorityAtNightStart} from './knifeAuthority.js';
import {playerCamp} from './victory.js';

type Choice='learn'|'guard'|'poison'|'inspect'|'extra-knife'|'skip';
export interface MechanicalNightRuntime {
 schedule:NightPhase[];index:number;shared:number[];inherited:number|null;
 locked:Record<number,{turnId:string;choice:Choice|'mixer';target:number|null}>;
 seen:Record<number,string>;
}
const fail=(code:string,status=409):never=>{throw new LobbyError(code,status);};
function engine(s:NightState):EngineState{return s.engine!;}
function runtime(s:NightState){return s.mechanical!;}
function turn(s:NightState,p:NightPhase,now:number){
 s.phase=p;s.turnId=randomUUID();const seconds=p==='wolves'?180:p==='eyes_closed'?5:p==='witch'&&s.night===1?60:30;
 s.deadline=['first_night_complete','rules_pending','awaiting_host'].includes(p)?null:now+seconds*1000;
 s.events.push({type:p,at:now});
}
export function initializeMechanicalNight(s:NightState,board:RoomBoardSnapshot,carry?:NightCarry){
 let e:EngineState;
 if(carry?.engine){e=structuredClone(carry.engine);e.night=s.night;e.stage='collecting';e.actions=[];e.resolution=null;e.victory={status:'playing'};
  for(const p of e.players){p.alive=s.players.find(x=>x.seat===p.seat)!.alive!==false;p.publicState.canVote=p.alive&&p.publicState.revealedRole!=='idiot';}
 }else e=createConfirmedEngineState(board,s.players.map(p=>({seat:p.seat,role:p.role,knifeGroup:p.role==='wolf'?'shared':p.role==='mechanicalWolf'?'mechanical':p.role==='armoredWolf'?'armor':'none'})),s.night);
 s.engine=validateConfirmedEngineState(e);s.extraNightSeat=carry?.extraNightSeat??null;
 const authority=knifeAuthorityAtNightStart(e.players.map(p=>({seat:p.seat,alive:p.alive||p.seat===s.extraNightSeat,knifeGroup:p.knifeGroup})));
 const counts=board.composition.roleCounts;const schedule:NightPhase[]=[];
 if(s.night===1&&counts.mixer)schedule.push('mixer');
 if((counts.mechanicalWolf||counts.armoredWolf)&&(s.night>1||!e.players.some(p=>p.knifeGroup==='shared')))schedule.push('mechanical_authority');
 if(counts.guard)schedule.push('guard');schedule.push('wolves');if(counts.witch)schedule.push('witch');
 if(counts.mechanicalWolf)schedule.push('mechanical');if(counts.armoredWolf)schedule.push('armor');
 if(counts.spiritSeer)schedule.push('spiritSeer');if(counts.seer)schedule.push('seer');if(counts.hunter)schedule.push('hunter');
 s.mechanical={schedule,index:0,shared:authority.sharedKnifeSeats,inherited:authority.inheritedKnifeSeat,locked:{},seen:{}};
}
export function beginMechanicalNight(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase!=='awaiting_host')fail('STALE_TURN');const r=runtime(s);
 s.confirmer=r.shared.length?r.shared[choose(r.shared.length)]:r.inherited;
 turn(s,r.schedule[0],now);
}
function roleActor(s:NightState){
 const role=s.phase==='mechanical'?'mechanicalWolf':s.phase==='armor'?'armoredWolf':s.phase;
 return engine(s).players.find(p=>p.role===role&&p.alive);
}
function append(s:NightState,seat:number,kind:'wolf-knife'|'guard'|'poison'|'inspect'|'extra-knife'|'antidote',target:number|null,now:number){
 let e=engine(s);const p=e.players.find(p=>p.seat===seat)!;
 const skill=p.abilities.skills.find(x=>x.kind===kind);
 const ghost=!p.alive&&seat===s.extraNightSeat&&kind==='wolf-knife';
 if(ghost){e=structuredClone(e);e.players.find(p=>p.seat===seat)!.alive=true;}
 const result=appendConfirmedEngineAction(e,{id:`${s.night}:${s.turnId}:${seat}:${kind}`,requestId:`${s.turnId}:${kind}`,casterId:seat,targetId:target,abilityId:kind==='wolf-knife'?null:skill?.id??null,abilityType:kind,stage:s.phase,at:now});
 if(result.status==='blocked')throw new LobbyError('RULE_DECISION_REQUIRED',409);
 s.engine=result.state;if(ghost)result.state.players.find(p=>p.seat===seat)!.alive=false;
}
function resolveKnife(s:NightState,now:number,choose:(n:number)=>number){
 const r=runtime(s);const voters=r.shared.length?r.shared:r.inherited===null?[]:[r.inherited];
 let target:number|null=null;
 if(s.priorityCommitted)target=s.priorityTarget;
 else {const tally=new Map<number,number>();for(const seat of voters){const v=s.votes[seat];if(v!==null&&v!==undefined)tally.set(v,(tally.get(v)??0)+1);}
  const max=Math.max(0,...tally.values());const ties=[...tally].filter(([,v])=>v===max).map(([seat])=>seat);target=ties.length?ties[choose(ties.length)]:null;}
 s.knife=target;
 const caster=r.shared[0]??r.inherited;if(caster!==null&&caster!==undefined)append(s,caster,'wolf-knife',target,now);
 s.events.push({type:'knife_resolved',at:now,target});
}
function complete(s:NightState,now:number){
 s.engine=settleEngineNight(engine(s),createMechanicalResolutionStrategy(engine(s).board.composition.ruleset));
 if(s.engine.resolution?.status==='blocked'||s.engine.victory.status==='unresolved'){turn(s,'rules_pending',now);return;}
 turn(s,'first_night_complete',now);
}
function finish(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase==='wolves')resolveKnife(s,now,choose);
 if(s.phase==='mixer'){
  const p=roleActor(s);if(p&&!p.model){const targets=engine(s).players.filter(x=>x.alive&&x.seat!==p.seat&&playerCamp(x.role)!==null);if(!targets.length){turn(s,'rules_pending',now);return;}const model=targets[choose(targets.length)];p.model={seat:model.seat,camp:playerCamp(model.role)!};s.events.push({type:'mixer_model',seat:p.seat,target:model.seat,at:now});}
 }
 const r=runtime(s);r.index++;if(r.index>=r.schedule.length){complete(s,now);return;}
 s.nextRole=r.schedule[r.index];turn(s,'eyes_closed',now);
}
export function advanceMechanicalNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){
 while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const boundary=s.deadline;
  if(s.phase==='eyes_closed'){const next=s.nextRole!;s.nextRole=null;turn(s,next,boundary);}else finish(s,boundary,choose);
 }
}
export function mechanicalNightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceMechanicalNight(s,now,choose);const r=runtime(s),e=engine(s);const p=e.players.find(p=>p.seat===seat);if(!p)fail('NOT_SEATED');
 const old=r.locked[seat];
 if(c.action==='witch'&&p!.role==='witch'&&s.witchChoice&&s.witchTurnId===c.turnId){if(s.witchChoice.choice===c.choice&&s.witchChoice.target===c.target)return;fail('ALREADY_COMMITTED');}
 if((c.action==='ability_finish'||c.action==='seer_finish')&&old?.turnId===c.turnId&&r.seen[seat]===c.turnId)return;
 if(c.action==='seer'&&p!.role==='seer'&&old?.turnId===c.turnId&&old.choice==='inspect'){if(old.target===c.target)return;fail('ALREADY_COMMITTED');}
 if(c.action==='hunter_seen'&&p!.role==='hunter'&&s.hunterTurnId===c.turnId&&s.hunterSeen)return;
 if(c.action==='ability'&&old?.turnId===c.turnId){if(old.choice===c.choice&&old.target===c.target)return;fail('ALREADY_COMMITTED');}
 if(c.action==='mixer'&&old?.turnId===c.turnId){if(old.choice==='mixer'&&old.target===c.target)return;fail('ALREADY_COMMITTED');}
 if(c.turnId!==s.turnId)fail('STALE_TURN');
 const targetValid=(target:number|null)=>target===null||e.players.some(x=>x.seat===target&&(x.alive||target===seat&&seat===s.extraNightSeat));
 if(s.phase==='wolves'){
  const priority=s.priorityWolf===seat;const voters=r.shared.length?r.shared:r.inherited===null?[]:[r.inherited];
  if(!voters.includes(seat)&&!priority)fail('NOT_YOUR_TURN',403);
  if(c.action==='vote'||c.action==='priority_knife'){
   if(!targetValid(c.target))fail('INVALID_TARGET',400);
   if(c.action==='priority_knife'){if(!priority)fail('PRIORITY_WOLF_ONLY',403);s.priorityTarget=c.target;s.priorityCommitted=true;s.events.push({type:'priority_knife',seat,target:c.target,at:now});finish(s,now,choose);}
   else {if(priority)s.priorityTarget=c.target;else s.votes[seat]=c.target;s.events.push({type:'wolf_vote',seat,target:c.target,at:now});}return;
  }
  if(c.action==='confirm_wolves'){if(s.priorityWolf!==null)fail('PRIORITY_WOLF_ONLY',403);if(s.confirmer!==seat)fail('CONFIRMER_ONLY',403);finish(s,now,choose);return;}
  fail('NOT_YOUR_TURN',403);
 }
 if(!p!.alive)fail('NOT_YOUR_TURN',403);
 if(s.phase==='mechanical_authority'&&c.action==='authority_seen'){
  if(!['mechanicalWolf','armoredWolf'].includes(p!.role))fail('NOT_YOUR_TURN',403);r.seen[seat]=s.turnId;return;
 }
 if(roleActor(s)?.seat!==seat)fail('NOT_YOUR_TURN',403);
 if(c.action==='mixer'&&s.phase==='mixer'){
  const target=e.players.find(x=>x.seat===c.target);if(!target?.alive||target===p||playerCamp(target.role)===null)throw new LobbyError('INVALID_TARGET');
  p!.model={seat:target.seat,camp:playerCamp(target.role)!};r.locked[seat]={turnId:c.turnId,choice:'mixer',target:c.target};s.events.push({type:'mixer_model',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='witch'&&s.phase==='witch'){
  if(s.witchChoice)fail('ALREADY_COMMITTED');
  if(c.choice==='save'){if(s.knife===seat)fail('CANNOT_SELF_SAVE');if(!s.antidote||s.knife===null)fail('POTION_UNAVAILABLE');if(c.target!==s.knife)fail('INVALID_TARGET',400);append(s,seat,'antidote',c.target,now);s.antidote=false;}
  else if(c.choice==='poison'){if(!s.poison)fail('POTION_UNAVAILABLE');if(c.target===null)fail('INVALID_TARGET',400);append(s,seat,'poison',c.target,now);s.poison=false;}
  else if(c.target!==null)fail('INVALID_TARGET',400);
  s.witchChoice={choice:c.choice,target:c.target};s.witchTurnId=c.turnId;s.events.push({type:`witch_${c.choice}`,seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='hunter_seen'&&s.phase==='hunter'){s.hunterSeen=true;s.hunterTurnId=c.turnId;s.events.push({type:'hunter_seen',seat,at:now});finish(s,now,choose);return;}
 if(c.action==='ability_finish'||c.action==='seer_finish'){
  if(!r.locked[seat]||r.locked[seat].turnId!==s.turnId)fail('RESULT_NOT_READY');r.seen[seat]=s.turnId;
  if(!['mechanical','armor'].includes(s.phase))finish(s,now,choose);return;
 }
 const choice=c.action==='seer'?'inspect':c.action==='ability'?c.choice:null;
 const target=c.action==='seer'||c.action==='ability'?c.target:null;
 if(choice===null)fail('NOT_YOUR_TURN',403);
 const mechanical=['mechanical','armor'].includes(s.phase);
 if(!mechanical&&!(s.phase==='guard'&&choice==='guard')&&!(['spiritSeer','seer'].includes(s.phase)&&choice==='inspect'))fail('NOT_YOUR_TURN',403);
 if(!targetValid(target))fail('INVALID_TARGET',400);
 if(choice==='skip'){if(target!==null)fail('INVALID_TARGET',400);}
 else if(choice==='learn'){
  if(!mechanical||p!.learning)fail('ALREADY_LEARNED');
  const result=learnConfirmedEngineAbility(e,seat,target,{copyId:`copy:${s.night}:${seat}`,at:now});
  if(result.status==='blocked')throw new LobbyError('RULE_DECISION_REQUIRED',409);s.engine=result.state;
  if(result.status==='learned')s.events.push({type:s.phase==='armor'?'armor_learn':'mechanical_learn',seat,target,at:now});
 }else {if(mechanical&&!p!.learning)fail('SKILL_NOT_FOUND');append(s,seat,choice as 'guard'|'poison'|'inspect'|'extra-knife',target,now);
  s.events.push({type:choice==='inspect'?(mechanical?'mechanical_check':s.phase==='seer'?'seer_check':'spirit_check'):choice==='guard'?'guard_protect':choice==='poison'?'mechanical_poison':s.phase==='armor'?'armor_knife':'mechanical_knife',seat,target,at:now});
 }
 r.locked[seat]={turnId:c.turnId,choice:choice!,target};
 if(!mechanical&&choice==='guard')finish(s,now,choose);
}
function hunterCanShoot(s:NightState,seat:number){
 const e=engine(s),p=e.players.find(p=>p.seat===seat)!;
 const result=createMechanicalResolutionStrategy(e.board.composition.ruleset).resolve(e);
 return p.abilities.skills.some(x=>x.kind==='shot'&&x.remaining!==0)&&result.status==='settled'&&!result.effects.some(effect=>effect.abilityType==='poison'&&effect.outcome==='killed'&&(effect.reflectTarget??effect.targetId)===seat);
}
export function privateMechanicalNight(s:NightState,seat:number):NightPrivate{
 const out:NightPrivate={turnId:s.turnId,kind:'waiting'};const e=engine(s),r=runtime(s),p=e.players.find(p=>p.seat===seat);
 if(!p)return out;
 if(p.role==='witch'&&s.witchChoice&&s.phase==='eyes_closed'&&r.schedule[r.index-1]==='witch')return {...out,witchReceipt:{...s.witchChoice},antidote:s.antidote,poison:s.poison,committed:true};
 if(p.role==='hunter'&&s.hunterSeen&&s.phase==='first_night_complete'&&s.players.find(x=>x.seat===seat)?.alive!==false)return {...out,skillReceipt:{role:'hunter',canShoot:hunterCanShoot(s,seat)}};
 const wolfSeats=r.shared.length?r.shared:r.inherited===null?[]:[r.inherited];
 if(s.phase==='wolves'&&(wolfSeats.includes(seat)||s.priorityWolf===seat))return {...out,kind:'wolves',legalTargets:e.players.filter(x=>x.alive||x.seat===seat&&seat===s.extraNightSeat).map(x=>x.seat),wolves:[...wolfSeats],votes:Object.entries(s.votes).filter(([seat])=>wolfSeats.includes(Number(seat))).map(([seat,target])=>({seat:Number(seat),target})),confirmer:s.confirmer??undefined,myVote:s.priorityWolf===seat?s.priorityTarget:s.votes[seat]??null,priorityWolf:s.priorityWolf,priorityTarget:s.priorityTarget,priorityCommitted:s.priorityCommitted};
 if(!p.alive)return out;
 if(s.phase==='mechanical_authority'&&['mechanicalWolf','armoredWolf'].includes(p.role))return {...out,kind:'mechanical_authority',inheritedKnife:r.inherited===seat,seen:r.seen[seat]===s.turnId};
 if(roleActor(s)?.seat!==seat)return out;
 if(s.phase==='witch')return {...out,kind:'witch',...(s.antidote?{knife:s.knife}:{}),antidote:s.antidote,poison:s.poison,committed:!!s.witchChoice,...(s.witchChoice??{})};
 if(s.phase==='hunter')return {...out,kind:'hunter',canShoot:hunterCanShoot(s,seat),seen:s.hunterSeen};
 if(s.phase==='mixer')return {...out,kind:'mixer',legalTargets:e.players.filter(x=>x.alive&&x!==p&&playerCamp(x.role)!==null).map(x=>x.seat),...(p.model?{modelSeat:p.model.seat}:{})};
 if(!['mechanical','armor','guard','spiritSeer','seer'].includes(s.phase))return out;
 const skill=p.abilities.skills.find(x=>['guard','poison','inspect','extra-knife'].includes(x.kind));
 const locked=r.locked[seat]?.turnId===s.turnId?r.locked[seat]:null;
 const inspection=e.actions.find(a=>a.casterId===seat&&a.abilityType==='inspect')?.privateInspection;
 const mechanical=['mechanical','armor'].includes(s.phase);
 const legalTargets=e.players.filter(x=>x.alive&&(!(mechanical&&!p.learning||skill?.kind==='inspect')||x.seat!==seat)&&!(skill?.kind==='guard'&&skill.uses.some(u=>u.night===s.night-1&&u.target===x.seat))).map(x=>x.seat);
 return {...out,kind:s.phase as NightPrivate['kind'],canLearn:mechanical&&!p.learning,learnedRole:p.abilities.mimickedRole,inheritedKnife:r.inherited===seat,
  skills:p.abilities.skills.filter((x):x is typeof x&{kind:'guard'|'poison'|'inspect'|'extra-knife'}=>['guard','poison','inspect','extra-knife'].includes(x.kind)).map(x=>({kind:x.kind,remaining:x.remaining,available:x.availableFromNight<=s.night&&x.remaining!==0&&(x.kind!=='extra-knife'||r.inherited===seat)&&!(x.kind==='extra-knife'&&x.copiedFrom?.night===s.night)})),
  legalTargets,committed:!!locked,seen:r.seen[seat]===s.turnId,...(locked?{target:locked.target}:{}),
  ...(inspection?.status==='visible'?{inspectionRole:inspection.role}:inspection?.status==='camp'?{result:inspection.camp==='wolves'?'wolf' as const:'good' as const}:{}),
  ...(locked?.choice==='learn'&&p.learning?{learningReceipt:{role:p.abilities.mimickedRole!,...(p.abilities.mimickedRole==='villager'?{civilianEasterEgg:{text:'你就是个「普通村民」！',emphasis:'普通村民',color:'red' as const}}:{})}}:{})};
}
