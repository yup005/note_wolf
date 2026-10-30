import {isGirlNight,initializeWolfGirlNight,beginWolfGirlNight,advanceWolfGirlNight,wolfGirlNightCommand,privateWolfGirlNight,type WolfGirlRuntime} from './wolfGirlNight.js';
import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import type {NightCommand,NightPhase,NightPrivate,NightPublic} from '../contracts/night.js';
import type {EngineState} from '../contracts/engine.js';
import {type RoomBoardSnapshot,isSharedWolfRole} from '../contracts/board.js';
import {initializeMechanicalNight,beginMechanicalNight,advanceMechanicalNight,mechanicalNightCommand,privateMechanicalNight} from './mechanicalNight.js';
export interface NightPlayer {seat:number;role:Role;alive?:boolean}
export interface NightCarry {night:number;antidote:boolean;poison:boolean;hunterSpent:boolean;priorityWolf:number|null;engine?:EngineState;extraNightSeat?:number|null}
export interface NightState {
 wolfGirl?:WolfGirlRuntime;engine?:EngineState;extraNightSeat?:number|null;mechanical?:import('./mechanicalNight.js').MechanicalNightRuntime;
 night:number;phase:NightPhase;turnId:string;deadline:number|null;nextRole:NightPhase|null;
 players:NightPlayer[];votes:Record<number,number|null>;confirmer:number|null;knife:number|null;
 antidote:boolean;poison:boolean;witchChoice:{choice:'save'|'poison'|'skip';target:number|null}|null;
 witchTurnId:string|null;seerTurnId?:string|null;seerFinishTurnId?:string|null;hunterTurnId?:string|null;seerCheck:{target:number;result:'good'|'wolf'}|null;hunterSeen:boolean;
 hunterSpent:boolean;priorityWolf:number|null;priorityTarget:number|null;priorityCommitted:boolean;
 events:{type:string;at:number;seat?:number;target?:number|null}[];
}
const duration={wolves:180000,witch:60000,seer:30000,hunter:30000,eyes_closed:5000};
export function createNight(players:NightPlayer[],now:number,carry?:NightCarry,board?:RoomBoardSnapshot):NightState{
 const roster=players.map(p=>({...p,alive:p.alive!==false}));
 const priority=roster.find(p=>p.seat===carry?.priorityWolf&&isSharedWolfRole(p.role)&&!p.alive);
 const priorityWolf=priority&&roster.some(p=>isSharedWolfRole(p.role)&&p.alive)?priority.seat:null;
 const state:NightState={night:carry?.night??1,phase:'awaiting_host',turnId:randomUUID(),deadline:null,nextRole:null,players:roster,votes:{},confirmer:null,knife:null,antidote:carry?.antidote??true,poison:carry?.poison??true,witchChoice:null,witchTurnId:null,seerCheck:null,hunterSeen:false,hunterSpent:carry?.hunterSpent??false,priorityWolf,priorityTarget:null,priorityCommitted:false,events:[{type:'night_created',at:now}]};
 if((board??carry?.engine?.board)?.composition.ruleset==='wolf-girl')initializeWolfGirlNight(state,(board??carry!.engine!.board),carry);
 else if(board&&board.composition.ruleset!=='standard'||carry?.engine)initializeMechanicalNight(state,board??carry!.engine!.board,carry);
 return state;
}
function phase(s:NightState,p:NightPhase,now:number){s.phase=p;s.turnId=randomUUID();s.deadline=p in duration?now+(p==='witch'&&s.night>=2?30000:duration[p as keyof typeof duration]):null;s.events.push({type:p,at:now});}
export function beginNight(s:NightState,now:number,choose=(n:number)=>randomInt(n)){
 if(isGirlNight(s))return beginWolfGirlNight(s,now,choose);
 if(s.engine)return beginMechanicalNight(s,now,choose);
 if(s.phase!=='awaiting_host')throw new LobbyError('STALE_TURN',409);
 const wolves=s.players.filter(p=>isSharedWolfRole(p.role)&&p.alive!==false);s.confirmer=wolves.length?wolves[choose(wolves.length)].seat:null;phase(s,'wolves',now);
}
function finishRole(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase==='wolves'){
  if(s.priorityCommitted)s.knife=s.priorityTarget;
  else {
   const counts=new Map<number,number>();for(const [seat,v] of Object.entries(s.votes))if(v!==null&&s.players.some(p=>p.seat===Number(seat)&&isSharedWolfRole(p.role)&&p.alive!==false))counts.set(v,(counts.get(v)??0)+1);
   const max=Math.max(0,...counts.values());const tied=[...counts].filter(([,n])=>n===max).map(([target])=>target);s.knife=tied.length?tied[choose(tied.length)]:null;
  }
  s.events.push({type:'knife_resolved',at:now,target:s.knife});s.nextRole='witch';
 }else if(s.phase==='witch')s.nextRole='seer';else if(s.phase==='seer')s.nextRole='hunter';else if(s.phase==='hunter'){phase(s,'first_night_complete',now);return;}
 phase(s,'eyes_closed',now);
}
export function advanceNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){
 if(isGirlNight(s))return advanceWolfGirlNight(s,now,choose,beforeDeadline);
 if(s.engine)return advanceMechanicalNight(s,now,choose,beforeDeadline);
 while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const boundary=s.deadline;if(s.phase==='eyes_closed'){const next=s.nextRole!;s.nextRole=null;phase(s,next,boundary);}else finishRole(s,boundary,choose);}
}
export function nightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 if(isGirlNight(s))return wolfGirlNightCommand(s,seat,c,now,choose);
 if(s.engine)return mechanicalNightCommand(s,seat,c,now,choose);
 advanceNight(s,now,choose);
 if(c.action==='witch'&&s.witchChoice&&s.witchTurnId===c.turnId&&s.players.some(p=>p.seat===seat&&p.role==='witch'&&p.alive!==false)){if(s.witchChoice.choice===c.choice&&s.witchChoice.target===c.target)return;throw new LobbyError('ALREADY_COMMITTED',409);}
 if(c.action==='seer'&&s.seerCheck&&s.seerTurnId===c.turnId&&s.players.some(p=>p.seat===seat&&p.role==='seer'&&p.alive!==false)){if(c.target===s.seerCheck.target)return;throw new LobbyError('ALREADY_COMMITTED',409);}
 if(c.action==='seer_finish'&&s.seerCheck&&s.seerFinishTurnId===c.turnId&&s.players.some(p=>p.seat===seat&&p.role==='seer'&&p.alive!==false))return;
 if(c.action==='hunter_seen'&&s.hunterSeen&&s.hunterTurnId===c.turnId&&s.players.some(p=>p.seat===seat&&p.role==='hunter'&&p.alive!==false))return;
 if(c.turnId!==s.turnId)throw new LobbyError('STALE_TURN',409);
 const player=s.players.find(p=>p.seat===seat);const role=player?.role;const alive=!!player&&player.alive!==false;
 const priority=s.phase==='wolves'&&s.priorityWolf===seat;
 const allowed=(s.phase==='wolves'&&role==='wolf'&&(alive||priority))||(alive&&s.phase===role&&['witch','seer','hunter'].includes(s.phase));
 if(!allowed)throw new LobbyError('NOT_YOUR_TURN',403);
 const targetValid=(target:number|null)=>target!==null&&s.players.some(p=>p.seat===target&&p.alive!==false);
 if(c.action==='vote'&&s.phase==='wolves'){
  if(c.target!==null&&!targetValid(c.target))throw new LobbyError('INVALID_INPUT');
  if(priority){s.priorityTarget=c.target;}
  else {s.votes[seat]=c.target;}return;
 }
 if(c.action==='priority_knife'&&s.phase==='wolves'){
  if(!priority)throw new LobbyError('PRIORITY_WOLF_ONLY',403);
  if(c.target!==null&&!targetValid(c.target))throw new LobbyError('INVALID_INPUT');
  s.priorityTarget=c.target;s.priorityCommitted=true;s.events.push({type:'priority_knife',at:now,seat,target:c.target});finishRole(s,now,choose);return;
 }
 if(c.action==='confirm_wolves'&&s.phase==='wolves'){
  if(s.priorityWolf!==null&&s.priorityWolf!==undefined)throw new LobbyError('PRIORITY_WOLF_ONLY',403);
  if(s.confirmer!==seat)throw new LobbyError('CONFIRMER_ONLY',403);finishRole(s,now,choose);return;
 }
 if(c.action==='witch'&&s.phase==='witch'){
  if(s.witchChoice){if(s.witchChoice.choice===c.choice&&s.witchChoice.target===c.target)return;throw new LobbyError('ALREADY_COMMITTED',409);}
  if(c.choice==='save'){
   if(s.knife===seat)throw new LobbyError('CANNOT_SELF_SAVE',409);
   if(!s.antidote||s.knife===null)throw new LobbyError('POTION_UNAVAILABLE',409);
   if(c.target!==s.knife||!targetValid(c.target))throw new LobbyError('INVALID_INPUT');s.antidote=false;
  }else if(c.choice==='poison'){
   if(!s.poison)throw new LobbyError('POTION_UNAVAILABLE',409);if(!targetValid(c.target))throw new LobbyError('INVALID_INPUT');s.poison=false;
  }else if(c.target!==null)throw new LobbyError('INVALID_INPUT');
  s.witchChoice={choice:c.choice,target:c.target};s.witchTurnId=c.turnId;s.events.push({type:`witch_${c.choice}`,at:now,seat,target:c.target});finishRole(s,now,choose);return;
 }
 if(c.action==='seer'&&s.phase==='seer'){
  if(s.seerCheck){if(s.seerCheck.target===c.target)return;throw new LobbyError('ALREADY_COMMITTED',409);}
  if(!targetValid(c.target))throw new LobbyError('INVALID_INPUT');
  s.seerCheck={target:c.target,result:s.players.find(p=>p.seat===c.target)!.role==='wolf'?'wolf':'good'};s.seerTurnId=c.turnId;s.events.push({type:'seer_check',at:now,seat,target:c.target});return;
 }
 if(c.action==='seer_finish'&&s.phase==='seer'){if(!s.seerCheck)throw new LobbyError('RESULT_NOT_READY',409);s.seerFinishTurnId=c.turnId;finishRole(s,now,choose);return;}
 if(c.action==='hunter_seen'&&s.phase==='hunter'){if(s.hunterSpent)throw new LobbyError('NOT_YOUR_TURN',403);if(!s.hunterSeen)s.events.push({type:'hunter_seen',at:now,seat});s.hunterSeen=true;s.hunterTurnId=c.turnId;finishRole(s,now,choose);return;}
 throw new LobbyError('NOT_YOUR_TURN',403);
}
export function publicNight(s:NightState,now:number):NightPublic{return {opening:s.wolfGirl?s.wolfGirl.index===0&&s.phase==='guard':s.mechanical?s.mechanical.index===0&&s.phase===s.mechanical.schedule[0]:s.phase==='wolves',night:s.night,phase:s.phase,turnId:s.turnId,deadline:s.deadline,serverNow:now,alive:s.players.filter(p=>p.alive!==false).map(p=>p.seat)};}
export function privateNight(s:NightState,seat:number):NightPrivate{
 if(isGirlNight(s))return privateWolfGirlNight(s,seat);
 if(s.engine)return privateMechanicalNight(s,seat);
 const out:NightPrivate={turnId:s.turnId,kind:'waiting'};const player=s.players.find(p=>p.seat===seat);const role=player?.role;
 if(role==='witch'&&s.witchChoice&&(s.phase==='witch'||s.phase==='eyes_closed'&&s.nextRole==='seer')){out.witchReceipt={...s.witchChoice};out.antidote=s.antidote;out.poison=s.poison;out.committed=true;}
 if(!player||(player.alive===false&&!(s.phase==='wolves'&&s.priorityWolf===seat))||(role==='hunter'&&s.hunterSpent))return out;
 if(role==='seer'&&s.seerCheck&&s.phase==='eyes_closed'&&s.nextRole==='hunter')return {...out,...s.seerCheck,skillReceipt:{role:'seer',...s.seerCheck}};
 if(role==='hunter'&&s.hunterSeen&&s.phase==='first_night_complete')return {...out,skillReceipt:{role:'hunter',canShoot:!s.hunterSpent&&!(s.witchChoice?.choice==='poison'&&s.witchChoice.target===seat)}};
 if(s.phase==='wolves'&&role==='wolf')return {...out,kind:'wolves',wolves:s.players.filter(p=>isSharedWolfRole(p.role)&&p.alive!==false).map(p=>p.seat),votes:Object.entries(s.votes).map(([seat,target])=>({seat:Number(seat),target})),confirmer:s.confirmer!,myVote:s.priorityWolf===seat?s.priorityTarget:s.votes[seat]??null,priorityWolf:s.priorityWolf??null,priorityTarget:s.priorityTarget??null,priorityCommitted:s.priorityCommitted??false};
 if(s.phase==='witch'&&role==='witch')return {...out,kind:'witch',...(s.antidote||s.witchChoice?.choice==='save'?{knife:s.knife}:{}),antidote:s.antidote,poison:s.poison,committed:!!s.witchChoice,...(s.witchChoice??{})};
 if(s.phase==='seer'&&role==='seer')return {...out,kind:'seer',committed:!!s.seerCheck,...(s.seerCheck??{})};
 if(s.phase==='hunter'&&role==='hunter')return {...out,kind:'hunter',canShoot:!s.hunterSpent&&!(s.witchChoice?.choice==='poison'&&s.witchChoice.target===seat),seen:s.hunterSeen};
 return out;
}
