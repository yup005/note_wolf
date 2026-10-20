import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
import {createNight,beginNight,advanceNight,nightCommand,privateNight,publicNight,type NightPlayer,type NightState} from '../packages/domain/night.js';
import {createDay,dayCommand,advanceDay,publicDay,privateDay,type DayState} from '../packages/domain/day.js';

const roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','seer','hunter','idiot'] as const;
const allSeats=[1,2,3,4,5,6,7,8,9,10,11,12];
type Input<T=DayCommand>=T extends unknown?Omit<T,'turnId'>:never;
// Earlier-round deaths are fixture preconditions. The terminal night itself uses real commands and timers.
function completeNight(alive:number[],knife:number|null,poison:number|null,round=2){
 const roster:NightPlayer[]=roles.map((role,i)=>({seat:i+1,role,alive:alive.includes(i+1)}));
 const n=createNight(roster,0,{night:round,antidote:true,poison:true,hunterSpent:false,priorityWolf:null});
 beginNight(n,0,()=>0);
 if(knife!==null)nightCommand(n,n.confirmer!,{action:'vote',target:knife,turnId:n.turnId},100,()=>0);
 nightCommand(n,n.confirmer!,{action:'confirm_wolves',turnId:n.turnId},200,()=>0);
 advanceNight(n,5200,()=>0);assert.equal(n.phase,'witch');
 if(poison!==null)nightCommand(n,9,{action:'witch',choice:'poison',target:poison,turnId:n.turnId},5300,()=>0);
 advanceNight(n,1000000,()=>0);assert.equal(n.phase,'first_night_complete');return n;
}
function command(d:DayState,seat:number,input:Input,now=1000000){dayCommand(d,{seat,isHost:seat===12},{...input,turnId:d.turnId} as DayCommand,now,()=>0);}
function dawn(n:NightState){const d=createDay(n,firstDayRules,1000000);command(d,12,{action:'start'});return d;}
function nextNight(n:NightState,d:DayState){
 let now=1000000;
 for(let i=0;i<20&&d.phase!=='day_complete';i++){
  if(d.phase==='night_announcement')command(d,12,{action:'continue'},now);
  else{assert.notEqual(d.deadline,null);now=d.deadline!;advanceDay(d,now,()=>0);}
 }
 assert.equal(d.phase,'day_complete');
 const next=createNight(d.players,2000000,{night:2,antidote:n.antidote,poison:n.poison,hunterSpent:d.hunterSpent,priorityWolf:d.priorityWolf});
 beginNight(next,2000000,()=>0);return next;
}

// Catch death tasks or a shot being offered after the last god's death already ended the game.
test('last-god hunter dies in the actual night and cannot shoot after wolves win',()=>{
 const n=completeNight([1,2,3,4,5,6,7,8,11],11,null),d=dawn(n);
 assert.equal(n.hunterSpent,false);assert.equal(d.players.find(p=>p.seat===11)!.alive,true);
 assert.equal(d.phase,'night_announcement');assert.equal(d.winner,null);
 command(d,12,{action:'continue'});
 assert.equal(d.phase,'ended');assert.equal(d.winner,'wolves');assert.deepEqual(d.announcement,[11]);
 assert.equal(d.players.find(p=>p.seat===11)!.alive,false);assert.deepEqual(d.tasks,[]);
 assert.equal(privateDay(d,11).canShoot,false);
 assert.throws(()=>command(d,11,{action:'shoot'}),/PHASE_LOCKED/);
 assert.equal(d.events.some(e=>e.type==='hunter_target'||e.type==='shot'),false);
});

// Catch checking victory after the knife but before the same-night poison has also settled.
test('last-god witch and last wolf both die before the simultaneous wolf-priority verdict',()=>{
 const n=completeNight([1,5,6,7,8,9],9,1),d=dawn(n);
 assert.equal(n.poison,false);command(d,12,{action:'continue'});
 assert.equal(d.phase,'ended');assert.equal(d.winner,'wolves');assert.deepEqual(d.announcement,[1,9]);
 assert.equal(d.players.find(p=>p.seat===1)!.alive,false);assert.equal(d.players.find(p=>p.seat===9)!.alive,false);
 assert.deepEqual(d.tasks,[]);assert.match(d.reason!,/神职/);
});

test('last villager and last wolf both die before the simultaneous wolf-priority verdict',()=>{
 const n=completeNight([1,5,9,10,11,12],5,1),d=dawn(n);
 command(d,12,{action:'continue'});
 assert.equal(d.phase,'ended');assert.equal(d.winner,'wolves');assert.deepEqual(d.announcement,[1,5]);
 assert.equal(d.players.find(p=>p.seat===1)!.alive,false);assert.equal(d.players.find(p=>p.seat===5)!.alive,false);
 assert.equal(d.players.find(p=>p.seat===9)!.alive,true);assert.deepEqual(d.tasks,[]);assert.match(d.reason!,/村民/);
});

// Catch granting a swallowed-poison/last wolf a knife, or publishing private priority metadata.
test('only an ordinary exploded wolf with a living shared ally inherits private priority',()=>{
 const ordinary=completeNight(allSeats,null,null,1),d=dawn(ordinary);command(d,1,{action:'explode',confirmed:true});
 assert.equal(d.priorityWolf,1);assert.equal(d.winner,null);
 for(const key of ['priorityWolf','priorityTarget'])assert.equal(key in publicDay(d,1000000),false);
 const inherited=nextNight(ordinary,d);
 assert.equal(privateNight(inherited,1).priorityWolf,1);assert.equal(privateNight(inherited,2).priorityWolf,1);
 assert.throws(()=>nightCommand(inherited,2,{action:'confirm_wolves',turnId:inherited.turnId},2000001,()=>0),/PRIORITY_WOLF_ONLY/);
 nightCommand(inherited,1,{action:'vote',target:8,turnId:inherited.turnId},2000002,()=>0);
 assert.equal(privateNight(inherited,2).priorityTarget,8);
 for(const key of ['priorityWolf','priorityTarget','priorityCommitted'])assert.equal(key in publicNight(inherited,2000002),false);
 assert.deepEqual(privateNight(inherited,5),{turnId:inherited.turnId,kind:'waiting'});

 const swallowed=completeNight(allSeats,5,1,1),s=dawn(swallowed);
 assert.equal(privateDay(s,1).canExplode,true);command(s,1,{action:'explode',confirmed:true});assert.equal(s.priorityWolf,null);
 assert.deepEqual(s.announcement,[1,5]);assert.equal(s.deaths.filter(death=>death.seat===1).length,1);
 const afterSwallow=nextNight(swallowed,s);assert.equal(privateNight(afterSwallow,2).priorityWolf,null);
 assert.deepEqual(privateNight(afterSwallow,1),{turnId:afterSwallow.turnId,kind:'waiting'});
 assert.throws(()=>nightCommand(afterSwallow,1,{action:'priority_knife',target:8,turnId:afterSwallow.turnId},2000001,()=>0),/NOT_YOUR_TURN/);
 for(const key of ['priorityWolf','priorityTarget'])assert.equal(key in publicDay(s,2000000),false);

 const last=completeNight([1,5,6,7,8,9,10,11,12],null,null),l=dawn(last);
 command(l,12,{action:'continue'});command(l,12,{action:'continue'});command(l,12,{action:'speech_mode',mode:'free'});
 command(l,1,{action:'explode',confirmed:true});assert.equal(l.phase,'ended');assert.equal(l.winner,'good');assert.equal(l.priorityWolf,null);
 assert.deepEqual(l.tasks,[]);
});
