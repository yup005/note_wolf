import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,boardStartError} from '../packages/domain/boardConfig.js';
import * as treasure from '../packages/domain/treasure.js';

test('treasure preset supports twelve players and separates mode from poisoner ruleset',()=>{
 const b=boardPreset('treasure-12' as never);assert.equal(b.ruleset,'treasure');assert.equal(b.seatCount,12);assert.equal(b.treasureMode,'fixed-wolf');assert.equal(boardStartError(b),null);
});
test('random bottoms exhaust all fifteen equally selectable pairs without an independent camp lottery',()=>{
 const outcomes=new Set<string>();let good=0,wolf=0;
 for(let a=0;a<6;a++)for(let b=0;b<5;b++){
  const choices=[a,b];const deal=treasure.dealTreasure('random',n=>choices.length?choices.shift()! % n:0);
  assert.equal(deal.deck.length,12);assert.equal(deal.bottoms.length,3);assert.equal(deal.bottoms.filter(r=>r==='villager').length,1);
  assert.equal(new Set(deal.bottoms).size,3);assert.equal(deal.deck.filter(r=>r==='treasureMaster').length,1);
  assert.equal(deal.deck.filter(r=>r==='villager').length,4);
  assert.equal(deal.deck.filter(r=>r==='wolf'||r==='blackWolf').length,deal.camp==='good'?4:3);
  outcomes.add([...deal.bottoms].sort().join(','));if(deal.camp==='good')good++;else wolf++;
 }
 assert.equal(outcomes.size,15);assert.equal(good,20);assert.equal(wolf,10);
});
test('fixed wolf always leaves a wolf, one god and a civilian',()=>{
 for(let i=0;i<5;i++){const d=treasure.dealTreasure('fixed-wolf',n=>i%n);assert.equal(d.camp,'wolves');assert.deepEqual(d.bottoms.filter(r=>r==='wolf'||r==='villager').sort(),['villager','wolf']);}
});
test('good treasure remains a god after choosing civilian and dead gods trigger wolves victory',()=>{
 const p=[{seat:1,role:'treasureMaster' as const,alive:true},{seat:2,role:'wolf' as const,alive:true},{seat:3,role:'villager' as const,alive:true}];
 assert.equal(treasure.treasureVictory(p,'good').status,'playing');p[0].alive=false;
 assert.deepEqual(treasure.treasureVictory(p,'good'),{status:'ended',winner:'wolves',reason:'all-gods-dead'});
});
test('simultaneous elimination of wolves and gods gives wolves priority',()=>{
 assert.deepEqual(treasure.treasureVictory([{seat:1,role:'treasureMaster',alive:false},{seat:2,role:'wolf',alive:false},{seat:3,role:'villager',alive:true}],'good'),{status:'ended',winner:'wolves',reason:'all-gods-dead'});
});
