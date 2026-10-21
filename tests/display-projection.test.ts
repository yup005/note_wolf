import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LobbyStore} from '../packages/storage/lobby.js';
import {projectDisplay} from '../packages/domain/display.js';
import type {DayPublic} from '../packages/contracts/day.js';
function room(){const s=new LobbyStore(':memory:');s.issueSession('synthetic-host');const r=s.create('synthetic-host','Synthetic',crypto.randomUUID()).room;s.close();return r;}
function day(phase:DayPublic['phase']):DayPublic{return {day:1,phase,turnId:'private-turn',deadline:5000,serverNow:1000,alive:[1,2],dead:[3],nightDeaths:[],speaker:2,currentDeath:3,announcement:null,result:null,vote:null,winner:null,reason:null,interjection:null,speechMode:null,direction:null,speechStart:null,signupCount:0,sheriff:null,badge:'available',candidates:[],originalCandidates:[],revealed:[]};}
test('display night projection is invariant to private phases, clocks, revisions and unpublished deaths',()=>{
 const r=room();r.night={night:2,phase:'wolves',turnId:'secret',deadline:5000,serverNow:1000,alive:[1]};r.day=day('day_complete');const baseline=projectDisplay(r,1000);
 for(const phase of ['wolves','witch','seer','hunter','mechanical','armor','spiritSeer','eyes_closed','rules_pending'] as const){const changed=structuredClone(r);changed.night={...r.night,phase,deadline:99999,alive:[],turnId:'OTHER'};changed.revision+=20;Object.assign(changed,{privateRole:'SECRET',target:7});assert.deepEqual(projectDisplay(changed,1000),baseline);}
 assert.equal(baseline.phase.label,'夜晚');assert.equal(baseline.timer,null);assert.deepEqual(baseline.dead,[3]);assert.doesNotMatch(JSON.stringify(baseline),/SECRET|turnId|revision|alive|wolves|witch|deadline/);
});
test('display sends only officially announced vote scope and current public speaker',()=>{
 const r=room();r.day=day('voting');r.day.vote={purpose:'exile',visibility:'totals',method:'phone',eligible:[1,2],candidates:[1],submittedCount:1};r.day.result={purpose:'exile',counts:[{seat:1,votes:1}],ballots:[{seat:2,target:1}],leaders:[1]};assert.equal(projectDisplay(r,1000).vote,null);
 r.day.phase='vote_result';assert.deepEqual(projectDisplay(r,1000).vote,{purpose:'exile',counts:[{seat:1,votes:1}]});r.day.vote.visibility='individual';assert.deepEqual(projectDisplay(r,1000).vote?.ballots,[{seat:2,target:1}]);r.day.phase='day_speech';assert.equal(projectDisplay(r,1000).speaker,2);assert.equal(projectDisplay(r,1000).vote,null);
 const out=projectDisplay({...r,control:{status:'paused',remainingMs:3500,version:1,resumeAt:null,serverNow:1000,tempSeat:null,reconnecting:false}},1000);assert.deepEqual(out.timer,{milliseconds:3500,running:false});
});
test('sensitive public death substeps do not expose roles or their timers',()=>{
 const r=room();r.day=day('death_skill');const baseline=projectDisplay(r,1000);for(const phase of ['hunter_target','white_wolf_target','badge_transfer'] as const){r.day={...r.day,phase,deadline:99999,currentDeath:7};assert.deepEqual(projectDisplay(r,1000),baseline);}assert.equal(baseline.phase.label,'公开流程处理中');assert.equal(baseline.timer,null);assert.equal(baseline.speaker,null);
});
test('manual display uses committed public facts without revealing roles or drafts',()=>{
 const r=room();r.manual={status:'playing',version:1,dead:[2],winner:null,revealed:[]} as NonNullable<typeof r.manual>;Object.assign(r.manual,{draft:{notes:'PRIVATE',deaths:[{seat:9}]},revealed:[{seat:1,role:'wolf'}]});const out=projectDisplay(r,1000);assert.equal(out.phase.kind,'manual');assert.deepEqual(out.dead,[2]);assert.doesNotMatch(JSON.stringify(out),/PRIVATE|wolf|revealed|draft/);r.manual.status='ended';assert.equal(projectDisplay(r,1000).phase.label,'记录已结束');assert.equal(projectDisplay(r,1000).winner,null);
});
