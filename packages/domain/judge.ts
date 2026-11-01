import {effectiveGameEvents} from './replay.js';
import {LobbyError} from '../contracts/index.js';
import type {JudgeSupplement} from '../contracts/judge.js';
import {emptyRecord,type RecordDocument} from '../contracts/records.js';
import type {FirstDayRules} from '../contracts/day.js';
import type {RoomBoardSnapshot} from '../contracts/board.js';
import {createNight,beginNight,advanceNight,nightCommand,type NightState} from './night.js';
import {createDay,advanceDay,dayCommand,type DayState} from './day.js';

/** This runtime has its own logical clock. Wall time and live tickers never advance it. */
export interface JudgeRuntime {clock:number;kind:'night'|'day';night:NightState;day:DayState|null;history:{kind:'night'|'day';round:number;state:NightState|DayState}[]}
export function phaseDuration(kind:'night'|'day',state:NightState|DayState):number|null{
 if(kind==='night'){
  const n=state as NightState;
  if(['awaiting_host','first_night_complete','rules_pending'].includes(n.phase))return null;
  return n.phase==='dancer'||n.phase==='mask'?60000:n.phase==='wolves'?180000:n.phase==='eyes_closed'?5000:n.phase==='mechanical_authority'?15000:n.phase==='witch'&&n.night===1?60000:30000;
 }
 const d=state as DayState;
 if(d.interjection)return Math.max(0,15000-(d.interjectionUsed?.[d.interjection.seat]??0));
 if(['sheriff_speech','day_speech','last_words'].includes(d.phase))return 90000;
 if(d.phase==='death_skill')return 10000;
 if(d.phase==='voting'&&d.vote?.method==='offline')return null;
 if(d.phase==='voting')return Number(d.events.findLast(e=>e.type==='command'&&e.command?.action==='start_vote')?.command?.seconds??d.voteDefaults?.seconds??30)*1000;
 return null;
}
export function restoredPhaseDuration(kind:'night'|'day',state:NightState|DayState,clock:number):number|null{
 if(kind==='night'&&(state as NightState).masquerade&&state.deadline!==null)return Math.max(0,state.deadline-clock);
 return phaseDuration(kind,state);
}
function tiedMasqueradeKnife(n:NightState):number[]{
 if(!n.masquerade||n.phase!=='wolves'||n.priorityCommitted)return [];const counts=new Map<number,number>();for(const seat of n.masquerade.shared){const t=n.votes[seat];if(t!=null)counts.set(t,(counts.get(t)??0)+1);}const max=Math.max(0,...counts.values());return [...counts].filter(([,count])=>count===max).map(([seat])=>seat);
}
export function supplementRuntime(runtime:JudgeRuntime,operation:JudgeSupplement['operation'],board:RoomBoardSnapshot,rules:FirstDayRules,hostSeat:number){
 const current=runtime.kind==='night'?runtime.night:runtime.day!;
 if(['ended','rules_pending'].includes(current.phase))throw new LobbyError('JUDGE_RETURN_BLOCKED',409);
 if(operation.kind==='masquerade-knife'){
  const n=runtime.night,r=n.masquerade;if(runtime.kind!=='night'||n.phase!=='wolves'||!r||n.deadline===null||operation.target!==null&&!r.alive.includes(operation.target))throw new LobbyError('PHASE_LOCKED',409);
  const candidates=tiedMasqueradeKnife(n);if(r.shared.length&&n.priorityWolf===null&&!n.priorityCommitted&&(candidates.length?!candidates.includes(operation.target!):operation.target!==null))throw new LobbyError('INVALID_TARGET',400);
  n.priorityTarget=operation.target;n.priorityCommitted=true;runtime.clock=n.deadline;advanceNight(n,runtime.clock);
 }else if(operation.kind==='advance'){
  if(runtime.kind==='night'&&tiedMasqueradeKnife(runtime.night).length>1)throw new LobbyError('JUDGE_MASQUERADE_KNIFE_REQUIRED',409);
  if(runtime.kind==='night'&&runtime.night.masquerade){const n=runtime.night,r=n.masquerade!,m=n.engine!.masquerade!;if(n.phase==='dancer'&&!r.danceDone&&r.alive.includes(n.players.find(p=>p.role==='dancer')!.seat)&&r.alive.filter(t=>!m.danced.some(h=>h.target===t)).length>=3||n.phase==='mask'&&!m.penalties.some(p=>p.seat===n.players.find(p=>p.role==='mask')!.seat)&&r.alive.includes(n.players.find(p=>p.role==='mask')!.seat)&&(!r.inspection&&r.alive.some(t=>!m.inspected.some(h=>h.target===t))||!r.mask&&r.alive.some(t=>!m.masked.some(h=>h.target===t))))throw new LobbyError('JUDGE_MASQUERADE_REQUIRED',409);}
  if(runtime.kind==='night'&&runtime.night.treasure&&['dreamer','treasure'].includes(current.phase))throw new LobbyError('JUDGE_TREASURE_ACTION_REQUIRED',409);
  if(runtime.kind==='night'&&current.phase==='confession'&&!runtime.night.engine?.confession)throw new LobbyError('JUDGE_CONFESSION_REQUIRED',409);
  if(runtime.kind==='night'&&current.phase==='awaiting_host'){beginNight(runtime.night,runtime.clock);return;}
  if(current.deadline===null)throw new LobbyError('PHASE_LOCKED',409);
  runtime.clock=current.deadline;
  if(runtime.kind==='night')advanceNight(runtime.night,runtime.clock);else advanceDay(runtime.day!,runtime.clock);
 }else if(operation.kind==='masquerade'){
  if(runtime.kind!=='night'||!runtime.night.masquerade||!['dance_confirm','mask_confirm'].includes(operation.command.action))throw new LobbyError('PHASE_LOCKED',409);
  const n=runtime.night,m=n.engine!.masquerade!,before={danced:m.danced.length,inspected:m.inspected.length,masked:m.masked.length};
  nightCommand(n,operation.actorSeat,operation.command,runtime.clock);
  for(const key of ['danced','inspected','masked'] as const)for(const h of n.engine!.masquerade![key].slice(before[key]))h.source=operation.source;
  if(operation.command.action==='dance_confirm')n.masquerade!.poolSource=operation.source;
  if(operation.command.action==='mask_confirm'){const receipt=operation.command.step==='inspect'?n.masquerade!.inspection:n.masquerade!.mask;if(receipt)receipt.source=operation.source;}
 }else if(operation.kind==='night'){
  if(runtime.kind!=='night')throw new LobbyError('PHASE_LOCKED',409);
  if(operation.command.action==='confirm_wolves'&&tiedMasqueradeKnife(runtime.night).length>1)throw new LobbyError('JUDGE_MASQUERADE_KNIFE_REQUIRED',409);
  nightCommand(runtime.night,operation.actorSeat,operation.command,runtime.clock);
 }else if(operation.kind==='day'){
  if(runtime.kind!=='day')throw new LobbyError('PHASE_LOCKED',409);
  // Delegated supplementation may perform public manager commands, but all player
  // eligibility and ability rules still run in the existing domain.
  dayCommand(runtime.day!,{seat:operation.actorSeat,isHost:true},operation.command,runtime.clock);
 }else if(operation.kind==='enter-day'){
  if(runtime.kind!=='night'||runtime.night.phase!=='first_night_complete')throw new LobbyError('PHASE_LOCKED',409);
  if(runtime.day)runtime.history.push({kind:'day',round:runtime.day.day,state:structuredClone(runtime.day)});
  runtime.day=createDay(runtime.night,rules,runtime.clock,runtime.day??undefined);runtime.kind='day';
  dayCommand(runtime.day,{seat:hostSeat,isHost:true},{action:'start',turnId:runtime.day.turnId},runtime.clock);
 }else{
  const d=runtime.day;
  if(runtime.kind!=='day'||d?.phase!=='day_complete')throw new LobbyError('PHASE_LOCKED',409);
  const n=runtime.night;runtime.history.push({kind:'night',round:n.night,state:structuredClone(n)});
  runtime.night=createNight(d.players,runtime.clock,{night:n.night+1,antidote:n.antidote,poison:n.poison,hunterSpent:d.hunterSpent,priorityWolf:d.priorityWolf,engine:d.engine,extraNightSeat:d.extraNightSeat,treasure:d.treasure},board);runtime.kind='night';beginNight(runtime.night,runtime.clock);
 }
}
export function runtimeFacts(runtime:JudgeRuntime):RecordDocument{
 const result=emptyRecord();const days=runtime.history.filter(h=>h.kind==='day').map(h=>h.state as DayState);if(runtime.day)days.push(runtime.day);
 for(const d of days.sort((a,b)=>a.day-b.day)){
  for(const e of effectiveGameEvents(d.events)){
   if(e.type.startsWith('death_')&&e.seat!==undefined&&!result.deaths.some(x=>x.seat===e.seat))result.deaths.push({seat:e.seat,round:d.day,period:['death_knife','death_poison','death_dance','death_penalty','death_dream'].includes(e.type)?'night':'day',cause:e.type.slice(6) as RecordDocument['deaths'][number]['cause']});
   if(e.type==='sheriff_elected')result.badges.push({round:d.day,seat:e.seat!});
   if(e.type==='command'&&e.command?.action==='transfer_badge')result.badges.push({round:d.day,seat:e.command.target as number|null});
   if((e.type==='death_exile'||e.type==='idiot_flip')&&e.seat!==undefined)result.exiles.push({round:d.day,seat:e.seat});
   if(e.type==='vote_outcome'&&e.result?.ballots)result.votes.push({round:d.day,kind:e.result.purpose.startsWith('sheriff')?'sheriff':'exile',ballots:e.result.ballots.map(b=>({voter:b.seat,target:b.target}))});
  }
  const last=result.badges.at(-1);
  if(d.badge==='lost'&&last?.seat!==null)result.badges.push({round:d.day,seat:null});
  if(d.badge==='elected'&&d.sheriff!==null&&last?.seat!==d.sheriff)result.badges.push({round:d.day,seat:d.sheriff});
 }
 return result;
}
export function assertOfficialAgreement(runtime:JudgeRuntime,official:RecordDocument):RecordDocument{
 const actual=runtimeFacts(runtime);
 if(official.deaths.some(d=>!actual.deaths.some(a=>a.seat===d.seat&&a.round===d.round&&a.period===d.period&&(d.cause==='unrecorded'||d.cause===a.cause))))throw new LobbyError('JUDGE_FACT_MISMATCH',409);
 // Absent facts are unknown. Existing facts must appear in the same order;
 // validated replay can fill missing facts but never erase or contradict them.
 for(const field of ['badges','exiles'] as const){let index=0;for(const expected of official[field]){const found=actual[field].findIndex((value,i)=>i>=index&&value.round===expected.round&&value.seat===expected.seat);if(found<0)throw new LobbyError('JUDGE_FACT_MISMATCH',409);index=found+1;}}
 let index=0;for(const expected of official.votes){const found=actual.votes.findIndex((value,i)=>i>=index&&value.round===expected.round&&value.kind===expected.kind&&expected.ballots.every(ballot=>value.ballots.some(b=>b.voter===ballot.voter&&b.target===ballot.target)));if(found<0)throw new LobbyError('JUDGE_FACT_MISMATCH',409);index=found+1;}
 return {...actual,notes:official.notes};
}
