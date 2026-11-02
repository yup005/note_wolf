import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,boardStartError,createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {evaluateVictory} from '../packages/domain/victory.js';
import type {BoardRole} from '../packages/contracts/board.js';

export const puppetRoles:BoardRole[]=['wolf','wolf','blackWolf','guard','witch','seer','hunter','villager','villager','villager','villager','villager'];
const players=()=>puppetRoles.map((role,i)=>({seat:i+1,role,alive:true,personalCamp:i===3?'wolves' as const:undefined}));
test('puppet preset is independent, exact copies work and mixtures cannot start',()=>{
 const b=boardPreset('puppet-12' as any);assert.equal(b.ruleset,'puppet');assert.deepEqual(b.roles,{wolf:2,blackWolf:1,villager:5,seer:1,witch:1,guard:1,hunter:1});
 assert.equal(createBoardConfiguration({variant:'puppet',seatCount:12,roles:b.roles}).ruleset,'puppet');assert.equal(boardStartError(b),null);
 const mixed=createBoardConfiguration({variant:'puppet',seatCount:12,roles:{...b.roles,guard:0,idiot:1}});assert.equal(boardStartError(mixed),'BOARD_NOT_IMPLEMENTED');
});
test('puppet counts as wolf, exits original god edge, and wolves win simultaneous night extinction',()=>{
 const p=players();p.slice(0,3).forEach(x=>x.alive=false);assert.deepEqual(evaluateVictory(p,'puppet' as any),{status:'playing'});
 p[3].alive=false;const good=evaluateVictory(p,'puppet' as any);assert.equal(good.status,'ended');if(good.status==='ended'){assert.equal(good.winner,'good');assert.equal(good.personalResults?.find(x=>x.seat===4)?.won,false);}
 p.slice(4,7).forEach(x=>x.alive=false);const both=evaluateVictory(p,'puppet' as any);assert.equal(both.status,'ended');if(both.status==='ended')assert.equal(both.winner,'wolves');
});
test('converted god does not keep god edge alive',()=>{
 const p=players();p.slice(4,7).forEach(x=>x.alive=false);const r=evaluateVictory(p,'puppet' as any);assert.equal(r.status,'ended');if(r.status==='ended'){assert.equal(r.winner,'wolves');assert.equal(r.reason,'all-gods-dead');assert.equal(r.personalResults?.find(x=>x.seat===4)?.won,true);}
});
test('circular candidates include boundary and exclude every original wolf',async()=>{
 const {puppetCandidates,hasNeighborGod,dealPuppetDeck}=await import('../packages/domain/puppet.js');
 assert.deepEqual(puppetCandidates(puppetRoles),[4,12]);assert.equal(hasNeighborGod(puppetRoles),true);
 const noGod:BoardRole[]=['wolf','wolf','blackWolf','villager','villager','guard','witch','seer','hunter','villager','villager','villager'];
 assert.equal(hasNeighborGod(noGod),false);const boundary=[...noGod];[boundary[5],boundary[11]]=[boundary[11],boundary[5]];assert.equal(hasNeighborGod(boundary),true);
 let calls=0;assert.deepEqual(dealPuppetDeck(()=>{calls++;return [...puppetRoles];}),puppetRoles);assert.equal(calls,1);
 calls=0;assert.deepEqual(dealPuppetDeck(()=>{calls++;return calls===1?[...noGod]:[...puppetRoles];}),puppetRoles);assert.equal(calls,2);
 calls=0;assert.deepEqual(dealPuppetDeck(()=>{calls++;return [...noGod];}),noGod);assert.equal(calls,2);
});

test('legacy role-only custom board and persisted mechanical-seer engine retain previous rules',async()=>{
 const roles={wolf:2,blackWolf:1,villager:5,seer:1,witch:1,guard:1,hunter:1};const legacy=createBoardConfiguration({seatCount:12,roles});assert.equal(legacy.ruleset,'mechanical-seer');
 const {createConfirmedEngineState,validateConfirmedEngineState}=await import('../packages/domain/mechanicalEngine.js');const {boardRuleVersion,isSharedWolfRole}=await import('../packages/contracts/board.js');
 let seat=0;const seeds=Object.entries(roles).flatMap(([role,count])=>Array.from({length:count},()=>({seat:++seat,role:role as BoardRole,knifeGroup:isSharedWolfRole(role as BoardRole)?'shared' as const:'none' as const})));
 const e=createConfirmedEngineState({id:'legacy',name:'原自定义',ruleVersion:boardRuleVersion,composition:{seatCount:12,roleCounts:roles,ruleset:'mechanical-seer',playable:true}},seeds);assert.equal(validateConfirmedEngineState(JSON.parse(JSON.stringify(e))).board.composition.ruleset,'mechanical-seer');
});
