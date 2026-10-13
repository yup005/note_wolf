import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBoardConfiguration,assertPlayableBoard,boardPreset} from '../packages/domain/boardConfig.js';
import {playerCamp,evaluateVictory} from '../packages/domain/victory.js';
import {createConfirmedEngineState,learnConfirmedEngineAbility,appendConfirmedEngineAction} from '../packages/domain/mechanicalEngine.js';
import {createNight,beginNight,nightCommand,privateNight} from '../packages/domain/night.js';
import type {BoardRole,RoomBoardSnapshot} from '../packages/contracts/board.js';
import {manualDecision} from '../packages/domain/manual.js';
import {knifeAuthorityAtNightStart} from '../packages/domain/knifeAuthority.js';

const black='blackWolf' as BoardRole,white='whiteWolf' as BoardRole;
function board(roles:BoardRole[]):RoomBoardSnapshot{
 const counts:Partial<Record<BoardRole,number>>={};for(const role of roles)counts[role]=(counts[role]??0)+1;const c=createBoardConfiguration({seatCount:roles.length,roles:counts});
 return {id:'king-fixture',name:'Synthetic kings',ruleVersion:'2026-10-10-v1',composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
}
function seeds(roles:BoardRole[]){return roles.map((role,i)=>({seat:i+1,role,knifeGroup:['wolf',black,white].includes(role)?'shared' as const:role==='mechanicalWolf'?'mechanical' as const:role==='armoredWolf'?'armor' as const:'none' as const}));}

test('custom king counts may repeat without changing default templates or other unique roles',()=>{
 const c=createBoardConfiguration({seatCount:6,roles:{[black]:2,[white]:2,villager:1,witch:1}});assert.equal(c.ruleset,'mechanical-seer');assert.doesNotThrow(()=>assertPlayableBoard(c));
 assert.deepEqual(boardPreset('standard-12').roles,{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1});
 assert.throws(()=>createBoardConfiguration({seatCount:4,roles:{[black]:1,villager:1,witch:2}}),/INVALID_BOARD_CONFIGURATION/);
 assert.throws(()=>assertPlayableBoard(createBoardConfiguration({seatCount:2,roles:{[black]:1,[white]:1}})),/INVALID_BOARD_FACTIONS/);
});

test('king camps and manual outcomes follow true wolf identities, even after good mimicry',()=>{
 assert.equal(playerCamp(black),'wolves');assert.equal(playerCamp(white),'wolves');
 const players=[{seat:1,role:black,alive:true},{seat:2,role:white,alive:false},{seat:3,role:'villager' as const,alive:true},{seat:4,role:'witch' as const,alive:true}];
 assert.deepEqual(evaluateVictory(players,'mechanical-seer'),{status:'playing'});assert.deepEqual(evaluateVictory(players.map(p=>({...p,alive:p.seat>2})),'mechanical-seer'),{status:'ended',winner:'good',reason:'all-wolves-dead'});
 assert.deepEqual(manualDecision(players.map(({seat,role})=>({seat,role})),[1,2]),{outcome:'good',requiresAdjudication:false});
});

test('native kings share the knife and delay mechanical inheritance until all shared kings are dead',()=>{
 const roles:BoardRole[]=[black,white,'mechanicalWolf','armoredWolf','villager','witch'];const b=board(roles),n=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,b);
 beginNight(n,0,()=>0);assert.equal(n.phase,'wolves');assert.deepEqual(privateNight(n,1).wolves,[1,2]);assert.equal(privateNight(n,3).kind,'waiting');
 nightCommand(n,2,{action:'vote',target:5,turnId:n.turnId},0,()=>0);assert.deepEqual(privateNight(n,1).votes,[{seat:2,target:5}]);
 const e=n.engine!;assert.deepEqual(knifeAuthorityAtNightStart(e.players.map(({seat,alive,knifeGroup})=>({seat,alive,knifeGroup}))),{sharedKnifeSeats:[1,2],inheritedKnifeSeat:null});e.players[0].alive=false;assert.deepEqual(knifeAuthorityAtNightStart(e.players.map(({seat,alive,knifeGroup})=>({seat,alive,knifeGroup}))),{sharedKnifeSeats:[2],inheritedKnifeSeat:null});e.players[1].alive=false;assert.deepEqual(knifeAuthorityAtNightStart(e.players.map(({seat,alive,knifeGroup})=>({seat,alive,knifeGroup}))),{sharedKnifeSeats:[],inheritedKnifeSeat:3});
});

for(const role of [black,white])test(`mechanical and armor copy ${role} into independent full first-day inventory`,()=>{
 const roles:BoardRole[]=['mechanicalWolf','armoredWolf',role,'villager','witch'];let e=createConfirmedEngineState(board(roles),seeds(roles));
 const native=e.players[2].abilities.skills[0];assert.equal(native.capacity,1);
 const a=learnConfirmedEngineAbility(e,1,3,{copyId:'m'});assert.equal(a.status,'learned');if(a.status!=='learned')return;e=a.state;
 const b=learnConfirmedEngineAbility(e,2,3,{copyId:'a'});assert.equal(b.status,'learned');if(b.status!=='learned')return;e=b.state;
 for(const i of [0,1]){const skill=e.players[i].abilities.skills[0];assert.equal(skill.kind,role===black?'shot':'explode-take');assert.equal(skill.remaining,1);assert.equal(skill.availableFromNight,1);assert.equal(e.players[i].camp,'wolves');assert.equal(e.players[i].abilities.mimickedRole,role);}
 assert.notEqual(e.players[0].abilities.skills[0].id,e.players[1].abilities.skills[0].id);
 if(role===white){const skill=e.players[0].abilities.skills[0];assert.throws(()=>appendConfirmedEngineAction(e,{id:'night-carry',requestId:'night-carry',casterId:1,targetId:4,abilityId:skill.id,abilityType:skill.kind,stage:'mechanical',at:1}),/DAY_SKILL_ONLY/);}
});

test('each repeated native black king owns its own shot inventory',()=>{
 const roles:BoardRole[]=[black,black,'villager','witch'];const e=createConfirmedEngineState(board(roles),seeds(roles));assert.equal(e.players[0].abilities.skills[0].parameters.damage,'black-wolf-shot');assert.notEqual(e.players[0].abilities.skills[0].id,e.players[1].abilities.skills[0].id);
});
