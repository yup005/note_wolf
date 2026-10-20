import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LobbyStore} from '../packages/storage/lobby.js';
import {managementFixture} from './helpers/management-fixture.js';

// Catch disconnecting the host freezing automatic phases or silently granting another player management.
test('host disconnect leaves automatic nights running but public manual steps wait for the returning host',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now);
 try{
  const f=managementFixture(s),member=s.view(f.tokens[0],f.id).me.id;
  const day=(seat:number,action:string,extra={})=>s.dayCommand(f.tokens[seat-1],f.id,{action,turnId:s.snapshot(f.id).day!.turnId,...extra} as never);
  s.connectMember(f.id,member,'host');s.disconnectMember('host');
  for(let step=0;step<20&&s.snapshot(f.id).night!.phase!=='first_night_complete';step++){
   const n=s.snapshot(f.id).night!;assert.notEqual(n.deadline,null);now=n.deadline!;s.tickNights();assert.equal(s.snapshot(f.id).control!.status,'running');
  }
  assert.equal(s.snapshot(f.id).night!.phase,'first_night_complete');const completed=s.snapshot(f.id).night!.turnId;
  now+=1000000;s.tickNights();assert.equal(s.snapshot(f.id).night!.turnId,completed);assert.equal(s.snapshot(f.id).day,null);assert.equal(s.snapshot(f.id).control!.tempSeat,null);
  assert.throws(()=>s.enterDay(f.tokens[5],f.id),/HOST_ONLY/);assert.throws(()=>f.command(6,'delegate',{seat:7}),/HOST_ONLY/);
  s.connectMember(f.id,member,'host-return');s.enterDay(f.tokens[0],f.id);day(1,'close_signup');day(1,'continue');day(1,'continue');day(1,'speech_mode',{mode:'free'});
  assert.equal(s.snapshot(f.id).day!.phase,'free_speech');assert.equal(s.snapshot(f.id).day!.deadline,null);s.disconnectMember('host-return');const turn=s.snapshot(f.id).day!.turnId;
  now+=1000000;s.tickNights();assert.equal(s.snapshot(f.id).day!.turnId,turn);assert.throws(()=>day(6,'end_speech'),/NOT_YOUR_TURN/);assert.equal(s.snapshot(f.id).control!.tempSeat,null);
  s.connectMember(f.id,member,'host-again');day(1,'end_speech');assert.equal(s.snapshot(f.id).day!.phase,'vote_setup');
 }finally{s.close();}
});

// Catch an already authorized manager losing public controls with the host, or inheriting the host's secret skill.
test('a previously authorized temporary host can advance offline-host public steps but gains no secret role access',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now);
 try{
  const f=managementFixture(s),host=s.view(f.tokens[0],f.id).me.id;f.command(1,'delegate',{seat:6});s.connectMember(f.id,host,'host');s.disconnectMember('host');
  const wolf=s.snapshot(f.id).night!;assert.deepEqual(s.nightPrivate(f.tokens[5],f.id),{turnId:wolf.turnId,kind:'waiting'});
  assert.throws(()=>s.nightCommand(f.tokens[5],f.id,{action:'vote',target:8,turnId:wolf.turnId}),/NOT_YOUR_TURN/);
  let sawSeer=false;
  for(let step=0;step<20&&s.snapshot(f.id).night!.phase!=='first_night_complete';step++){
   const n=s.snapshot(f.id).night!;
   if(n.phase==='seer'){sawSeer=true;assert.equal(s.nightPrivate(f.tokens[0],f.id).kind,'seer');assert.deepEqual(s.nightPrivate(f.tokens[5],f.id),{turnId:n.turnId,kind:'waiting'});assert.throws(()=>s.nightCommand(f.tokens[5],f.id,{action:'seer',target:2,turnId:n.turnId}),/NOT_YOUR_TURN/);}
   now=n.deadline!;s.tickNights();
  }
  assert.equal(sawSeer,true);
  s.enterDay(f.tokens[5],f.id);const day=(action:string,extra={})=>s.dayCommand(f.tokens[5],f.id,{action,turnId:s.snapshot(f.id).day!.turnId,...extra} as never);
  day('close_signup');day('continue');day('continue');day('speech_mode',{mode:'free'});day('end_speech');assert.equal(s.snapshot(f.id).day!.phase,'vote_setup');
  assert.equal(s.view(f.tokens[5],f.id).me.isHost,false);assert.equal(s.snapshot(f.id).control!.tempSeat,6);assert.throws(()=>f.command(6,'delegate',{seat:7}),/HOST_ONLY/);
  s.connectMember(f.id,host,'returned');f.command(1,'delegate',{seat:null});assert.throws(()=>f.command(6,'pause'),/HOST_ONLY/);
 }finally{s.close();}
});
