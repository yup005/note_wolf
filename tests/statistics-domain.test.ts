import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateStatistics,type StatisticsEvidence} from '../packages/domain/statistics.js';
function game(gameId:string,role:StatisticsEvidence['role'],camp:StatisticsEvidence['camp'],winner:StatisticsEvidence['winner']):StatisticsEvidence{return {gameId,ended:true,ordinary:true,role,camp,winner,board:{key:'standard-12',name:'预女猎白'}};}
test('stats count each ended ordinary game once and exclude unknown own outcomes from denominators',()=>{
 const wolf=game('game-one','wolf','wolves','good'),seer=game('game-two','seer','good','good'),mixer=game('game-three','mixer',null,'wolves'),unknown=game('game-four','villager','good',null);mixer.board={key:'custom',name:'合成板子'};
 const result=aggregateStatistics([wolf,seer,mixer,unknown,wolf]);assert.equal(result.played,4);assert.equal(result.resolved,2);assert.equal(result.wins,1);assert.equal(result.losses,1);assert.equal(result.unresolved,2);assert.equal(result.winRate,.5);
 assert.deepEqual(result.roles.find(r=>r.role==='mixer'),{role:'mixer',played:1,resolved:0,wins:0,losses:0,winRate:null});assert.equal(result.roles.find(r=>r.role==='wolf')?.winRate,0);assert.equal(result.roles.find(r=>r.role==='seer')?.winRate,1);assert.deepEqual(result.boards,[{name:'预女猎白',played:3},{name:'合成板子',played:1}]);assert.doesNotMatch(JSON.stringify(result),/game-one|game-two|standard-12|custom/);
});
test('running and simulated secrets cannot alter aggregate, and zero outcomes never create NaN rates',()=>{
 const baseline=aggregateStatistics([]);assert.equal(baseline.winRate,null);assert.deepEqual(baseline.roles,[]);
 const ongoing={...game('running','seer','good','wolves'),ended:false},simulated={...game('simulated','wolf','wolves','wolves'),ordinary:false};assert.deepEqual(aggregateStatistics([ongoing,simulated]),baseline);
 ongoing.role='mixer';ongoing.camp=null;ongoing.winner='good';Object.assign(ongoing,{privateOpponent:'NEVER_PUBLIC',privateTarget:7,privateNotes:'NEVER_PUBLIC'});assert.deepEqual(aggregateStatistics([ongoing,simulated]),baseline);
 const result=aggregateStatistics([game('ended-only-record','mixer',null,null)]);assert.equal(result.played,1);assert.equal(result.unresolved,1);assert.equal(result.winRate,null);assert.equal(result.roles[0].winRate,null);assert.doesNotMatch(JSON.stringify(result),/NaN|Infinity|NEVER_PUBLIC/);
});
test('true wolf camp stays independent of copied skill and distinct rounds on one room remain distinct',()=>{
 const evidence=[game('round-1','mechanicalWolf','wolves','wolves'),game('round-2','armoredWolf','wolves','good'),game('round-3','mixer','wolves','wolves')];
 const result=aggregateStatistics(evidence);assert.equal(result.played,3);assert.equal(result.resolved,3);assert.equal(result.wins,2);assert.equal(result.losses,1);assert.equal(result.roles.find(r=>r.role==='mechanicalWolf')?.winRate,1);assert.equal(result.roles.find(r=>r.role==='armoredWolf')?.winRate,0);assert.deepEqual(aggregateStatistics(evidence),result,'reads are pure and never increment persisted counters');
});
