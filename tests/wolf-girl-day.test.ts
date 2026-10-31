import test from 'node:test';
import assert from 'node:assert/strict';
import {beginNight,nightCommand,createNight,privateNight} from '../packages/domain/night.js';
import {createDay,dayCommand,privateDay,advanceDay,publicDay,type DayState} from '../packages/domain/day.js';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
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

type Command<T> = T extends unknown?Omit<T,'turnId'>:never;
function command(d:DayState,seat:number,c:Command<DayCommand>,now=1000000){dayCommand(d,{seat,isHost:seat===12},{...c,turnId:d.turnId},now,()=>0);}
function firstNightPk(candidates:number[],poison:number|null=null){
 const n=girlFixture();beginNight(n,0,()=>0);move(n,'confession');nightCommand(n,4,{action:'confess',turnId:n.turnId,target:5},n.deadline!-1);
 if(poison!==null){move(n,'poisoner');nightCommand(n,10,{action:'poisoner',turnId:n.turnId,target:poison},n.deadline!-1);}
 move(n,'first_night_complete');const d=createDay(n,firstDayRules,1000000);
 command(d,12,{action:'start'});for(const p of d.players)command(d,p.seat,{action:'signup',join:candidates.includes(p.seat)});
 command(d,12,{action:'close_signup'});while(d.phase==='sheriff_speech')command(d,12,{action:'end_speech'});
 command(d,12,{action:'close_withdraw'});command(d,12,{action:'start_vote',method:'offline',visibility:'totals',seconds:30});
 command(d,12,{action:'offline_results',counts:candidates.map(seat=>({seat,votes:1}))});command(d,12,{action:'continue'});
 assert.equal(d.phase,'sheriff_speech');assert.equal(d.vote!.purpose,'sheriff_pk');return {n,d};
}
test('first-day girl PK retaliation removes both dead finalists without electing the target',()=>{
 const {d}=firstNightPk([4,5]);command(d,4,{action:'explode',confirmed:true});
 assert.equal(d.winner,null);assert.equal(d.sheriff,null);assert.equal(d.events.some(e=>e.type==='sheriff_elected'),false);
 assert.deepEqual(publicDay(d,1000000).candidates,[]);assert.equal(d.tasks.some(t=>t.step==='badge'),false);
});
test('first-day girl PK elects the sole living finalist only after the full death batch',()=>{
 const {d}=firstNightPk([4,5,6]);command(d,4,{action:'explode',confirmed:true});
 assert.deepEqual(d.candidates,[6]);assert.equal(d.sheriff,6);assert.equal(d.badge,'elected');
 const elected=d.events.findIndex(e=>e.type==='sheriff_elected');
 assert.ok(elected>d.events.findIndex(e=>e.type==='death_girl-retaliation'));
 assert.equal(d.events.filter(e=>e.type==='sheriff_elected').length,1);
});
test('deferred girl PK settles retaliation and pending night death before victory without a new sheriff',()=>{
 const {n,d:first}=firstNightPk([4,5],2);command(first,1,{action:'explode',confirmed:true});command(first,12,{action:'continue'});
 while(first.deadline!==null)advanceDay(first,first.deadline,()=>0);
 assert.equal(first.phase,'day_complete');assert.equal(first.badge,'deferred');
 const next=createNight(first.players,2000000,{night:2,antidote:false,poison:n.poison,hunterSpent:first.hunterSpent,priorityWolf:first.priorityWolf,engine:first.engine},first.engine!.board);
 beginNight(next,2000000,()=>0);move(next,'wolves');nightCommand(next,1,{action:'priority_knife',turnId:next.turnId,target:3},next.deadline!-1);move(next,'first_night_complete');
 const d=createDay(next,firstDayRules,3000000,first);command(d,12,{action:'start'},3000000);
 assert.equal(d.phase,'sheriff_withdraw');assert.deepEqual(d.candidates,[4,5]);command(d,4,{action:'explode',confirmed:true},3000000);
 assert.equal(d.winner,'good');assert.equal(d.phase,'ended');assert.equal(d.sheriff,null);
 assert.equal(d.events.some(e=>e.type==='sheriff_elected'),false);assert.equal(d.tasks.length,0);
 assert.deepEqual(d.events.filter(e=>e.type.startsWith('death_')).map(e=>e.seat),[4,5,3]);
});
