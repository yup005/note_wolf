import {randomInt,randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import type {DayCommand,DayPhase,DayPublic,DayPrivate,DayVoteResult,FirstDayRules,VotePurpose} from '../contracts/day.js';
import type {GameEvent} from '../contracts/game.js';
import type {NightState} from './night.js';
import {evaluateVictory} from './victory.js';
type DeathReason='knife'|'poison'|'shot'|'exile'|'explosion';
type Task={seat:number;step:'skill'|'words'|'badge'};
export interface DayState {
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
function phase(s:DayState,p:DayPhase,now:number,seconds?:number){s.phase=p;s.turnId=randomUUID();s.deadline=seconds===undefined?null:now+seconds*1000;s.events.push({type:p,at:now,...(p==='sheriff_speech'||p==='day_speech'?{seat:s.speaker!}:['death_skill','last_words','badge_transfer','hunter_target'].includes(p)?{seat:s.currentDeath!}:{})});}
export function createDay(n:NightState,rules:FirstDayRules,now:number,previous?:DayState):DayState{
 if(n.phase!=='first_night_complete')error();
 const pendingDeaths:DayState['pendingDeaths']=[];
 if(n.knife!==null&&n.witchChoice?.choice!=='save')pendingDeaths.push({seat:n.knife,reason:'knife'});
 if(n.witchChoice?.choice==='poison'){const seat=n.witchChoice.target!;const old=pendingDeaths.find(d=>d.seat===seat);if(old)old.reason='poison';else pendingDeaths.push({seat,reason:'poison'});}
 return {day:n.night,nightDeaths:pendingDeaths.map(d=>d.seat),hunterSpent:previous?.hunterSpent??false,speechStart:null,phase:'awaiting_host',turnId:randomUUID(),deadline:null,players:n.players.map(p=>({...p,alive:previous?.players.find(old=>old.seat===p.seat)?.alive??p.alive??true})),rules:{...rules},pendingDeaths,deaths:previous?.deaths.map(d=>({...d}))??[],tasks:[],currentDeath:null,sheriff:previous?.sheriff??null,badge:previous?.badge??'available',signup:previous?.badge==='deferred'?{...previous.signup}:{},originalCandidates:previous?.badge==='deferred'?[...(previous.originalCandidates.length?previous.originalCandidates:previous.players.filter(p=>previous.signup[p.seat]).map(p=>p.seat))]:[],candidates:previous?.badge==='deferred'?[...(previous.originalCandidates.length?previous.candidates:previous.players.filter(p=>previous.signup[p.seat]).map(p=>p.seat))]:[],speakers:[],speaker:null,vote:null,result:null,announcement:null,revealed:previous?.revealed.map(p=>({...p}))??[],winner:null,reason:null,electionPurpose:previous?.badge==='deferred'?(previous.electionPurpose??(previous.vote?.purpose==='sheriff_pk'||previous.result?.purpose==='sheriff'&&previous.result.leaders.length>1?'sheriff_pk':'sheriff')):'sheriff',voteStarted:false,speechMode:null,direction:null,afterDeaths:'day',explosions:previous?.explosions??0,priorityWolf:null,events:[{type:'day_created',at:now}]};
}
function checkWin(s:DayState,now:number){
 const result=evaluateVictory(s.players,'standard');
 const winner=result.status==='ended'?result.winner:null;
 if(winner){s.winner=winner;s.revealed=s.players.map(({seat,role})=>({seat,role}));s.tasks=[];s.speaker=null;s.currentDeath=null;s.vote=null;phase(s,'ended',now);return true;}return false;
}
function reveal(s:DayState,seat:number,role:Role){if(!s.revealed.some(p=>p.seat===seat))s.revealed.push({seat,role});}
function kill(s:DayState,seat:number,reason:DeathReason,now:number){const p=s.players.find(p=>p.seat===seat);if(!p||!p.alive)return false;p.alive=false;s.deaths.push({seat,reason});s.events.push({type:`death_${reason}`,seat,at:now});if(reason==='exile'&&p.role==='idiot')reveal(s,seat,'idiot');return true;}
function deathTasks(s:DayState,seat:number,words=true):Task[]{return [{seat,step:'skill'},...(words?[{seat,step:'words' as const}]:[]),...(s.sheriff===seat?[{seat,step:'badge' as const}]:[])];}
function nextTask(s:DayState,now:number){const task=s.tasks.shift();s.currentDeath=task?.seat??null;if(!task){if(s.afterDeaths==='night')phase(s,'day_complete',now);else phase(s,'day_direction',now);return;}phase(s,task.step==='skill'?'death_skill':task.step==='words'?'last_words':'badge_transfer',now,task.step==='skill'?10:task.step==='words'?90:undefined);}
function shuffle<T>(items:T[],choose:(n:number)=>number){const out=[...items];for(let i=out.length-1;i>0;i--){const j=choose(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
function announce(s:DayState,now:number,choose:(n:number)=>number){
 s.announcement=s.pendingDeaths.map(p=>p.seat).sort((a,b)=>a-b);for(const d of s.pendingDeaths)kill(s,d.seat,d.reason,now);s.pendingDeaths=[];
 if(checkWin(s,now))return;s.tasks=shuffle(s.announcement,choose).flatMap(seat=>deathTasks(s,seat,s.day===1));phase(s,'night_announcement',now);
}
function startSpeeches(s:DayState,seats:number[],p:'sheriff_speech'|'day_speech',now:number){s.speakers=[...seats];s.speaker=s.speakers.shift()??null;if(s.speaker!==null)phase(s,p,now,90);else if(p==='sheriff_speech')phase(s,'sheriff_withdraw',now);else setupVote(s,'exile',living(s),living(s),now);}
function nextSpeaker(s:DayState,now:number){s.speaker=s.speakers.shift()??null;if(s.speaker!==null)phase(s,s.phase,now,90);else if(s.phase==='sheriff_speech'){if(s.vote?.purpose==='sheriff_pk')setupVote(s,'sheriff_pk',s.candidates,living(s).filter(p=>!s.candidates.includes(p)),now);else phase(s,'sheriff_withdraw',now);}else setupVote(s,'exile',living(s),living(s),now);}
function setupVote(s:DayState,purpose:VotePurpose,candidates:number[],eligible:number[],now:number){s.vote={purpose,candidates:[...candidates],eligible:[...eligible],ballots:{},method:'phone',visibility:'individual'};s.result=null;phase(s,'vote_setup',now);}
function electSheriff(s:DayState,seat:number,now:number){s.sheriff=seat;s.badge='elected';s.events.push({type:'sheriff_elected',seat,at:now});}
function electionFinished(s:DayState,now:number){s.speaker=null;s.speakers=[];phase(s,'night_announcement',now);}
function closeElection(s:DayState,now:number){if(s.candidates.length===0){s.badge='lost';electionFinished(s,now);}else if(s.candidates.length===1){electSheriff(s,s.candidates[0],now);electionFinished(s,now);}else {const purpose=s.electionPurpose??'sheriff';setupVote(s,purpose,s.candidates,living(s).filter(p=>!(purpose==='sheriff_pk'?s.candidates:s.originalCandidates).includes(p)),now);}}
function tally(s:DayState,now:number){const v=s.vote!;const counts=v.candidates.map(seat=>({seat,votes:0}));for(const seat of v.eligible){const target=v.ballots[seat];const count=counts.find(c=>c.seat===target);if(count)count.votes+=(v.purpose.startsWith('exile')&&s.sheriff===seat?1.5:1);}
 const max=Math.max(0,...counts.map(c=>c.votes));s.result={purpose:v.purpose,counts,leaders:max?counts.filter(c=>c.votes===max).map(c=>c.seat):[],...(v.visibility==='individual'?{ballots:v.eligible.map(seat=>({seat,target:v.ballots[seat]??null}))}:{} )};s.events.push({type:'vote_outcome',at:now,result:structuredClone(s.result!)});phase(s,'vote_result',now);
}
function rulePending(s:DayState,reason:string,now:number){s.reason=reason;phase(s,'rules_pending',now);}
function continueResult(s:DayState,now:number,choose:(n:number)=>number){
 const r=s.result!;if(r.purpose==='sheriff'||r.purpose==='sheriff_pk'){
  if(r.leaders.length===1){electSheriff(s,r.leaders[0],now);electionFinished(s,now);}
  else if(!r.leaders.length){if(s.rules.zeroVotes==='no_result'){s.badge='lost';electionFinished(s,now);}else rulePending(s,'全员弃票时的警长选举规则待确认',now);}
  else if(r.purpose==='sheriff_pk'){s.badge='lost';electionFinished(s,now);}
  else{s.candidates=[...r.leaders];s.vote={...s.vote!,purpose:'sheriff_pk',candidates:s.candidates,eligible:living(s).filter(p=>!s.candidates.includes(p)),ballots:{}};startSpeeches(s,shuffle(s.candidates,choose),'sheriff_speech',now);}
 }else{
  if(r.leaders.length===1){const seat=r.leaders[0];kill(s,seat,'exile',now);if(checkWin(s,now))return;s.afterDeaths='night';s.tasks=deathTasks(s,seat);nextTask(s,now);}
  else if(!r.leaders.length){if(s.rules.zeroVotes==='no_result')phase(s,'day_complete',now);else rulePending(s,'全员弃票时的放逐规则待确认',now);}
  else if(r.purpose==='exile_pk'){phase(s,'day_complete',now);}
  else{if(s.rules.exilePkEligibility===null){rulePending(s,'放逐 PK 投票资格待确认',now);return;}s.candidates=[...r.leaders];s.speakers=shuffle(s.candidates,choose);s.speaker=s.speakers.shift()!;s.vote={...s.vote!,purpose:'exile_pk',candidates:s.candidates,eligible:living(s).filter(p=>s.rules.exilePkEligibility==='all_alive'||!s.candidates.includes(p)),ballots:{}};phase(s,'day_speech',now,90);}
 }
}
function startDaySpeech(s:DayState,now:number,choose:(n:number)=>number){
 if(s.speechMode==='free'){s.speaker=null;s.speakers=[];phase(s,'free_speech',now);return;}
 if(s.speechMode===null||s.direction===null)return;
 const seats=living(s).sort((a,b)=>s.direction==='ascending'?a-b:b-a);
 const anchor=s.nightDeaths.length===1?s.nightDeaths[0]:s.sheriff;
 let start=s.speechStart;
 if(start===null&&anchor!==null)start=seats.find(p=>s.direction==='ascending'?p>anchor:p<anchor)??seats[0];
 start??=seats[choose(seats.length)];s.speechStart=start;const index=seats.indexOf(start);
 startSpeeches(s,[...seats.slice(index),...seats.slice(0,index)],'day_speech',now);
}
export function advanceDay(s:DayState,now:number,choose=(n:number)=>randomInt(n)){
 while(s.deadline!==null&&now>=s.deadline){const boundary=s.deadline;if(s.phase==='voting')tally(s,boundary);else if(s.phase==='sheriff_speech'||s.phase==='day_speech'){
  if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.speakers.length===0){s.speaker=null;setupVote(s,'exile_pk',s.vote.candidates,s.vote.eligible,boundary);}else nextSpeaker(s,boundary);
 }else if(s.phase==='death_skill'||s.phase==='last_words')nextTask(s,boundary);else error();}
}
function applyDayCommand(s:DayState,actor:{seat:number;isHost:boolean},c:DayCommand,now:number,choose=(n:number)=>randomInt(n)){
 advanceDay(s,now,choose);if(c.turnId!==s.turnId)error('STALE_TURN');const seat=actor.seat;const p=s.players.find(p=>p.seat===seat);if(!p)error('NOT_SEATED');
 const host=()=>{if(!actor.isHost)error('HOST_ONLY',403);};const need=(phaseName:DayPhase)=>{if(s.phase!==phaseName)error();};
 if(c.action==='start'){host();need('awaiting_host');if(s.rules.winTiming===null||s.rules.preAnnouncementEligibility===null)error('DAY_RULE_UNRESOLVED');if(s.rules.winTiming==='before_election')error('DAY_RULE_UNRESOLVED');if(s.badge==='deferred'){s.candidates=s.candidates.filter(seat=>living(s).includes(seat));s.speaker=null;s.speakers=[];if(s.candidates.length<=1)closeElection(s,now);else phase(s,'sheriff_withdraw',now);}else phase(s,s.day===1?'sheriff_signup':'night_announcement',now);return;}
 if(c.action==='signup'){need('sheriff_signup');if(!p!.alive)error('NOT_YOUR_TURN',403);s.signup[seat]=c.join;return;}
 if(c.action==='close_signup'){host();need('sheriff_signup');s.originalCandidates=living(s).filter(seat=>s.signup[seat]);s.candidates=[...s.originalCandidates];if(s.candidates.length===living(s).length||s.candidates.length===0){s.badge='lost';electionFinished(s,now);}else if(s.candidates.length===1)closeElection(s,now);else{const seats=[...s.candidates].sort((a,b)=>a-b);const start=choose(seats.length);startSpeeches(s,[...seats.slice(start),...seats.slice(0,start)],'sheriff_speech',now);}return;}
 if(c.action==='withdraw'){if(!['sheriff_speech','sheriff_withdraw'].includes(s.phase)||!s.candidates.includes(seat))error();s.candidates=s.candidates.filter(p=>p!==seat);s.speakers=s.speakers.filter(p=>p!==seat);if(s.vote?.purpose==='sheriff_pk'){s.vote.candidates=[...s.candidates];s.vote.eligible=living(s).filter(p=>!s.candidates.includes(p));}if(s.candidates.length<=1){closeElection(s,now);announce(s,now,choose);return;}if(s.speaker===seat)nextSpeaker(s,now);return;}
 if(c.action==='end_speech'){if(!['sheriff_speech','day_speech','last_words','free_speech'].includes(s.phase))error();if(!actor.isHost&&seat!==(s.phase==='last_words'?s.currentDeath:s.speaker))error('NOT_YOUR_TURN',403);if(s.phase==='last_words')nextTask(s,now);else if(s.phase==='free_speech'){host();setupVote(s,'exile',living(s),living(s),now);}else if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.speakers.length===0){s.speaker=null;setupVote(s,'exile_pk',s.vote.candidates,s.vote.eligible,now);}else nextSpeaker(s,now);return;}
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
 if(c.action==='shoot'){need('death_skill');if(seat!==s.currentDeath||p!.role!=='hunter'||s.hunterSpent||s.deaths.find(d=>d.seat===seat)?.reason==='poison')error('NOT_YOUR_TURN',403);s.hunterSpent=true;reveal(s,seat,'hunter');phase(s,'hunter_target',now);return;}
 if(c.action==='record_shot'){host();need('hunter_target');if(!living(s).includes(c.target))error('INVALID_INPUT');kill(s,c.target,'shot',now);s.events.push({type:'hunter_shot',at:now,seat:s.currentDeath!,target:c.target});if(checkWin(s,now))return;s.tasks=[...deathTasks(s,c.target,s.tasks.some(t=>t.seat===s.currentDeath&&t.step==='words')),...s.tasks];nextTask(s,now);return;}
 if(c.action==='transfer_badge'){need('badge_transfer');if(seat!==s.currentDeath&&(!actor.isHost||c.takeover!==true))error('NOT_YOUR_TURN',403);if(c.target!==null&&!living(s).includes(c.target))error('INVALID_INPUT');s.sheriff=c.target;s.badge=c.target===null?'lost':'elected';nextTask(s,now);return;}
 if(c.action==='speech_mode'){host();need('day_direction');s.speechMode=c.mode==='ordered'?'phone':c.mode;if(s.sheriff===null)s.direction='ascending';startDaySpeech(s,now,choose);return;}
 if(c.action==='direction'){need('day_direction');if(seat!==s.sheriff)error('NOT_YOUR_TURN',403);if(c.start!==undefined&&!living(s).includes(c.start))error('INVALID_INPUT');s.speechStart=c.start??null;s.direction=c.direction;startDaySpeech(s,now,choose);return;}
 if(c.action==='explode'){
  if(s.rules.explosionOrder===null||(s.voteStarted&&s.rules.explosionLock===null))error('DAY_RULE_UNRESOLVED');if(s.voteStarted&&s.rules.explosionLock==='after_any_vote')error('PHASE_LOCKED');if(!['sheriff_signup','sheriff_speech','sheriff_withdraw','day_speech','free_speech'].includes(s.phase)||!p!.alive||p!.role!=='wolf')error('NOT_YOUR_TURN',403);
  if(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.vote.candidates.includes(seat))error('NOT_YOUR_TURN',403);
  const sheriffPk=['sheriff_speech','sheriff_withdraw'].includes(s.phase)&&(s.vote?.purpose==='sheriff_pk'||s.electionPurpose==='sheriff_pk');if(sheriffPk&&s.candidates.includes(seat)){s.candidates=s.candidates.filter(p=>p!==seat);if(s.candidates.length===1){electSheriff(s,s.candidates[0],now);}}
  const poisoned=s.pendingDeaths.some(d=>d.seat===seat&&d.reason==='poison');const onSheriff=['sheriff_signup','sheriff_speech','sheriff_withdraw'].includes(s.phase);const swallowing=onSheriff&&poisoned;
  if(onSheriff&&s.sheriff===null){s.electionPurpose=s.vote?.purpose==='sheriff_pk'?'sheriff_pk':s.electionPurpose??'sheriff';s.explosions++;s.badge=s.explosions>=2?'lost':'deferred';}
  kill(s,seat,'explosion',now);reveal(s,seat,'wolf');s.priorityWolf=!swallowing&&s.players.some(p=>p.alive&&p.role==='wolf')?seat:null;
  s.afterDeaths='night';const pending=s.pendingDeaths.filter(p=>p.seat!==seat);for(const death of pending)kill(s,death.seat,death.reason,now);s.announcement=[...new Set([seat,...pending.map(d=>d.seat)])].sort((a,b)=>a-b);s.pendingDeaths=[];if(checkWin(s,now))return;
  s.tasks=shuffle([...pending.map(p=>p.seat),seat],choose).flatMap(dead=>deathTasks(s,dead,dead===seat?swallowing&&s.day===1:s.day===1));s.vote=null;s.speaker=null;phase(s,'night_announcement',now);return;
 }
 error();
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
export function publicDay(s:DayState,now:number):DayPublic{return {skillResults:publicDeathSkills(s),day:s.day,speechMode:s.speechMode==='ordered'?'phone':s.speechMode,direction:s.direction,speechStart:s.speechStart,nightDeaths:s.announcement===null?[]:s.nightDeaths,phase:s.phase,turnId:s.turnId,deadline:s.deadline,serverNow:now,alive:living(s),dead:s.deaths.map(d=>d.seat).sort((a,b)=>a-b),signupCount:living(s).filter(seat=>Object.hasOwn(s.signup,seat)).length,sheriff:s.sheriff,badge:s.badge,candidates:[...s.candidates],originalCandidates:[...s.originalCandidates],speaker:s.speaker,currentDeath:s.currentDeath,vote:s.vote?{purpose:s.vote.purpose,method:s.vote.method,visibility:s.vote.visibility,eligible:s.vote.eligible,candidates:s.vote.candidates,submittedCount:Object.keys(s.vote.ballots).length}:null,result:s.phase==='vote_result'?s.result:null,announcement:s.announcement,revealed:s.revealed,winner:s.winner,reason:s.reason};}
export function privateDay(s:DayState,seat:number):DayPrivate{const p=s.players.find(p=>p.seat===seat);const vote=s.vote;return {turnId:s.turnId,seat,canSignup:s.phase==='sheriff_signup'&&!!p?.alive,signup:s.signup[seat]??null,canWithdraw:['sheriff_speech','sheriff_withdraw'].includes(s.phase)&&s.candidates.includes(seat),canVote:s.phase==='voting'&&vote?.method==='phone'&&vote.eligible.includes(seat)&&!Object.hasOwn(vote.ballots,seat)||false,voted:!!vote&&Object.hasOwn(vote.ballots,seat),myVote:vote?.ballots[seat]??null,canShoot:s.phase==='death_skill'&&seat===s.currentDeath&&p?.role==='hunter'&&!s.hunterSpent&&s.deaths.find(d=>d.seat===seat)?.reason!=='poison',canExplode:s.rules.explosionOrder!==null&&(s.rules.explosionLock==='during_vote'||!s.voteStarted)&&['sheriff_signup','sheriff_speech','sheriff_withdraw','day_speech','free_speech'].includes(s.phase)&&!(s.phase==='day_speech'&&s.vote?.purpose==='exile_pk'&&s.vote.candidates.includes(seat))&&!!p?.alive&&p.role==='wolf',canEndSpeech:seat===(s.phase==='last_words'?s.currentDeath:s.speaker),canTransfer:s.phase==='badge_transfer'&&seat===s.currentDeath};}

export function dayCommand(s:DayState,actor:{seat:number;isHost:boolean},c:DayCommand,now:number,choose=(n:number)=>randomInt(n)){
 const before=JSON.stringify(s);applyDayCommand(s,actor,c,now,choose);if(JSON.stringify(s)!==before)s.events.push({type:'command',at:now,seat:actor.seat,command:{...c}});
}
