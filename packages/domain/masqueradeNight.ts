import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {isWolfRole,type RoomBoardSnapshot} from '../contracts/board.js';
import type {NightCommand,NightPhase,NightPrivate} from '../contracts/night.js';
import type {MasqueradeRuntime,MasqueradeReceipt} from '../contracts/masquerade.js';
import type {NightCarry,NightState} from './night.js';
import {createConfirmedEngineState,validateConfirmedEngineState} from './mechanicalEngine.js';
import {settleEngineNight} from './engine.js';
import {useSkill} from './skills.js';
import {masqueradeResolution} from './masqueradeResolution.js';
const fail=(code:string,status=409):never=>{throw new LobbyError(code,status);};
const runtime=(s:NightState)=>s.masquerade!;
const facts=(s:NightState)=>s.engine!.masquerade!;
const actor=(s:NightState,role:string)=>s.players.find(p=>p.role===role)!;
const penalized=(s:NightState,seat:number)=>facts(s).penalties.some(p=>p.seat===seat);
const available=(s:NightState,seat:number)=>runtime(s).alive.includes(seat)&&!penalized(s,seat);
const targets=(s:NightState,key:'danced'|'inspected'|'masked')=>runtime(s).alive.filter(seat=>!facts(s)[key].some(h=>h.target===seat));
export const isMasqueradeNight=(s:NightState)=>s.engine?.board.composition.ruleset==='masquerade';
export function initializeMasqueradeNight(s:NightState,board:RoomBoardSnapshot,carry?:NightCarry){
 if(carry?.engine){
  const e=structuredClone(carry.engine);if(!e.masquerade)fail('INVALID_ENGINE_STATE');
  e.night=s.night;e.stage='collecting';e.actions=[];e.resolution=null;e.victory={status:'playing'};
  for(const p of e.players){p.alive=s.players.find(x=>x.seat===p.seat)!.alive!==false;p.publicState.canVote=p.alive;}
  e.masquerade!.pool=[];e.masquerade!.mask=null;e.masquerade!.penalties=[];s.engine=validateConfirmedEngineState(e);
 }else{
  s.engine=createConfirmedEngineState(board,s.players.map(p=>({seat:p.seat,role:p.role,knifeGroup:p.role==='wolf'?'shared':'none'})),s.night);
  s.engine.masquerade={version:1,danced:[],inspected:[],masked:[],pool:[],mask:null,penalties:[]};
 }
 const alive=s.players.filter(p=>p.alive!==false).map(p=>p.seat),shared=s.players.filter(p=>p.role==='wolf'&&alive.includes(p.seat)).map(p=>p.seat);
 s.masquerade={schedule:s.night===1?['wolves','witch','seer']:['dancer','mask','wolves','seer','witch'],index:0,alive,shared,inherited:shared.length?null:alive.includes(actor(s,'mask').seat)?actor(s,'mask').seat:null,danceDraft:[],danceRevision:0,danceDone:false,inspectDraft:null,maskDraft:null,maskRevision:0,requests:{},locked:{}};
}
function turn(s:NightState,p:NightPhase,now:number){
 s.phase=p;s.turnId=randomUUID();s.deadline=p==='first_night_complete'?null:now+(p==='wolves'?180:p==='dancer'||p==='mask'||p==='witch'&&s.night===1?60:p==='eyes_closed'?5:30)*1000;s.events.push({type:p,at:now});
}
export function beginMasqueradeNight(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase!=='awaiting_host')fail('STALE_TURN');const r=runtime(s);s.confirmer=r.shared.length?r.shared[choose(r.shared.length)]:null;turn(s,r.schedule[0],now);
}
function action(s:NightState,seat:number,kind:'wolf-knife'|'inspect'|'antidote'|'poison'|'dance-death'|'rule-penalty',target:number|null,now:number,id=`${s.night}:${s.turnId}:${seat}:${kind}`){
 const e=s.engine!,p=e.players.find(p=>p.seat===seat)!;if(e.actions.some(a=>a.id===id))return;
 const skill=p.abilities.skills.find(a=>a.kind===kind);
 if(skill)p.abilities=useSkill(p.abilities,skill.id,{requestId:id,night:s.night,target});
 e.actions.push({id,requestId:id,casterId:seat,targetId:target,abilityId:skill?.id??null,abilityType:kind,stage:s.phase,at:now,night:s.night,sourceRole:p.role,ruleset:'masquerade',...(kind==='inspect'&&target!==null?{privateInspection:{status:'camp' as const,camp:isWolfRole(e.players.find(p=>p.seat===target)!.role)?'wolves' as const:'good' as const}}:{})});
}
function penalty(s:NightState,seat:number,reason:'dance-repeat'|'inspect-repeat'|'mask-repeat',now:number){
 if(penalized(s,seat))return;const id=`${s.night}:${seat}:${reason}`;facts(s).penalties.push({seat,reason,id});action(s,seat,'rule-penalty',seat,now,id);s.events.push({type:reason,seat,at:now});
}
function dance(s:NightState,list:number[],source:'manual'|'draft'|'random',now:number){
 const r=runtime(s),m=facts(s),seat=actor(s,'dancer').seat;if(r.danceDone)return;
 if(list.some(target=>m.danced.some(h=>h.target===target))){r.danceDone=true;penalty(s,seat,'dance-repeat',now);return;}
 if(list.length!==3||new Set(list).size!==3||list.some(t=>!r.alive.includes(t)))fail('INVALID_TARGET',400);
 r.danceDone=true;r.poolSource=source;m.pool=[...list];for(const target of list)m.danced.push({night:s.night,actor:seat,target,source,id:`${s.night}:dance:${target}`});s.events.push({type:'dance_locked',seat,at:now});
}
function maskStep(s:NightState,step:'inspect'|'mask',target:number|null,source:MasqueradeReceipt['source'],now:number){
 const r=runtime(s),m=facts(s),seat=actor(s,'mask').seat,key=step==='inspect'?'inspected':'masked';
 if(!available(s,seat))return;
 if(target!==null&&m[key].some(h=>h.target===target)){penalty(s,seat,step==='inspect'?'inspect-repeat':'mask-repeat',now);return;}
 const receipt:MasqueradeReceipt={target,source,...(step==='inspect'&&target!==null?{inPool:m.pool.includes(target)}:{})};
 if(step==='inspect')r.inspection=receipt;else r.mask=receipt;
 if(target!==null){m[key].push({night:s.night,actor:seat,target,source:source==='skipped'?'manual':source,id:`${s.night}:${step}:${target}`});if(step==='mask')m.mask=target;}
 s.events.push({type:`mask_${step}`,seat,target,at:now});
}
function autoDance(s:NightState,now:number,choose:(n:number)=>number){
 const r=runtime(s);if(r.danceDone||!available(s,actor(s,'dancer').seat))return;
 if(r.danceDraft.some(t=>facts(s).danced.some(h=>h.target===t))){penalty(s,actor(s,'dancer').seat,'dance-repeat',now);r.danceDone=true;return;}
 const legal=targets(s,'danced');if(legal.length<3){r.danceDone=true;r.poolSource='skipped';return;}
 const list=[...r.danceDraft];while(list.length<3){const candidates=legal.filter(t=>!list.includes(t));list.push(candidates[choose(candidates.length)]);}
 dance(s,list,r.danceDraft.length===3?'draft':'random',now);
}
function autoMask(s:NightState,now:number,choose:(n:number)=>number){
 const r=runtime(s);for(const step of ['inspect','mask'] as const){
  if(!available(s,actor(s,'mask').seat))break;
  if(step==='inspect'?r.inspection:r.mask)continue;
  const draft=step==='inspect'?r.inspectDraft:r.maskDraft,key=step==='inspect'?'inspected':'masked';
  const legal=targets(s,key),target=draft??(legal.length?legal[choose(legal.length)]:null);
  maskStep(s,step,target,draft!==null?'draft':target!==null?'random':'skipped',now);
 }
}
function finish(s:NightState,now:number,choose:(n:number)=>number){
 const r=runtime(s);if(s.phase==='dancer')autoDance(s,now,choose);if(s.phase==='mask')autoMask(s,now,choose);
 if(s.phase==='wolves'){
  const seat=r.shared[0]??r.inherited;
  if(r.shared.length){const counts=new Map<number,number>();for(const wolf of r.shared){const t=s.votes[wolf];if(t!=null)counts.set(t,(counts.get(t)??0)+1);}const max=Math.max(0,...counts.values()),tied=[...counts].filter(([,n])=>n===max).map(([t])=>t);s.knife=s.priorityCommitted?s.priorityTarget:tied.length?tied[choose(tied.length)]:null;}
  else if(!r.inherited||!available(s,r.inherited)||!s.priorityCommitted)s.knife=null;else s.knife=s.priorityTarget;
  if(seat!==null&&available(s,seat))action(s,seat,'wolf-knife',s.knife,now);
  s.events.push({type:'knife_resolved',target:s.knife,at:now});
 }
 r.index++;
 if(r.index===r.schedule.length){
  const m=facts(s);if(m.pool.length===3){const wolves=m.pool.filter(t=>isWolfRole(s.players.find(p=>p.seat===t)!.role)!==(m.mask===t));if(wolves.length===1||wolves.length===2){const minority=m.pool.find(t=>wolves.length===1?wolves.includes(t):!wolves.includes(t))!;action(s,actor(s,'dancer').seat,'dance-death',minority,now);}}
  s.engine=settleEngineNight(s.engine!,masqueradeResolution());turn(s,'first_night_complete',now);return;
 }
 s.nextRole=r.schedule[r.index];turn(s,'eyes_closed',now);
}
export function advanceMasqueradeNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){
 while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const at=s.deadline;if(s.phase==='eyes_closed'){const p=s.nextRole!;s.nextRole=null;turn(s,p,at);}else finish(s,at,choose);}
}
export function masqueradeNightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceMasqueradeNight(s,now,choose);const r=runtime(s),p=s.players.find(p=>p.seat===seat);if(!p)fail('NOT_SEATED');
 if('requestId' in c){const old=r.requests[c.requestId];if(old){if(old.seat!==seat)fail('NOT_YOUR_TURN',403);if(old.seat===seat&&old.payload===JSON.stringify(c))return;fail('REQUEST_CONFLICT');}}
 const old=r.locked[seat];if(old?.turnId===c.turnId&&old.action===c.action){if(old.target===('target' in c?c.target:null)&&(!('choice' in c)||c.choice===old.choice))return;fail('ALREADY_COMMITTED');}
 if(c.action==='seer_finish'&&s.seerFinishTurnId===c.turnId)return;
 if(c.turnId!==s.turnId)fail('STALE_TURN');
 const priority=s.phase==='wolves'&&s.priorityWolf===seat&&r.shared.length>0;
 if(!available(s,seat)&&!priority)fail('NOT_YOUR_TURN',403);
 const valid=(target:number|null)=>target===null||r.alive.includes(target);
 if('requestId' in c){
  const dancer=c.action==='dance_draft'||c.action==='dance_confirm';
  if(p!.role!==(dancer?'dancer':'mask')||s.phase!==(dancer?'dancer':'mask'))fail('NOT_YOUR_TURN',403);
  if(c.expectedRevision!==(dancer?r.danceRevision:r.maskRevision))fail('STALE_DRAFT');
  if(dancer){
   if(r.danceDone)fail('ALREADY_COMMITTED');if(new Set(c.targets).size!==c.targets.length||c.targets.some(t=>!valid(t)))fail('INVALID_TARGET',400);
   if(c.action==='dance_confirm')dance(s,c.targets,'manual',now);else r.danceDraft=[...c.targets];r.danceRevision++;
  }else{
   if(c.action!=='mask_skip'&&!valid(c.target))fail('INVALID_TARGET',400);if(c.step==='inspect'&&r.inspection||c.step==='mask'&&r.mask)fail('ALREADY_COMMITTED');
   if((c.action==='mask_confirm'||c.action==='mask_skip')&&c.step==='mask'&&!r.inspection)fail('RESULT_NOT_READY');
   if(c.action==='mask_skip'){if(targets(s,c.step==='inspect'?'inspected':'masked').length)fail('LEGAL_TARGETS_REMAIN');maskStep(s,c.step,null,'skipped',now);}
   else if(c.action==='mask_draft'){if(c.step==='inspect')r.inspectDraft=c.target;else r.maskDraft=c.target;}
   else maskStep(s,c.step,c.target,'manual',now);r.maskRevision++;
  }
  r.requests[c.requestId]={seat,payload:JSON.stringify(c)};
  if(!penalized(s,seat)&&(dancer?r.danceDone:!!r.inspection&&!!r.mask))finish(s,now,choose);return;
 }
 if(s.phase==='wolves'){
  const inherited=r.inherited===seat;if(!r.shared.includes(seat)&&!inherited&&!priority)fail('NOT_YOUR_TURN',403);
  if(c.action==='vote'||c.action==='priority_knife'){
   if(!valid(c.target))fail('INVALID_TARGET',400);
   if(c.action==='priority_knife'){if(!priority&&!inherited)fail('PRIORITY_WOLF_ONLY',403);s.priorityTarget=c.target;s.priorityCommitted=true;finish(s,now,choose);}
   else if(inherited||priority)s.priorityTarget=c.target;else s.votes[seat]=c.target;return;
  }
  if(c.action==='confirm_wolves'){if(inherited){s.priorityCommitted=true;finish(s,now,choose);return;}if(s.priorityWolf!==null)fail('PRIORITY_WOLF_ONLY',403);if(s.confirmer!==seat)fail('CONFIRMER_ONLY',403);finish(s,now,choose);return;}
  fail('NOT_YOUR_TURN',403);
 }
 if(s.phase!==p!.role)fail('NOT_YOUR_TURN',403);
 if(c.action==='seer'&&s.phase==='seer'){
  if(!valid(c.target)||c.target===seat)fail('INVALID_TARGET',400);if(s.seerCheck)fail('ALREADY_COMMITTED');action(s,seat,'inspect',c.target,now);s.seerCheck={target:c.target,result:isWolfRole(s.players.find(p=>p.seat===c.target)!.role)?'wolf':'good'};s.seerTurnId=c.turnId;s.events.push({type:'seer_check',seat,target:c.target,at:now});
 }else if(c.action==='seer_finish'&&s.phase==='seer'){
  if(!s.seerCheck)fail('RESULT_NOT_READY');s.seerFinishTurnId=c.turnId;finish(s,now,choose);return;
 }else if(c.action==='witch'&&s.phase==='witch'){
  if(s.witchChoice)fail('ALREADY_COMMITTED');if(!valid(c.target))fail('INVALID_TARGET',400);
  if(c.choice==='save'){if(c.target===seat)fail('CANNOT_SELF_SAVE');if(!s.antidote||s.knife===null)fail('POTION_UNAVAILABLE');if(c.target!==s.knife)fail('INVALID_TARGET',400);action(s,seat,'antidote',c.target,now);s.antidote=false;}
  else if(c.choice==='poison'){if(!s.poison)fail('POTION_UNAVAILABLE');if(c.target===null)fail('INVALID_TARGET',400);action(s,seat,'poison',c.target,now);s.poison=false;}
  else if(c.target!==null)fail('INVALID_TARGET',400);
  s.witchChoice={choice:c.choice,target:c.target};s.witchTurnId=c.turnId;s.events.push({type:`witch_${c.choice}`,seat,target:c.target,at:now});
 }else fail('NOT_YOUR_TURN',403);
 r.locked[seat]={turnId:c.turnId,action:c.action,target:'target' in c?c.target:null,...('choice' in c?{choice:c.choice}:{})};if(c.action==='witch')finish(s,now,choose);
}
export function privateMasqueradeNight(s:NightState,seat:number):NightPrivate{
 const out:NightPrivate={kind:'waiting',turnId:s.turnId},r=runtime(s),p=s.players.find(p=>p.seat===seat);if(!p||!r.alive.includes(seat)&&!(s.phase==='wolves'&&s.priorityWolf===seat&&r.shared.length>0)||s.phase==='first_night_complete'||s.phase==='awaiting_host')return out;
 if(p.role==='dancer'&&s.night>1){out.masquerade={danceRevision:r.danceRevision,draft:[...r.danceDraft],...(r.danceDone?{pool:[...facts(s).pool],poolSource:r.poolSource}:{cannotDance:targets(s,'danced').length<3}),penalized:penalized(s,seat)};if(s.phase==='dancer'&&!penalized(s,seat))out.kind='dancer';}
 if(p.role==='mask'&&s.night>1&&(s.phase==='mask'||r.inspection||r.mask||penalized(s,seat))){out.masquerade={maskRevision:r.maskRevision,canSkip:targets(s,r.inspection?'masked':'inspected').length===0,step:r.mask?'done':r.inspection?'mask':'inspect',inspectDraft:r.inspectDraft,maskDraft:r.maskDraft,inspection:r.inspection,mask:r.mask,penalized:penalized(s,seat)};if(s.phase==='mask'&&!penalized(s,seat))out.kind='mask';}
 if(s.phase==='wolves'&&!penalized(s,seat)&&(r.shared.includes(seat)||s.priorityWolf===seat||r.inherited===seat))return {...out,kind:'wolves',inheritedKnife:r.inherited===seat,wolves:r.inherited===seat?undefined:[...r.shared],confirmer:r.inherited===seat?seat:s.confirmer??undefined,votes:r.inherited===seat?undefined:Object.entries(s.votes).map(([seat,target])=>({seat:Number(seat),target})),myVote:r.inherited===seat||s.priorityWolf===seat?s.priorityTarget:s.votes[seat]??null,priorityWolf:s.priorityWolf,priorityTarget:s.priorityTarget,priorityCommitted:s.priorityCommitted,legalTargets:[...r.alive]};
 if(s.phase==='seer'&&p.role==='seer')return {...out,kind:'seer',legalTargets:r.alive.filter(t=>t!==seat),committed:!!s.seerCheck,...(s.seerCheck??{})};
 if(s.phase==='eyes_closed'&&p.role==='seer'&&s.seerCheck)return {...out,skillReceipt:{role:'seer',...s.seerCheck}};
 if(s.phase==='witch'&&p.role==='witch')return {...out,kind:'witch',legalTargets:[...r.alive],...(s.antidote?{knife:s.knife}:{}),antidote:s.antidote,poison:s.poison,committed:!!s.witchChoice,...(s.witchChoice??{})};
 return out;
}
