import test from 'node:test';
import assert from 'node:assert/strict';
import {beginNight,nightCommand,createNight,privateNight} from '../packages/domain/night.js';
import {createDay,dayCommand,privateDay} from '../packages/domain/day.js';
import {firstDayRules} from '../packages/contracts/day.js';
import {girlFixture,move} from './wolf-girl-fixture.js';
function day(target=11){const n=girlFixture();beginNight(n,0,()=>0);move(n,'confession');nightCommand(n,4,{action:'confess',turnId:n.turnId,target},n.deadline!-1);move(n,'first_night_complete');const d=createDay(n,firstDayRules,1000000);d.phase='free_speech';d.announcement=[];d.speechMode='free';return {n,d};}
test('girl retaliation takes refused hunter without shot or last words, completed batch precedes victory',()=>{
 const {d}=day();assert.equal(privateDay(d,4).canExplode,true);dayCommand(d,{seat:4,isHost:false},{action:'explode',turnId:d.turnId,confirmed:true},1000001);
 assert.equal(d.players.find(p=>p.seat===11)!.alive,false);assert.equal(d.deaths.find(p=>p.seat===11)!.reason,'girl-retaliation');assert.equal(d.tasks.some(t=>t.seat===11&&t.step!=='badge'),false);assert.equal(d.tasks.some(t=>t.seat===4&&t.step==='words'),false);
 assert.equal(d.priorityWolf,4);assert.equal(d.winner,null);
});
test('girl post-vote explosion cancels exile; ordinary wolf cannot; dead target still allows girl explosion',()=>{
 const {d}=day(5);d.phase='vote_result';d.voteStarted=true;d.result={purpose:'exile',counts:[{seat:6,votes:9}],leaders:[6]};
 assert.equal(privateDay(d,1).canExplode,false);assert.equal(privateDay(d,4).canExplode,true);
 d.players.find(p=>p.seat===5)!.alive=false;
 dayCommand(d,{seat:4,isHost:false},{action:'explode',turnId:d.turnId,confirmed:true},1000001);
 assert.equal(d.players.find(p=>p.seat===6)!.alive,true);assert.equal(d.events.some(e=>e.type==='vote_cancelled'),true);assert.equal(d.result,null);
});
test('last girl and retaliation settle before good victory and converted civilian loses',()=>{
 const {d}=day(5);for(const p of d.players)if([1,2,3,6,7,8].includes(p.seat))p.alive=false;
 dayCommand(d,{seat:4,isHost:false},{action:'explode',turnId:d.turnId,confirmed:true},1000001);
 assert.equal(d.players.find(p=>p.seat===5)!.alive,false);assert.equal(d.winner,'good');assert.equal(d.engine!.victory.status,'ended');if(d.engine!.victory.status==='ended')assert.equal(d.engine!.victory.personalResults!.find(p=>p.seat===5)!.won,false);
});
test('girl priority knife is private next night only and cannot give converted villager knife',()=>{
 const {n,d}=day(5);dayCommand(d,{seat:4,isHost:false},{action:'explode',turnId:d.turnId,confirmed:true},1000001);
 const next=createNight(d.players,2000000,{night:2,antidote:false,poison:n.poison,hunterSpent:false,priorityWolf:d.priorityWolf,engine:d.engine},d.engine!.board);
 beginNight(next,2000000,()=>0);move(next,'wolves');assert.equal(privateNight(next,4).kind,'wolves');assert.equal(privateNight(next,5).kind,'waiting');
 nightCommand(next,4,{action:'priority_knife',turnId:next.turnId,target:6},next.deadline!-1);assert.equal(next.knife,6);
});
