import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNight,beginNight,advanceNight,type NightPlayer} from '../packages/domain/night.js';
import {createDay,dayCommand,advanceDay,publicDay,privateDay,type DayState} from '../packages/domain/day.js';
import type {DayCommand,FirstDayRules} from '../packages/contracts/day.js';
const players:NightPlayer[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','seer','hunter','idiot'].map((role,i)=>({seat:i+1,role:role as NightPlayer['role']}));
// Explicit test policy; these fixtures do not approve production rules.
const rules:FirstDayRules={winTiming:'after_election',preAnnouncementEligibility:'all',explosionOrder:null,exilePkEligibility:'excluding_candidates',zeroVotes:'no_result',explosionLock:'during_vote'};
type CommandWithoutTurn<T> = T extends unknown?Omit<T,'turnId'>:never;
function game(deaths:{knife?:number;poison?:number}={}){const n=createNight(players,0);beginNight(n,0,()=>0);advanceNight(n,1000000);n.knife=deaths.knife??null;if(deaths.poison)n.witchChoice={choice:'poison',target:deaths.poison};return createDay(n,rules,1000000);}
function cmd(s:DayState,seat:number,c:CommandWithoutTurn<DayCommand>,host=seat===12,now=1000000){dayCommand(s,{seat,isHost:host},{...c,turnId:s.turnId} as DayCommand,now,()=>0);}
function signup(s:DayState,seats:number[]){cmd(s,12,{action:'start'});for(const seat of s.players.map(p=>p.seat))cmd(s,seat,{action:'signup',join:seats.includes(seat)});cmd(s,12,{action:'close_signup'});}
function endSpeeches(s:DayState){while(s.phase==='sheriff_speech'||s.phase==='day_speech')cmd(s,12,{action:'end_speech'});}
function phoneVote(s:DayState,ballots:Record<number,number|null>,purpose='sheriff'){assert.equal(s.phase,'vote_setup');assert.equal(s.vote?.purpose,purpose);cmd(s,12,{action:'start_vote',method:'phone',visibility:'individual',seconds:30});for(const seat of s.vote!.eligible)cmd(s,seat,{action:'vote',target:ballots[seat]??null});assert.equal(s.phase,'vote_result');}
function toDaySpeech(s:DayState){signup(s,[]);cmd(s,12,{action:'continue'});cmd(s,12,{action:'continue'});while(s.phase==='death_skill'||s.phase==='last_words'){advanceDay(s,s.deadline!,()=>0);}assert.equal(s.phase,'day_direction');cmd(s,12,{action:'speech_mode',mode:'ordered'});}
test('unresolved production rules block uniformly without disclosing pending knife or poison',()=>{
 for(const death of [{},{knife:5},{poison:2}]){const s=game(death);s.rules.winTiming=null;const before=JSON.stringify(publicDay(s,1000000));assert.throws(()=>cmd(s,12,{action:'start'}),/DAY_RULE_UNRESOLVED/);assert.equal(JSON.stringify(publicDay(s,1000000)),before);assert.equal(before.includes('poison'),false);assert.equal(before.includes('knife'),false);}
});
test('sheriff signup retains pending-night players, all-up and nobody-up lose badge, one candidate wins',()=>{
 for(const seats of [[],players.map(p=>p.seat),[2]]){const s=game({poison:2});signup(s,seats);assert.equal(s.phase,'night_announcement');assert.equal(s.badge,seats.length===1?'elected':'lost');assert.equal(s.sheriff,seats.length===1?2:null);assert.equal(s.players[1].alive,true);assert.equal(publicDay(s,1000000).announcement,null);}
});
test('withdrawn candidates cannot vote in first sheriff round; non-candidates vote privately and timeout abstains',()=>{
 const s=game();signup(s,[1,2,3]);cmd(s,3,{action:'withdraw'});assert.throws(()=>cmd(s,3,{action:'signup',join:true}),/PHASE_LOCKED/);endSpeeches(s);cmd(s,12,{action:'close_withdraw'});assert.deepEqual(s.vote!.eligible,[4,5,6,7,8,9,10,11,12]);cmd(s,12,{action:'start_vote',method:'phone',visibility:'totals',seconds:30});cmd(s,4,{action:'vote',target:1});assert.throws(()=>cmd(s,3,{action:'vote',target:1}),/NOT_YOUR_TURN/);assert.throws(()=>cmd(s,4,{action:'vote',target:2}),/ALREADY_COMMITTED/);assert.equal(JSON.stringify(publicDay(s,1000000)).includes('ballots'),false);assert.equal(publicDay(s,1000000).result,null);assert.equal(privateDay(s,5).myVote,null);advanceDay(s,1030000,()=>0);assert.equal(s.phase,'vote_result');assert.equal(publicDay(s,1030000).result!.ballots,undefined);assert.deepEqual(s.result!.leaders,[1]);cmd(s,12,{action:'continue'},true,1030000);assert.equal(s.sheriff,1);
});
test('sheriff tie enters PK, former candidates may vote, second tie loses badge',()=>{
 const s=game();signup(s,[1,2,3]);cmd(s,3,{action:'withdraw'});endSpeeches(s);cmd(s,12,{action:'close_withdraw'});phoneVote(s,{4:1,5:2});cmd(s,12,{action:'continue'});assert.equal(s.phase,'sheriff_speech');endSpeeches(s);assert.equal(s.phase,'vote_setup');assert.equal(s.vote!.purpose,'sheriff_pk');assert.equal(s.vote!.eligible.includes(3),true);assert.equal(s.vote!.eligible.includes(1),false);phoneVote(s,{3:1,4:2},'sheriff_pk');cmd(s,12,{action:'continue'});assert.equal(s.badge,'lost');assert.equal(s.phase,'night_announcement');
});
test('night deaths are announced in one batch and every dead player has a ten-second skill window and ninety-second words',()=>{
 const s=game({knife:5,poison:11});signup(s,[]);cmd(s,12,{action:'continue'});assert.deepEqual(s.announcement,[5,11]);assert.equal(s.players[4].alive,false);cmd(s,12,{action:'continue'});assert.equal(s.phase,'death_skill');assert.equal(s.deadline,1010000);assert.equal(privateDay(s,11).canShoot,false);assert.throws(()=>cmd(s,12,{action:'end_speech'}),/PHASE_LOCKED/);advanceDay(s,1009999);assert.equal(s.phase,'death_skill');advanceDay(s,1010000);assert.equal(s.phase,'last_words');assert.equal(s.deadline,1100000);advanceDay(s,1100000);assert.equal(s.phase,'death_skill');assert.equal(s.deadline,1110000);advanceDay(s,1110000);assert.equal(s.phase,'last_words');advanceDay(s,1200000);assert.equal(s.phase,'day_direction');
});
test('hunter privately requests skill; host records shot, new death resolves before returning to original queue',()=>{
 const s=game({knife:11});signup(s,[]);cmd(s,12,{action:'continue'});cmd(s,12,{action:'continue'});assert.equal(s.currentDeath,11);assert.equal(privateDay(s,11).canShoot,true);assert.throws(()=>cmd(s,12,{action:'shoot'}),/NOT_YOUR_TURN/);cmd(s,11,{action:'shoot'});assert.equal(s.phase,'hunter_target');assert.throws(()=>cmd(s,11,{action:'record_shot',target:1}),/HOST_ONLY/);cmd(s,12,{action:'record_shot',target:1});assert.equal(s.currentDeath,1);assert.equal(s.phase,'death_skill');advanceDay(s,1010000);assert.equal(s.currentDeath,1);cmd(s,12,{action:'end_speech'},true,1010000);assert.equal(s.currentDeath,11);assert.equal(s.phase,'last_words');assert.equal(s.deaths.filter(d=>d.seat===1).length,1);
});
test('last-god hunter death ends immediately, and simultaneous last-villager/last-wolf deaths prioritize wolves',()=>{
 const s=game({knife:11});s.players=s.players.filter(p=>p.role==='wolf'||p.role==='villager'||p.role==='hunter');cmd(s,11,{action:'start'},true);cmd(s,11,{action:'close_signup'},true);cmd(s,11,{action:'continue'},true);assert.equal(s.winner,'wolves');assert.equal(s.phase,'ended');assert.equal(privateDay(s,11).canShoot,false);
 const simultaneous=game({knife:5,poison:1});simultaneous.players=simultaneous.players.filter(p=>p.seat===1||p.seat===5||p.role==='seer');cmd(simultaneous,10,{action:'start'},true);cmd(simultaneous,10,{action:'close_signup'},true);cmd(simultaneous,10,{action:'continue'},true);assert.equal(simultaneous.winner,'wolves');assert.equal(simultaneous.tasks.length,0);
});
test('dead sheriff transfers badge only to a living player; host takeover needs explicit confirmation',()=>{
 const s=game({knife:2});signup(s,[2]);cmd(s,12,{action:'continue'});cmd(s,12,{action:'continue'});advanceDay(s,1010000);cmd(s,12,{action:'end_speech'},true,1010000);assert.equal(s.phase,'badge_transfer');assert.throws(()=>cmd(s,12,{action:'transfer_badge',target:5},true,1010000),/NOT_YOUR_TURN/);assert.throws(()=>cmd(s,2,{action:'transfer_badge',target:2},false,1010000),/INVALID_INPUT/);cmd(s,2,{action:'transfer_badge',target:5},false,1010000);assert.equal(s.sheriff,5);assert.equal(s.phase,'day_direction');assert.equal(s.deadline,null);
});
test('ordered speech is ninety seconds, host/speaker can finish, free speech host-only; sheriff has 1.5 exile votes',()=>{
 const s=game();toDaySpeech(s);assert.equal(s.deadline,1090000);assert.throws(()=>cmd(s,s.speaker===1?2:1,{action:'end_speech'},false),/NOT_YOUR_TURN/);cmd(s,s.speaker!,{action:'end_speech'},false);endSpeeches(s);assert.equal(s.vote!.purpose,'exile');s.sheriff=1;phoneVote(s,{1:2,3:1},'exile');assert.equal(s.result!.counts.find(p=>p.seat===2)!.votes,1.5);assert.deepEqual(s.result!.leaders,[2]);
 const free=game();signup(free,[]);cmd(free,12,{action:'continue'});cmd(free,12,{action:'continue'});cmd(free,12,{action:'speech_mode',mode:'free'});assert.equal(free.phase,'free_speech');assert.throws(()=>cmd(free,1,{action:'end_speech'},false),/NOT_YOUR_TURN/);cmd(free,12,{action:'end_speech'});assert.equal(free.phase,'vote_setup');
});
test('12-player idiot is revealed and dies when exiled; exile PK tie ends day with nobody exiled',()=>{
 const s=game();toDaySpeech(s);endSpeeches(s);phoneVote(s,Object.fromEntries(players.map(p=>[p.seat,12])),'exile');cmd(s,12,{action:'continue'});assert.equal(s.players[11].alive,false);assert.deepEqual(s.revealed,[{seat:12,role:'idiot'}]);assert.equal(s.phase,'death_skill');advanceDay(s,1010000);cmd(s,12,{action:'end_speech'},true,1010000);assert.equal(s.phase,'day_complete');
 const pk=game();toDaySpeech(pk);endSpeeches(pk);phoneVote(pk,{1:5,2:6},'exile');cmd(pk,12,{action:'continue'});endSpeeches(pk);assert.equal(pk.vote!.purpose,'exile_pk');phoneVote(pk,{1:5,2:6},'exile_pk');cmd(pk,12,{action:'continue'});assert.equal(pk.phase,'day_complete');assert.equal(pk.deaths.length,0);
});
test('offline vote entry requires host, ineligible or stale entries are rejected and results reveal only configured scope',()=>{
 const s=game();toDaySpeech(s);endSpeeches(s);cmd(s,12,{action:'start_vote',method:'offline',visibility:'individual',seconds:30});assert.throws(()=>cmd(s,1,{action:'offline_vote',voter:1,target:2},false),/HOST_ONLY/);cmd(s,12,{action:'offline_vote',voter:1,target:2});const before=s.turnId;cmd(s,12,{action:'close_vote'});assert.equal(s.result!.ballots!.length,12);assert.throws(()=>dayCommand(s,{seat:12,isHost:true},{action:'close_vote',turnId:before},1000000),/STALE_TURN/);
});

test('confirmed zero votes lose badge or end exile without a death',()=>{
 const s=game();signup(s,[1,2]);endSpeeches(s);cmd(s,12,{action:'close_withdraw'});phoneVote(s,{});cmd(s,12,{action:'continue'});assert.equal(s.badge,'lost');assert.equal(s.phase,'night_announcement');
 const exile=game();toDaySpeech(exile);endSpeeches(exile);phoneVote(exile,{},'exile');cmd(exile,12,{action:'continue'});assert.equal(exile.phase,'day_complete');assert.equal(exile.deaths.length,0);
});
test('police explosion consumes poison once, stays private, defers badge, has first-day words and no priority knife',()=>{
 const s=game({knife:5,poison:2});s.rules.explosionOrder='announce_resolve_words_night';signup(s,[1,2]);cmd(s,2,{action:'explode',confirmed:true});assert.equal(s.phase,'night_announcement');assert.equal(s.badge,'deferred');assert.deepEqual(s.announcement,[2,5]);assert.equal(s.deaths.filter(d=>d.seat===2).length,1);assert.equal(s.priorityWolf,null);assert.equal(s.tasks.filter(t=>t.seat===2&&t.step==='words').length,1);assert.equal(JSON.stringify(publicDay(s,1000000)).includes('poison'),false);assert.equal(JSON.stringify(publicDay(s,1000000)).includes('吞毒'),false);cmd(s,12,{action:'continue'});while(s.deadline!==null)advanceDay(s,s.deadline);assert.equal(s.phase,'day_complete');
});
test('ordinary explosion has unified skill query but no words; sheriff PK candidate explosion elects sole other candidate',()=>{
 const s=game();s.rules.explosionOrder='announce_resolve_words_night';signup(s,[1,2]);cmd(s,1,{action:'explode',confirmed:true});assert.equal(s.priorityWolf,1);assert.equal(s.tasks.some(t=>t.seat===1&&t.step==='skill'),true);assert.equal(s.tasks.some(t=>t.seat===1&&t.step==='words'),false);
 const pk=game();pk.rules.explosionOrder='announce_resolve_words_night';signup(pk,[1,2]);endSpeeches(pk);cmd(pk,12,{action:'close_withdraw'});phoneVote(pk,{3:1,4:2});cmd(pk,12,{action:'continue'});cmd(pk,1,{action:'explode',confirmed:true});assert.equal(pk.sheriff,2);assert.equal(pk.badge,'elected');assert.equal(pk.afterDeaths,'night');
});
test('PK explosion is speech-only: exile candidate blocked, outside wolf allowed, every wolf blocked during actual vote',()=>{
 const s=game();s.rules.explosionOrder='announce_resolve_words_night';toDaySpeech(s);endSpeeches(s);phoneVote(s,{1:1,2:2},'exile');cmd(s,12,{action:'continue'});assert.equal(s.phase,'day_speech');assert.equal(privateDay(s,1).canExplode,false);assert.throws(()=>cmd(s,1,{action:'explode',confirmed:true}),/NOT_YOUR_TURN/);assert.equal(privateDay(s,3).canExplode,true);cmd(s,3,{action:'explode',confirmed:true});assert.equal(s.phase,'night_announcement');
 const voting=game();voting.rules.explosionOrder='announce_resolve_words_night';signup(voting,[1,2]);endSpeeches(voting);cmd(voting,12,{action:'close_withdraw'});cmd(voting,12,{action:'start_vote',method:'phone',visibility:'totals',seconds:30});assert.equal(privateDay(voting,3).canExplode,false);assert.throws(()=>cmd(voting,3,{action:'explode',confirmed:true}),/NOT_YOUR_TURN/);
});

test('free speech starts immediately even with a sheriff and no direction; PK candidate may withdraw and the other wins',()=>{
 const s=game();signup(s,[5]);cmd(s,12,{action:'continue'});cmd(s,12,{action:'continue'});assert.equal(s.direction,null);cmd(s,12,{action:'speech_mode',mode:'free'});assert.equal(s.phase,'free_speech');
 const pk=game();signup(pk,[1,2]);endSpeeches(pk);cmd(pk,12,{action:'close_withdraw'});phoneVote(pk,{3:1,4:2});cmd(pk,12,{action:'continue'});assert.equal(privateDay(pk,1).canWithdraw,true);cmd(pk,1,{action:'withdraw'});assert.equal(pk.sheriff,2);assert.equal(pk.phase,'night_announcement');
});
