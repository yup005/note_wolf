import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceFixture} from './helpers/voice-fixture.js';

// Catch replacement of a disconnected confirmer or a reset/extension of the wolf clock.
test('wolf confirmer reconnects after fifteen seconds with the same authority and original deadline',()=>{
 const f=voiceFixture();const {store:s,tokens:t,id}=f;
 try{
  const night=s.snapshot(id).night!,turnId=night.turnId,deadline=night.deadline!;
  const confirmer=s.nightPrivate(t[0],id).confirmer!,token=t[confirmer-1];
  const other=[1,2,3,4].find(seat=>seat!==confirmer)!,member=s.view(token,id).me.id;
  s.connectMember(id,member,'confirmer-before');
  s.connectMember(id,s.view(t[other-1],id).me.id,'other-wolf');
  s.nightCommand(t[other-1],id,{action:'vote',target:8,turnId});
  f.setNow(2000);s.disconnectMember('confirmer-before');
  for(const now of [17000,90000]){
   f.setNow(now);s.tickNights();
   assert.equal(s.snapshot(id).night!.turnId,turnId);
   assert.equal(s.snapshot(id).night!.deadline,deadline);
   assert.equal(s.nightPrivate(t[other-1],id).confirmer,confirmer);
   assert.throws(()=>s.nightCommand(t[other-1],id,{action:'confirm_wolves',turnId}),/CONFIRMER_ONLY/);
  }
  s.connectMember(id,member,'confirmer-returned');
  const restored=s.nightPrivate(token,id);
  assert.equal(restored.confirmer,confirmer);assert.deepEqual(restored.votes,[{seat:other,target:8}]);
  assert.equal(s.snapshot(id).night!.deadline,deadline);
  s.nightCommand(token,id,{action:'confirm_wolves',turnId});
  assert.equal(s.snapshot(id).night!.phase,'eyes_closed');
  f.setNow(95000);s.tickNights();
  assert.equal(s.nightPrivate(t[9],id).knife,8);
  assert.deepEqual(s.nightPrivate(t[4],id),{turnId:s.snapshot(id).night!.turnId,kind:'waiting'});
 }finally{s.close();}
});

test('offline confirmer expires at the original deadline using latest valid wolf votes without leaking the knife',()=>{
 const f=voiceFixture();const {store:s,tokens:t,id}=f;
 try{
  const night=s.snapshot(id).night!,turnId=night.turnId,deadline=night.deadline!;
  const confirmer=s.nightPrivate(t[0],id).confirmer!,token=t[confirmer-1];
  const others=[1,2,3,4].filter(seat=>seat!==confirmer),member=s.view(token,id).me.id;
  s.connectMember(id,member,'confirmer-offline');
  for(const seat of others)s.connectMember(id,s.view(t[seat-1],id).me.id,`online-wolf-${seat}`);
  s.disconnectMember('confirmer-offline');
  s.nightCommand(t[others[0]-1],id,{action:'vote',target:7,turnId});
  s.nightCommand(t[others[0]-1],id,{action:'vote',target:6,turnId});
  s.nightCommand(t[others[1]-1],id,{action:'vote',target:6,turnId});
  f.setNow(deadline-1);s.tickNights();
  assert.equal(s.snapshot(id).night!.phase,'wolves');assert.equal(s.snapshot(id).night!.deadline,deadline);
  assert.equal(s.nightPrivate(t[others[0]-1],id).confirmer,confirmer);
  f.setNow(deadline);s.tickNights();
  assert.equal(s.snapshot(id).night!.phase,'eyes_closed');assert.equal(s.snapshot(id).night!.deadline,deadline+5000);
  assert.throws(()=>s.nightCommand(token,id,{action:'confirm_wolves',turnId}),/STALE_TURN/);
  for(const key of ['knife','votes','confirmer'])assert.equal(key in s.snapshot(id).night!,false);
  f.setNow(deadline+5000);s.tickNights();
  assert.equal(s.nightPrivate(t[9],id).knife,6);
  assert.deepEqual(s.nightPrivate(t[4],id),{turnId:s.snapshot(id).night!.turnId,kind:'waiting'});
 }finally{s.close();}
});

// Catch a self-knife consuming antidote or suppressing the witch's same-night poison.
test('a self-knifed witch can poison and both deaths enter the same public night settlement',()=>{
 const f=voiceFixture();const {store:s,tokens:t,id}=f;
 try{
  const wolfTurn=s.snapshot(id).night!.turnId,confirmer=s.nightPrivate(t[0],id).confirmer!;
  s.nightCommand(t[0],id,{action:'vote',target:10,turnId:wolfTurn});
  s.nightCommand(t[confirmer-1],id,{action:'confirm_wolves',turnId:wolfTurn});
  f.setNow(6000);s.tickNights();
  const turnId=s.snapshot(id).night!.turnId;
  assert.equal(s.nightPrivate(t[9],id).knife,10);
  assert.throws(()=>s.nightCommand(t[9],id,{action:'witch',choice:'save',target:10,turnId}),/CANNOT_SELF_SAVE/);
  assert.equal(s.nightPrivate(t[9],id).antidote,true);
  s.nightCommand(t[9],id,{action:'witch',choice:'poison',target:5,turnId});
  assert.equal(s.nightPrivate(t[9],id).antidote,true);assert.equal(s.nightPrivate(t[9],id).poison,false);
  assert.deepEqual(s.nightPrivate(t[9],id).witchReceipt,{choice:'poison',target:5});
  assert.deepEqual(s.nightPrivate(t[4],id),{turnId:s.snapshot(id).night!.turnId,kind:'waiting'});
  f.setNow(1000000);s.tickNights();s.enterDay(t[0],id);
  s.dayCommand(t[0],id,{action:'close_signup',turnId:s.snapshot(id).day!.turnId});
  assert.equal(s.snapshot(id).day!.announcement,null);
  s.dayCommand(t[0],id,{action:'continue',turnId:s.snapshot(id).day!.turnId});
  const day=s.snapshot(id).day!;
  assert.deepEqual(day.announcement,[5,10]);assert.equal(day.alive.includes(5),false);assert.equal(day.alive.includes(10),false);
  assert.equal(day.winner,null);
  for(const key of ['knife','poison','witchChoice'])assert.equal(key in day,false);
 }finally{s.close();}
});
