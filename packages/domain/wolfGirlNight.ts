import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {isSharedWolfRole,isWolfRole,boardRuleVersion,type RoomBoardSnapshot} from '../contracts/board.js';
import type {NightCommand,NightPhase,NightPrivate} from '../contracts/night.js';
import type {NightState,NightCarry} from './night.js';
import {createConfirmedEngineState,validateConfirmedEngineState,appendConfirmedEngineAction} from './mechanicalEngine.js';
import {settleEngineNight,type ResolutionStrategy} from './engine.js';

export interface WolfGirlRuntime {schedule:NightPhase[];index:number;locked:Record<number,{turnId:string;action:string;target:number|null;choice?:string}>;seen:Record<number,string>}
const fail=(code:string,status=409):never=>{throw new LobbyError(code,status);};
const runtime=(s:NightState)=>s.wolfGirl!;
export const isGirlNight=(s:NightState)=>s.engine?.board.composition.ruleset==='wolf-girl';
function turn(s:NightState,p:NightPhase,now:number){s.phase=p;s.turnId=randomUUID();s.deadline=p==='first_night_complete'?null:now+(p==='wolves'?180:p==='eyes_closed'?5:30)*1000;s.events.push({type:p,at:now});}
export function initializeWolfGirlNight(s:NightState,board:RoomBoardSnapshot,carry?:NightCarry){
 if(carry?.engine){
  const e=structuredClone(carry.engine);e.night=s.night;e.stage='collecting';e.actions=[];e.resolution=null;e.victory={status:'playing'};
  for(const p of e.players){p.alive=s.players.find(x=>x.seat===p.seat)!.alive!==false;p.publicState.canVote=p.alive;}
  s.engine=validateConfirmedEngineState(e);
 }else s.engine=createConfirmedEngineState(board,s.players.map(p=>({seat:p.seat,role:p.role,knifeGroup:isSharedWolfRole(p.role)?'shared':'none'})),s.night);
 s.antidote=false;
 s.wolfGirl={schedule:s.night===1?['guard','confession','wolves','poisoner','seer','hunter','confession_notice']:['guard','wolves','poisoner','seer','hunter'],index:0,locked:{},seen:{}};
}
export function beginWolfGirlNight(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase!=='awaiting_host')fail('STALE_TURN');const wolves=s.engine!.players.filter(p=>p.alive&&isSharedWolfRole(p.role));s.confirmer=wolves.length?wolves[choose(wolves.length)].seat:null;turn(s,runtime(s).schedule[0],now);
}
function append(s:NightState,seat:number,kind:'wolf-knife'|'guard'|'poison'|'inspect',target:number|null,now:number){
 const p=s.engine!.players.find(p=>p.seat===seat)!;
 const result=appendConfirmedEngineAction(s.engine!,{id:`${s.night}:${s.turnId}:${seat}:${kind}`,requestId:`${s.turnId}:${kind}`,casterId:seat,targetId:target,abilityId:kind==='wolf-knife'?null:p.abilities.skills.find(x=>x.kind===kind)!.id,abilityType:kind,stage:s.phase,at:now});
 if(result.status==='blocked')throw new LobbyError('RULE_DECISION_REQUIRED',409);s.engine=result.state;
}
export function wolfGirlResolution():ResolutionStrategy{return {ruleset:'wolf-girl',ruleVersion:boardRuleVersion,resolve:e=>({status:'settled',effects:e.actions.filter(a=>['wolf-knife','poison'].includes(a.abilityType)).map(a=>{
 const guards=a.abilityType==='wolf-knife'&&a.targetId!==null?e.actions.filter(g=>g.abilityType==='guard'&&g.targetId===a.targetId):[];
 return {id:a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:a.targetId===null?'no-effect' as const:guards.length?'prevented' as const:'killed' as const,reflectTarget:null,preventedBy:guards.map(g=>g.id)};
 })})};}
function confess(s:NightState,seat:number,target:number,now:number){
 const e=s.engine!,girl=e.players.find(p=>p.seat===seat),other=e.players.find(p=>p.seat===target);
 if(!girl?.alive||girl.role!=='wolfGirl'||!other?.alive||isWolfRole(other.role)||other===girl)fail('INVALID_TARGET',400);
 if(e.confession)fail('ALREADY_COMMITTED');
 e.confession={girl:seat,target,accepted:other!.role==='villager',turnId:s.turnId,notified:false};
 s.events.push({type:'girl_confession',seat,target,at:now});
}
function finish(s:NightState,now:number,choose:(n:number)=>number){
 const e=s.engine!;
 if(s.phase==='confession'&&!e.confession){const girl=e.players.find(p=>p.role==='wolfGirl'&&p.alive);if(girl){const targets=e.players.filter(p=>p.alive&&!isWolfRole(p.role));if(targets.length)confess(s,girl.seat,targets[choose(targets.length)].seat,now);}}
 if(s.phase==='confession_notice'&&e.confession)e.confession.notified=true;
 if(s.phase==='wolves'){
  if(s.night===1){s.knife=null;s.events.push({type:'wolves_recognized',at:now});}
  else {
   const wolves=e.players.filter(p=>p.alive&&isSharedWolfRole(p.role));const counts=new Map<number,number>();
   for(const p of wolves){const target=s.votes[p.seat];if(target!=null)counts.set(target,(counts.get(target)??0)+1);}
   const max=Math.max(0,...counts.values()),tied=[...counts].filter(([,n])=>n===max).map(([target])=>target);
   s.knife=s.priorityCommitted?s.priorityTarget:tied.length?tied[choose(tied.length)]:null;
   if(wolves.length)append(s,wolves[0].seat,'wolf-knife',s.knife,now);
   s.events.push({type:'knife_resolved',target:s.knife,at:now});
  }
 }
 const r=runtime(s);r.index++;
 if(r.index===r.schedule.length){s.engine=settleEngineNight(s.engine!,wolfGirlResolution());turn(s,'first_night_complete',now);return;}
 s.nextRole=r.schedule[r.index];turn(s,'eyes_closed',now);
}
export function advanceWolfGirlNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){
 while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const boundary=s.deadline;if(s.phase==='eyes_closed'){const next=s.nextRole!;s.nextRole=null;turn(s,next,boundary);}else finish(s,boundary,choose);}
}
export function wolfGirlNightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceWolfGirlNight(s,now,choose);const r=runtime(s),p=s.engine!.players.find(p=>p.seat===seat);if(!p)fail('NOT_SEATED');
 const old=r.locked[seat];
 if(c.action==='confession_seen'&&r.seen[seat]===c.turnId)return;
 if(old?.turnId===c.turnId){
  if(c.action===old.action){const target='target' in c?c.target:null;if(target===old.target&&(!('choice' in c)||c.choice===old.choice))return;fail('ALREADY_COMMITTED');}
  if(c.action==='seer_finish'&&old.action==='seer'&&r.seen[seat]===c.turnId)return;
 }
 if(c.turnId!==s.turnId)fail('STALE_TURN');
 if(s.phase==='wolves'){
  const priority=s.priorityWolf===seat;
  if(!(p!.alive&&isSharedWolfRole(p!.role))&&!priority)fail('NOT_YOUR_TURN',403);
  if(s.night===1&&c.action!=='confirm_wolves')fail('FIRST_NIGHT_NO_KNIFE');
  if(c.action==='vote'||c.action==='priority_knife'){
   if(c.target!==null&&!s.engine!.players.some(x=>x.seat===c.target&&x.alive))fail('INVALID_TARGET',400);
   if(c.action==='priority_knife'){if(!priority)fail('PRIORITY_WOLF_ONLY',403);s.priorityCommitted=true;s.priorityTarget=c.target;s.events.push({type:'priority_knife',seat,target:c.target,at:now});finish(s,now,choose);}
   else if(priority)s.priorityTarget=c.target;else s.votes[seat]=c.target;return;
  }
  if(c.action==='confirm_wolves'){if(s.priorityWolf!==null)fail('PRIORITY_WOLF_ONLY',403);if(s.confirmer!==seat)fail('CONFIRMER_ONLY',403);finish(s,now,choose);return;}
  fail('NOT_YOUR_TURN',403);
 }
 if(!p!.alive)fail('NOT_YOUR_TURN',403);
 const expected=s.phase==='confession'?'wolfGirl':s.phase;
 if(s.phase==='confession_notice'){
  if(c.action!=='confession_seen'||s.engine!.confession?.target!==seat)fail('NOT_YOUR_TURN',403);
  s.engine!.confession!.notified=true;r.seen[seat]=c.turnId;return;
 }
 if(p!.role!==expected)fail('NOT_YOUR_TURN',403);
 if(c.action==='confess'&&s.phase==='confession'){confess(s,seat,c.target,now);r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target};finish(s,now,choose);return;}
 if(c.action==='ability'&&s.phase==='guard'&&(c.choice==='guard'||c.choice==='skip'&&c.target===null)){
  append(s,seat,'guard',c.target,now);r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target,choice:c.choice};s.events.push({type:'guard_protect',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='poisoner'&&s.phase==='poisoner'){
  if(c.target!==null){append(s,seat,'poison',c.target,now);s.poison=false;}r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target};s.events.push({type:'poisoner_poison',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='seer'&&s.phase==='seer'){
  append(s,seat,'inspect',c.target,now);const result=s.engine!.actions.find(a=>a.casterId===seat&&a.abilityType==='inspect')!.privateInspection!;
  s.seerCheck={target:c.target,result:result.status==='camp'&&result.camp==='wolves'?'wolf':'good'};s.seerTurnId=c.turnId;r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target};s.events.push({type:'seer_check',seat,target:c.target,at:now});return;
 }
 if(c.action==='seer_finish'&&s.phase==='seer'&&s.seerCheck){r.seen[seat]=c.turnId;finish(s,now,choose);return;}
 if(c.action==='hunter_seen'&&s.phase==='hunter'){
  s.hunterSeen=true;s.hunterTurnId=c.turnId;r.locked[seat]={turnId:c.turnId,action:c.action,target:null};s.events.push({type:'hunter_seen',seat,at:now});finish(s,now,choose);return;
 }
 fail('NOT_YOUR_TURN',403);
}
export function privateWolfGirlNight(s:NightState,seat:number):NightPrivate{
 const out:NightPrivate={turnId:s.turnId,kind:'waiting'},e=s.engine!,p=e.players.find(p=>p.seat===seat),r=runtime(s);if(!p)return out;
 if(s.phase==='wolves'&&(p.alive&&isSharedWolfRole(p.role)||s.priorityWolf===seat))return {...out,kind:'wolves',recognitionOnly:s.night===1,wolves:e.players.filter(p=>p.alive&&isSharedWolfRole(p.role)).map(p=>p.seat),confirmer:s.confirmer??undefined,votes:Object.entries(s.votes).map(([seat,target])=>({seat:Number(seat),target})),myVote:s.votes[seat]??null,priorityWolf:s.priorityWolf,priorityTarget:s.priorityTarget,priorityCommitted:s.priorityCommitted,legalTargets:e.players.filter(p=>p.alive).map(p=>p.seat)};
 if(!p.alive)return out;
 if(p.role==='seer'&&s.phase==='eyes_closed'&&r.schedule[r.index-1]==='seer'&&s.seerCheck)return {...out,skillReceipt:{role:'seer',...s.seerCheck}};
 if(s.phase==='confession_notice'&&e.confession?.target===seat)return {...out,kind:'confession_notice',confession:{accepted:e.confession.accepted,...(e.confession.accepted?{girl:e.confession.girl}:{})},seen:r.seen[seat]===s.turnId};
 if(s.phase==='confession'&&p.role==='wolfGirl')return {...out,kind:'confession',legalTargets:e.players.filter(p=>p.alive&&!isWolfRole(p.role)).map(p=>p.seat)};
 if(s.phase==='guard'&&p.role==='guard'){
  const skill=p.abilities.skills.find(x=>x.kind==='guard')!;
  return {...out,kind:'guard',skills:[{kind:'guard',remaining:null,available:true}],legalTargets:e.players.filter(p=>p.alive&&!skill.uses.some(u=>u.night===s.night-1&&u.target===p.seat)).map(p=>p.seat)};
 }
 if(s.phase==='poisoner'&&p.role==='poisoner')return {...out,kind:'poisoner',poison:p.abilities.skills.some(x=>x.kind==='poison'&&x.remaining!==0),legalTargets:e.players.filter(p=>p.alive).map(p=>p.seat)};
 if(s.phase==='seer'&&p.role==='seer')return {...out,kind:'seer',legalTargets:e.players.filter(x=>x.alive&&x.seat!==seat).map(p=>p.seat),committed:!!s.seerCheck,...(s.seerCheck??{})};
 if(s.phase==='hunter'&&p.role==='hunter')return {...out,kind:'hunter',seen:s.hunterSeen,canShoot:!s.hunterSpent&&!e.actions.some(a=>a.abilityType==='poison'&&a.targetId===seat)};
 return out;
}
