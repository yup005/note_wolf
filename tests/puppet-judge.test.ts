import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {puppetFixture,move} from './puppet-fixture.js';
import {beginNight,privateNight,publicNight,nightCommand} from '../packages/domain/night.js';
import {judgeActions,judgeOperation} from '../apps/web/src/judgeActions.js';
import {phaseDuration,supplementRuntime} from '../packages/domain/judge.js';
import {firstDayRules} from '../packages/contracts/day.js';
import {emptyRecord} from '../packages/contracts/records.js';
import type {JudgePrivate} from '../packages/contracts/judge.js';
const fields={target:2,method:'offline' as const,seconds:30,speech:'free' as const,counts:{}};
function data(s:ReturnType<typeof puppetFixture>):JudgePrivate{return {assignmentVersion:1,manualVersion:0,roles:s.players.map(p=>({seat:p.seat,role:p.role,alive:true})),night:publicNight(s,0),day:null,cards:s.players.map(p=>({seat:p.seat,night:privateNight(s,p.seat),day:null})),history:[],official:emptyRecord(),audit:[],draft:{id:randomUUID(),version:0,assignmentVersion:1,manualVersion:0,kind:'night',round:1,phase:s.phase,turnId:s.turnId}};}
test('judge can supplement mandatory puppet vote then confirm but cannot invent conversion by advancing',()=>{
 const s=puppetFixture();beginNight(s,0,()=>0);move(s,'puppet');assert.equal(phaseDuration('night',s),180000);const before=data(s);assert.equal(judgeActions(before,1).some(a=>a.key==='puppet_vote'),true);assert.equal(judgeActions(before,1).some(a=>a.key==='confirm_puppet'),false);assert.throws(()=>supplementRuntime({clock:s.deadline!-1,kind:'night',night:s,day:null,history:[]},{kind:'advance'},s.engine!.board,firstDayRules,12),/JUDGE_PUPPET_REQUIRED/);
 const op=judgeOperation(before,1,'puppet_vote',fields);assert.equal(op.kind,'night');if(op.kind==='night')nightCommand(s,op.actorSeat,op.command,s.deadline!-1);const after=data(s);assert.equal(judgeActions(after,1).some(a=>a.key==='confirm_puppet'),true);const confirm=judgeOperation(after,1,'confirm_puppet',fields);if(confirm.kind==='night')nightCommand(s,confirm.actorSeat,confirm.command,s.deadline!-1);assert.equal(s.engine!.puppet!.target,2);
});
test('judge witch-save command carries the real knife target in puppet board',()=>{const s=puppetFixture();beginNight(s,0,()=>0);move(s,'wolves');nightCommand(s,1,{action:'vote',target:3,turnId:s.turnId},s.deadline!-1);nightCommand(s,1,{action:'confirm_wolves',turnId:s.turnId},s.deadline!-1);move(s,'witch');const op=judgeOperation(data(s),4,'witch:save',{...fields,target:null});assert.equal(op.kind,'night');if(op.kind==='night'){assert.equal('target' in op.command?op.command.target:undefined,3);assert.doesNotThrow(()=>nightCommand(s,op.actorSeat,op.command,s.deadline!-1));}});
