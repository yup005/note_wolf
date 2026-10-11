import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nightCommandSchema} from '../packages/contracts/night.js';
import {createNight,beginNight,advanceNight,nightCommand,privateNight,publicNight,type NightPlayer,type NightCarry} from '../packages/domain/night.js';

const players:NightPlayer[]=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','seer','hunter','idiot'].map((role,i)=>({seat:i+1,role:role as NightPlayer['role']}));
const carry:NightCarry={night:2,antidote:false,poison:true,hunterSpent:true,priorityWolf:null};
const livingExcept=(...seats:number[])=>players.map(p=>({...p,alive:!seats.includes(p.seat)}));
function start(roster=players,resources=carry){const s=createNight(roster,1000,resources);beginNight(s,1000,()=>0);return s;}

test('later nights expose their round and inherit spent drugs and hunter use',()=>{
 const s=start();assert.equal(publicNight(s,1000).night,2);
 advanceNight(s,186000);assert.equal(privateNight(s,9).antidote,false);assert.equal(privateNight(s,9).poison,true);
 assert.equal('knife' in privateNight(s,9),false);
 assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'save',target:5,turnId:s.turnId},187000),/POTION_UNAVAILABLE/);
 advanceNight(s,286000);assert.deepEqual(privateNight(s,11),{turnId:s.turnId,kind:'waiting'});
 assert.throws(()=>nightCommand(s,11,{action:'hunter_seen',turnId:s.turnId},287000),/NOT_YOUR_TURN/);
 advanceNight(s,316000);assert.equal(s.phase,'first_night_complete');
});

test('dead role windows retain timing but expose no private actions or results',()=>{
 const s=start(livingExcept(1,9,10,11));assert.equal(s.confirmer,2);
 assert.deepEqual(publicNight(s,1000).alive,[2,3,4,5,6,7,8,12]);
 assert.deepEqual(privateNight(s,1),{turnId:s.turnId,kind:'waiting'});
 assert.throws(()=>nightCommand(s,1,{action:'vote',target:5,turnId:s.turnId},2000),/NOT_YOUR_TURN/);
 for(const [at,role,seat,action] of [[186000,'witch',9,{action:'witch',choice:'poison',target:5}],[221000,'seer',10,{action:'seer',target:2}],[256000,'hunter',11,{action:'hunter_seen'}]] as const){
  advanceNight(s,at);assert.equal(s.phase,role);assert.deepEqual(privateNight(s,seat),{turnId:s.turnId,kind:'waiting'});
  assert.throws(()=>nightCommand(s,seat,{...action,turnId:s.turnId},at+1),/NOT_YOUR_TURN/);
 }
 advanceNight(s,316000);assert.equal(s.phase,'first_night_complete');assert.equal(s.poison,true);
});

test('wolves, witch and seer can only select living targets',()=>{
 const s=start(livingExcept(5));assert.throws(()=>nightCommand(s,1,{action:'vote',target:5,turnId:s.turnId},2000),/INVALID_INPUT/);
 advanceNight(s,186000);assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'poison',target:5,turnId:s.turnId},187000),/INVALID_INPUT/);assert.equal(s.poison,true);
 advanceNight(s,221000);assert.throws(()=>nightCommand(s,10,{action:'seer',target:5,turnId:s.turnId},222000),/INVALID_INPUT/);assert.equal(s.seerCheck,null);
});

test('priority wolf proposal is private and only its explicit commit can end wolves early',()=>{
 const s=start(livingExcept(1),{...carry,priorityWolf:1});const turnId=s.turnId;
 nightCommand(s,2,{action:'vote',target:6,turnId},2000);
 assert.throws(()=>nightCommand(s,2,{action:'confirm_wolves',turnId},2001),/PRIORITY_WOLF_ONLY/);
 nightCommand(s,1,{action:'vote',target:7,turnId},2100);const view=privateNight(s,2);
 assert.equal(view.priorityWolf,1);assert.equal(view.priorityTarget,7);assert.equal(view.priorityCommitted,false);
 assert.deepEqual(view.wolves,[2,3,4]);assert.deepEqual(view.votes,[{seat:2,target:6}]);assert.equal(s.phase,'wolves');
 const publicJson=JSON.stringify(publicNight(s,2100));for(const key of ['priorityWolf','priorityTarget','priorityCommitted'])assert.equal(publicJson.includes(key),false);
 assert.deepEqual(privateNight(s,5),{turnId,kind:'waiting'});
 const command=nightCommandSchema.parse({action:'priority_knife',target:8,turnId});
 assert.throws(()=>nightCommand(s,3,command,2200),/PRIORITY_WOLF_ONLY/);
 nightCommand(s,1,command,2300);assert.equal(s.knife,8);assert.equal(s.priorityCommitted,true);assert.equal(s.phase,'eyes_closed');assert.equal(s.deadline,7300);
 assert.throws(()=>nightCommand(s,1,command,2400),/STALE_TURN/);
});

test('priority wolf can explicitly commit an empty knife even when living wolves voted',()=>{
 const s=start(livingExcept(1),{...carry,priorityWolf:1});nightCommand(s,2,{action:'vote',target:6,turnId:s.turnId},2000);
 nightCommand(s,1,nightCommandSchema.parse({action:'priority_knife',target:null,turnId:s.turnId}),2100);
 assert.equal(s.knife,null);assert.equal(s.priorityCommitted,true);assert.equal(s.phase,'eyes_closed');
});

test('unconfirmed priority expires at the hard deadline and falls back to living wolf last votes',()=>{
 const s=start(livingExcept(1),{...carry,priorityWolf:1});const turnId=s.turnId;
 nightCommand(s,1,{action:'vote',target:8,turnId},2000);nightCommand(s,2,{action:'vote',target:6,turnId},2100);nightCommand(s,2,{action:'vote',target:7,turnId},2200);
 advanceNight(s,180999);assert.equal(s.phase,'wolves');assert.equal(s.deadline,181000);
 assert.throws(()=>nightCommand(s,1,nightCommandSchema.parse({action:'priority_knife',target:8,turnId}),181000),/STALE_TURN/);
 assert.equal(s.knife,7);assert.equal(s.priorityCommitted,false);assert.equal(s.phase,'eyes_closed');
});

test('priority authority requires a dead wolf with a living ally and is absent by default next night',()=>{
 for(const [roster,seat] of [[players,1],[livingExcept(5),5],[livingExcept(1,2,3,4),1]] as const){const s=start(roster,{...carry,priorityWolf:seat});assert.equal(s.priorityWolf,null);}
 const s=start(livingExcept(1),{...carry,priorityWolf:1});advanceNight(s,316000);
 const next=createNight(s.players,400000);beginNight(next,400000,()=>0);assert.equal(privateNight(next,2).priorityWolf,null);
 assert.throws(()=>nightCommand(next,1,nightCommandSchema.parse({action:'priority_knife',target:8,turnId:next.turnId}),400001),/NOT_YOUR_TURN/);
});

test('priority wolf cannot knife a dead seat',()=>{
 const s=start(livingExcept(1,5),{...carry,priorityWolf:1});
 assert.throws(()=>nightCommand(s,1,nightCommandSchema.parse({action:'priority_knife',target:5,turnId:s.turnId}),2000),/INVALID_INPUT/);
 assert.equal(s.phase,'wolves');assert.equal(s.priorityCommitted,false);
});

test('spent antidote keeps all subsequent knife targets hidden',()=>{
 const first=createNight(players,1000);beginNight(first,1000,()=>0);nightCommand(first,1,{action:'vote',target:5,turnId:first.turnId},1100);nightCommand(first,1,{action:'confirm_wolves',turnId:first.turnId},1200);advanceNight(first,6200);
 nightCommand(first,9,{action:'witch',choice:'save',target:5,turnId:first.turnId},6300);assert.equal(privateNight(first,9).witchReceipt?.target,5);
 const next=start(players,{...carry,antidote:first.antidote,poison:first.poison,hunterSpent:false});nightCommand(next,1,{action:'vote',target:6,turnId:next.turnId},1100);nightCommand(next,1,{action:'confirm_wolves',turnId:next.turnId},1200);advanceNight(next,6200);
 assert.equal('knife' in privateNight(next,9),false);assert.equal(next.knife,6);
});
test('witch confirmation immediately closes her window, preserves an own-only receipt and rejects self-save',()=>{
 for(const choice of ['poison','skip'] as const){const s=createNight(players,0);beginNight(s,0,()=>0);nightCommand(s,1,{action:'vote',target:9,turnId:s.turnId},100);nightCommand(s,1,{action:'confirm_wolves',turnId:s.turnId},200);advanceNight(s,5200);const turn=s.turnId;assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'save',target:9,turnId:turn},5300),/CANNOT_SELF_SAVE/);assert.equal(s.antidote,true);nightCommand(s,9,{action:'witch',choice,target:choice==='poison'?11:null,turnId:turn},5400);assert.equal(s.phase,'eyes_closed');assert.equal(s.deadline,10400);assert.deepEqual(privateNight(s,9).witchReceipt,{choice,target:choice==='poison'?11:null});assert.equal(privateNight(s,10).witchReceipt,undefined);assert.throws(()=>nightCommand(s,9,{action:'witch',choice:'save',target:9,turnId:turn},5500),/ALREADY_COMMITTED/);assert.equal(s.antidote,true);advanceNight(s,10400);assert.equal(s.phase,'seer');}
});

test('first-night witch has 60 seconds; all later god windows are 30 seconds including dead roles',()=>{
 for(const night of [1,2,3])for(const roster of [players,livingExcept(9,10,11)]){const s=start(roster,{...carry,night});advanceNight(s,186000);assert.equal(s.phase,'witch');assert.equal(s.deadline,night===1?246000:216000);advanceNight(s,s.deadline!+5000);assert.equal(s.phase,'seer');const seerStart=s.deadline!-30000;assert.equal(s.deadline!-seerStart,30000);advanceNight(s,s.deadline!+5000);assert.equal(s.phase,'hunter');assert.equal(s.deadline!-s.events.at(-1)!.at,30000);}
});

test('seer keeps result until explicit finish, hunter confirmation ends immediately, retries never repeat skills',()=>{
 const s=start(players,{...carry,night:1,hunterSpent:false,antidote:true});advanceNight(s,251000);const turn=s.turnId;assert.throws(()=>nightCommand(s,10,{action:'seer_finish',turnId:turn},251001),/RESULT_NOT_READY/);nightCommand(s,10,{action:'seer',target:1,turnId:turn},251002);assert.equal(s.phase,'seer');assert.equal(privateNight(s,10).result,'wolf');assert.throws(()=>nightCommand(s,5,{action:'seer_finish',turnId:turn},251003),/NOT_YOUR_TURN/);nightCommand(s,10,{action:'seer_finish',turnId:turn},251004);assert.equal(s.phase,'eyes_closed');assert.equal(s.deadline,256004);assert.equal(privateNight(s,10).skillReceipt?.result,'wolf');assert.equal(privateNight(s,5).skillReceipt,undefined);nightCommand(s,10,{action:'seer_finish',turnId:turn},251005);assert.equal(s.deadline,256004);assert.equal(s.events.filter(e=>e.type==='seer_check').length,1);advanceNight(s,256004);assert.equal(s.phase,'hunter');assert.equal(privateNight(s,10).skillReceipt,undefined);const hunterTurn=s.turnId;nightCommand(s,11,{action:'hunter_seen',turnId:hunterTurn},256005);assert.equal(s.phase,'first_night_complete');assert.equal(privateNight(s,11).skillReceipt?.canShoot,true);nightCommand(s,11,{action:'hunter_seen',turnId:hunterTurn},256006);assert.equal(s.events.filter(e=>e.type==='hunter_seen').length,1);assert.equal(privateNight(s,5).skillReceipt,undefined);
});
