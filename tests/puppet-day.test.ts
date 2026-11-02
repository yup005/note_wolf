import test from 'node:test';
import assert from 'node:assert/strict';
import {beginNight,nightCommand} from '../packages/domain/night.js';
import {createDay,dayCommand,privateDay,selfDay} from '../packages/domain/day.js';
import {firstDayRules} from '../packages/contracts/day.js';
import {finalReplay} from '../packages/domain/replay.js';
import {manualDecision} from '../packages/domain/manual.js';
import {puppetFixture,move,roles} from './puppet-fixture.js';
function day(target:number,knife:number|null=null){const n=puppetFixture();beginNight(n,0,()=>0);move(n,'puppet');nightCommand(n,1,{action:'puppet_vote',target,turnId:n.turnId},n.deadline!-1);nightCommand(n,1,{action:'confirm_puppet',turnId:n.turnId},n.deadline!-1);if(knife!==null){move(n,'wolves');nightCommand(n,1,{action:'vote',target:knife,turnId:n.turnId},n.deadline!-1);nightCommand(n,1,{action:'confirm_wolves',turnId:n.turnId},n.deadline!-1);}move(n,'first_night_complete');const d=createDay(n,firstDayRules,1000000);return {n,d};}
test('controlled hunter death inquiry is generic 10 seconds and actual shot denied by server',()=>{
 const {n,d}=day(8,8);d.phase='night_announcement';dayCommand(d,{seat:12,isHost:true},{action:'continue',turnId:d.turnId},1000000,()=>0);dayCommand(d,{seat:12,isHost:true},{action:'continue',turnId:d.turnId},1000000,()=>0);assert.equal(d.phase,'death_skill');assert.equal(d.deadline,1010000);assert.equal(privateDay(d,8).canShoot,false);assert.throws(()=>dayCommand(d,{seat:8,isHost:false},{action:'shoot',turnId:d.turnId},1000001),/NOT_YOUR_TURN/);assert.equal(JSON.stringify(selfDay(d,n,8)).includes('puppet'),false);
});
test('daytime retains living puppet after original wolves die and removes converted god from edge',()=>{
 const {d}=day(2);d.phase='free_speech';d.players.filter(p=>[5,9].includes(p.seat)).forEach(p=>p.alive=false);dayCommand(d,{seat:1,isHost:false},{action:'explode',confirmed:true,turnId:d.turnId},1000000);assert.equal(d.winner,null);
 const {d:g}=day(2);g.phase='free_speech';g.players.filter(p=>[4,6,8].includes(p.seat)).forEach(p=>p.alive=false);dayCommand(g,{seat:1,isHost:false},{action:'explode',confirmed:true,turnId:g.turnId},1000000);assert.equal(g.winner,'wolves');
});
test('black wolf retains ordinary valid death shot; controlled hunter cannot explode',()=>{
 const {d}=day(8,9);d.phase='night_announcement';dayCommand(d,{seat:12,isHost:true},{action:'continue',turnId:d.turnId},1000000,()=>0);dayCommand(d,{seat:12,isHost:true},{action:'continue',turnId:d.turnId},1000000,()=>0);assert.equal(privateDay(d,9).canShoot,true);assert.equal(privateDay(d,8).canExplode,false);
});
test('final replay exposes original role, conversion timestamp, effective allegiance and verdict; strips runtime',()=>{
 const {n,d}=day(6);const replay=finalReplay({winner:'wolves',roles:d.players.map(p=>({seat:p.seat,role:p.role})),rounds:[{kind:'night',round:1,events:n.events,engine:n.engine}]});const text=JSON.stringify(replay);assert.match(text,/傀儡/);assert.match(text,/预言家/);assert.match(text,/狼人阵营/);assert.equal(replay.rounds[0].events.filter(e=>e.type==='puppet_selected').length,1);assert.equal(replay.rounds[0].engine,undefined);assert.equal(replay.roles.find(p=>p.seat===6)!.role,'seer');
});
test('manual victory uses retained conversion; unknown first-night conversion requires adjudication',()=>{
 const p=roles.map((role,i)=>({seat:i+1,role}));const facts=p.map(p=>({seat:p.seat,learnedRole:null,personalCamp:p.seat===2?'wolves' as const:undefined}));assert.deepEqual(manualDecision(p,[1,5,9],facts,{variant:'puppet'}),{outcome:null,requiresAdjudication:false});assert.deepEqual(manualDecision(p,[1,2,5,9],facts,{variant:'puppet'}),{outcome:'good',requiresAdjudication:false});assert.deepEqual(manualDecision(p,[1,5,9],[],{variant:'puppet'}),{outcome:null,requiresAdjudication:true});
});
