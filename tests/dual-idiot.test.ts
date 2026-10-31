import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createBoardConfiguration,assertPlayableBoard} from '../packages/domain/boardConfig.js';
import {createNight,beginNight,advanceNight,nightCommand,privateNight} from '../packages/domain/night.js';
import {createDay,dayCommand,privateDay,publicDay,type DayState} from '../packages/domain/day.js';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
import type {RoomBoardSnapshot,BoardRole} from '../packages/contracts/board.js';
import {manualDecision} from '../packages/domain/manual.js';

const roles:BoardRole[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','villager','villager','seer','witch','hunter','idiot'];
const composition={seatCount:14,roles:{wolf:4,villager:6,seer:1,witch:1,hunter:1,idiot:1},idiotPolicy:'dual-category-14'};
function board(dual=true):RoomBoardSnapshot{
 const config=createBoardConfiguration(dual?composition:{seatCount:14,roles:composition.roles});
 return {id:'custom',name:'Dual 14',ruleVersion:'2026-10-10-v1',composition:{seatCount:14,roleCounts:config.roles,ruleset:config.ruleset,playable:config.playable,...(dual?{idiotPolicy:'dual-category-14' as const}:{})}};
}
function dawn(dual=true){const n=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board(dual));n.phase='first_night_complete';n.engine!.stage='resolved';n.engine!.resolution={status:'settled',effects:[],deaths:[]};return createDay(n,firstDayRules,1000);}
type Command<T>=T extends unknown?Omit<T,'turnId'>:never;
function command(s:DayState,c:Command<DayCommand>,seat=1,now=1000){dayCommand(s,{seat,isHost:seat===1},{...c,turnId:s.turnId} as DayCommand,now,()=>0);}
function exile(s:DayState,seat=14){s.phase='vote_result';s.result={purpose:'exile',counts:[{seat,votes:1}],leaders:[seat]};command(s,{action:'continue'});}
function speeches(s:DayState){s.phase='day_direction';s.sheriff=null;s.vote=null;s.speechMode=null;s.direction=null;command(s,{action:'speech_mode',mode:'ordered'});}

test('dual policy is explicit, requires an idiot at any player count, and survives validation',()=>{
 const c=createBoardConfiguration(composition);assert.equal(assertPlayableBoard(c).idiotPolicy,'dual-category-14');
 assert.equal(createBoardConfiguration({seatCount:14,roles:composition.roles}).idiotPolicy,undefined);
 for(const input of [{...composition,roles:{wolf:4,villager:7,seer:1,witch:1,hunter:1}},{...composition,idiotPolicy:'guessed'}])assert.throws(()=>createBoardConfiguration(input),/INVALID_BOARD_CONFIGURATION/);
});

test('dual exile leaves a physical night target but removes speech, votes and interjection rights',()=>{
 const s=dawn();exile(s);assert.equal(s.players[13].alive,true);assert.equal(s.engine!.players[13].publicState.canVote,false);assert.equal(s.engine!.players[13].publicState.canInterject,false);
 assert.deepEqual(s.revealed,[{seat:14,role:'idiot'}]);assert.equal(s.deaths.some(d=>d.seat===14),false);assert.equal(s.phase,'day_complete');assert.equal(s.winner,null);
 const restored:DayState=JSON.parse(JSON.stringify(s));speeches(restored);assert.equal(restored.speaker,1);assert.equal(restored.speakers.includes(14),false);
 assert.equal(privateDay(restored,14).canInterject,false);assert.throws(()=>command(restored,{action:'interject'},14),/NOT_YOUR_TURN/);
 while(restored.phase==='day_speech')command(restored,{action:'end_speech'});
 assert.equal(restored.vote!.candidates.includes(14),false);assert.equal(restored.vote!.eligible.includes(14),false);
 command(restored,{action:'start_vote',method:'offline',visibility:'totals',seconds:30});
 assert.throws(()=>command(restored,{action:'offline_vote',voter:14,target:1}),/NOT_YOUR_TURN/);
 assert.throws(()=>command(restored,{action:'offline_vote',voter:1,target:14}),/INVALID_INPUT/);
 assert.equal(JSON.stringify(publicDay(restored,1000)).includes('engine'),false);
});

test('dual idiot remains the civilian edge after villagers die, but no longer the god edge',()=>{
 const s=dawn();s.players.filter(p=>p.role==='villager').forEach(p=>p.alive=false);exile(s);assert.equal(s.winner,null);
 const t=dawn();t.players.filter(p=>['seer','witch','hunter'].includes(p.role)).forEach(p=>p.alive=false);exile(t);assert.equal(t.winner,'wolves');assert.equal(t.reason,'神职全部出局，狼人屠边');
});

for(const cause of ['knife','poison'] as const)test(`flipped dual idiot is a valid ${cause} target and dies on the next public announcement`,()=>{
 const s=dawn();exile(s);
 const n=createNight(s.players,2000,{night:2,antidote:true,poison:true,hunterSpent:false,priorityWolf:null,engine:s.engine},board());
 beginNight(n,2000,()=>0);assert.equal(n.phase,'wolves');assert.equal(privateNight(n,1).legalTargets!.includes(14),true);
 nightCommand(n,1,{action:'vote',target:cause==='knife'?14:null,turnId:n.turnId},2000);
 nightCommand(n,1,{action:'confirm_wolves',turnId:n.turnId},2000,()=>0);
 advanceNight(n,n.deadline!,()=>0);assert.equal(n.phase,'witch');
 nightCommand(n,12,{action:'witch',choice:cause==='poison'?'poison':'skip',target:cause==='poison'?14:null,turnId:n.turnId},n.deadline!-30000,()=>0);
 advanceNight(n,1000000,()=>0);assert.equal(n.phase,'first_night_complete');assert.equal(n.engine!.players[13].alive,false);
 const next=createDay(n,firstDayRules,1000001,s);command(next,{action:'start'},1,1000001);assert.equal(publicDay(next,1000001).dead.includes(14),false);
 command(next,{action:'continue'},1,1000001);assert.equal(next.players[13].alive,false);assert.equal(next.deaths.find(d=>d.seat===14)?.reason,cause);assert.equal(privateDay(next,14).canInterject,false);
});

test('fourteen-player ordinary idiot keeps the original death and interjection policy',()=>{
 const s=dawn(false);exile(s);assert.equal(s.players[13].alive,false);s.phase='day_speech';s.speaker=5;s.deadline=91000;s.turnId=randomUUID();assert.equal(privateDay(s,14).canInterject,true);
});

test('flipped dual idiot keeps the existing physical living-target rule for hunter shots',()=>{
 const s=dawn();exile(s);exile(s,13);assert.equal(privateDay(s,13).canShoot,true);command(s,{action:'shoot'},13);command(s,{action:'record_shot',target:14});
 assert.equal(s.players[13].alive,false);assert.equal(s.deaths.find(d=>d.seat===14)?.reason,'shot');assert.equal(privateDay(s,14).canInterject,false);
});

test('composition gates forbid automatic wolf-free and all-wolf games without rejecting a missing single edge',()=>{
 const noWolves=createBoardConfiguration({seatCount:2,roles:{villager:1,witch:1}});
 assert.throws(()=>assertPlayableBoard(noWolves),/WOLF_FREE_MANUAL_ONLY/);assert.doesNotThrow(()=> assertPlayableBoard(noWolves,'manual'));
 const allWolves=createBoardConfiguration({seatCount:2,roles:{wolf:1,mechanicalWolf:1}});assert.throws(()=>assertPlayableBoard(allWolves),/INVALID_BOARD_FACTIONS/);assert.throws(()=> assertPlayableBoard(allWolves,'manual'),/INVALID_BOARD_FACTIONS/);
 for(const input of [{seatCount:2,roles:{wolf:1,villager:1}},{seatCount:2,roles:{mechanicalWolf:1,witch:1}},{seatCount:3,roles:{mechanicalWolf:1,armoredWolf:1,villager:1}}])assert.doesNotThrow(()=>assertPlayableBoard(createBoardConfiguration(input)));
});

test('manual dual victory uses separate public flip and physical death facts',()=>{
 const roster=roles.map((role,i)=>({seat:i+1,role}));
 const options={idiotPolicy:'dual-category-14' as const,flippedIdiots:[14]};
 assert.deepEqual(manualDecision(roster,[5,6,7,8,9,10],[],options),{outcome:null,requiresAdjudication:false});
 assert.deepEqual(manualDecision(roster,[5,6,7,8,9,10,14],[],options),{outcome:'wolves',requiresAdjudication:false});
 assert.deepEqual(manualDecision(roster,[11,12,13],[],options),{outcome:'wolves',requiresAdjudication:false});
 assert.deepEqual(manualDecision([{seat:1,role:'villager'},{seat:2,role:'witch'}],[1,2]),{outcome:null,requiresAdjudication:false});
});

test('eleven-player dual idiot explicitly flips without dying and keeps only the civilian edge',()=>{
 const roster:BoardRole[]=['wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
 const input={seatCount:11,roles:{wolf:3,villager:4,seer:1,witch:1,hunter:1,idiot:1},idiotPolicy:'dual-category-14'};
 const config=createBoardConfiguration(input);assert.equal(assertPlayableBoard(config).idiotPolicy,'dual-category-14');
 assert.equal(createBoardConfiguration({seatCount:11,roles:input.roles}).idiotPolicy,undefined);
 const snapshot:RoomBoardSnapshot={id:'custom',name:'Dual 11',ruleVersion:'2026-10-10-v1',composition:{seatCount:11,roleCounts:config.roles,ruleset:config.ruleset,playable:config.playable,idiotPolicy:'dual-category-14'}};
 const n=createNight(roster.map((role,i)=>({seat:i+1,role})),0,undefined,snapshot);n.phase='first_night_complete';n.engine!.stage='resolved';n.engine!.resolution={status:'settled',effects:[],deaths:[]};
 const d=createDay(n,firstDayRules,1000);exile(d,11);assert.equal(d.players[10].alive,true);assert.equal(d.deaths.some(p=>p.seat===11),false);assert.equal(privateDay(d,11).canInterject,false);
 const people=roster.map((role,i)=>({seat:i+1,role})),options={idiotPolicy:'dual-category-14' as const,flippedIdiots:[11]};
 assert.equal(manualDecision(people,[4,5,6,7],[],options).outcome,null);
 assert.equal(manualDecision(people,[8,9,10],[],options).outcome,'wolves');
 assert.equal(manualDecision(people,[4,5,6,7,11],[],options).outcome,'wolves');
 const next=createNight(d.players,2000,{night:2,antidote:true,poison:true,hunterSpent:false,priorityWolf:null,engine:d.engine},snapshot);beginNight(next,2000,()=>0);assert.equal(privateNight(next,1).legalTargets!.includes(11),true);
});

test('dual policy accepts every supported player count explicitly and still requires one real idiot',()=>{
 for(let seatCount=6;seatCount<=20;seatCount++){
  const roles={wolf:1,villager:seatCount-2,idiot:1};
  assert.equal(createBoardConfiguration({seatCount,roles,idiotPolicy:'dual-category-14'}).idiotPolicy,'dual-category-14');
  assert.equal(createBoardConfiguration({seatCount,roles}).idiotPolicy,undefined);
  const people=[{seat:1,role:'wolf' as const},...Array.from({length:seatCount-2},(_,i)=>({seat:i+2,role:'villager' as const})),{seat:seatCount,role:'idiot' as const}];
  assert.equal(manualDecision(people,[],[],{idiotPolicy:'dual-category-14',flippedIdiots:[]}).outcome,null);
  assert.equal(manualDecision(people,[],[],{idiotPolicy:'dual-category-14',flippedIdiots:[seatCount]}).outcome,'wolves');
 }
 assert.throws(()=>createBoardConfiguration({seatCount:12,roles:{wolf:3,villager:9},idiotPolicy:'dual-category-14'}),/INVALID_BOARD_CONFIGURATION/);
});
