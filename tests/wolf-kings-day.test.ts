import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {createNight} from '../packages/domain/night.js';
import {createDay,dayCommand,privateDay,publicDay,advanceDay,type DayState} from '../packages/domain/day.js';
import {firstDayRules,type DayCommand} from '../packages/contracts/day.js';
import type {BoardRole,RoomBoardSnapshot} from '../packages/contracts/board.js';
import {learnConfirmedEngineAbility} from '../packages/domain/mechanicalEngine.js';
import {useConfirmedAbility} from '../packages/domain/mechanicalAbilities.js';

const black='blackWolf' as BoardRole,white='whiteWolf' as BoardRole;
const roster:BoardRole[]=[white,black,'wolf','mechanicalWolf','armoredWolf','villager','villager','seer','witch','hunter','guard'];
function fixture(roles=roster,copy?:{seat:number;target:number}){
 const counts:Partial<Record<BoardRole,number>>={};for(const r of roles)counts[r]=(counts[r]??0)+1;const c=createBoardConfiguration({seatCount:roles.length,roles:counts});
 const b:RoomBoardSnapshot={id:'kings',name:'Kings',ruleVersion:'2026-10-10-v1',composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
 const n=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,b);
 if(copy){const result=learnConfirmedEngineAbility(n.engine!,copy.seat,copy.target,{copyId:'copy'});assert.equal(result.status,'learned');if(result.status==='learned')n.engine=result.state;}
 n.phase='first_night_complete';n.engine!.stage='resolved';n.engine!.resolution={status:'settled',effects:[],deaths:[]};return createDay(n,firstDayRules,1000);
}
type Command<T>=T extends unknown?Omit<T,'turnId'>:never;
function cmd(s:DayState,c:Command<DayCommand>,seat=6,host=true){dayCommand(s,{seat,isHost:host},{...c,turnId:s.turnId} as DayCommand,1000,()=>0);}
function exile(s:DayState,seat:number){s.phase='vote_result';s.result={purpose:'exile',counts:[{seat,votes:1}],leaders:[seat]};cmd(s,{action:'continue'});}
function fakeDeath(s:DayState,seat:number,reason:DayState['deaths'][number]['reason']){s.players[seat-1].alive=false;s.engine!.players[seat-1].alive=false;s.deaths.push({seat,reason});s.currentDeath=seat;s.phase='death_skill';s.deadline=11000;s.turnId=randomUUID();}
function explode(s:DayState,seat=1){s.phase='free_speech';s.deadline=null;cmd(s,{action:'explode',confirmed:true},seat,false);}

for(const reason of ['knife','exile','shot','poison','explosion','white-wolf'] as const)test(`black king shot eligibility for ${reason}`,()=>{
 const s=fixture();fakeDeath(s,2,reason as DayState['deaths'][number]['reason']);assert.equal(privateDay(s,2).canShoot,!['poison','explosion'].includes(reason));
});

test('copied black king retains gun-death trigger while a copied hunter does not gain it',()=>{
 const s=fixture(roster,{seat:4,target:2});fakeDeath(s,4,'shot');assert.equal(privateDay(s,4).canShoot,true);cmd(s,{action:'shoot'},4,false);assert.equal(s.revealed.find(p=>p.seat===4)?.role,black);assert.equal(s.engine!.players[3].abilities.skills[0].remaining,0);assert.equal(s.engine!.players[1].abilities.skills[0].remaining,1);
 const hunter=fixture(roster,{seat:4,target:10});fakeDeath(hunter,4,'shot');assert.equal(privateDay(hunter,4).canShoot,false);
});

test('black shot authorization agrees with capability profile and refuses poison/terminal verdicts',()=>{
 const s=fixture(),p=s.engine!.players[1];p.alive=false;const skill=p.abilities.skills[0],context={ruleset:s.engine!.board.composition.ruleset,players:s.engine!.players,settledVictory:{status:'playing' as const},deathCauses:['shot' as const]};
 assert.equal(useConfirmedAbility(p.abilities,skill.id,{requestId:'gun',night:1,target:6},context).status,'used');
 assert.throws(()=>useConfirmedAbility(p.abilities,skill.id,{requestId:'poison',night:1,target:6},{...context,deathCauses:['poison']}),/SHOT_NOT_AUTHORIZED/);
 assert.throws(()=>useConfirmedAbility(p.abilities,skill.id,{requestId:'ended',night:1,target:6},{...context,settledVictory:{status:'ended',winner:'good',reason:'all-wolves-dead'}}),/SHOT_NOT_AUTHORIZED/);
});

test('last actual black king is terminal before opening a gun window',()=>{
 const s=fixture([black,'villager','villager','seer','witch','hunter']);s.phase='vote_result';s.result={purpose:'exile',counts:[{seat:1,votes:1}],leaders:[1]};cmd(s,{action:'continue'},2);assert.equal(s.phase,'ended');assert.equal(s.winner,'good');assert.equal(privateDay(s,1).canShoot,false);
});

test('white king explosion is victory-first and nonterminal carry is host-recorded exactly once',()=>{
 const s=fixture();explode(s);assert.equal(s.phase,'white_wolf_target');assert.equal(s.currentDeath,1);assert.equal(s.players[0].alive,false);assert.equal(s.engine!.players[0].abilities.skills[0].remaining,0);
 const turn=s.turnId;assert.throws(()=>cmd(s,{action:'record_take',target:7},7,false),/HOST_ONLY/);assert.throws(()=>cmd(s,{action:'record_take',target:1}),/INVALID_INPUT/);
 cmd(s,{action:'record_take',target:7});assert.equal(s.players[6].alive,false);assert.equal(s.deaths.find(d=>d.seat===7)?.reason,'white-wolf');assert.equal(s.events.filter(e=>e.type==='white_wolf_take').length,1);
 assert.throws(()=>dayCommand(s,{seat:6,isHost:true},{action:'record_take',target:8,turnId:turn},1000),/STALE_TURN/);assert.equal(s.players[7].alive,true);
 const serialized=JSON.stringify(publicDay(s,1000));for(const secret of ['copiedFrom','originalRole','abilities','poison','swallow'])assert.equal(serialized.includes('"'+secret+'"'),false);
});

test('last actual white king ends before carrying even when its target could eliminate the last civilian',()=>{
 const s=fixture([white,'villager','witch']);s.phase='free_speech';s.deadline=null;cmd(s,{action:'explode',confirmed:true},1,false);assert.equal(s.phase,'ended');assert.equal(s.winner,'good');assert.equal(s.players[1].alive,true);assert.equal(s.engine!.players[0].abilities.skills[0].remaining,1);
});

for(const seat of [4,5])test(`copied white king first post-learning day explosion is enabled for seat ${seat}`,()=>{
 const s=fixture(roster,{seat,target:1});s.phase='free_speech';assert.equal(privateDay(s,seat).canExplode,true);cmd(s,{action:'explode',confirmed:true},seat,false);assert.equal(s.phase,'white_wolf_target');assert.equal(s.revealed.find(p=>p.seat===seat)?.role,white);assert.equal(s.engine!.players[seat-1].camp,'wolves');assert.equal(s.engine!.players[0].abilities.skills[0].remaining,1);
 const unlearned=fixture();unlearned.phase='free_speech';assert.equal(privateDay(unlearned,seat).canExplode,false);
});

test('poisoned white king and copied white king may swallow on sheriff phases without carrying',()=>{
 for(const seat of [1,4]){const s=fixture(roster,seat===4?{seat:4,target:1}:undefined);s.pendingDeaths=[{seat,reason:'poison'}];s.phase='sheriff_signup';assert.equal(privateDay(s,seat).canExplode,true);cmd(s,{action:'explode',confirmed:true},seat,false);assert.equal(s.phase,'night_announcement');assert.equal(s.engine!.players[seat-1].abilities.skills[0].remaining,1);assert.equal(s.priorityWolf,null);assert.equal(s.events.some(e=>e.type==='white_wolf_take'),false);assert.equal(JSON.stringify(publicDay(s,1000)).includes('吞毒'),false);}
});

test('white carry enters hunter and black death skills',()=>{
 for(const target of [2,10]){const s=fixture();explode(s);cmd(s,{action:'record_take',target});assert.equal(s.phase,'death_skill');assert.equal(s.currentDeath,target);assert.equal(privateDay(s,target).canShoot,true);cmd(s,{action:'shoot'},target,false);cmd(s,{action:'record_shot',target:8});assert.equal(s.players[7].alive,false);}
});

test('white explosion uses ordinary legal phase and exile-PK restrictions',()=>{
 for(const roleSeat of [1,2]){const s=fixture();s.phase='voting';s.vote={purpose:'exile',method:'phone',visibility:'totals',candidates:[1,2,6],eligible:[1,2,6],ballots:{}};assert.equal(privateDay(s,roleSeat).canExplode,false);assert.throws(()=>cmd(s,{action:'explode',confirmed:true},roleSeat,false),/NOT_YOUR_TURN|PHASE_LOCKED/);}
 const pk=fixture();pk.phase='day_speech';pk.speaker=1;pk.vote={purpose:'exile_pk',method:'phone',visibility:'totals',candidates:[1,6],eligible:[2,7],ballots:{}};assert.equal(privateDay(pk,1).canExplode,false);
});

test('repeated white kings spend independent inventory and a carried sheriff transfers badge',()=>{
 const s=fixture(['whiteWolf','whiteWolf','blackWolf','wolf','villager','villager','witch','hunter']);s.sheriff=5;s.badge='elected';explode(s);assert.equal(s.engine!.players[0].abilities.skills[0].remaining,0);assert.equal(s.engine!.players[1].abilities.skills[0].remaining,1);cmd(s,{action:'record_take',target:5});assert.equal(s.phase,'death_skill');assert.equal(s.currentDeath,5);advanceDay(s,s.deadline!);assert.equal(s.phase,'badge_transfer');assert.equal(s.currentDeath,5);
 dayCommand(s,{seat:5,isHost:false},{action:'transfer_badge',target:6,turnId:s.turnId},11000);assert.equal(s.sheriff,6);
});

test('white explosion resolves other pending deaths before opening a carry target',()=>{
 const s=fixture(['whiteWolf','wolf','villager','witch']);s.pendingDeaths=[{seat:2,reason:'knife'}];s.phase='sheriff_signup';cmd(s,{action:'explode',confirmed:true},1,false);assert.equal(s.phase,'ended');assert.equal(s.winner,'good');assert.equal(s.players[2].alive,true);assert.equal(s.engine!.players[0].abilities.skills[0].remaining,1);
});
