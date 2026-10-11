import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReplay} from '../packages/domain/replay.js';
import type {GameReplay} from '../packages/contracts/game.js';
const roles:GameReplay['roles']=[{seat:1,role:'wolf'},{seat:5,role:'hunter'},{seat:8,role:'villager'},{seat:9,role:'witch'},{seat:10,role:'seer'}];
test('replay condenses actual night actions, includes seer result and hides waiting and wolf proposals',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'night',round:1,events:[{type:'night_created',at:0},{type:'wolf_vote',at:1,seat:1,target:7},{type:'knife_resolved',at:2,target:8},{type:'eyes_closed',at:3},{type:'witch_poison',at:4,seat:9,target:5},{type:'seer_check',at:5,seat:10,target:8},{type:'hunter_seen',at:6,seat:5},{type:'first_night_complete',at:7}]}]};
 assert.deepEqual(summarizeReplay(r),[{title:'第 1 晚',lines:['狼刀 8 号','女巫毒 5 号','预言家验 8 号：好人','猎人查看状态：技能不可发动']}]);
});
test('replay deduplicates explosions and labels poisoned hunter inability without inventing a shot',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:1,events:[{type:'death_explosion',at:1,seat:1},{type:'death_knife',at:2,seat:8},{type:'death_poison',at:3,seat:5},{type:'death_skill',at:4,seat:5},{type:'command',at:5,seat:1,command:{action:'explode'}},{type:'last_words',at:6,seat:8}]}]};
 assert.deepEqual(summarizeReplay(r)[0].lines,['1 号狼人自爆','8 号被狼刀杀死','5 号被毒死（技能不可发动）']);
});
test('replay groups individual voters by target, keeps abstentions, totals and election outcome',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:2,events:[{type:'vote_outcome',at:1,result:{purpose:'sheriff',counts:[{seat:8,votes:2},{seat:10,votes:1}],leaders:[8],ballots:[{seat:1,target:8},{seat:5,target:8},{seat:9,target:10},{seat:10,target:null}]}},{type:'sheriff_elected',at:2,seat:8}]}]};
 assert.deepEqual(summarizeReplay(r)[0].lines,['留警：8 号','警长投票：1、5 号投 8 号；9 号投 10 号；10 号弃票。8 号 2 票，10 号 1 票','8 号当选警长']);
});
test('manual aggregate results never invent individual votes, and legacy rounds use their saved outcome',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:1,events:[{type:'command',at:1,seat:1,command:{action:'offline_results',counts:[{seat:8,votes:1.5},{seat:10,votes:0}]}}],outcome:{sheriff:8,badge:'elected',result:{purpose:'exile',counts:[{seat:8,votes:1.5},{seat:10,votes:0}],leaders:[8]}}}]};
 assert.deepEqual(summarizeReplay(r)[0].lines,['放逐投票：8 号 1.5 票','8 号当选警长']);
});
test('legacy replay keeps earlier sheriff and final exile ballots without exposing totals-only ballots',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:1,events:[{type:'sheriff_speech',at:1},{type:'command',at:2,command:{action:'start_vote',visibility:'individual'}},{type:'command',at:3,seat:1,command:{action:'vote',target:8}},{type:'command',at:4,seat:5,command:{action:'vote',target:8}},{type:'vote_result',at:5},{type:'day_direction',at:6},{type:'command',at:7,command:{action:'start_vote',visibility:'totals'}},{type:'command',at:8,seat:1,command:{action:'vote',target:10}}],outcome:{sheriff:8,badge:'elected',result:{purpose:'exile',counts:[{seat:10,votes:1}],leaders:[10]}}}]};
 assert.deepEqual(summarizeReplay(r)[0].lines,['警长投票：1、5 号投 8 号','放逐投票：10 号 1 票','8 号当选警长']);
});
test('games spanning the update preserve earlier ballots and automatic sheriff election alongside new vote events',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:1,events:[{type:'sheriff_speech',at:1},{type:'command',at:2,command:{action:'start_vote',visibility:'individual'}},{type:'command',at:3,seat:1,command:{action:'vote',target:8}},{type:'day_direction',at:4},{type:'command',at:5,command:{action:'start_vote',visibility:'totals'}},{type:'vote_outcome',at:6,result:{purpose:'exile',counts:[{seat:10,votes:1}],leaders:[10]}}],outcome:{sheriff:8,badge:'elected',result:{purpose:'exile',counts:[{seat:10,votes:1}],leaders:[10]}}}]};const lines=summarizeReplay(r)[0].lines;assert.equal(lines.includes('警长投票：1 号投 8 号'),true);assert.equal(lines.includes('8 号当选警长'),true);assert.equal(lines.filter(l=>l.startsWith('放逐投票')).length,1);
});

test('night and day share one section, deaths are folded into actions and only remaining sheriff candidates and positive votes appear',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'night',round:1,events:[{type:'knife_resolved',at:1,target:8},{type:'witch_poison',at:2,target:5}]},{kind:'day',round:1,events:[{type:'sheriff_signup',at:3},{type:'command',at:4,seat:1,command:{action:'signup',join:true}},{type:'command',at:5,seat:10,command:{action:'signup',join:true}},{type:'command',at:6,seat:1,command:{action:'withdraw'}},{type:'death_knife',at:7,seat:8},{type:'death_poison',at:8,seat:5},{type:'vote_outcome',at:9,result:{purpose:'sheriff',counts:[{seat:10,votes:2},{seat:1,votes:0}],leaders:[10]}}]}]};
 assert.deepEqual(summarizeReplay(r),[{title:'第 1 晚 / 第 1 天',lines:['狼刀 8 号（死亡）','女巫毒 5 号（死亡，技能不可发动）','留警：10 号','警长投票：10 号 2 票']}]);
});

test('sheriff PK recap excludes eliminated non-finalists when a finalist withdraws',()=>{
 const r:GameReplay={winner:'good',roles,rounds:[{kind:'day',round:1,events:[{type:'sheriff_signup',at:0},...[1,5,10].map(seat=>({type:'command',at:1,seat,command:{action:'signup',join:true}})),{type:'vote_outcome',at:2,result:{purpose:'sheriff',counts:[{seat:1,votes:2},{seat:5,votes:2},{seat:10,votes:1}],leaders:[1,5]}},{type:'command',at:3,seat:5,command:{action:'withdraw'}},{type:'sheriff_elected',at:4,seat:1}]}]};assert.equal(summarizeReplay(r)[0].lines[0],'留警：1 号');
});
