import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNight,type NightPlayer} from '../packages/domain/night.js';
import {createDay,dayCommand,advanceDay,type DayState} from '../packages/domain/day.js';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
const players:NightPlayer[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','seer','hunter','idiot'].map((role,i)=>({seat:i+1,role:role as NightPlayer['role']}));
type Command<T> = T extends unknown?Omit<T,'turnId'>:never;
function cmd(s:DayState,seat:number,c:Command<DayCommand>,host=seat===12){dayCommand(s,{seat,isHost:host},{...c,turnId:s.turnId} as DayCommand,0,()=>0);}
function dawn(previous?:DayState,knife:number|null=null){const n=createNight(players,0);n.phase='first_night_complete';n.night=previous?previous.day+1:1;n.knife=knife;return createDay(n,firstDayRules,0,previous);}
function signup(s:DayState,seats:number[]){cmd(s,12,{action:'start'});for(const p of s.players.filter(p=>p.alive))cmd(s,p.seat,{action:'signup',join:seats.includes(p.seat)});cmd(s,12,{action:'close_signup'});}
function clearDeaths(s:DayState){if(s.announcement===null)cmd(s,12,{action:'continue'});cmd(s,12,{action:'continue'});while(['death_skill','last_words'].includes(s.phase))advanceDay(s,s.deadline!,()=>0);}
test('last remaining sheriff candidate wins immediately and stops remaining speeches, then deaths are announced',()=>{
 const s=dawn(undefined,5);signup(s,[1,2,3]);cmd(s,1,{action:'withdraw'});cmd(s,2,{action:'withdraw'});assert.equal(s.sheriff,3);assert.equal(s.badge,'elected');assert.equal(s.speaker,null);assert.deepEqual(s.speakers,[]);assert.equal(s.phase,'night_announcement');assert.deepEqual(s.announcement,[5]);assert.equal(s.players.find(p=>p.seat===5)!.alive,false);
});
test('second dawn inherits dead seats, badge, resources and disables election when badge is already elected',()=>{
 const first=dawn(undefined,5);signup(first,[6]);clearDeaths(first);first.hunterSpent=true;
 const second=dawn(first,7);assert.equal(second.day,2);assert.equal(second.players.find(p=>p.seat===5)!.alive,false);assert.equal(second.sheriff,6);assert.equal(second.hunterSpent,true);cmd(second,12,{action:'start'});assert.equal(second.phase,'night_announcement');clearDeaths(second);assert.equal(second.phase,'day_direction');assert.equal(second.events.filter(e=>e.type==='last_words').length,0);assert.equal(second.deaths.filter(d=>d.seat===5).length,1);
});
test('deferred election continues day two, second unfinished campaign explosion permanently loses badge',()=>{
 const first=dawn();signup(first,[1,2,3,6]);cmd(first,1,{action:'explode',confirmed:true});assert.equal(first.badge,'deferred');clearDeaths(first);assert.equal(first.phase,'day_complete');const second=dawn(first,5);cmd(second,12,{action:'start'});assert.equal(second.phase,'sheriff_withdraw');assert.deepEqual(second.candidates,[2,3,6]);assert.equal(second.speaker,null);cmd(second,2,{action:'explode',confirmed:true});assert.equal(second.badge,'lost');assert.equal(second.explosions,2);assert.equal(second.tasks.some(t=>t.step==='words'),false);
});
test('single-death direction starts on chosen side and wraps; explicit start is living; free speech is host only',()=>{
 const s=dawn(undefined,5);signup(s,[6]);clearDeaths(s);cmd(s,12,{action:'speech_mode',mode:'ordered'});cmd(s,6,{action:'direction',direction:'descending'});assert.equal(s.speaker,4);
 const start=dawn(undefined,5);signup(start,[6]);clearDeaths(start);cmd(start,12,{action:'speech_mode',mode:'ordered'});assert.throws(()=>cmd(start,6,{action:'direction',direction:'ascending',start:5}),/INVALID_INPUT/);cmd(start,6,{action:'direction',direction:'ascending',start:9});assert.equal(start.speaker,9);
 const sheriff=dawn();signup(sheriff,[6]);clearDeaths(sheriff);cmd(sheriff,12,{action:'speech_mode',mode:'ordered'});cmd(sheriff,6,{action:'direction',direction:'ascending'});assert.equal(sheriff.speaker,7);assert.equal(sheriff.speakers.at(-1),6);
 const free=dawn();signup(free,[6]);clearDeaths(free);assert.throws(()=>cmd(free,6,{action:'speech_mode',mode:'free'},false),/HOST_ONLY/);cmd(free,12,{action:'speech_mode',mode:'free'});assert.equal(free.phase,'free_speech');assert.equal(free.deadline,null);assert.equal(free.speaker,null);
});
test('second-night hunter chain has no words and used hunter cannot fire twice',()=>{
 const first=dawn();signup(first,[]);clearDeaths(first);const second=dawn(first,11);cmd(second,12,{action:'start'});cmd(second,12,{action:'continue'});cmd(second,12,{action:'continue'});cmd(second,11,{action:'shoot'});assert.equal(second.hunterSpent,true);cmd(second,12,{action:'record_shot',target:1});assert.equal(second.currentDeath,1);assert.equal(second.tasks.some(t=>t.step==='words'),false);advanceDay(second,second.deadline!,()=>0);assert.equal(second.phase,'day_direction');
});

test('deferred sheriff retains signup and withdrawals, skips speeches and excludes original candidates from voting',()=>{
 const first=dawn();signup(first,[1,2,3,6]);cmd(first,3,{action:'withdraw'});cmd(first,4,{action:'explode',confirmed:true});clearDeaths(first);
 const second=dawn(first,6);cmd(second,12,{action:'start'});assert.equal(second.phase,'sheriff_withdraw');assert.deepEqual(second.candidates,[1,2,6]);assert.deepEqual(second.originalCandidates,[1,2,3,6]);assert.equal(second.speaker,null);assert.deepEqual(second.speakers,[]);assert.equal(second.deadline,null);assert.equal(second.announcement,null);assert.equal(second.players.find(p=>p.seat===6)!.alive,true);
 assert.throws(()=>cmd(second,3,{action:'signup',join:true}),/PHASE_LOCKED/);assert.throws(()=>cmd(second,12,{action:'end_speech'}),/PHASE_LOCKED/);cmd(second,12,{action:'close_withdraw'});assert.equal(second.phase,'vote_setup');assert.deepEqual(second.vote!.candidates,[1,2,6]);assert.deepEqual(second.vote!.eligible,[5,7,8,9,10,11,12]);
});
test('explosion during signup carries only existing applicants into next-day withdrawal, without reopening signup',()=>{
 const first=dawn();cmd(first,12,{action:'start'});cmd(first,1,{action:'signup',join:true});cmd(first,6,{action:'signup',join:true});cmd(first,7,{action:'signup',join:false});cmd(first,4,{action:'explode',confirmed:true});clearDeaths(first);const second=dawn(first);cmd(second,12,{action:'start'});assert.equal(second.phase,'sheriff_withdraw');assert.deepEqual(second.candidates,[1,6]);assert.equal(second.signup[7],false);
});
test('deferred election removes publicly dead applicants and elects sole survivor immediately',()=>{
 const first=dawn(undefined,2);signup(first,[1,2,6]);cmd(first,1,{action:'explode',confirmed:true});clearDeaths(first);const second=dawn(first);cmd(second,12,{action:'start'});assert.equal(second.phase,'night_announcement');assert.equal(second.sheriff,6);assert.equal(second.badge,'elected');assert.deepEqual(second.candidates,[6]);assert.equal(second.events.some(e=>e.type==='sheriff_speech'),false);
});
test('deferred sheriff PK skips PK speeches but retains its candidate and voter restrictions',()=>{
 const first=dawn();signup(first,[1,6,7]);while(first.phase==='sheriff_speech')cmd(first,12,{action:'end_speech'});cmd(first,12,{action:'close_withdraw'});cmd(first,12,{action:'start_vote',method:'offline',visibility:'individual',seconds:30});for(const seat of first.vote!.eligible)cmd(first,12,{action:'offline_vote',voter:seat,target:seat===2?1:seat===3?6:null});cmd(first,12,{action:'continue'});assert.equal(first.vote!.purpose,'sheriff_pk');cmd(first,4,{action:'explode',confirmed:true});clearDeaths(first);
 const second=dawn(first);cmd(second,12,{action:'start'});assert.equal(second.phase,'sheriff_withdraw');assert.deepEqual(second.candidates,[1,6]);cmd(second,12,{action:'close_withdraw'});assert.equal(second.vote!.purpose,'sheriff_pk');assert.equal(second.vote!.eligible.includes(7),true);assert.equal(second.vote!.eligible.includes(1),false);assert.equal(second.vote!.eligible.includes(4),false);
});
test('phone operation mode is a host choice and keeps sheriff direction selection',()=>{
 const s=dawn();signup(s,[6]);clearDeaths(s);assert.throws(()=>cmd(s,6,{action:'speech_mode',mode:'phone'},false),/HOST_ONLY/);cmd(s,12,{action:'speech_mode',mode:'phone'});assert.equal(s.speechMode,'phone');assert.equal(s.phase,'day_direction');cmd(s,6,{action:'direction',direction:'ascending'});assert.equal(s.phase,'day_speech');assert.equal(s.speaker,7);
});
test('hunter shot cannot target an already dead player or consume another death',()=>{
 const first=dawn(undefined,5);signup(first,[]);clearDeaths(first);const second=dawn(first,11);cmd(second,12,{action:'start'});cmd(second,12,{action:'continue'});cmd(second,12,{action:'continue'});cmd(second,11,{action:'shoot'});const before=JSON.stringify(second);assert.throws(()=>cmd(second,12,{action:'record_shot',target:5}),/INVALID_INPUT/);assert.equal(JSON.stringify(second),before);cmd(second,12,{action:'record_shot',target:1});assert.equal(second.players.find(p=>p.seat===1)!.alive,false);
});
test('offline hand vote waits for host totals, rejects excess/dead/duplicate candidates and prevents non-host recording',()=>{
 const s=dawn();signup(s,[]);clearDeaths(s);cmd(s,12,{action:'speech_mode',mode:'free'});cmd(s,12,{action:'end_speech'});cmd(s,12,{action:'start_vote',method:'offline',visibility:'totals',seconds:5});assert.equal(s.deadline,null);advanceDay(s,60000);assert.equal(s.phase,'voting');const counts=s.vote!.candidates.map(seat=>({seat,votes:seat===1?3:0}));assert.throws(()=>cmd(s,2,{action:'offline_results',counts},false),/HOST_ONLY/);assert.throws(()=>cmd(s,12,{action:'offline_results',counts:[...counts,{seat:1,votes:1}]}),/INVALID_INPUT/);assert.throws(()=>cmd(s,12,{action:'offline_results',counts:counts.map(c=>({...c,votes:2}))}),/INVALID_INPUT/);cmd(s,12,{action:'offline_results',counts});assert.equal(s.phase,'vote_result');assert.deepEqual(s.result!.leaders,[1]);assert.equal(s.result!.ballots,undefined);assert.equal(s.result!.counts[0].votes,3);
});
test('manual exile totals include sheriff 1.5 weight without inventing individual ballots',()=>{
 const s=dawn(undefined,5);signup(s,[6]);clearDeaths(s);cmd(s,12,{action:'speech_mode',mode:'free'});cmd(s,12,{action:'end_speech'});cmd(s,12,{action:'start_vote',method:'offline',visibility:'totals',seconds:30});const counts=s.vote!.candidates.map(seat=>({seat,votes:seat===1?1.5:0}));assert.throws(()=>cmd(s,12,{action:'offline_results',counts:[...counts,{seat:5,votes:1}]}),/INVALID_INPUT/);assert.throws(()=>cmd(s,12,{action:'offline_results',counts:counts.map(c=>({...c,votes:c.seat===1?0.5:0}))}),/INVALID_INPUT/);assert.throws(()=>cmd(s,12,{action:'offline_results',counts:counts.map(c=>({...c,votes:c.seat===1||c.seat===2?1.5:0}))}),/INVALID_INPUT/);cmd(s,12,{action:'offline_results',counts});assert.equal(s.result!.counts.find(c=>c.seat===1)!.votes,1.5);assert.equal(s.result!.ballots,undefined);
});
test('a deferred PK finalist exploding in next-day withdrawal elects the other finalist immediately',()=>{
 const first=dawn();signup(first,[1,6]);while(first.phase==='sheriff_speech')cmd(first,12,{action:'end_speech'});cmd(first,12,{action:'close_withdraw'});cmd(first,12,{action:'start_vote',method:'offline',visibility:'totals',seconds:30});cmd(first,12,{action:'offline_results',counts:[{seat:1,votes:1},{seat:6,votes:1}]});cmd(first,12,{action:'continue'});cmd(first,4,{action:'explode',confirmed:true});clearDeaths(first);const second=dawn(first);cmd(second,12,{action:'start'});cmd(second,1,{action:'explode',confirmed:true});assert.equal(second.sheriff,6);assert.equal(second.badge,'elected');assert.equal(second.explosions,1);
});

test('offline individual ballots record exactly who voted whom with sheriff weighting and validate host and voters',()=>{
 const s=dawn();signup(s,[6]);clearDeaths(s);cmd(s,12,{action:'speech_mode',mode:'free'});cmd(s,12,{action:'end_speech'});cmd(s,12,{action:'start_vote',method:'offline',visibility:'individual',seconds:30});const eligible=s.vote!.eligible;const ballots=eligible.map(seat=>({seat,target:seat===6?1:null}));assert.throws(()=>cmd(s,5,{action:'offline_ballots',ballots},false),/HOST_ONLY/);assert.throws(()=>cmd(s,12,{action:'offline_ballots',ballots:ballots.slice(1)}),/INVALID_INPUT/);assert.throws(()=>cmd(s,12,{action:'offline_ballots',ballots:[...ballots.slice(1),ballots[1]]}),/INVALID_INPUT/);assert.throws(()=>cmd(s,12,{action:'offline_ballots',ballots:ballots.map(b=>({...b,target:13}))}),/INVALID_INPUT/);assert.equal(s.phase,'voting');cmd(s,12,{action:'offline_ballots',ballots});assert.equal(s.phase,'vote_result');assert.equal(s.result!.counts.find(c=>c.seat===1)!.votes,1.5);assert.deepEqual(s.result!.ballots,ballots);
});
