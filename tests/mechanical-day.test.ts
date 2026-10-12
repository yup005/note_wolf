import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {BoardRole,RoomBoardSnapshot} from '../packages/contracts/board.js';
import type {DayCommand} from '../packages/contracts/day.js';
import {firstDayRules,dayCommandSchema} from '../packages/contracts/day.js';
import {createNight,type NightPlayer} from '../packages/domain/night.js';
import {createDay,dayCommand,advanceDay,privateDay,publicDay,type DayState} from '../packages/domain/day.js';
import {createConfirmedEngineState,learnConfirmedEngineAbility} from '../packages/domain/mechanicalEngine.js';
import {createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {evaluateVictory,type VictoryPlayer} from '../packages/domain/victory.js';

type Command<T>=T extends unknown?Omit<T,'turnId'>:never;
const roles:BoardRole[]=['wolf','mechanicalWolf','villager','villager','spiritSeer','hunter','idiot','witch','guard'];
function fixture(roster=roles){
 const counts=Object.fromEntries(roster.map(role=>[role,roster.filter(r=>r===role).length]));
 const config=createBoardConfiguration({seatCount:roster.length,roles:counts});
 const board:RoomBoardSnapshot={id:'test',name:'test',ruleVersion:'2026-10-10-v1',composition:{seatCount:roster.length,roleCounts:config.roles,ruleset:config.ruleset,playable:config.playable}};
 const engine=createConfirmedEngineState(board,roster.map((role,i)=>({seat:i+1,role,knifeGroup:role==='wolf'?'shared':role==='mechanicalWolf'?'mechanical':role==='armoredWolf'?'armor':'none'})));
 const n=Object.assign(createNight(roster.map((role,i)=>({seat:i+1,role})) as NightPlayer[],0),{engine});n.phase='first_night_complete';
 return n;
}
function cmd(s:DayState,seat:number,c:Command<DayCommand>,now=1000,isHost=seat===1){dayCommand(s,{seat,isHost},{...c,turnId:s.turnId} as DayCommand,now,()=>0);}
function dawn(n=fixture()){if(n.engine.resolution===null){n.engine.resolution={status:'settled',effects:[],deaths:[]};n.engine.stage='resolved';}return createDay(n,firstDayRules,1000);}
function announce(s:DayState){cmd(s,1,{action:'start'});cmd(s,1,{action:'close_signup'});cmd(s,1,{action:'continue'});}
function exile(s:DayState,seat:number){s.phase='vote_result';s.result={purpose:'exile',counts:[{seat,votes:1}],leaders:[seat]};cmd(s,1,{action:'continue'});}
function speech(s:DayState,seat=3,now=1000){s.phase='day_speech';s.speaker=seat;s.speakers=[4];s.deadline=now+90000;s.turnId=randomUUID();}

test('day contract accepts custom seats while runtime still validates membership',()=>{
 assert.equal(dayCommandSchema.safeParse({action:'record_shot',turnId:randomUUID(),target:15}).success,true);
 assert.equal(dayCommandSchema.safeParse({action:'record_shot',turnId:randomUUID(),target:257}).success,false);
});
test('settled engine death sources replace raw knife/save and poison overrides shot eligibility',()=>{
 const n=fixture();n.knife=3;n.witchChoice={choice:'save',target:3};
 n.engine.resolution={status:'settled',effects:[{id:'reflected',actionId:'p',casterId:6,targetId:3,abilityType:'poison',sourceRole:'hunter',ruleset:'mechanical-seer',night:1,outcome:'killed',reflectTarget:6,preventedBy:[]}],deaths:[{seat:6,sourceEffectIds:['reflected']}]};
 n.engine.players[5].alive=false;n.engine.players[5].publicState.canVote=false;
 const s=dawn(n);assert.deepEqual(s.pendingDeaths,[{seat:6,reason:'poison'}]);assert.equal(s.players[5].alive,true);
 assert.equal(JSON.stringify(publicDay(s,1000)).includes('reflected'),false);
 announce(s);assert.equal(s.players[5].alive,false);cmd(s,1,{action:'continue'});assert.equal(privateDay(s,6).canShoot,false);
});
test('mechanical hunter shot uses independent inventory and publicly flips as hunter',()=>{
 const n=fixture();const learned=learnConfirmedEngineAbility(n.engine,2,6,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);exile(s,2);assert.equal(s.phase,'death_skill');assert.equal(privateDay(s,2).canShoot,true);
 cmd(s,2,{action:'shoot'});assert.deepEqual(s.revealed,[{seat:2,role:'hunter'}]);assert.equal(s.hunterSpent,false);
 assert.equal(s.engine!.players[1].abilities.skills.find(a=>a.kind==='shot')!.remaining,0);
 assert.equal(s.engine!.players[5].abilities.skills.find(a=>a.kind==='shot')!.remaining,1);
 cmd(s,1,{action:'record_shot',target:3});assert.equal(s.players[2].alive,false);
 assert.equal(privateDay(s,2).canExplode,false);
});
test('last mechanical hunter is terminal before shot and truth revealed only at game end',()=>{
 const n=fixture(roles.slice(1));const learned=learnConfirmedEngineAbility(n.engine,1,5,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);exile(s,1);assert.equal(s.phase,'ended');assert.equal(s.winner,'good');assert.equal(privateDay(s,1).canShoot,false);
});
test('last mechanical idiot exile grants hidden extra night with ordinary idiot presentation',()=>{
 const n=fixture(roles.slice(1));const learned=learnConfirmedEngineAbility(n.engine,1,6,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);exile(s,1);assert.equal(s.winner,null);assert.equal(s.extraNightSeat,1);assert.deepEqual(s.revealed,[{seat:1,role:'idiot'}]);
 const publicValue=JSON.stringify(publicDay(s,1000));assert.equal(publicValue.includes('mechanical'),false);assert.equal(publicValue.includes('extraNight'),false);
 assert.equal(s.players[0].alive,false);assert.equal(s.engine!.players[0].alive,false);
});
test('mechanical idiot cannot postpone an already completed wolf elimination victory',()=>{
 const n=fixture(roles.slice(1));const learned=learnConfirmedEngineAbility(n.engine,1,6,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);s.players.filter(p=>p.role==='villager').forEach(p=>{p.alive=false;});exile(s,1);assert.equal(s.phase,'ended');assert.equal(s.winner,'wolves');assert.equal(s.extraNightSeat??null,null);
});
test('ordinary idiot flip grants independent cumulative interjection budget and preserves original speaker timer',()=>{
 const s=dawn();announce(s);exile(s,7);speech(s);
 assert.equal(privateDay(s,7).canInterject,true);assert.equal(privateDay(s,7).interjectionRemainingMs,15000);
 cmd(s,7,{action:'interject'},11000);assert.equal(s.deadline,26000);assert.deepEqual(publicDay(s,11000).interjection,{seat:7,originalSpeaker:3});
 assert.throws(()=>cmd(s,4,{action:'end_interjection'},12000),/NOT_YOUR_TURN/);
 assert.throws(()=>cmd(s,1,{action:'end_speech'},12000),/PHASE_LOCKED/);
 cmd(s,7,{action:'end_interjection'},16000);assert.equal(s.deadline,96000);assert.equal(privateDay(s,7).interjectionRemainingMs,10000);
 cmd(s,7,{action:'interject'},17000);assert.equal(s.deadline,27000);advanceDay(s,27000);assert.equal(s.speaker,3);assert.equal(s.deadline,106000);assert.equal(privateDay(s,7).canInterject,false);
 assert.throws(()=>cmd(s,7,{action:'interject'},28000),/NOT_YOUR_TURN/);
 cmd(s,3,{action:'end_speech'},28000);assert.equal(s.speaker,4);assert.equal(privateDay(s,7).interjectionRemainingMs,15000);
});
test('multiple flipped idiots have separate budgets and only active speaker can end an interjection',()=>{
 const n=fixture();const learned=learnConfirmedEngineAbility(n.engine,2,7,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);exile(s,7);exile(s,2);speech(s);
 cmd(s,7,{action:'interject'},2000);advanceDay(s,17000);assert.equal(privateDay(s,7).canInterject,false);assert.equal(privateDay(s,2).canInterject,true);
 cmd(s,2,{action:'interject'},18000);cmd(s,1,{action:'end_interjection'},23000);assert.equal(privateDay(s,2).interjectionRemainingMs,10000);assert.equal(privateDay(s,7).interjectionRemainingMs,0);
});
test('mixer model is available privately to itself while public state excludes it',()=>{
 const n=fixture([...roles,'mixer']);n.engine.players[9].model={seat:2,camp:'wolves'};const s=dawn(n);
 assert.deepEqual(privateDay(s,10).mixerModel,{seat:2});assert.equal(privateDay(s,1).mixerModel,undefined);
 assert.equal(JSON.stringify(publicDay(s,1000)).includes('mixerModel'),false);
});
test('confirmed standard twelve with mixed blood requires all four civilian identities dead',()=>{
 const roster:BoardRole[]=['wolf','wolf','wolf','wolf','villager','villager','villager','seer','witch','hunter','idiot','mixer'];
 const players:VictoryPlayer[]=roster.map((role,i)=>({seat:i+1,role,alive:true,...(role==='mixer'?{modelSeat:1,modelCamp:'wolves' as const}:{})}));
 const threeVillagersDead=players.map(p=>({...p,alive:p.role!=='villager'}));
 assert.deepEqual(evaluateVictory(threeVillagersDead,'mechanical-seer'),{status:'playing'});
 const mixerAndTwoDead=players.map(p=>({...p,alive:![5,6,12].includes(p.seat)}));
 assert.deepEqual(evaluateVictory(mixerAndTwoDead,'mechanical-seer'),{status:'playing'});
 const allCiviliansDead=players.map(p=>({...p,alive:!['villager','mixer'].includes(p.role)}));
 assert.deepEqual(evaluateVictory(allCiviliansDead,'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-villagers-dead',personalResults:[{seat:12,won:true}]});
});
test('standard twelve mixed blood personal victory follows its model original camp',()=>{
 const roster:BoardRole[]=['wolf','wolf','wolf','wolf','villager','villager','villager','seer','witch','hunter','idiot','mixer'];
 const players:VictoryPlayer[]=roster.map((role,i)=>({seat:i+1,role,alive:!['villager','mixer'].includes(role),...(role==='mixer'?{modelSeat:8,modelCamp:'good' as const}:{})}));
 assert.deepEqual(evaluateVictory(players,'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-villagers-dead',personalResults:[{seat:12,won:false}]});
});
test('independent interjection does not remove ordinary wolf legal explosion rights',()=>{
 const s=dawn();announce(s);exile(s,7);speech(s);cmd(s,7,{action:'interject'},2000);
 assert.equal(privateDay(s,1).canExplode,true);cmd(s,1,{action:'explode',confirmed:true},3000);
 assert.equal(s.interjection,null);assert.equal(s.phase,'night_announcement');assert.equal(s.players[0].alive,false);
});
test('interjection permissions and budgets survive serialized refresh without restoring votes',()=>{
 const s=dawn();announce(s);exile(s,7);speech(s);cmd(s,7,{action:'interject'},2000);
 const restored:DayState=JSON.parse(JSON.stringify(s));advanceDay(restored,17000);assert.equal(privateDay(restored,7).canInterject,false);
 cmd(restored,3,{action:'end_speech'},18000);cmd(restored,4,{action:'end_speech'},18000);
 assert.equal(restored.vote!.eligible.includes(7),false);assert.equal(privateDay(restored,7).canVote,false);
});
test('extra night announcement ends good if no wolf threshold was reached',()=>{
 const n=fixture(roles.slice(1));const learned=learnConfirmedEngineAbility(n.engine,1,6,{copyId:'copy'});assert.equal(learned.status,'learned');if(learned.status!=='learned')return;n.engine=learned.state;
 const s=dawn(n);announce(s);exile(s,1);
 const extra=Object.assign(createNight(s.players,2000),{engine:s.engine!,extraNightSeat:s.extraNightSeat});extra.night=2;extra.phase='first_night_complete';extra.engine.resolution={status:'settled',effects:[],deaths:[]};
 const next=createDay(extra,firstDayRules,3000,s);cmd(next,1,{action:'start'},3000);cmd(next,1,{action:'continue'},3000);
 assert.equal(next.winner,'good');assert.equal(next.phase,'ended');assert.equal(next.extraNightSeat,null);
});
