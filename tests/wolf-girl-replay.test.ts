import test from 'node:test';
import assert from 'node:assert/strict';
import {finalReplay,summarizeReplay} from '../packages/domain/replay.js';
import {voiceFrame} from '../packages/domain/voice.js';
import {roles} from './wolf-girl-fixture.js';
test('replay records confession, poisoner, cancelled vote, retaliation and personal result',()=>{
 const result={purpose:'exile' as const,counts:[{seat:6,votes:8}],leaders:[6]};
 const record=finalReplay({winner:'good',roles:roles.map((role,i)=>({seat:i+1,role})),personalResults:[{seat:5,won:false}],rounds:[{kind:'night',round:1,events:[{type:'girl_confession',seat:4,target:5,at:1},{type:'poisoner_poison',seat:10,target:8,at:2}]},{kind:'day',round:1,events:[{type:'vote_outcome',result,at:3},{type:'vote_cancelled',result,at:4},{type:'death_explosion',seat:4,at:5},{type:'death_girl-retaliation',seat:5,at:5}]}]});
 const text=JSON.stringify(summarizeReplay(record));assert.match(text,/表白/);assert.match(text,/毒师/);assert.match(text,/作废/);assert.match(text,/报复/);assert.equal(record.personalResults?.[0].won,false);assert.equal(record.rounds[1].events.some(e=>e.type==='vote_outcome'),false);
});
test('new public night speech has fixed phase prompts without secrets and first night recognition only',()=>{
 const room:any={board:{composition:{ruleset:'wolf-girl'}},preparation:{settings:{gameMode:'automatic'}},night:{night:1,phase:'confession',turnId:'x',deadline:30000,opening:false}};
 assert.match(voiceFrame(room,0).current!.text,/狼女孩/);room.night.phase='confession_notice';assert.match(voiceFrame(room,0).current!.text,/被表白者/);room.night.phase='poisoner';assert.match(voiceFrame(room,0).current!.text,/毒师/);room.night.phase='wolves';assert.doesNotMatch(voiceFrame(room,0).current!.text,/选择目标/);
});

test('projecting an already projected cancelled vote never removes the earlier sheriff election',()=>{
 const sheriff={purpose:'sheriff' as const,counts:[{seat:1,votes:8}],leaders:[1]},exile={purpose:'exile' as const,counts:[{seat:6,votes:8}],leaders:[6]};
 const first=finalReplay({winner:'wolves',roles:[],rounds:[{kind:'day',round:1,events:[{type:'vote_outcome',result:sheriff,at:1},{type:'vote_outcome',result:exile,at:2},{type:'vote_cancelled',result:exile,at:3}]}]});
 assert.deepEqual(finalReplay(first),first);
});

test('cancelled legacy raw ballots do not reappear in final summary as valid exile votes',()=>{
 const result={purpose:'exile' as const,counts:[{seat:6,votes:1}],leaders:[6],ballots:[{seat:1,target:6}]};
 const replay=finalReplay({winner:'good',roles:[],rounds:[{kind:'day',round:1,events:[{type:'free_speech',at:0},{type:'command',at:1,command:{action:'start_vote',visibility:'individual'}},{type:'command',at:2,seat:1,command:{action:'vote',target:6}},{type:'vote_outcome',result,at:3},{type:'vote_cancelled',result,at:4}]}]});
 assert.doesNotMatch(JSON.stringify(replay.summary),/放逐投票：/);assert.match(JSON.stringify(replay.summary),/作废/);
});
