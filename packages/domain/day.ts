import {treasureVictory,treasureWolf} from './treasure.js';
import type {TreasureRuntime} from './treasureNight.js';
import {createNativeAbilityProfile} from './mechanicalAbilities.js';
import type {DaySelf} from '../contracts/day.js';
import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import type {DayCommand,DayPhase,DayPublic,DayPrivate,DayVoteResult,FirstDayRules,VotePurpose} from '../contracts/day.js';
import type {GameEvent} from '../contracts/game.js';
import type {NightState} from './night.js';
import {evaluateVictory} from './victory.js';
import type {EngineState} from '../contracts/engine.js';
import {isWolfRole,isSharedWolfRole} from '../contracts/board.js';
import {useSkill} from './skills.js';
type DeathReason='knife'|'poison'|'shot'|'exile'|'explosion'|'white-wolf'|'girl-retaliation'|'dream';
type Task={seat:number;step:'skill'|'words'|'badge'};
export interface DayState {
 treasure?:TreasureRuntime;delayedDeaths?:{seat:number;reason:DeathReason}[];maskResume?:{phase:'sheriff_speech'|'day_speech';speakers:number[]};
 engine?:EngineState;extraNightSeat?:number|null;flippedIdiots?:number[];
 interjection?:{seat:number;startedAt:number;remainingSpeechMs:number;pausedElapsedMs?:number}|null;interjectionUsed?:Record<number,number>;
 voteDefaults?:{seconds:number;visibility:'individual'|'totals'};
 day:number;phase:DayPhase;turnId:string;deadline:number|null;players:{seat:number;role:Role;alive:boolean}[];rules:FirstDayRules;
 nightDeaths:number[];hunterSpent:boolean;speechStart:number|null;pendingDeaths:{seat:number;reason:DeathReason}[];deaths:{seat:number;reason:DeathReason}[];tasks:Task[];currentDeath:number|null;
 sheriff:number|null;badge:DayPublic['badge'];signup:Record<number,boolean>;originalCandidates:number[];candidates:number[];speakers:number[];speaker:number|null;
 vote:{purpose:VotePurpose;method:'phone'|'offline';visibility:'individual'|'totals';eligible:number[];candidates:number[];ballots:Record<number,number|null>}|null;
 result:DayVoteResult|null;announcement:number[]|null;revealed:{seat:number;role:Role}[];winner:'wolves'|'good'|null;reason:string|null;
 electionPurpose?:'sheriff'|'sheriff_pk';voteStarted:boolean;speechMode:'ordered'|'phone'|'free'|null;direction:'ascending'|'descending'|null;afterDeaths:'day'|'night';explosions:number;priorityWolf:number|null;events:GameEvent[];
}
const error=(code='PHASE_LOCKED',status=409):never=>{throw new LobbyError(code,status);};
const living=(s:DayState)=>s.players.filter(p=>p.alive).map(p=>p.seat);
const dualFlipped=(s:DayState,seat:number)=>s.engine?.board.composition.idiotPolicy==='dual-category-14'&&s.players.some(p=>p.seat===seat&&p.role==='idiot')&&!!s.flippedIdiots?.includes(seat);
const participants=(s:DayState)=>living(s).filter(seat=>!dualFlipped(s,seat));
function phase(s:DayState,p:DayPhase,now:number,seconds?:number){s.interjection=null;s.interjectionUsed={};s.phase=p;s.turnId=randomUUID();s.deadline=seconds===undefined?null:now+seconds*1000;s.events.push({type:p,at:now,...(p==='sheriff_speech'||p==='day_speech'?{seat:s.speaker!}:['death_skill','last_words','badge_transfer','hunter_target','white_wolf_target'].includes(p)?{seat:s.currentDeath!}:{})});}
export function createDay(n:NightState,rules:FirstDayRules,now:number,previous?:DayState):DayState{
 if(n.phase!=='first_night_complete')error();
 const pendingDeaths:DayState['pendingDeaths']=[];
 if(n.treasure){for(const d of n.treasure.deaths)if(!d.delayed)pendingDeaths.push({seat:d.seat,reason:d.reason});}
 else if(n.engine){
  const resolution=n.engine.resolution;if(!resolution||resolution.status!=='settled')return error('NIGHT_NOT_SETTLED');
  for(const death of resolution.deaths){
   const effects=resolution.effects.filter(e=>death.sourceEffectIds.includes(e.id));
   pendingDeaths.push({seat:death.seat,reason:effects.some(e=>e.abilityType==='poison')?'poison':'knife'});
  }
 }else{
  if(n.knife!==null&&n.witchChoice?.choice!=='save')pendingDeaths.push({seat:n.knife,reason:'knife'});
  if(n.witchChoice?.choice==='poison'){const seat=n.witchChoice.target!;const old=pendingDeaths.find(d=>d.seat===seat);if(old)old.reason='poison';else pendingDeaths.push({seat,reason:'poison'});}
 }
 return {...(n.treasure?{treasure:structuredClone(n.treasure),delayedDeaths:n.treasure.deaths.filter(d=>d.delayed).map(({seat,reason})=>({seat,reason}))}:{}),...(n.engine?{engine:structuredClone(n.engine)}:{}),extraNightSeat:n.extraNightSeat??null,flippedIdiots:[...(previous?.flippedIdiots??n.engine?.players.filter(p=>p.publicState.revealedRole==='idiot'&&!p.publicState.canVote).map(p=>p.seat)??[])],interjection:null,interjectionUsed:{},day:n.night,nightDeaths:pendingDeaths.map(d=>d.seat),hunterSpent:previous?.hunterSpent??false,speechStart:null,phase:'awaiting_host',turnId:randomUUID(),deadline:null,players:n.players.map(p=>({...p,alive:previous?.players.find(old=>old.seat===p.seat)?.alive??p.alive??true})),rules:{...rules},pendingDeaths,deaths:previous?.deaths.map(d=>({...d}))??[],tasks:[],currentDeath:null,sheriff:previous?.sheriff??null,badge:previous?.badge??'available',signup:previous?.badge==='deferred'?{...previous.signup}:{},originalCandidates:previous?.badge==='deferred'?[...(previous.originalCandidates.length?previous.originalCandidates:previous.players.filter(p=>previous.signup[p.seat]).map(p=>p.seat))]:[],candidates:previous?.badge==='deferred'?[...(previous.originalCandidates.length?previous.candidates:previous.players.filter(p=>previous.signup[p.seat]).map(p=>p.seat))]:[],speakers:[],speaker:null,vote:null,result:null,announcement:null,revealed:previous?.revealed.map(p=>({...p}))??[],winner:null,reason:null,electionPurpose:previous?.badge==='deferred'?(previous.electionPurpose??(previous.vote?.purpose==='sheriff_pk'||previous.result?.purpose==='sheriff'&&previous.result.leaders.length>1?'sheriff_pk':'sheriff')):'sheriff',voteStarted:false,speechMode:null,direction:null,afterDeaths:'day',explosions:previous?.explosions??0,priorityWolf:null,events:[{type:'day_created',at:now}]};
}
function checkWin(s:DayState,now:number){
 const roster=s.players.map(p=>{const engine=s.engine?.players.find(e=>e.seat===p.seat);return {...p,...(dualFlipped(s,p.seat)?{idiotFlipped:true}:{}),...(engine?.abilities.mimickedRole?{learnedRole:engine.abilities.mimickedRole}:{}),...(s.engine?.confession?.accepted&&s.engine.confession.target===p.seat?{personalCamp:'wolves' as const}:{}),...(engine?.model?{modelSeat:engine.model.seat,modelCamp:engine.model.camp}:{})};});
 const result=s.treasure?treasureVictory(roster,s.treasure.deal.camp):evaluateVictory(roster,s.engine?.board.composition.ruleset??'standard',s.engine?.board.composition.idiotPolicy);
 if(s.engine){s.engine.victory=result;for(const p of s.players){const engine=s.engine.players.find(e=>e.seat===p.seat);if(engine){engine.alive=p.alive;engine.publicState.canVote=p.alive&&!dualFlipped(s,p.seat);}}}
 if(result.status==='unresolved'){rulePending(s,'规则待确认',now);return true;}
 const winner=result.status==='ended'?result.winner:null;
 // Last mechanical idiot only postpones a good verdict on exile. Wolves win first.
 if(winner==='good'&&s.extraNightSeat!==null&&s.extraNightSeat!==undefined)return false;
 if(winner){s.extraNightSeat=null;s.winner=winner;
  if(result.status==='ended')s.reason=({'all-villagers-dead':s.engine?'民职全部出局，狼人屠边':'村民全部出局，狼人屠边','all-gods-dead':'神职全部出局，狼人屠边','all-wolves-dead':'所有狼人已出局','mixer-dead-one-villager':'混血儿出局且仅剩一名村民，狼人屠边','mixer-last-civilian':'仅混血儿为存活民职，狼人屠边'} as const)[result.reason];
  s.revealed=s.players.map(({seat,role})=>({seat,role}));s.tasks=[];s.speaker=null;s.currentDeath=null;s.vote=null;phase(s,'ended',now);return true;}return false;
}
function reveal(s:DayState,seat:number,role:Role){if(!s.revealed.some(p=>p.seat===seat))s.revealed.push({seat,role});}
function kill(s:DayState,seat:number,reason:DeathReason,now:number){
 const p=s.players.find(p=>p.seat===seat);if(!p||!p.alive)return false;
 if(reason==='exile'&&s.treasure&&p.role==='treasureMaster'&&s.treasure.deal.camp==='wolves'&&s.treasure.selected==='masked'&&s.players.filter(p=>p.alive&&treasureWolf(p.role,s.treasure!.deal.camp)).length===1&&!s.treasure.exemptionUsed){
  s.treasure.exemptionUsed=true;reveal(s,seat,'masked');s.events.push({type:'treasure_mask_exemption',seat,at:now});return false;
 }
 if(reason==='exile'&&p.role==='idiot'&&s.engine?.board.composition.idiotPolicy==='dual-category-14'){
  if(dualFlipped(s,seat))return error('INVALID_INPUT');
  reveal(s,seat,'idiot');s.flippedIdiots??=[];s.flippedIdiots.push(seat);
  const engine=s.engine.players.find(e=>e.seat===seat)!;engine.publicState={revealedRole:'idiot',canVote:false,canInterject:false};
  s.events.push({type:'idiot_flip',seat,at:now});return true;
 }
 p.alive=false;s.deaths.push({seat,reason});s.events.push({type:`death_${reason}`,seat,at:now});
 const engine=s.engine?.players.find(e=>e.seat===seat);
 if(engine){engine.alive=false;engine.publicState.canVote=false;}
 const mechanicalIdiot=p.role==='mechanicalWolf'&&engine?.abilities.mimickedRole==='idiot';
 if(reason==='exile'&&(p.role==='idiot'||mechanicalIdiot)){
  reveal(s,seat,'idiot');s.flippedIdiots??=[];if(!s.flippedIdiots.includes(seat))s.flippedIdiots.push(seat);
  if(engine){engine.publicState.revealedRole='idiot';engine.publicState.canInterject=true;}
  if(mechanicalIdiot&&!s.players.some(other=>other.alive&&isWolfRole(other.role)))s.extraNightSeat=seat;
 }
 return true;
}
function deathTasks(s:DayState,seat:number,words=true):Task[]{return [...(s.players.find(p=>p.seat===seat)?.alive?[]:[{seat,step:'skill' as const}]),...(words&&!dualFlipped(s,seat)?[{seat,step:'words' as const}]:[]),...(s.sheriff===seat?[{seat,step:'badge' as const}]:[])];}
function nextTask(s:DayState,now:number){const task=s.tasks.shift();s.currentDeath=task?.seat??null;if(!task){if(s.maskResume){const resume=s.maskResume;delete s.maskResume;s.speakers=resume.speakers;s.phase=resume.phase;nextSpeaker(s,now);return;}if(s.afterDeaths==='night')phase(s,'day_complete',now);else phase(s,'day_direction',now);return;}phase(s,task.step==='skill'?'death_skill':task.step==='words'?'last_words':'badge_transfer',now,task.step==='skill'?10:task.step==='words'?90:undefined);}
function shuffle<T>(items:T[],choose:(n:number)=>number){const out=[...items];for(let i=out.length-1;i>0;i--){const j=choose(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
function announce(s:DayState,now:number,choose:(n:number)=>number){
 s.announcement=s.pendingDeaths.map(p=>p.seat).sort((a,b)=>a-b);for(const d of s.pendingDeaths)kill(s,d.seat,d.reason,now);s.pendingDeaths=[];
 if(s.extraNightSeat!==null&&s.extraNightSeat!==undefined)s.extraNightSeat=null;
 if(checkWin(s,now))return;s.tasks=shuffle(s.announcement,choose).flatMap(seat=>deathTasks(s,seat,s.day===1));phase(s,'night_announcement',now);
}
function finishMaskedSpeech(s:DayState,now:number):boolean{
 const d=s.delayedDeaths?.find(d=>d.seat===s.speaker);if(!d)return false;
 s.delayedDeaths=s.delayedDeaths!.filter(x=>x!==d);kill(s,d.seat,d.reason,now);
 s.events.push({type:'masked_death_announced',seat:d.seat,at:now});
 s.candidates=s.candidates.filter(p=>p!==d.seat);s.originalCandidates=s.originalCandidates.filter(p=>p!==d.seat);
 if(checkWin(s,now))return true;
 if(s.sheriff===d.seat){s.maskResume={phase:s.phase as 'sheriff_speech'|'day_speech',speakers:[...s.speakers]};s.tasks=[{seat:d.seat,step:'badge'}];nextTask(s,now);return true;}
 return false;
}
function startSpeeches(s:DayState,seats:number[],p:'sheriff_speech'|'day_speech',now:number){s.speakers=[...seats];s.speaker=s.speakers.shift()??null;if(s.speaker!==null)phase(s,p,now,90);else if(p==='sheriff_speech')phase(s,'sheriff_withdraw',now);else setupVote(s,'exile',participants(s),participants(s),now);}
function nextSpeaker(s:DayState,now:number){if(finishMaskedSpeech(s,now))return;s.speaker=s.speakers.shift()??null;if(s.speaker!==null)phase(s,s.phase,now,90);else if(s.phase==='sheriff_speech'){if(s.vote?.purpose==='sheriff_pk')setupVote(s,'sheriff_pk',s.candidates,participants(s).filter(p=>!s.candidates.includes(p)),now);else phase(s,'sheriff_withdraw',now);}else setupVote(s,'exile',participants(s),participants(s),now);}
function setupVote(s:DayState,purpose:VotePurpose,candidates:number[],eligible:number[],now:number){s.vote={purpose,candidates:[...candidates],eligible:[...eligible],ballots:{},method:'phone',visibility:'individual'};s.result=null;phase(s,'vote_setup',now);}
function electSheriff(s:DayState,seat:number,now:number){s.sheriff=seat;s.badge='elected';s.events.push({type:'sheriff_elected',seat,at:now});}
function electionFinished(s:DayState,now:number){s.speaker=null;s.speakers=[];phase(s,'night_announcement',now);}
function closeElection(s:DayState,now:number){if(s.candidates.length===0){s.badge='lost';electionFinished(s,now);}else if(s.candidates.length===1){electSheriff(s,s.candidates[0],now);electionFinished(s,now);}else {const purpose=s.electionPurpose??'sheriff';setupVote(s,purpose,s.candidates,participants(s).filter(p=>!(purpose==='sheriff_pk'?s.candidates:s.originalCandidates).includes(p)),now);}}
function tally(s:DayState,now:number){const v=s.vote!;const counts=v.candidates.map(seat=>({seat,votes:0}));for(const seat of v.eligible){const target=v.ballots[seat];const count=counts.find(c=>c.seat===target);if(count)count.votes+=(v.purpose.startsWith('exile')&&s.sheriff===seat?1.5:1);}
 const max=Math.max(0,...counts.map(c=>c.votes));s.result={purpose:v.purpose,counts,leaders:max?counts.filter(c=>c.votes===max).map(c=>c.seat):[],...(v.visibility==='individual'?{ballots:v.eligible.map(seat=>({seat,target:v.ballots[seat]??null}))}:{} )};s.events.push({type:'vote_outcome',at:now,result:structuredClone(s.result!)});phase(s,'vote_result',now);
}
function rulePending(s:DayState,reason:string,now:number){s.reason=reason;phase(s,'rules_pending',now);}
function continueResult(s:DayState,now:number,choose:(n:number)=>number){
 const r=s.result!;if(r.purpose==='sheriff'||r.purpose==='sheriff_pk'){
  if(r.leaders.length===1){electSheriff(s,r.leaders[0],now);electionFinished(s,now);}
  else if(!r.leaders.length){if(s.rules.zeroVotes==='no_result'){s.badge='lost';electionFinished(s,now);}else rulePending(s,'全员弃票时的警长选举规则待确认',now);}
  else if(r.purpose==='sheriff_pk'){s.badge='lost';electionFinished(s,now);}
  else{s.candidates=[...r.leaders];s.vote={...s.vote!,purpose:'sheriff_pk',candidates:s.candidates,eligible:participants(s).filter(p=>!s.candidates.includes(p)),ballots:{}};startSpeeches(s,shuffle(s.candidates,choose),'sheriff_speech',now);}
 }else{
  if(r.leaders.length===1){const seat=r.leaders[0];kill(s,seat,'exile',now);if(s.phase==='rules_pending')return;if(s.treasure&&s.players.find(p=>p.seat===seat)?.alive){phase(s,'day_complete',now);return;}if(checkWin(s,now))return;s.afterDeaths='night';s.tasks=deathTasks(s,seat);nextTask(s,now);}
  else if(!r.leaders.length){if(s.rules.zeroVotes==='no_result')phase(s,'day_complete',now);else rulePending(s,'全员弃票时的放逐规则待确认',now);}
  else if(r.purpose==='exile_pk'){phase(s,'day_complete',now);}
  else{if(s.rules.exilePkEligibility===null){rulePending(s,'放逐 PK 投票资格待确认',now);return;}s.candidates=[...r.leaders];s.speakers=shuffle(s.candidates,choose);s.speaker=s.speakers.shift()!;s.vote={...s.vote!,purpose:'exile_pk',candidates:s.candidates,eligible:participants(s).filter(p=>s.rules.exilePkEligibility==='all_alive'||!s.candidates.includes(p)),ballots:{}};phase(s,'day_speech',now,90);}
 }
}
function startDaySpeech(s:DayState,now:number,choose:(n:number)=>number){
 if(s.speechMode==='free'){s.speaker=null;s.speakers=[];phase(s,'free_speech',now);return;}
 if(s.speechMode===null||s.direction===null)return;
 const seats=participants(s).sort((a,b)=>s.direction==='ascending'?a-b:b-a);
 const anchor=s.nightDeaths.length===1?s.nightDeaths[0]:s.sheriff;
 let start=s.speechStart;
 if(start===null&&anchor!==null)start=seats.find(p=>s.direction==='ascending'?p>anchor:p<anchor)??seats[0];
 start??=seats[choose(seats.length)];s.speechStart=start;const index=seats.indexOf(start);
 startSpeeches(s,[...seats.slice(index),...seats.slice(0,index)],'day_speech',now);
}
function canShoot(s:DayState,seat:number){
 if(s.phase!=='death_skill'||seat!==s.currentDeath||s.winner!==null)return false;
 const p=s.players.find(p=>p.seat===seat),death=s.deaths.find(d=>d.seat===seat);
 if(!p||p.alive||!death||death.reason==='poison'||death.reason==='girl-retaliation'||death.reason==='dream')return false;
 if(s.treasure){const role=p.role==='treasureMaster'?s.treasure.selected:p.role;return !s.treasure.shotSpent.includes(seat)&&(role==='hunter'&&['knife','exile'].includes(death.reason)||role==='blackWolf'&&death.reason==='exile');}
 if(s.engine?.board.composition.ruleset==='wolf-girl'&&!['knife','exile'].includes(death.reason))return false;
 if(s.engine){const skill=s.engine.players.find(p=>p.seat===seat)?.abilities.skills.find(a=>a.kind==='shot');return !!skill&&skill.remaining!==0&&skill.availableFromNight<=s.day&&(skill.parameters.damage==='black-wolf-shot'?['knife','exile','shot','white-wolf'].includes(death.reason):p.role==='hunter'||['knife','exile'].includes(death.reason));}
 return p.role==='hunter'&&!s.hunterSpent;
}
function canExplode(s:DayState,seat:number){
 const girl=s.engine?.board.composition.ruleset==='wolf-girl'&&s.players.some(p=>p.seat===seat&&p.alive&&p.role==='wolfGirl');
 if(girl&&s.winner===null&&s.phase==='vote_result'&&s.result?.purpose.startsWith('exile'))return true;
 const p=s.players.find(p=>p.seat===seat),ability=s.engine?.players.find(p=>p.seat===seat)?.abilities.skills.find(a=>a.kind==='explode-take');
 return s.winner===null&&s.rules.explosionOrder!==null&&(s.rules.explosionLock==='during_vote'||!s.voteStarted)&&['sheriff_signup','sheriff_speech','sheriff_withdraw','day_speech','free_speech'].includes(s.phase)&&!(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.vote.candidates.includes(seat))&&!!p?.alive&&(isSharedWolfRole(p.role)||!!ability&&ability.remaining!==0&&ability.availableFromNight<=s.day);
}
function interjectionRemaining(s:DayState,seat:number){return Math.max(0,15000-(s.interjectionUsed?.[seat]??0));}
function canInterject(s:DayState,seat:number){
 return !dualFlipped(s,seat)&&!!s.flippedIdiots?.includes(seat)&&['sheriff_speech','day_speech','last_words'].includes(s.phase)&&
  seat!==(s.phase==='last_words'?s.currentDeath:s.speaker)&&s.deadline!==null&&!s.interjection&&interjectionRemaining(s,seat)>0;
}
function finishInterjection(s:DayState,now:number){
 const current=s.interjection!;s.interjectionUsed??={};s.interjectionUsed[current.seat]=(s.interjectionUsed[current.seat]??0)+Math.min(interjectionRemaining(s,current.seat),Math.max(0,now-current.startedAt));
 s.deadline=now+current.remainingSpeechMs;s.interjection=null;s.turnId=randomUUID();s.events.push({type:'interjection_ended',seat:current.seat,at:now});
}
export function advanceDay(s:DayState,now:number,choose=(n:number)=>randomInt(n)){
 while(s.deadline!==null&&now>=s.deadline){const boundary=s.deadline;if(s.interjection){finishInterjection(s,boundary);continue;}if(s.phase==='voting')tally(s,boundary);else if(s.phase==='sheriff_speech'||s.phase==='day_speech'){
  if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.speakers.length===0){if(finishMaskedSpeech(s,boundary))continue;s.speaker=null;setupVote(s,'exile_pk',s.vote.candidates,s.vote.eligible,boundary);}else nextSpeaker(s,boundary);
 }else if(s.phase==='death_skill'||s.phase==='last_words')nextTask(s,boundary);else error();}
}
function applyDayCommand(s:DayState,actor:{seat:number;isHost:boolean},c:DayCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceDay(s,now,choose);if(c.turnId!==s.turnId)error('STALE_TURN');const seat=actor.seat;const p=s.players.find(p=>p.seat===seat);if(!p)error('NOT_SEATED');
 const host=()=>{if(!actor.isHost)error('HOST_ONLY',403);};const need=(phaseName:DayPhase)=>{if(s.phase!==phaseName)error();};
 if(c.action==='end_interjection'){
  if(!s.interjection)return error();if(seat!==s.interjection.seat&&!actor.isHost)error('NOT_YOUR_TURN',403);finishInterjection(s,now);return;
 }
 // A player cannot end/replace the paused original speaker's turn.
 if(s.interjection&&!['explode','withdraw'].includes(c.action))error();
 if(c.action==='interject'){
  if(!canInterject(s,seat))error('NOT_YOUR_TURN',403);
  s.interjection={seat,startedAt:now,remainingSpeechMs:Math.max(0,s.deadline!-now)};s.deadline=now+interjectionRemaining(s,seat);s.turnId=randomUUID();s.events.push({type:'interjection_started',seat,at:now});return;
 }

 if(c.action==='start'){host();need('awaiting_host');if(s.treasure){const deaths=[...s.pendingDeaths];const verdict=treasureVictory(s.players.map(p=>({...p,alive:p.alive&&!deaths.some(d=>d.seat===p.seat)})),s.treasure.deal.camp);if(verdict.status==='ended'){for(const d of deaths)kill(s,d.seat,d.reason,now);s.pendingDeaths=[];s.delayedDeaths=[];s.announcement=deaths.map(d=>d.seat);checkWin(s,now);return;}if(verdict.status==='unresolved'){rulePending(s,'同时达成胜负条件待裁决',now);return;}}if(s.rules.winTiming===null||s.rules.preAnnouncementEligibility===null)error('DAY_RULE_UNRESOLVED');if(s.rules.winTiming==='before_election')error('DAY_RULE_UNRESOLVED');if(s.badge==='deferred'){s.candidates=s.candidates.filter(seat=>participants(s).includes(seat));s.speaker=null;s.speakers=[];if(s.candidates.length<=1)closeElection(s,now);else phase(s,'sheriff_withdraw',now);}else phase(s,s.day===1?'sheriff_signup':'night_announcement',now);return;}
 if(c.action==='signup'){need('sheriff_signup');if(!p!.alive||dualFlipped(s,seat))error('NOT_YOUR_TURN',403);s.signup[seat]=c.join;return;}
 if(c.action==='close_signup'){host();need('sheriff_signup');s.originalCandidates=participants(s).filter(seat=>s.signup[seat]);s.candidates=[...s.originalCandidates];if(s.candidates.length===participants(s).length||s.candidates.length===0){s.badge='lost';electionFinished(s,now);}else if(s.candidates.length===1)closeElection(s,now);else{const seats=[...s.candidates].sort((a,b)=>a-b);const start=choose(seats.length);startSpeeches(s,[...seats.slice(start),...seats.slice(0,start)],'sheriff_speech',now);}return;}
 if(c.action==='withdraw'){if(!['sheriff_speech','sheriff_withdraw'].includes(s.phase)||!s.candidates.includes(seat))error();if(s.speaker===seat&&finishMaskedSpeech(s,now))return;s.candidates=s.candidates.filter(p=>p!==seat);s.speakers=s.speakers.filter(p=>p!==seat);if(s.vote?.purpose==='sheriff_pk'){s.vote.candidates=[...s.candidates];s.vote.eligible=participants(s).filter(p=>!s.candidates.includes(p));}if(s.candidates.length<=1){closeElection(s,now);announce(s,now,choose);return;}if(s.speaker===seat){if(s.interjection)finishInterjection(s,now);nextSpeaker(s,now);}return;}
 if(c.action==='end_speech'){if(!['sheriff_speech','day_speech','last_words','free_speech'].includes(s.phase))error();if(!actor.isHost&&seat!==(s.phase==='last_words'?s.currentDeath:s.speaker))error('NOT_YOUR_TURN',403);if(s.phase==='last_words')nextTask(s,now);else if(s.phase==='free_speech'){host();setupVote(s,'exile',participants(s),participants(s),now);}else if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.speakers.length===0){if(finishMaskedSpeech(s,now))return;s.speaker=null;setupVote(s,'exile_pk',s.vote.candidates,s.vote.eligible,now);}else nextSpeaker(s,now);return;}
 if(c.action==='close_withdraw'){host();need('sheriff_withdraw');closeElection(s,now);return;}
 if(c.action==='start_vote'){host();need('vote_setup');s.voteStarted=true;s.vote!.method=c.method;s.vote!.visibility=c.visibility;phase(s,'voting',now,c.method==='phone'?c.seconds:undefined);return;}
 if(c.action==='vote'||c.action==='offline_vote'){
  need('voting');const v=s.vote!;let voter=seat;if(c.action==='offline_vote'){host();if(v.method!=='offline')error();voter=c.voter;}else if(v.method!=='phone')error();
  if(!v.eligible.includes(voter))error('NOT_YOUR_TURN',403);if(c.target!==null&&!v.candidates.includes(c.target))error('INVALID_INPUT');
  if(Object.hasOwn(v.ballots,voter)){if(v.ballots[voter]===c.target)return;error('ALREADY_COMMITTED');}v.ballots[voter]=c.target;if(v.eligible.every(p=>Object.hasOwn(v.ballots,p)))tally(s,now);return;
 }
 if(c.action==='offline_ballots'){
  host();need('voting');const v=s.vote!;if(v.method!=='offline')error();
  const keys=c.ballots.map(b=>b.seat);if(keys.length!==v.eligible.length||new Set(keys).size!==keys.length||keys.some(seat=>!v.eligible.includes(seat))||c.ballots.some(b=>b.target!==null&&!v.candidates.includes(b.target)))error('INVALID_INPUT');
  for(const b of c.ballots)if(Object.hasOwn(v.ballots,b.seat)&&v.ballots[b.seat]!==b.target)error('ALREADY_COMMITTED');
  v.ballots=Object.fromEntries(c.ballots.map(b=>[b.seat,b.target]));tally(s,now);return;
 }
 if(c.action==='offline_results'){
  host();need('voting');const v=s.vote!;if(v.method!=='offline')error();
  const keys=c.counts.map(c=>c.seat);if(keys.length!==v.candidates.length||new Set(keys).size!==keys.length||keys.some(seat=>!v.candidates.includes(seat))||c.counts.some(c=>!Number.isFinite(c.votes)||c.votes<0||!Number.isInteger(c.votes*2)))error('INVALID_INPUT');
  const sheriffWeighted=v.purpose.startsWith('exile')&&s.sheriff!==null&&v.eligible.includes(s.sheriff);const halves=c.counts.filter(c=>!Number.isInteger(c.votes));const total=c.counts.reduce((sum,c)=>sum+c.votes,0);
  if(halves.length>1||halves.length&&(!sheriffWeighted||halves[0].votes<1.5)||total>(sheriffWeighted?(halves.length?v.eligible.length+0.5:v.eligible.length-1):v.eligible.length))error('INVALID_INPUT');
  const counts=v.candidates.map(seat=>({...c.counts.find(c=>c.seat===seat)!}));const max=Math.max(0,...counts.map(c=>c.votes));s.result={purpose:v.purpose,counts,leaders:max?counts.filter(c=>c.votes===max).map(c=>c.seat):[]};s.events.push({type:'vote_outcome',at:now,result:structuredClone(s.result!)});phase(s,'vote_result',now);return;
 }
 if(c.action==='close_vote'){host();need('voting');if(s.vote!.method!=='offline')error();tally(s,now);return;}
 if(c.action==='continue'){host();if(s.phase==='vote_result')continueResult(s,now,choose);else if(s.phase==='night_announcement'){if(s.announcement===null)announce(s,now,choose);else nextTask(s,now);}else error();return;}
 if(c.action==='shoot'){
  need('death_skill');if(!canShoot(s,seat))error('NOT_YOUR_TURN',403);
  const engine=s.engine?.players.find(e=>e.seat===seat),shot=engine?.abilities.skills.find(a=>a.kind==='shot');
  if(engine&&shot)engine.abilities=useSkill(engine.abilities,shot.id,{requestId:s.turnId,night:s.day,target:null});
  if(s.treasure)s.treasure.shotSpent.push(seat);if(p!.role==='hunter')s.hunterSpent=true;const shown=s.treasure&&p!.role==='blackWolf'?'blackWolf':shot?.parameters.damage==='black-wolf-shot'?'blackWolf':'hunter';reveal(s,seat,shown);if(engine)engine.publicState.revealedRole=shown;phase(s,'hunter_target',now);return;
 }
 if(c.action==='record_shot'){host();need('hunter_target');if(!living(s).includes(c.target))error('INVALID_INPUT');kill(s,c.target,'shot',now);s.events.push({type:'hunter_shot',at:now,seat:s.currentDeath!,target:c.target});if(checkWin(s,now))return;s.tasks=[...deathTasks(s,c.target,s.tasks.some(t=>t.seat===s.currentDeath&&t.step==='words')),...s.tasks];nextTask(s,now);return;}
 if(c.action==='record_take'){host();need('white_wolf_target');if(!living(s).includes(c.target))error('INVALID_INPUT');kill(s,c.target,'white-wolf',now);s.events.push({type:'white_wolf_take',at:now,seat:s.currentDeath!,target:c.target});if(checkWin(s,now))return;s.tasks=[...deathTasks(s,c.target,false),...s.tasks];nextTask(s,now);return;}
 if(c.action==='transfer_badge'){need('badge_transfer');if(seat!==s.currentDeath&&(!actor.isHost||c.takeover!==true))error('NOT_YOUR_TURN',403);if(c.target!==null&&!participants(s).includes(c.target))error('INVALID_INPUT');s.sheriff=c.target;s.badge=c.target===null?'lost':'elected';nextTask(s,now);return;}
 if(c.action==='speech_mode'){host();need('day_direction');if(s.delayedDeaths?.length&&c.mode==='free')error('TREASURE_MASK_ORDERED_REQUIRED');s.speechMode=c.mode==='ordered'?'phone':c.mode;if(s.sheriff===null)s.direction='ascending';startDaySpeech(s,now,choose);return;}
 if(c.action==='direction'){need('day_direction');if(seat!==s.sheriff)error('NOT_YOUR_TURN',403);if(c.start!==undefined&&!participants(s).includes(c.start))error('INVALID_INPUT');s.speechStart=c.start??null;s.direction=c.direction;startDaySpeech(s,now,choose);return;}
 if(c.action==='explode'){
  if(p?.role==='wolfGirl'&&s.engine?.board.composition.ruleset==='wolf-girl'){if(!canExplode(s,seat))error('NOT_YOUR_TURN',403);explodeGirl(s,seat,now,choose);return;}
  if(s.rules.explosionOrder===null||(s.voteStarted&&s.rules.explosionLock===null))error('DAY_RULE_UNRESOLVED');if(s.voteStarted&&s.rules.explosionLock==='after_any_vote')error('PHASE_LOCKED');if(!canExplode(s,seat))error('NOT_YOUR_TURN',403);
  if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.vote.candidates.includes(seat))error('NOT_YOUR_TURN',403);
  const sheriffPk=['sheriff_speech','sheriff_withdraw'].includes(s.phase)&&(s.vote?.purpose==='sheriff_pk'||s.electionPurpose==='sheriff_pk');if(sheriffPk&&s.candidates.includes(seat)){s.candidates=s.candidates.filter(p=>p!==seat);if(s.candidates.length===1){electSheriff(s,s.candidates[0],now);}}
  const poisoned=s.pendingDeaths.some(d=>d.seat===seat&&d.reason==='poison');const onSheriff=['sheriff_signup','sheriff_speech','sheriff_withdraw'].includes(s.phase);const swallowing=onSheriff&&poisoned;
  if(onSheriff&&s.sheriff===null){s.electionPurpose=s.vote?.purpose==='sheriff_pk'?'sheriff_pk':s.electionPurpose??'sheriff';s.explosions++;s.badge=s.explosions>=2?'lost':'deferred';}
  const engine=s.engine?.players.find(e=>e.seat===seat),take=engine?.abilities.skills.find(a=>a.kind==='explode-take');
  kill(s,seat,'explosion',now);const shown=take?'whiteWolf':p!.role;reveal(s,seat,shown);if(engine)engine.publicState.revealedRole=shown;s.priorityWolf=!swallowing&&isSharedWolfRole(p!.role)&&s.players.some(p=>p.alive&&isSharedWolfRole(p.role))?seat:null;
  s.afterDeaths='night';const pending=[...s.pendingDeaths,...(s.delayedDeaths??[])].filter(p=>p.seat!==seat);s.delayedDeaths=[];for(const death of pending)kill(s,death.seat,death.reason,now);s.announcement=[...new Set([seat,...pending.map(d=>d.seat)])].sort((a,b)=>a-b);s.pendingDeaths=[];if(checkWin(s,now))return;
  s.tasks=shuffle([...pending.map(p=>p.seat),seat],choose).flatMap(dead=>deathTasks(s,dead,dead===seat?swallowing&&s.day===1:s.day===1));s.vote=null;s.speaker=null;if(engine&&take&&!swallowing){engine.abilities=useSkill(engine.abilities,take.id,{requestId:s.turnId,night:s.day,target:null});s.currentDeath=seat;phase(s,'white_wolf_target',now);}else phase(s,'night_announcement',now);return;
 }
 error();
}
function explodeGirl(s:DayState,seat:number,now:number,choose:(n:number)=>number){
 const relation=s.engine!.confession;
 const cancelled=s.phase==='vote_result'&&s.result?.purpose.startsWith('exile');
 if(cancelled){s.events.push({type:'vote_cancelled',at:now,...(s.result?{result:structuredClone(s.result)}:{})});s.result=null;}
 const onSheriff=['sheriff_signup','sheriff_speech','sheriff_withdraw'].includes(s.phase);
 const swallowing=onSheriff&&s.pendingDeaths.some(d=>d.seat===seat&&d.reason==='poison');
 const sheriffPk=onSheriff&&(s.vote?.purpose==='sheriff_pk'||s.electionPurpose==='sheriff_pk');
 const pkCandidate=sheriffPk&&s.candidates.includes(seat);
 kill(s,seat,'explosion',now);reveal(s,seat,'wolfGirl');s.engine!.players.find(p=>p.seat===seat)!.publicState.revealedRole='wolfGirl';
 const retaliation=relation&&kill(s,relation.target,'girl-retaliation',now)?relation.target:null;
 const other=s.pendingDeaths.filter(d=>d.seat!==seat&&d.seat!==retaliation);
 for(const d of other)kill(s,d.seat,d.reason,now);
 s.pendingDeaths=[];s.announcement=[...new Set([seat,...(retaliation===null?[]:[retaliation]),...other.map(d=>d.seat)])].sort((a,b)=>a-b);
 if(onSheriff)s.candidates=s.candidates.filter(candidate=>participants(s).includes(candidate));
 s.afterDeaths='night';s.vote=null;s.speaker=null;s.speakers=[];
 s.priorityWolf=!swallowing&&s.players.some(p=>p.alive&&isSharedWolfRole(p.role))?seat:null;
 if(checkWin(s,now))return;
 // WG-008: finish all deaths and victory before any new election or badge work.
 if(onSheriff&&s.sheriff===null){
  if(pkCandidate&&s.candidates.length===1)electSheriff(s,s.candidates[0],now);
  else{s.electionPurpose=sheriffPk?'sheriff_pk':s.electionPurpose??'sheriff';s.explosions++;s.badge=s.explosions>=2?'lost':'deferred';}
 }
 const silent=[seat,...(retaliation===null?[]:[retaliation])];
 s.tasks=[...silent.flatMap(dead=>s.sheriff===dead?[{seat:dead,step:'badge' as const}]:[]),...shuffle(other.map(d=>d.seat),choose).flatMap(dead=>deathTasks(s,dead,s.day===1))];
 phase(s,'night_announcement',now);
}
function publicDeathSkills(s:DayState):NonNullable<DayPublic['skillResults']>{
 const results:NonNullable<DayPublic['skillResults']>=[];
 for(let i=0;i<s.events.length;i++){
  const e=s.events[i];if(e.type!=='death_skill'||e.seat===undefined)continue;
  // Only completed public phase transitions determine an outcome; private commands are ignored.
  const next=s.events.slice(i+1).find(x=>['hunter_target','last_words','badge_transfer','death_skill','day_direction','day_complete','ended'].includes(x.type));
  if(next&&next.type!=='ended')results.push({key:`day:${s.day}:skill:${i}`,seat:e.seat,activated:next.type==='hunter_target',at:next.at});
 }
 return results;
}
export function publicDay(s:DayState,now:number):DayPublic{return {...(s.winner&&s.treasure?{personalResults:s.players.map(p=>({seat:p.seat,won:(treasureWolf(p.role,s.treasure!.deal.camp)?'wolves':'good')===s.winner}))}:{}),...(s.winner&&s.engine?.victory.status==='ended'?{personalResults:s.engine.victory.personalResults}:{}),skillResults:publicDeathSkills(s),interjection:s.interjection?{seat:s.interjection.seat,originalSpeaker:(s.phase==='last_words'?s.currentDeath:s.speaker)!}:null,day:s.day,speechMode:s.speechMode==='ordered'?'phone':s.speechMode,direction:s.direction,speechStart:s.speechStart,nightDeaths:s.announcement===null?[]:s.nightDeaths,phase:s.phase,turnId:s.turnId,deadline:s.deadline,serverNow:now,alive:living(s),dead:s.deaths.map(d=>d.seat).sort((a,b)=>a-b),signupCount:living(s).filter(seat=>Object.hasOwn(s.signup,seat)).length,sheriff:s.sheriff,badge:s.badge,candidates:[...s.candidates],originalCandidates:[...s.originalCandidates],speaker:s.speaker,currentDeath:s.currentDeath,vote:s.vote?{purpose:s.vote.purpose,method:s.vote.method,visibility:s.vote.visibility,eligible:s.vote.eligible,candidates:s.vote.candidates,submittedCount:Object.keys(s.vote.ballots).length}:null,result:s.phase==='vote_result'?s.result:null,announcement:s.announcement,revealed:s.revealed,winner:s.winner,reason:s.reason};}
export function privateDay(s:DayState,seat:number):DayPrivate{
 const p=s.players.find(p=>p.seat===seat),vote=s.vote,engine=s.engine?.players.find(e=>e.seat===seat);
 return {turnId:s.turnId,seat,
  canSignup:s.phase==='sheriff_signup'&&!!p?.alive&&!dualFlipped(s,seat),signup:s.signup[seat]??null,
  canWithdraw:['sheriff_speech','sheriff_withdraw'].includes(s.phase)&&s.candidates.includes(seat),
  canVote:s.phase==='voting'&&vote?.method==='phone'&&vote.eligible.includes(seat)&&!Object.hasOwn(vote.ballots,seat)||false,
  voted:!!vote&&Object.hasOwn(vote.ballots,seat),myVote:vote?.ballots[seat]??null,canShoot:canShoot(s,seat),
  canExplode:canExplode(s,seat),
  canEndSpeech:!s.interjection&&seat===(s.phase==='last_words'?s.currentDeath:s.speaker),canTransfer:s.phase==='badge_transfer'&&seat===s.currentDeath,
  canInterject:canInterject(s,seat),canEndInterjection:s.interjection?.seat===seat,interjectionRemainingMs:interjectionRemaining(s,seat),
  ...(p?.role==='mixer'&&engine?.model?{mixerModel:{seat:engine.model.seat}}:{})};
}

export function dayCommand(s:DayState,actor:{seat:number;isHost:boolean},c:DayCommand,now:number,choose=(n:number)=>randomInt(n)){
 const before=JSON.stringify(s);applyDayCommand(s,actor,c,now,choose);if(JSON.stringify(s)!==before&&!['vote','offline_vote','offline_ballots','offline_results'].includes(c.action))s.events.push({type:'command',at:now,seat:actor.seat,command:{...c}});
}

/** Own inventory only: never include actions, targets, receipts or copy provenance. */
export function selfDay(s:DayState,n:NightState,seat:number):DaySelf{
 if(s.phase==='ended'||s.day!==n.night)error();
 const player=s.players.find(p=>p.seat===seat);if(!player)return error('NOT_SEATED',403);
 if(s.treasure){const role=player.role==='treasureMaster'?s.treasure.selected:player.role;return {turnId:s.turnId,seat,role:player.role,learnedRole:null,modelSeat:null,idiotRevealed:null,...(player.role==='treasureMaster'?{treasureCamp:s.treasure.deal.camp,treasureCard:s.treasure.selected}:{}),skills:role==='poisoner'?[{kind:'poison',remaining:Number(!s.treasure.poisonSpent.includes(seat)),availableFromNight:1}]:role==='hunter'||role==='blackWolf'?[{kind:'shot',remaining:Number(!s.treasure.shotSpent.includes(seat)),availableFromNight:1}]:role==='spiritSeer'?[{kind:'inspect',remaining:null,availableFromNight:1}]:[]};}
 const engine=s.engine?.players.find(p=>p.seat===seat),profile=engine?.abilities??createNativeAbilityProfile(player.role,seat,'standard');
 return {turnId:s.turnId,seat,role:player.role,learnedRole:profile.mimickedRole,
  ...(s.engine?.confession?.target===seat&&s.engine.confession.notified?{confession:{accepted:s.engine.confession.accepted,...(s.engine.confession.accepted?{girl:s.engine.confession.girl}:{})}}:{}),
  modelSeat:player.role==='mixer'?engine?.model?.seat??null:null,
  idiotRevealed:player.role==='idiot'||profile.mimickedRole==='idiot'?s.revealed.some(p=>p.seat===seat&&p.role==='idiot'):null,
  skills:profile.skills.map(skill=>({kind:skill.kind,remaining:engine?skill.remaining:skill.kind==='antidote'?Number(n.antidote):skill.kind==='poison'?Number(n.poison):skill.kind==='shot'?Number(!s.hunterSpent):skill.remaining,availableFromNight:skill.availableFromNight}))};
}
