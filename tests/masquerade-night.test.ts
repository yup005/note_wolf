import test from 'node:test';
import assert from 'node:assert/strict';
import {createNight,advanceNight,nightCommand,privateNight,publicNight} from '../packages/domain/night.js';
import {validateConfirmedEngineState} from '../packages/domain/mechanicalEngine.js';
import {fixture,start,move,dance,mask,command} from './masquerade-fixture.js';

test('fixed first/subsequent schedule and shared mask deadline; true seer camp unchanged',()=>{
 const first=start(fixture(1));assert.equal(first.phase,'wolves');move(first,'witch');assert.equal(first.deadline!-first.events.at(-1)!.at,60000);move(first,'seer');move(first,'first_night_complete');
 const s=start(fixture());assert.equal(s.phase,'dancer');assert.equal(s.deadline,60000);dance(s,[5,6,1]);move(s,'mask');const end=s.deadline!;
 mask(s,'inspect',5);assert.equal(s.deadline,end);assert.equal(privateNight(s,4).masquerade!.inspection!.inPool,true);mask(s,'mask',5);move(s,'seer');command(s,9,{action:'seer',target:5});assert.equal(privateNight(s,9).result,'good');move(s,'first_night_complete');
 assert.deepEqual(s.engine!.resolution!.status==='settled'&&s.engine!.resolution!.deaths.map(d=>d.seat),[6]);assert.equal(s.engine!.players.find(p=>p.seat===5)!.camp,'good');assert.doesNotThrow(()=>validateConfirmedEngineState(s.engine));
});
test('dancer timeout fills partial draft once and private receipts disclose full pool only to actor',()=>{
 const s=start(fixture());command(s,12,{action:'dance_draft',targets:[5],expectedRevision:0});advanceNight(s,s.deadline!,()=>0);const pool=privateNight(s,12).masquerade!.pool!;assert.equal(pool.length,3);assert(pool.includes(5));const stored=JSON.stringify(s);advanceNight(s,60000,()=>1);assert.equal(JSON.stringify(s),stored);
 for(const seat of [1,4,6,9])assert.equal(privateNight(s,seat).masquerade,undefined);assert.equal(JSON.stringify(publicNight(s,60000)).includes('pool'),false);
});
test('repeat dancer confirmation or timeout draft penalizes only dancer and cancels pool without consuming others',()=>{
 for(const confirmed of [true,false]){const s=start(fixture());s.engine!.masquerade!.danced.push({night:1,actor:12,target:5,id:'previous',source:'manual'});
 const c={action:confirmed?'dance_confirm':'dance_draft',targets:[5,6,7],expectedRevision:0};command(s,12,c);if(!confirmed)advanceNight(s,s.deadline!,()=>0);
 assert.deepEqual(s.engine!.masquerade!.pool,[]);assert.equal(s.engine!.masquerade!.danced.length,1);assert.equal(s.engine!.masquerade!.penalties[0].seat,12);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===12)!.alive,false);}
});
test('49A mask repeat drafts penalize at deadline; valid changed/cleared drafts use legal pool and shared history stays independent',()=>{
 for(const step of ['inspect','mask'] as const){const s=start(fixture());dance(s,[5,6,1]);move(s,'mask');s.engine!.masquerade![step==='inspect'?'inspected':'masked'].push({night:1,actor:4,target:5,id:'old',source:'manual'});if(step==='mask')mask(s,'inspect',6);
 command(s,4,{action:'mask_draft',step,target:5,expectedRevision:s.masquerade!.maskRevision});advanceNight(s,s.deadline!,()=>0);
 assert.equal(s.engine!.masquerade!.penalties[0].seat,4);assert.equal(s.engine!.masquerade!.mask,null);assert.throws(()=>mask(s,'mask',7));}
 const s=start(fixture());dance(s,[5,6,1]);move(s,'mask');s.engine!.masquerade!.inspected.push({night:1,actor:4,target:5,id:'old',source:'manual'});
 command(s,4,{action:'mask_draft',step:'inspect',target:5,expectedRevision:0});command(s,4,{action:'mask_draft',step:'inspect',target:6,expectedRevision:1});advanceNight(s,s.deadline!,()=>0);assert.equal(s.engine!.masquerade!.penalties.length,0);assert.equal(privateNight(s,4).masquerade!.inspection!.target,6);
});
test('mask saved drafts beat random, requests/revisions are idempotent, receipts persist only within night',()=>{
 const s=start(fixture());dance(s,[5,6,1]);move(s,'mask');const request=command(s,4,{action:'mask_draft',step:'inspect',target:7,expectedRevision:0});nightCommand(s,4,request as never,s.deadline!-1,()=>0);assert.equal(s.masquerade!.maskRevision,1);
 assert.throws(()=>command(s,4,{action:'mask_draft',step:'inspect',target:8,expectedRevision:0}),/STALE_DRAFT/);
 advanceNight(s,s.deadline!,()=>0);assert.equal(privateNight(s,4).masquerade!.inspection!.target,7);assert.equal(privateNight(s,4).masquerade!.inspection!.inPool,false);
 const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(privateNight(restored,4),privateNight(s,4));move(s,'first_night_complete');assert.equal(privateNight(s,4).masquerade,undefined);
});
test('valid dancer pool protects all three from either knife; poison immunity consumes potion; dance still kills minority',()=>{
 const s=start(fixture());dance(s,[12,5,1]);move(s,'mask');mask(s,'inspect',7);mask(s,'mask',8);move(s,'wolves');command(s,1,{action:'vote',target:5});command(s,1,{action:'confirm_wolves'});move(s,'witch');command(s,10,{action:'witch',choice:'poison',target:12});move(s,'first_night_complete');
 assert.equal(s.poison,false);assert.deepEqual(s.engine!.resolution!.status==='settled'&&s.engine!.resolution!.deaths.map(d=>d.seat),[1]);
 const poison=s.engine!.resolution!.status==='settled'&&s.engine!.resolution!.effects.find(e=>e.abilityType==='poison');assert.equal(poison&&poison.outcome,'prevented');
});
test('dancer knife death does not cancel legal pool; knife and dance deaths deduplicate; antidote cannot save dance',()=>{
 for(const save of [false,true]){const s=start(fixture());dance(s,[5,6,1]);move(s,'mask');mask(s,'inspect',7);mask(s,'mask',8);move(s,'wolves');command(s,1,{action:'vote',target:1});command(s,1,{action:'confirm_wolves'});move(s,'witch');if(save)command(s,10,{action:'witch',choice:'save',target:1});move(s,'first_night_complete');const r=s.engine!.resolution!;assert.equal(r.status,'settled');if(r.status==='settled'){assert.equal(r.deaths.length,1);assert.equal(r.deaths[0].sourceEffectIds.length,save?1:2);}}
});
test('inherited mask knife uses night-entry authority, self/empty allowed, unconfirmed timeout empty, penalty disables it',()=>{
 const first=fixture(1);for(const p of first.players)if(p.role==='wolf')p.alive=false;for(const p of first.engine!.players)if(p.role==='wolf'){p.alive=false;p.publicState.canVote=false;}
 const s=createNight(first.players,0,{night:2,engine:first.engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:null},first.engine!.board);start(s);dance(s,[5,6,7]);move(s,'mask');mask(s,'inspect',8);mask(s,'mask',9);move(s,'wolves');assert.equal(privateNight(s,4).inheritedKnife,true);command(s,4,{action:'vote',target:4});advanceNight(s,s.deadline!,()=>0);assert.equal(s.knife,null);
});
test('only ordinary wolves recognize each other; insufficient unused dancers skip, no illegal system target',()=>{
 const s=start(fixture());s.engine!.masquerade!.danced=s.players.slice(0,10).map(p=>({night:1,actor:12,target:p.seat,id:'old'+p.seat,source:'manual' as const}));assert.equal(privateNight(s,12).masquerade!.cannotDance,true);advanceNight(s,s.deadline!,()=>0);move(s,'wolves');assert.deepEqual(privateNight(s,1).wolves,[1,2,3]);assert.equal(privateNight(s,4).kind,'waiting');assert.equal(s.engine!.masquerade!.penalties.length,0);
});

test('dancer outside own pool dies to knife while its valid minority still dies; mask poison immunity',()=>{
 const s=start(fixture());dance(s,[5,6,1]);move(s,'mask');mask(s,'inspect',7);mask(s,'mask',8);move(s,'wolves');command(s,1,{action:'vote',target:12});command(s,1,{action:'confirm_wolves'});move(s,'witch');command(s,10,{action:'witch',choice:'poison',target:4});move(s,'first_night_complete');const r=s.engine!.resolution!;assert.equal(r.status,'settled');if(r.status==='settled')assert.deepEqual(r.deaths.map(d=>d.seat).sort((a,b)=>a-b),[1,12]);assert.equal(s.poison,false);
});
test('penalized mask loses inherited knife, no legal targets skips both skills without penalty',()=>{
 for(const exhausted of [true,false]){const s=fixture();for(const p of s.players)if(p.role==='wolf')p.alive=false;for(const p of s.engine!.players)if(p.role==='wolf'){p.alive=false;p.publicState.canVote=false;}s.masquerade!.shared=[];s.masquerade!.alive=s.players.filter(p=>p.alive!==false).map(p=>p.seat);s.masquerade!.inherited=4;start(s);dance(s,[5,6,7]);move(s,'mask');const m=s.engine!.masquerade!;m.inspected=s.masquerade!.alive.map(target=>({night:1,actor:4,target,source:'manual' as const,id:'i'+target}));m.masked=exhausted?m.inspected.map(h=>({...h,id:'m'+h.target})):[];
 if(exhausted){advanceNight(s,s.deadline!,()=>0);const card=privateNight(s,4).masquerade!;assert.equal(card.inspection!.source,'skipped');assert.equal(card.mask!.source,'skipped');assert.equal(m.penalties.length,0);}else{mask(s,'inspect',5);assert.equal(m.penalties.length,1);advanceNight(s,s.deadline!,()=>0);}
 move(s,'wolves');if(!exhausted){assert.equal(privateNight(s,4).kind,'waiting');assert.throws(()=>command(s,4,{action:'confirm_wolves'}),/NOT_YOUR_TURN/);}move(s,'first_night_complete');assert.equal(s.knife,null);}
});
test('history is carried through day/night and missing masquerade history cannot restart a later night',()=>{
 const s=start(fixture());dance(s,[5,6,7]);move(s,'mask');mask(s,'inspect',8);mask(s,'mask',9);move(s,'first_night_complete');const engine=validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine)));const next=createNight(s.players,1000000,{night:3,engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:null},engine.board);assert.equal(next.engine!.masquerade!.danced.length,3);assert.equal(next.engine!.masquerade!.inspected[0].target,8);assert.equal(next.engine!.masquerade!.masked[0].target,9);assert.deepEqual(next.engine!.masquerade!.pool,[]);delete engine.masquerade;assert.throws(()=>createNight(s.players,1000000,{night:3,engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:null},engine.board),/INVALID_ENGINE_STATE/);
});

test('day-exploded ordinary wolf retains next-night priority knife private UI',()=>{
 const previous=fixture(1);previous.players[0].alive=false;previous.engine!.players[0].alive=false;previous.engine!.players[0].publicState.canVote=false;const s=createNight(previous.players,0,{night:2,engine:previous.engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:1},previous.engine!.board);start(s);move(s,'wolves');assert.equal(privateNight(s,1).kind,'wolves');assert.equal(privateNight(s,1).priorityWolf,1);command(s,1,{action:'priority_knife',target:5});assert.equal(s.knife,5);
});

test('locked pool and mask cannot survive restore without their current-night histories',()=>{
 const s=fixture();s.engine!.masquerade!.pool=[1,2,3];s.engine!.masquerade!.mask=4;assert.throws(()=>validateConfirmedEngineState(s.engine),/INVALID_ENGINE_STATE/);
});

test('inherited knife atomically confirms an explicit self-target or empty target',()=>{
 for(const target of [4,null]){const first=fixture(1);for(const p of first.players)if(p.role==='wolf')p.alive=false;for(const p of first.engine!.players)if(p.role==='wolf'){p.alive=false;p.publicState.canVote=false;}const s=createNight(first.players,0,{night:2,engine:first.engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:null},first.engine!.board);start(s);dance(s,[5,6,7]);move(s,'mask');mask(s,'inspect',8);mask(s,'mask',9);move(s,'wolves');command(s,4,{action:'priority_knife',target});assert.equal(s.knife,target);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===4)!.alive,target===null);}
});
