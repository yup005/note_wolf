import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {boardRuleVersion,isSharedWolfRole,type RoomBoardSnapshot} from '../contracts/board.js';
import type {NightCommand,NightPhase,NightPrivate} from '../contracts/night.js';
import type {NightState,NightCarry} from './night.js';
import {createConfirmedEngineState,validateConfirmedEngineState,appendConfirmedEngineAction} from './mechanicalEngine.js';
import {settleEngineNight,type ResolutionStrategy} from './engine.js';
import {puppetCandidates} from './puppet.js';

export interface PuppetRuntime {
 schedule:NightPhase[];index:number;votes:Record<number,number>;selectionTurn?:string;
 confirmation?:{seat:number;turnId:string};
 locked:Record<number,{turnId:string;action:string;target:number|null;choice?:string}>;seen:Record<number,string>;
}
const fail=(code:string,status=409):never=>{throw new LobbyError(code,status);};
const originalWolves=(s:NightState)=>s.engine!.players.filter(p=>p.alive&&isSharedWolfRole(p.role));
function turn(s:NightState,p:NightPhase,now:number){s.phase=p;s.turnId=randomUUID();s.deadline=p==='first_night_complete'?null:now+(p==='wolves'||p==='puppet'?180:p==='eyes_closed'?5:p==='witch'&&s.night===1?60:30)*1000;s.events.push({type:p,at:now});}
export function initializePuppetNight(s:NightState,board:RoomBoardSnapshot,carry?:NightCarry){
 if(carry?.engine){const e=structuredClone(carry.engine);e.night=s.night;e.stage='collecting';e.actions=[];e.resolution=null;e.victory={status:'playing'};for(const p of e.players){p.alive=s.players.find(x=>x.seat===p.seat)!.alive!==false;p.publicState.canVote=p.alive;}s.engine=validateConfirmedEngineState(e);}
 else s.engine=createConfirmedEngineState(board,s.players.map(p=>({seat:p.seat,role:p.role,knifeGroup:isSharedWolfRole(p.role)?'shared':'none'})),s.night);
 s.puppetRuntime={schedule:s.night===1?['guard','puppet','wolves','witch','seer','hunter']:['guard','wolves','witch','seer','hunter'],index:0,votes:{},locked:{},seen:{}};
}
export function beginPuppetNight(s:NightState,now:number,choose:(n:number)=>number){if(s.phase!=='awaiting_host')fail('STALE_TURN');const wolves=originalWolves(s);s.confirmer=wolves.length?wolves[choose(wolves.length)].seat:null;turn(s,'guard',now);}
function append(s:NightState,seat:number,kind:'wolf-knife'|'guard'|'antidote'|'poison'|'inspect',target:number|null,now:number){
 const p=s.engine!.players.find(p=>p.seat===seat)!;
 const result=appendConfirmedEngineAction(s.engine!,{id:`${s.night}:${s.turnId}:${seat}:${kind}`,requestId:`${s.turnId}:${kind}`,casterId:seat,targetId:target,abilityId:kind==='wolf-knife'?null:p.abilities.skills.find(x=>x.kind===kind)!.id,abilityType:kind,stage:s.phase,at:now});
 if(result.status==='blocked')throw new LobbyError('RULE_DECISION_REQUIRED',409);s.engine=result.state;
}
export function puppetResolution():ResolutionStrategy{return {ruleset:'puppet',ruleVersion:boardRuleVersion,resolve:e=>{
 const active=e.actions.filter(a=>a.casterId!==e.puppet?.target);
 return {status:'settled',effects:e.actions.filter(a=>a.abilityType==='wolf-knife'||a.abilityType==='poison').map(a=>{
  const protections=a.abilityType==='wolf-knife'&&a.targetId!==null?active.filter(g=>g.targetId===a.targetId&&(g.abilityType==='guard'||g.abilityType==='antidote')):[];
  const doubled=protections.some(g=>g.abilityType==='guard')&&protections.some(g=>g.abilityType==='antidote');
  return {id:a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:a.targetId===null||a.casterId===e.puppet?.target?'no-effect' as const:protections.length&&!doubled?'prevented' as const:'killed' as const,reflectTarget:null,preventedBy:doubled?[]:protections.map(p=>p.id)};
 })};
 }};}
function candidates(s:NightState){return puppetCandidates([...s.engine!.players].sort((a,b)=>a.seat-b.seat).map(p=>p.role)).filter(seat=>s.engine!.players.some(p=>p.seat===seat&&p.alive));}
function select(s:NightState,now:number,choose:(n:number)=>number,source:'confirmed'|'timeout'){
 if(s.engine!.puppet)fail('ALREADY_COMMITTED');const r=s.puppetRuntime!,legal=candidates(s),tally=new Map<number,number>();
 for(const p of originalWolves(s)){const target=r.votes[p.seat];if(legal.includes(target))tally.set(target,(tally.get(target)??0)+1);}
 if(source==='confirmed'&&!tally.size)fail('PUPPET_VOTE_REQUIRED');
 const max=Math.max(0,...tally.values()),pool=tally.size?[...tally].filter(([,n])=>n===max).map(([seat])=>seat):legal;
 if(!pool.length)fail('INVALID_TARGET');const target=pool[choose(pool.length)];
 r.selectionTurn=s.turnId;s.engine!.puppet={target,turnId:s.turnId,at:now,source};s.events.push({type:'puppet_selected',target,at:now});
}
function finish(s:NightState,now:number,choose:(n:number)=>number,source:'confirmed'|'timeout'='timeout'){
 if(s.phase==='puppet')select(s,now,choose,source);
 if(s.phase==='wolves'){
  const wolves=originalWolves(s),tally=new Map<number,number>();
  for(const p of wolves){const target=s.votes[p.seat];if(target!==undefined&&target!==null)tally.set(target,(tally.get(target)??0)+1);}
  const max=Math.max(0,...tally.values()),pool=[...tally].filter(([,n])=>n===max).map(([seat])=>seat);s.knife=s.priorityCommitted?s.priorityTarget:pool.length?pool[choose(pool.length)]:null;
  if(wolves.length)append(s,wolves[0].seat,'wolf-knife',s.knife,now);s.events.push({type:'knife_resolved',target:s.knife,at:now});
 }
 const r=s.puppetRuntime!;r.index++;
 if(r.index===r.schedule.length){s.engine=settleEngineNight(s.engine!,puppetResolution());turn(s,'first_night_complete',now);return;}
 s.nextRole=r.schedule[r.index];turn(s,'eyes_closed',now);
}
export function advancePuppetNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const at=s.deadline;if(s.phase==='eyes_closed'){const next=s.nextRole!;s.nextRole=null;turn(s,next,at);}else finish(s,at,choose);}}
export function puppetNightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 advancePuppetNight(s,now,choose);const r=s.puppetRuntime!,p=s.engine!.players.find(p=>p.seat===seat);if(!p)throw new LobbyError('NOT_SEATED',409);
 if(c.action==='confirm_puppet'&&r.confirmation?.turnId===c.turnId){if(r.confirmation.seat!==seat)fail('CONFIRMER_ONLY',403);return;}
 if(c.action==='puppet_vote'&&r.selectionTurn===c.turnId){if(r.votes[seat]===c.target&&isSharedWolfRole(p.role))return;fail('ALREADY_COMMITTED');}
 const old=r.locked[seat];if(old?.turnId===c.turnId&&!(c.action==='seer_finish'&&old.action==='seer'&&r.seen[seat]!==c.turnId)){if(c.action===old.action&&('target' in c?c.target:null)===old.target&&(!('choice' in c)||c.choice===old.choice))return;if(c.action==='seer_finish'&&old.action==='seer'&&r.seen[seat]===c.turnId)return;fail('ALREADY_COMMITTED');}
 if(c.turnId!==s.turnId)fail('STALE_TURN');
 if(s.phase==='puppet'){
  if(!p.alive||!isSharedWolfRole(p.role))fail('NOT_YOUR_TURN',403);
  if(c.action==='puppet_vote'){if(!candidates(s).includes(c.target))fail('INVALID_TARGET',400);r.votes[seat]=c.target;return;}
  if(c.action==='confirm_puppet'){if(s.confirmer!==seat)fail('CONFIRMER_ONLY',403);const turnId=s.turnId;finish(s,now,choose,'confirmed');r.confirmation={seat,turnId};return;}
  fail('NOT_YOUR_TURN',403);
 }
 if(s.phase==='wolves'){
  const priority=s.priorityWolf===seat;if(!(p.alive&&isSharedWolfRole(p.role))&&!priority)fail('NOT_YOUR_TURN',403);
  if(c.action==='vote'||c.action==='priority_knife'){
   if(c.target!==null&&!s.engine!.players.some(x=>x.seat===c.target&&x.alive))fail('INVALID_TARGET',400);
   if(c.action==='priority_knife'){if(!priority)fail('PRIORITY_WOLF_ONLY',403);s.priorityCommitted=true;s.priorityTarget=c.target;s.events.push({type:'priority_knife',seat,target:c.target,at:now});finish(s,now,choose);}else if(priority)s.priorityTarget=c.target;else s.votes[seat]=c.target;return;
  }
  if(c.action==='confirm_wolves'){if(s.priorityWolf!==null)fail('PRIORITY_WOLF_ONLY',403);if(s.confirmer!==seat)fail('CONFIRMER_ONLY',403);finish(s,now,choose);return;}
  fail('NOT_YOUR_TURN',403);
 }
 if(!p.alive||p.role!==s.phase)fail('NOT_YOUR_TURN',403);
 if(s.phase==='guard'&&c.action==='ability'&&(c.choice==='guard'||c.choice==='skip'&&c.target===null)){
  append(s,seat,'guard',c.target,now);r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target,choice:c.choice};s.events.push({type:'guard_protect',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(s.phase==='witch'&&c.action==='witch'){
  if(c.choice==='save'){if(s.knife===seat)fail('CANNOT_SELF_SAVE');if(!s.antidote||s.knife===null)fail('POTION_UNAVAILABLE');if(c.target!==s.knife)fail('INVALID_TARGET',400);append(s,seat,'antidote',c.target,now);s.antidote=false;}
  else if(c.choice==='poison'){if(!s.poison)fail('POTION_UNAVAILABLE');if(c.target===null)fail('INVALID_TARGET',400);append(s,seat,'poison',c.target,now);s.poison=false;}else if(c.target!==null)fail('INVALID_TARGET',400);
  s.witchChoice={choice:c.choice,target:c.target};s.witchTurnId=c.turnId;r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target,choice:c.choice};s.events.push({type:`witch_${c.choice}`,seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(s.phase==='seer'&&c.action==='seer'){
  append(s,seat,'inspect',c.target,now);const result=s.engine!.actions.find(a=>a.casterId===seat&&a.abilityType==='inspect')!.privateInspection!;
  s.seerCheck={target:c.target,result:result.status==='camp'&&result.camp==='wolves'?'wolf':'good'};s.seerTurnId=c.turnId;r.locked[seat]={turnId:c.turnId,action:c.action,target:c.target};s.events.push({type:'seer_check',seat,target:c.target,at:now});return;
 }
 if(s.phase==='seer'&&c.action==='seer_finish'){if(!s.seerCheck)fail('RESULT_NOT_READY');r.seen[seat]=c.turnId;finish(s,now,choose);return;}
 if(s.phase==='hunter'&&c.action==='hunter_seen'){s.hunterSeen=true;s.hunterTurnId=c.turnId;r.locked[seat]={turnId:c.turnId,action:c.action,target:null};s.events.push({type:'hunter_seen',seat,at:now});finish(s,now,choose);return;}
 fail('NOT_YOUR_TURN',403);
}
function hunterStatus(s:NightState,seat:number){return s.engine!.puppet?.target===seat||!s.hunterSpent&&!s.engine!.actions.some(a=>a.abilityType==='poison'&&a.casterId!==s.engine!.puppet?.target&&a.targetId===seat);}
export function privatePuppetNight(s:NightState,seat:number):NightPrivate{
 const out:NightPrivate={turnId:s.turnId,kind:'waiting'},e=s.engine!,p=e.players.find(p=>p.seat===seat);if(!p)return out;
 if(p.role==='witch'&&s.witchChoice&&(s.phase==='witch'||s.phase==='eyes_closed'&&s.nextRole==='seer'))Object.assign(out,{witchReceipt:{...s.witchChoice},antidote:s.antidote,poison:s.poison,committed:true});
 if(s.phase==='wolves'&&(p.alive&&isSharedWolfRole(p.role)||s.priorityWolf===seat))return {...out,kind:'wolves',wolves:originalWolves(s).map(p=>p.seat),confirmer:s.confirmer??undefined,votes:Object.entries(s.votes).map(([seat,target])=>({seat:Number(seat),target})),myVote:s.votes[seat]??null,priorityWolf:s.priorityWolf,priorityTarget:s.priorityTarget,priorityCommitted:s.priorityCommitted,legalTargets:e.players.filter(p=>p.alive).map(p=>p.seat),puppetSeat:e.puppet?.target};
 // Keep the pre-announcement roster for receipts; settled hidden deaths are not public yet.
 if(s.players.find(x=>x.seat===seat)?.alive===false)return out;
 if(s.phase==='puppet'&&isSharedWolfRole(p.role))return {...out,kind:'puppet',wolves:originalWolves(s).map(p=>p.seat),legalTargets:candidates(s),confirmer:s.confirmer??undefined,votes:Object.entries(s.puppetRuntime!.votes).map(([seat,target])=>({seat:Number(seat),target})),myVote:s.puppetRuntime!.votes[seat]??null};
 if(p.role==='seer'&&s.phase==='eyes_closed'&&s.nextRole==='hunter'&&s.seerCheck)return {...out,skillReceipt:{role:'seer',...s.seerCheck}};
 if(p.role==='hunter'&&s.phase==='first_night_complete'&&s.hunterSeen)return {...out,skillReceipt:{role:'hunter',canShoot:hunterStatus(s,seat)}};
 if(s.phase==='guard'&&p.role==='guard'){const skill=p.abilities.skills.find(x=>x.kind==='guard')!;return {...out,kind:'guard',skills:[{kind:'guard',remaining:null,available:true}],legalTargets:e.players.filter(x=>x.alive&&!skill.uses.some(u=>u.night===s.night-1&&u.target===x.seat)).map(p=>p.seat)};}
 if(s.phase==='witch'&&p.role==='witch')return {...out,kind:'witch',...(s.antidote?{knife:s.knife}:{}),antidote:s.antidote,poison:s.poison,committed:!!s.witchChoice,...(s.witchChoice??{}),legalTargets:e.players.filter(p=>p.alive).map(p=>p.seat)};
 if(s.phase==='seer'&&p.role==='seer')return {...out,kind:'seer',committed:!!s.seerCheck,...(s.seerCheck??{}),legalTargets:e.players.filter(p=>p.alive).map(p=>p.seat)};
 if(s.phase==='hunter'&&p.role==='hunter')return {...out,kind:'hunter',seen:s.hunterSeen,canShoot:hunterStatus(s,seat)};
 return out;
}
