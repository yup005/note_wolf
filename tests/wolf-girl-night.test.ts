import test from 'node:test';
import assert from 'node:assert/strict';
import {beginNight,nightCommand,privateNight,publicNight,createNight,advanceNight} from '../packages/domain/night.js';
import {validateConfirmedEngineState} from '../packages/domain/mechanicalEngine.js';
import {girlFixture,move} from './wolf-girl-fixture.js';

test('first night recognizes wolves without knife and confession is private and durable',()=>{
 const s=girlFixture();beginNight(s,0,()=>0);assert.equal(s.phase,'guard');move(s,'confession');
 assert.equal(privateNight(s,4).kind,'confession');assert.deepEqual(privateNight(s,4).wolves,[1,2,3,4]);for(const seat of [1,2,3,5,6,7,8,9,10,11,12]){assert.equal(privateNight(s,seat).kind,'waiting');assert.equal(privateNight(s,seat).wolves,undefined);assert.equal(privateNight(s,seat).legalTargets,undefined);}assert.deepEqual(privateNight(s,4).legalTargets,[5,6,7,8,9,10,11,12]);
 assert.throws(()=>nightCommand(s,4,{action:'confess',turnId:s.turnId,target:1},s.deadline!-1),/INVALID_TARGET/);
 const c={action:'confess',turnId:s.turnId,target:5} as const;nightCommand(s,4,c,s.deadline!-1);nightCommand(s,4,c,s.deadline!-1);
 assert.equal(privateNight(s,4).confession?.accepted,undefined);move(s,'wolves');
 assert.equal(privateNight(s,1).recognitionOnly,true);assert.equal(privateNight(s,1).confession,undefined);
 assert.throws(()=>nightCommand(s,1,{action:'vote',turnId:s.turnId,target:6},s.deadline!-1),/FIRST_NIGHT_NO_KNIFE/);
 move(s,'confession_notice');assert.deepEqual(privateNight(s,5).confession,{accepted:true,girl:4});
 assert.equal(privateNight(s,6).kind,'waiting');assert.equal(JSON.stringify(publicNight(s,0)).includes('target'),false);
 move(s,'first_night_complete');assert.equal(s.knife,null);assert.equal(s.engine!.confession!.target,5);
 const restored=validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine)));assert.equal(restored.confession!.target,5);
 const next=createNight(s.players,1000000,{night:2,antidote:false,poison:true,hunterSpent:false,priorityWolf:null,engine:restored},restored.board);
 beginNight(next,1000000,()=>0);move(next,'wolves');assert.equal(privateNight(next,1).recognitionOnly,false);
 nightCommand(next,1,{action:'vote',turnId:next.turnId,target:6},next.deadline!-1);nightCommand(next,1,{action:'confirm_wolves',turnId:next.turnId},next.deadline!-1);
 move(next,'first_night_complete');assert.equal(next.engine!.players.find(p=>p.seat===6)!.alive,false);assert.equal(next.engine!.confession!.target,5);
});
test('timeout randomly selects a nonwolf once; refused god never learns girl; seer sees civilian as good',()=>{
 const s=girlFixture();beginNight(s,0,()=>0);move(s,'confession');const end=s.deadline!;
 advanceNight(s,end,()=>4);assert.equal(s.engine!.confession!.target,9);advanceNight(s,end,()=>0);assert.equal(s.engine!.confession!.target,9);
 move(s,'confession_notice');assert.deepEqual(privateNight(s,9).confession,{accepted:false});assert.equal(privateNight(s,4).confession,undefined);
 const t=girlFixture();beginNight(t,0,()=>0);move(t,'confession');nightCommand(t,4,{action:'confess',turnId:t.turnId,target:5},t.deadline!-1);move(t,'seer');nightCommand(t,9,{action:'seer',turnId:t.turnId,target:5},t.deadline!-1);assert.equal(privateNight(t,9).result,'good');
});
test('poisoner self-poisons first night with no antidote or knife; guard does not stop poison; hunter poison prevents shot',()=>{
 const s=girlFixture();beginNight(s,0,()=>0);nightCommand(s,12,{action:'ability',choice:'guard',target:10,turnId:s.turnId},1);move(s,'poisoner');
 const card=privateNight(s,10);assert.equal(card.knife,undefined);assert.equal(card.antidote,undefined);assert.equal(card.poison,true);
 nightCommand(s,10,{action:'poisoner',target:10,turnId:s.turnId},s.deadline!-1);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===10)!.alive,false);
 const h=girlFixture();beginNight(h,0,()=>0);move(h,'poisoner');nightCommand(h,10,{action:'poisoner',target:11,turnId:h.turnId},h.deadline!-1);move(h,'hunter');assert.equal(privateNight(h,11).canShoot,false);
});

test('judge supplementation cannot invent a random confession while advancing an unrecorded phase',async()=>{
 const {supplementRuntime}=await import('../packages/domain/judge.js');const {firstDayRules}=await import('../packages/contracts/day.js');
 const n=girlFixture();beginNight(n,0,()=>0);move(n,'confession');const runtime={clock:n.deadline!-1,kind:'night' as const,night:n,day:null,history:[]};
 assert.throws(()=>supplementRuntime(runtime,{kind:'advance'},n.engine!.board,firstDayRules,1),/JUDGE_CONFESSION_REQUIRED/);assert.equal(n.engine!.confession,undefined);
});

test('seer receipt and notice acknowledgement survive response loss across the stage boundary',()=>{
 const s=girlFixture();beginNight(s,0,()=>0);move(s,'seer');nightCommand(s,9,{action:'seer',turnId:s.turnId,target:4},s.deadline!-1);const finish={action:'seer_finish',turnId:s.turnId} as const;nightCommand(s,9,finish,s.deadline!-1);assert.deepEqual(privateNight(s,9).skillReceipt,{role:'seer',target:4,result:'wolf'});
 move(s,'confession_notice');const target=s.engine!.confession!.target;const ack={action:'confession_seen',turnId:s.turnId} as const;nightCommand(s,target,ack,s.deadline!-1);move(s,'first_night_complete');assert.doesNotThrow(()=>nightCommand(s,target,ack,1000000));
});
test('judge can record empty guard and conflicting ability retries are rejected',()=>{
 const s=girlFixture();beginNight(s,0,()=>0);const command={action:'ability',choice:'skip',target:null,turnId:s.turnId} as const;nightCommand(s,12,command,1);assert.equal(s.engine!.actions.find(a=>a.abilityType==='guard')!.targetId,null);assert.throws(()=>nightCommand(s,12,{...command,choice:'poison'},2),/ALREADY_COMMITTED/);
});
