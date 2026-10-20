import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {DayCommand} from '../packages/contracts/day.js';
import {voiceFrame} from '../packages/domain/voice.js';
import {voiceFixture} from './helpers/voice-fixture.js';

type Fixture=ReturnType<typeof voiceFixture>;
type Input<T=DayCommand>=T extends unknown?Omit<T,'turnId'>:never;
const day=(f:Fixture)=>f.store.snapshot(f.id).day!;
function act(f:Fixture,seat:number,input:Input){return f.store.dayCommand(f.tokens[seat-1],f.id,{...input,turnId:day(f).turnId} as DayCommand);}
function enter(f:Fixture){f.setNow(1000000);f.store.tickNights();f.store.enterDay(f.tokens[0],f.id);}
function signup(f:Fixture,seats:number[]){for(let seat=1;seat<=12;seat++)act(f,seat,{action:'signup',join:seats.includes(seat)});act(f,1,{action:'close_signup'});}
function finishSpeeches(f:Fixture){for(let i=0;i<12&&day(f).phase==='sheriff_speech';i++)act(f,1,{action:'end_speech'});assert.notEqual(day(f).phase,'sheriff_speech');}

// Catch reused/shortened clocks between candidates, and between election and PK.
test('each sheriff and PK speaker gets ninety seconds with exact timeout boundaries',()=>{
 const f=voiceFixture();try{
  enter(f);signup(f,[2,3]);const first=day(f).speaker,firstTurn=day(f).turnId;
  assert.equal(day(f).deadline,1090000);
  f.setNow(1089999);f.store.tickNights();assert.equal(day(f).turnId,firstTurn);assert.equal(day(f).speaker,first);
  f.setNow(1090000);f.store.tickNights();assert.notEqual(day(f).speaker,first);assert.equal(day(f).deadline,1180000);
  f.setNow(1092000);act(f,1,{action:'end_speech'});assert.equal(day(f).phase,'sheriff_withdraw');
  act(f,1,{action:'close_withdraw'});assert.deepEqual(day(f).vote!.eligible,[1,4,5,6,7,8,9,10,11,12]);
  act(f,1,{action:'start_vote',method:'phone',visibility:'totals',seconds:30});
  for(const seat of [1,4,5,6,7,8,9,10,11,12])act(f,seat,{action:'vote',target:seat===1?2:seat===4?3:null});
  assert.deepEqual(day(f).result!.leaders,[2,3]);act(f,1,{action:'continue'});
  assert.equal(day(f).phase,'sheriff_speech');assert.equal(day(f).deadline,1182000);
  const pkSpeaker=day(f).speaker;f.setNow(1182000);f.store.tickNights();
  assert.equal(day(f).phase,'sheriff_speech');assert.notEqual(day(f).speaker,pkSpeaker);assert.equal(day(f).deadline,1272000);
  assert.deepEqual(voiceFrame(f.store.snapshot(f.id),f.getNow()).cues,[]);
 }finally{f.store.close();}
});

// Catch a live vote being reconfigured, private ballots leaking, or PK inheriting old eligibility/settings.
test('vote settings lock for the round and PK permits a fresh choice with its own voter set',()=>{
 const f=voiceFixture();try{
  enter(f);signup(f,[2,3,4]);act(f,4,{action:'withdraw'});finishSpeeches(f);act(f,1,{action:'close_withdraw'});
  assert.deepEqual(day(f).vote!.eligible,[1,5,6,7,8,9,10,11,12]);
  assert.deepEqual(f.store.snapshot(f.id).control!.voteDefaults,{seconds:30,visibility:'individual'});
  assert.throws(()=>act(f,5,{action:'start_vote',method:'phone',visibility:'totals',seconds:45}),/HOST_ONLY/);
  act(f,1,{action:'start_vote',method:'phone',visibility:'totals',seconds:45});assert.equal(day(f).deadline,1045000);
  f.setNow(1001000);
  assert.throws(()=>act(f,1,{action:'start_vote',method:'offline',visibility:'individual',seconds:15}),/PHASE_LOCKED/);
  assert.equal(day(f).deadline,1045000);assert.equal(day(f).vote!.method,'phone');assert.equal(day(f).vote!.visibility,'totals');
  assert.throws(()=>act(f,4,{action:'vote',target:2}),/NOT_YOUR_TURN/);
  act(f,1,{action:'vote',target:2});assert.equal(day(f).result,null);assert.equal('ballots' in day(f).vote!,false);
  assert.equal(f.store.dayPrivate(f.tokens[5],f.id).myVote,null);
  for(const seat of [5,6,7,8,9,10,11,12])act(f,seat,{action:'vote',target:seat===5?3:null});
  assert.equal(day(f).result!.ballots,undefined);assert.deepEqual(day(f).result!.leaders,[2,3]);
  act(f,1,{action:'continue'});finishSpeeches(f);
  assert.deepEqual(day(f).vote!.eligible,[1,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(f.store.snapshot(f.id).control!.voteDefaults,{seconds:30,visibility:'individual'});
  act(f,1,{action:'start_vote',method:'phone',visibility:'individual',seconds:15});assert.equal(day(f).deadline,1016000);
  assert.throws(()=>act(f,2,{action:'vote',target:3}),/NOT_YOUR_TURN/);
  act(f,4,{action:'vote',target:2});assert.equal(day(f).result,null);assert.equal('ballots' in day(f).vote!,false);
  for(const seat of [1,5,6,7,8,9,10,11,12])act(f,seat,{action:'vote',target:null});
  assert.deepEqual(day(f).result!.ballots,[1,4,5,6,7,8,9,10,11,12].map(seat=>({seat,target:seat===4?2:null})));
 }finally{f.store.close();}
});

// Catch a dead seat entering ordered speech or another player ending the active speaker's turn.
test('ordered day speech skips the night death, grants fresh clocks and stays silent',()=>{
 const f=voiceFixture();try{
  const wolfTurn=f.store.snapshot(f.id).night!.turnId,confirmer=f.store.nightPrivate(f.tokens[0],f.id).confirmer!;
  f.store.nightCommand(f.tokens[0],f.id,{action:'vote',target:5,turnId:wolfTurn});
  f.store.nightCommand(f.tokens[confirmer-1],f.id,{action:'confirm_wolves',turnId:wolfTurn});
  enter(f);signup(f,[]);act(f,1,{action:'continue'});act(f,1,{action:'continue'});
  f.setNow(day(f).deadline!);f.store.tickNights();act(f,1,{action:'end_speech'});assert.equal(day(f).phase,'day_direction');
  act(f,1,{action:'speech_mode',mode:'ordered'});assert.equal(day(f).speaker,6);assert.equal(day(f).deadline,1100000);
  const speakers=[day(f).speaker!];act(f,1,{action:'end_speech'});assert.equal(day(f).speaker,7);
  assert.throws(()=>act(f,2,{action:'end_speech'}),/NOT_YOUR_TURN/);assert.throws(()=>act(f,5,{action:'end_speech'}),/NOT_YOUR_TURN/);
  speakers.push(7);f.setNow(1011000);act(f,7,{action:'end_speech'});assert.equal(day(f).speaker,8);assert.equal(day(f).deadline,1101000);
  for(let i=0;i<12&&day(f).phase==='day_speech';i++){
   speakers.push(day(f).speaker!);assert.deepEqual(voiceFrame(f.store.snapshot(f.id),f.getNow()).cues,[]);act(f,1,{action:'end_speech'});
  }
  assert.deepEqual(speakers,[6,7,8,9,10,11,12,1,2,3,4]);assert.equal(day(f).phase,'vote_setup');
  assert.equal(f.store.dayPrivate(f.tokens[4],f.id).canEndSpeech,false);
 }finally{f.store.close();}
});
