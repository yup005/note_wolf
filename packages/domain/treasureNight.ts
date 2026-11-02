import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import type {NightCommand,NightPhase,NightPrivate} from '../contracts/night.js';
import type {NightState,NightCarry} from './night.js';
import {validateTreasureDeal,treasureGod,treasureVictory,type TreasureDeal} from './treasure.js';
export type TreasureDeath={seat:number;reason:'knife'|'poison'|'dream';delayed:boolean};
export interface TreasureRuntime {
 deal:TreasureDeal;schedule:NightPhase[];index:number;selected:Role|null;previous:Role|null;
 poisonSpent:number[];shotSpent:number[];dreamHistory:Record<number,{night:number;target:number}[]>;
 dreams:{caster:number;target:number;repeat:boolean}[];poisons:{caster:number;target:number}[];
 inspections:Record<number,{target:number;role:Role}>;deaths:TreasureDeath[];
 locks:{seat:number;turnId:string;command:NightCommand}[];blocked:string|null;exemptionUsed:boolean;
}
const fail=(code:string,status=409):never=>{throw new LobbyError(code,status);};
const runtime=(s:NightState)=>s.treasure!;
const alive=(s:NightState)=>s.players.filter(p=>p.alive!==false);
const thief=(s:NightState)=>s.players.find(p=>p.role==='treasureMaster')!;
const regularWolves=(s:NightState)=>alive(s).filter(p=>p.role==='wolf'||p.role==='blackWolf');
function turn(s:NightState,p:NightPhase,now:number){s.phase=p;s.turnId=randomUUID();s.deadline=['first_night_complete','rules_pending'].includes(p)?null:now+(p==='wolves'?180:p==='eyes_closed'?5:30)*1000;s.events.push({type:p,at:now});}
export function initializeTreasureNight(s:NightState,deal?:TreasureDeal,carry?:NightCarry){
 const old=carry?.treasure;if(!old&&!deal)fail('TREASURE_DEAL_REQUIRED');
 const d=validateTreasureDeal(old?.deal??deal);
 if(s.players.length!==12||s.players.some(p=>d.deck.filter(r=>r===p.role).length!==s.players.filter(x=>x.role===p.role).length))fail('INVALID_TREASURE_DEAL');
 s.antidote=false;s.treasure={deal:d,schedule:s.night===1?['hunter_signal','dreamer','wolves','poisoner','masked_signal','treasure','spiritSeer','hunter']:['dreamer','wolves','poisoner','treasure','spiritSeer','hunter'],index:0,selected:null,previous:old?.selected??null,poisonSpent:[...(old?.poisonSpent??[])],shotSpent:[...(old?.shotSpent??[])],dreamHistory:structuredClone(old?.dreamHistory??{}),dreams:[],poisons:[],inspections:{},deaths:[],locks:[],blocked:null,exemptionUsed:old?.exemptionUsed??false};
}
export function beginTreasureNight(s:NightState,now:number,choose:(n:number)=>number){
 if(s.phase!=='awaiting_host')fail('STALE_TURN');const wolves=regularWolves(s);s.confirmer=wolves.length?wolves[choose(wolves.length)].seat:null;turn(s,runtime(s).schedule[0],now);
}
function dream(s:NightState,caster:number,target:number){
 const r=runtime(s),history=r.dreamHistory[caster]??=[];
 const prior=history.at(-1),repeat=!!prior&&prior.target===target&&(caster===thief(s).seat||prior.night===s.night-1);
 r.dreams.push({caster,target,repeat});history.push({night:s.night,target});r.dreamHistory[caster]=history;
}
function chooseCard(s:NightState,card:Role){const r=runtime(s);if(!r.deal.bottoms.includes(card))fail('INVALID_INPUT',400);if(card===r.previous)fail('TREASURE_REPEAT_CARD');if(r.selected!==null&&r.selected!==card)fail('ALREADY_COMMITTED');r.selected=card;}
export function settleTreasure(s:NightState){
 const r=runtime(s),protectedSeats=new Set(r.dreams.map(d=>d.target));const deaths=new Map<number,TreasureDeath>();
 const add=(seat:number,reason:TreasureDeath['reason'])=>{const existing=deaths.get(seat);if(!existing||reason!=='knife')deaths.set(seat,{seat,reason,delayed:false});};
 if(s.knife!==null&&!protectedSeats.has(s.knife))add(s.knife,'knife');
 for(const p of r.poisons)if(!protectedSeats.has(p.target))add(p.target,'poison');
 for(const d of r.dreams){if(d.repeat)add(d.target,'dream');if(['knife','poison'].includes(deaths.get(d.caster)?.reason??''))add(d.target,'dream');}
 for(const d of deaths.values()){const p=s.players.find(p=>p.seat===d.seat)!;d.delayed=p.role==='masked'||p.role==='treasureMaster'&&r.selected==='masked';}
 const remainingGods=alive(s).filter(p=>treasureGod(p.role,r.deal.camp)&&!deaths.has(p.seat));
 // Last god is terminal even when its borrowed/native mask would delay death.
 if(!remainingGods.length)for(const d of deaths.values())d.delayed=false;
 r.deaths=[...deaths.values()];
 const verdict=treasureVictory(s.players.map(p=>({...p,alive:p.alive!==false&&!deaths.has(p.seat)})),r.deal.camp);
 if(verdict.status==='unresolved')r.blocked=verdict.questionId;
}
function finish(s:NightState,now:number,choose:(n:number)=>number){
 const r=runtime(s);
 if(s.phase==='wolves'){
  if(s.night===1){s.knife=null;s.events.push({type:'wolves_recognized',at:now});}
  else{const voters=regularWolves(s),t=thief(s);const authorized=voters.length?voters:r.deal.camp==='wolves'&&t.alive!==false?[t]:[];
   if(!s.priorityCommitted){const counts=new Map<number,number>();for(const p of authorized){const v=s.votes[p.seat];if(v!=null)counts.set(v,(counts.get(v)??0)+1);}const max=Math.max(0,...counts.values()),tied=[...counts].filter(([,n])=>n===max).map(([seat])=>seat);s.knife=tied.length?tied[choose(tied.length)]:null;}else s.knife=s.priorityTarget;
   s.events.push({type:'knife_resolved',target:s.knife,at:now});}
 }
 if(s.phase==='dreamer'){const p=alive(s).find(p=>p.role==='dreamer');if(p&&!r.dreams.some(d=>d.caster===p.seat)){const targets=alive(s);dream(s,p.seat,targets[choose(targets.length)].seat);}}
 if(s.phase==='treasure'&&thief(s).alive!==false){
  if(r.selected===null){const options=r.deal.bottoms.filter(card=>card!==r.previous);chooseCard(s,options[choose(options.length)]);}
  if(r.selected==='dreamer'&&!r.dreams.some(d=>d.caster===thief(s).seat)){const targets=alive(s);dream(s,thief(s).seat,targets[choose(targets.length)].seat);}
 }
 r.index++;
 if(r.index===r.schedule.length){settleTreasure(s);turn(s,r.blocked?'rules_pending':'first_night_complete',now);return;}
 s.nextRole=r.schedule[r.index];turn(s,'eyes_closed',now);
}
export function advanceTreasureNight(s:NightState,now:number,choose=(n:number)=>randomInt(n),beforeDeadline?:(s:NightState,now:number)=>void){
 while(s.deadline!==null&&now>=s.deadline){beforeDeadline?.(s,now);if(s.deadline===null||now<s.deadline)break;const boundary=s.deadline;if(s.phase==='eyes_closed'){const next=s.nextRole!;s.nextRole=null;turn(s,next,boundary);}else finish(s,boundary,choose);}
}
export function treasureNightCommand(s:NightState,seat:number,c:NightCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceTreasureNight(s,now,choose);const r=runtime(s),p=s.players.find(p=>p.seat===seat);if(!p)fail('NOT_SEATED');
 const old=r.locks.find(x=>x.seat===seat&&x.turnId===c.turnId&&x.command.action===c.action);
 if(old){if(JSON.stringify(old.command)===JSON.stringify(c))return;fail('ALREADY_COMMITTED');}
 if(c.turnId!==s.turnId)fail('STALE_TURN');
 const commit=()=>r.locks.push({seat,turnId:c.turnId,command:structuredClone(c)});
 if(s.phase==='wolves'){
  const wolves=regularWolves(s),t=thief(s),inherited=!wolves.length&&r.deal.camp==='wolves'&&p===t;
  const priority=s.priorityWolf===seat;if(!(p!.alive!==false&&(wolves.includes(p!)||inherited))&&!priority)fail('NOT_YOUR_TURN',403);
  if(s.night===1&&c.action!=='confirm_wolves')fail('FIRST_NIGHT_NO_KNIFE');
  if(c.action==='vote'||c.action==='priority_knife'){
   if(c.target!==null&&!alive(s).some(p=>p.seat===c.target))fail('INVALID_TARGET');
   if(c.action==='priority_knife'){if(!priority)fail('PRIORITY_WOLF_ONLY',403);s.priorityCommitted=true;s.priorityTarget=c.target;commit();finish(s,now,choose);}else s.votes[seat]=c.target;return;
  }
  if(c.action==='confirm_wolves'){if(s.priorityWolf!==null)fail('PRIORITY_WOLF_ONLY',403);if(s.confirmer!==seat&&!inherited)fail('CONFIRMER_ONLY',403);commit();finish(s,now,choose);return;}fail('NOT_YOUR_TURN',403);
 }
 if(p!.alive===false)fail('NOT_YOUR_TURN',403);
 const treasureStage=s.phase==='treasure'&&p!.role==='treasureMaster';
 if(c.action==='treasure_card'&&treasureStage){chooseCard(s,c.card);commit();s.events.push({type:'treasure_card',seat,at:now});if(!['poisoner','dreamer','spiritSeer'].includes(c.card))finish(s,now,choose);return;}
 const borrowedHunter=s.phase==='hunter'&&p!.role==='treasureMaster'&&r.selected==='hunter';
 const role=treasureStage||borrowedHunter?r.selected:p!.role;
 const allowed=borrowedHunter||treasureStage&&r.selected!==null||s.phase===p!.role||s.phase==='hunter_signal'&&p!.role==='hunter'||s.phase==='masked_signal'&&p!.role==='masked';if(!allowed)fail('NOT_YOUR_TURN',403);
 if(c.action==='dream'&&role==='dreamer'){
  if(!alive(s).some(p=>p.seat===c.target))fail('INVALID_TARGET');dream(s,seat,c.target);commit();s.events.push({type:'dream_target',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='poisoner'&&role==='poisoner'){
  if(c.target!==null){if(r.poisonSpent.includes(seat))fail('SKILL_EXHAUSTED');if(!alive(s).some(p=>p.seat===c.target))fail('INVALID_TARGET');r.poisonSpent.push(seat);r.poisons.push({caster:seat,target:c.target});}
  commit();s.events.push({type:'poisoner_poison',seat,target:c.target,at:now});finish(s,now,choose);return;
 }
 if(c.action==='ability'&&c.choice==='inspect'&&role==='spiritSeer'){
  if(c.target!==null){const target=alive(s).find(p=>p.seat===c.target&&p.seat!==seat);if(!target)fail('INVALID_TARGET');r.inspections[seat]={target:c.target,role:target!.role==='treasureMaster'?r.selected!:target!.role};s.events.push({type:'spirit_check',seat,target:c.target,at:now});}commit();return;
 }
 if(c.action==='ability_finish'&&(role==='spiritSeer'||s.phase==='hunter_signal'||s.phase==='masked_signal')){commit();finish(s,now,choose);return;}
 if(c.action==='hunter_seen'&&s.phase==='hunter'&&(p!.role==='hunter'||borrowedHunter)){commit();finish(s,now,choose);return;}
 fail('NOT_YOUR_TURN',403);
}
export function privateTreasureNight(s:NightState,seat:number):NightPrivate{
 const out:NightPrivate={turnId:s.turnId,kind:'waiting'},r=runtime(s),p=s.players.find(p=>p.seat===seat);if(!p)return out;
 const regular=regularWolves(s),inherited=p.role==='treasureMaster'&&r.deal.camp==='wolves'&&!regular.length;
 if(s.phase==='wolves'&&(p.alive!==false&&(regular.includes(p)||inherited)||s.priorityWolf===seat))return {...out,kind:'wolves',recognitionOnly:s.night===1,wolves:regular.length?regular.map(p=>p.seat):[seat],confirmer:inherited?seat:s.confirmer??undefined,votes:Object.entries(s.votes).map(([seat,target])=>({seat:Number(seat),target})),myVote:s.votes[seat]??null,priorityWolf:s.priorityWolf,priorityTarget:s.priorityTarget,priorityCommitted:s.priorityCommitted,legalTargets:alive(s).map(p=>p.seat)};
 if(p.alive===false)return out;
 const committed=r.locks.some(x=>x.seat===seat&&x.turnId===s.turnId&&x.command.action!=='treasure_card');
 if(s.phase==='hunter_signal'&&p.role==='hunter'||s.phase==='masked_signal'&&p.role==='masked')return {...out,kind:'signal'};
 const treasureStage=s.phase==='treasure'&&p.role==='treasureMaster';
 const borrowedHunter=s.phase==='hunter'&&p.role==='treasureMaster'&&r.selected==='hunter';
 if(!treasureStage&&!borrowedHunter&&s.phase!==p.role)return out;
 if(treasureStage&&r.selected===null)return {...out,kind:'treasure',treasureCamp:r.deal.camp,bottoms:r.deal.bottoms,previousCard:r.previous,legalTargets:[]};
 const role=treasureStage||borrowedHunter?r.selected:p.role,extra=treasureStage||borrowedHunter?{treasureCamp:r.deal.camp,selectedCard:r.selected}:{};
 if(role==='dreamer')return {...out,...extra,kind:'dreamer',legalTargets:alive(s).map(p=>p.seat)};
 if(role==='poisoner')return {...out,...extra,kind:'poisoner',poison:!r.poisonSpent.includes(seat),legalTargets:alive(s).map(p=>p.seat)};
 if(role==='spiritSeer')return {...out,...extra,kind:'spiritSeer',skills:[{kind:'inspect',remaining:null,available:true}],legalTargets:alive(s).filter(p=>p.seat!==seat).map(p=>p.seat),committed,...(r.inspections[seat]?{target:r.inspections[seat].target,inspectionRole:r.inspections[seat].role}:{})};
 if(role==='hunter'){const projected=structuredClone(s);settleTreasure(projected);return {...out,...extra,kind:'hunter',seen:committed,canShoot:!r.shotSpent.includes(seat)&&!projected.treasure!.deaths.some(d=>d.seat===seat&&['poison','dream'].includes(d.reason))};}
 return out;
}
