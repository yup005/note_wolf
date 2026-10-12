import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReplay} from '../packages/domain/replay.js';
import type {GameReplay} from '../packages/contracts/game.js';
import type {EngineState} from '../packages/contracts/engine.js';

test('new-board native seer replay uses frozen camp and retains the native role label',()=>{
 const engine={players:[],actions:[{casterId:1,targetId:2,abilityType:'inspect',privateInspection:{status:'camp',camp:'wolves'}}]} as unknown as EngineState;
 const replay={winner:'good',roles:[{seat:1,role:'seer'},{seat:2,role:'mechanicalWolf'}],rounds:[{kind:'night',round:1,engine,events:[{type:'seer_check',seat:1,target:2,at:1}]}]} as GameReplay;
 const lines=summarizeReplay(replay).flatMap(s=>s.lines).join('；');assert.match(lines,/预言家验 2 号：狼人/);assert.doesNotMatch(lines,/通灵师/);
});
test('hunter replay uses settled reflected poison instead of the original poison target',()=>{
 const engine={players:[{seat:2,abilities:{skills:[{kind:'shot',remaining:1}]}}],actions:[],resolution:{status:'settled',effects:[{abilityType:'poison',targetId:2,reflectTarget:3,outcome:'killed',casterId:3}],deaths:[{seat:3}]}} as unknown as EngineState;
 const replay={winner:'good',roles:[{seat:2,role:'hunter'},{seat:3,role:'witch'}],rounds:[{kind:'night',round:2,engine,events:[{type:'witch_poison',seat:3,target:2,at:1},{type:'hunter_seen',seat:2,at:2}]}]} as GameReplay;
 assert.match(summarizeReplay(replay).flatMap(s=>s.lines).join('；'),/猎人查看状态：技能可发动/);
});
