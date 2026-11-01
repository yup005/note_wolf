import test from 'node:test';
import assert from 'node:assert/strict';
import {createDay,dayCommand,selfDay} from '../packages/domain/day.js';
import {firstDayRules} from '../packages/contracts/day.js';
import {fixture,move} from './treasure-fixture.js';
import {beginNight} from '../packages/domain/night.js';
import {settleTreasure} from '../packages/domain/treasureNight.js';
const seat=(s:ReturnType<typeof fixture>,r:string)=>s.players.find(p=>p.role===r)!.seat;
test('last god masked knife death ends before election or delayed speech',()=>{
 const n=fixture();beginNight(n,0,()=>0);move(n,'first_night_complete');
 const mask=seat(n,'masked');n.players.forEach(p=>{if(['hunter','poisoner','dreamer','spiritSeer'].includes(p.role))p.alive=false;});n.knife=mask;settleTreasure(n);
 const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},2);
 assert.equal(d.winner,'wolves');assert.equal(d.phase,'ended');assert.equal(d.players.find(p=>p.seat===mask)!.alive,false);
});
test('nonlast masked death stays out of announcement then dies at end of own day speech',()=>{
 const n=fixture();beginNight(n,0,()=>0);move(n,'first_night_complete');const mask=seat(n,'masked');n.knife=mask;settleTreasure(n);
 const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},2);
 assert.equal(d.players.find(p=>p.seat===mask)!.alive,true);assert.equal(d.pendingDeaths.some(p=>p.seat===mask),false);
 d.phase='day_speech';d.speaker=mask;d.speakers=[1,2];dayCommand(d,{seat:mask,isHost:false},{action:'end_speech',turnId:d.turnId},3);
 assert.equal(d.players.find(p=>p.seat===mask)!.alive,false);assert.ok(d.deaths.some(p=>p.seat===mask));
});
test('good treasure counted as god and self view never defaults to standard role inventory',()=>{
 const n=fixture('random');beginNight(n,0,()=>0);move(n,'first_night_complete');const t=seat(n,'treasureMaster');const d=createDay(n,firstDayRules,1);
 const own=selfDay(d,n,t);assert.equal(own.treasureCamp,'good');assert.equal(own.role,'treasureMaster');assert.equal(own.treasureCard,n.treasure!.selected);
});
test('last wolf borrowed mask exemption is once per game; second qualifying exile kills',()=>{
 for(const used of [false,true]){
  const n=fixture('fixed-wolf',4);beginNight(n,0,()=>0);move(n,'first_night_complete');n.treasure!.selected='masked';n.treasure!.exemptionUsed=used;for(const p of n.players)if(p.role==='wolf'||p.role==='blackWolf')p.alive=false;
  const t=seat(n,'treasureMaster'),d=createDay(n,firstDayRules,1);d.phase='vote_result';d.result={purpose:'exile',leaders:[t],counts:[{seat:t,votes:5}]};
  dayCommand(d,{seat:1,isHost:true},{action:'continue',turnId:d.turnId},2);
  assert.equal(d.players.find(p=>p.seat===t)!.alive,!used);assert.equal(d.phase,used?'ended':'day_complete');assert.equal(d.winner,used?'good':null);
 }
});
test('delayed masked last wolf lives until speech rather than ending good at dawn',()=>{
 const n=fixture('fixed-wolf',4);beginNight(n,0,()=>0);move(n,'first_night_complete');const t=seat(n,'treasureMaster');n.treasure!.selected='masked';for(const p of n.players)if(p.role==='wolf'||p.role==='blackWolf')p.alive=false;n.knife=t;settleTreasure(n);assert.equal(n.treasure!.deaths.find(d=>d.seat===t)!.delayed,true);
 const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},2);assert.equal(d.winner,null);assert.equal(d.players.find(p=>p.seat===t)!.alive,true);
 d.phase='day_speech';d.speaker=t;d.speakers=[];dayCommand(d,{seat:t,isHost:false},{action:'end_speech',turnId:d.turnId},3);assert.equal(d.winner,'good');
});
test('masked campaign speaker withdrawal resolves death before electing other finalist',()=>{
 const n=fixture();beginNight(n,0,()=>0);move(n,'first_night_complete');const m=seat(n,'masked'),v=seat(n,'villager');n.knife=m;settleTreasure(n);const d=createDay(n,firstDayRules,1);d.phase='sheriff_speech';d.speaker=m;d.candidates=[m,v];d.originalCandidates=[m,v];d.speakers=[v];
 dayCommand(d,{seat:m,isHost:false},{action:'withdraw',turnId:d.turnId},2);assert.equal(d.players.find(p=>p.seat===m)!.alive,false);assert.equal(d.sheriff,v);
});
test('explosion cannot silently discard a pending masked death',()=>{
 const n=fixture();beginNight(n,0,()=>0);move(n,'first_night_complete');const m=seat(n,'masked'),w=seat(n,'wolf');n.knife=m;settleTreasure(n);const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},2);
 assert.throws(()=>dayCommand(d,{seat:w,isHost:false},{action:'explode',confirmed:true,turnId:d.turnId},3),/RULE_DECISION_REQUIRED/);assert.ok(d.delayedDeaths?.some(p=>p.seat===m));assert.equal(d.players.find(p=>p.seat===w)!.alive,true);
});
test('last masked god poison and dream deaths also bypass delayed speech',()=>{
 for(const [pick,cause] of [[1,'poison'],[3,'dream']] as const){
  const n=fixture('fixed-wolf',pick);beginNight(n,0,()=>0);move(n,'first_night_complete');const m=seat(n,'masked'),t=seat(n,'treasureMaster');for(const p of n.players)if(['hunter','poisoner','dreamer','spiritSeer'].includes(p.role))p.alive=false;
  if(cause==='poison'){n.treasure!.selected='poisoner';n.treasure!.poisons=[{caster:t,target:m}];}else{n.treasure!.selected='dreamer';n.treasure!.dreams=[{caster:t,target:m,repeat:true}];}
  settleTreasure(n);assert.equal(n.treasure!.deaths.find(d=>d.seat===m)!.delayed,false);const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},2);assert.equal(d.winner,'wolves');assert.equal(d.phase,'ended');
 }
});
