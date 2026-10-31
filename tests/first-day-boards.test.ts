import test from 'node:test';
import assert from 'node:assert/strict';
import {createNight,beginNight,nightCommand,advanceNight,type NightState} from '../packages/domain/night.js';
import {createDay,dayCommand,advanceDay,privateDay,type DayState} from '../packages/domain/day.js';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import type {Role} from '../packages/contracts/index.js';

type Command<T> = T extends unknown?Omit<T,'turnId'>:never;
const presets=['standard-12','mechanical-12','mechanical-armor-12','wolf-girl-12'] as const;
function move(n:NightState,target:NightState['phase']){
 for(let i=0;i<50&&n.phase!==target;i++){
  assert.notEqual(n.deadline,null,`expected ${target}, current ${n.phase}`);
  advanceNight(n,n.deadline!,()=>0);
 }
 assert.equal(n.phase,target);
}
function dawn(id:typeof presets[number]){
 const config=boardPreset(id);
 const board:RoomBoardSnapshot={id,name:id,ruleVersion:boardRuleVersion,composition:{seatCount:config.seatCount,roleCounts:config.roles,ruleset:config.ruleset,playable:true}};
 const roles=Object.entries(config.roles).flatMap(([role,count])=>Array<Role>(count).fill(role as Role));
 const roster=roles.map((role,i)=>({seat:i+1,role}));
 const n=createNight(roster,0,undefined,board);beginNight(n,0,()=>0);
 const wolf=roster.find(p=>p.role==='wolf')!.seat;
 const villagers=roster.filter(p=>p.role==='villager').map(p=>p.seat);
 const girl=roster.find(p=>p.role==='wolfGirl')?.seat;
 const poisoned=girl??wolf;
 if(girl){
  move(n,'confession');nightCommand(n,girl,{action:'confess',target:villagers[0],turnId:n.turnId},n.deadline!-1,()=>0);
  move(n,'poisoner');nightCommand(n,roster.find(p=>p.role==='poisoner')!.seat,{action:'poisoner',target:poisoned,turnId:n.turnId},n.deadline!-1,()=>0);
 }else{
  move(n,'wolves');nightCommand(n,wolf,{action:'vote',target:villagers[0],turnId:n.turnId},n.deadline!-1,()=>0);
  nightCommand(n,n.confirmer!,{action:'confirm_wolves',turnId:n.turnId},n.deadline!-1,()=>0);
  move(n,'witch');nightCommand(n,roster.find(p=>p.role==='witch')!.seat,{action:'witch',choice:'poison',target:poisoned,turnId:n.turnId},n.deadline!-1,()=>0);
 }
 move(n,'first_night_complete');
 return {n,roster,villagers,girl,poisoned,host:roster.at(-1)!.seat};
}
function command(d:DayState,seat:number,c:Command<DayCommand>,host:number,now=1000000){
 dayCommand(d,{seat,isHost:seat===host},{...c,turnId:d.turnId},now,()=>0);
}

for(const id of presets){
 test(`${id}: pending first-night victims can run and vote before announcement, then resolve badge, words and exile`,()=>{
  const f=dawn(id),d=createDay(f.n,firstDayRules,1000000);
  let now=1000000;
  const cmd=(seat:number,c:Command<DayCommand>)=>command(d,seat,c,f.host,now);
  const expire=()=>{assert.notEqual(d.deadline,null);now=d.deadline!;advanceDay(d,now,()=>0);};
  const currentPhase=()=>d.phase;
  const candidate=f.poisoned,other=f.villagers[1];
  cmd(f.host,{action:'start'});assert.equal(currentPhase(),'sheriff_signup');
  for(const p of f.roster){assert.equal(privateDay(d,p.seat).canSignup,true);cmd(p.seat,{action:'signup',join:[candidate,other].includes(p.seat)});}
  cmd(f.host,{action:'close_signup'});
  while(d.phase==='sheriff_speech')cmd(f.host,{action:'end_speech'});
  cmd(f.host,{action:'close_withdraw'});cmd(f.host,{action:'start_vote',method:'phone',visibility:'individual',seconds:30});
  for(const seat of d.vote!.eligible){assert.equal(privateDay(d,seat).canVote,true);cmd(seat,{action:'vote',target:candidate});}
  cmd(f.host,{action:'continue'});assert.equal(d.sheriff,candidate);assert.equal(d.announcement,null);
  assert.equal(d.players.find(p=>p.seat===candidate)!.alive,true);
  cmd(f.host,{action:'continue'});assert.equal(d.players.find(p=>p.seat===candidate)!.alive,false);
  assert.equal(d.deaths.filter(p=>p.seat===candidate).length,1);
  cmd(f.host,{action:'continue'});
  while(['death_skill','last_words','badge_transfer'].includes(d.phase)){
   if(d.phase==='badge_transfer')cmd(candidate,{action:'transfer_badge',target:other});
   else expire();
  }
  assert.ok(d.events.some(e=>e.type==='last_words'&&e.seat===candidate));
  assert.equal(d.sheriff,other);assert.equal(d.phase,'day_direction');
  cmd(f.host,{action:'speech_mode',mode:'free'});cmd(f.host,{action:'end_speech'});
  cmd(f.host,{action:'start_vote',method:'offline',visibility:'totals',seconds:30});
  const exile=d.players.find(p=>p.alive&&p.role==='wolf')!.seat;
  cmd(f.host,{action:'offline_results',counts:d.vote!.candidates.map(seat=>({seat,votes:seat===exile?1:0}))});cmd(f.host,{action:'continue'});
  while(['death_skill','last_words'].includes(d.phase))expire();
  assert.equal(d.players.find(p=>p.seat===exile)!.alive,false);assert.equal(d.phase,'day_complete');
 });
 test(`${id}: first-day sheriff explosion swallows poison once, denies priority knife and applies the correct words rule`,()=>{
  const f=dawn(id),d=createDay(f.n,firstDayRules,1000000);
  command(d,f.host,{action:'start'},f.host);
  command(d,f.poisoned,{action:'explode',confirmed:true},f.host);
  assert.equal(d.priorityWolf,null);assert.equal(d.deaths.filter(p=>p.seat===f.poisoned).length,1);
  assert.equal(d.deaths.find(p=>p.seat===f.poisoned)!.reason,'explosion');
  assert.equal(d.tasks.some(t=>t.seat===f.poisoned&&t.step==='words'),!f.girl);
  assert.deepEqual(d.announcement,[...new Set(d.announcement)].sort((a,b)=>a-b));
  assert.deepEqual(d.pendingDeaths,[]);assert.equal(d.badge,'deferred');assert.equal(d.afterDeaths,'night');
  if(f.girl){assert.equal(d.deaths.find(p=>p.seat===f.villagers[0])!.reason,'girl-retaliation');assert.equal(d.tasks.some(t=>t.seat===f.villagers[0]),false);}
 });
}
