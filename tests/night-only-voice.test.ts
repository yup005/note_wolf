import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {voiceFrame} from '../packages/domain/voice.js';
import {createNight,beginNight,advanceNight,publicNight} from '../packages/domain/night.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import type {DayPhase} from '../packages/contracts/day.js';
import {voiceFixture} from './helpers/voice-fixture.js';

test('every daytime phase and control state is silent, including sheriff, transfer, free speech and victory',()=>{
 const f=voiceFixture();try{
  f.setNow(1000000);f.store.tickNights();f.store.enterDay(f.tokens[0],f.id);const room=f.store.snapshot(f.id);
  const phases:DayPhase[]=['awaiting_host','sheriff_signup','sheriff_speech','sheriff_withdraw','vote_setup','voting','vote_result','night_announcement','death_skill','hunter_target','white_wolf_target','last_words','badge_transfer','day_direction','day_speech','free_speech','day_complete','ended','rules_pending'];
  for(const phase of phases)for(const status of ['running','paused','resuming'] as const){
   const frame=voiceFrame({...room,control:{...room.control!,status},day:{...room.day!,phase,sheriff:3,badge:'elected',announcement:[5],currentDeath:5,speaker:3,winner:'good',interjection:{seat:4,originalSpeaker:3}}},1000000);
   assert.deepEqual(frame.cues,[],phase+' '+status);assert.equal(frame.current,null);assert.equal(frame.stage,'');
  }
 }finally{f.store.close();}
});

test('night opening precedes the first role and is absent when wolves act after authority or guard',()=>{
 const f=voiceFixture();try{
  const room=f.store.snapshot(f.id),c=boardPreset('mechanical-12');
  const board:RoomBoardSnapshot={id:'mechanical-12',name:'Mechanical',ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
  const roles=['wolf','wolf','wolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard','mechanicalWolf'] as const;
  const first=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);
  const text=(n:typeof first)=>voiceFrame({...room,day:null,night:publicNight(n,0)},0).cues.map(c=>c.text).join(' ');
  beginNight(first,0,()=>0);assert.match(text(first),/^第1夜，天黑请闭眼。守卫请睁眼/);
  while(first.phase!=='wolves')advanceNight(first,first.deadline!);assert.equal(text(first),'狼人请睁眼，选择目标。');
  while(String(first.phase)!=='first_night_complete')advanceNight(first,first.deadline!);
  const next=createNight(first.players,500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},board);
  beginNight(next,500000,()=>0);assert.match(text(next),/^第2夜，天黑请闭眼。机械狼请睁眼，请查看行动状态。/);
  while(next.phase!=='wolves')advanceNight(next,next.deadline!);assert.equal(text(next),'狼人请睁眼，选择目标。');
  const standard=createNight([{seat:1,role:'wolf'},{seat:2,role:'villager'}],0);beginNight(standard,0,()=>0);assert.equal(text(standard),'第1夜，天黑请闭眼。狼人请睁眼，选择目标。');
  const mixerBoard={...board,composition:{...board.composition,seatCount:13,roleCounts:{...board.composition.roleCounts,mixer:1}}};
  const mixer=createNight([...roles.map((role,i)=>({seat:i+1,role})),{seat:13,role:'mixer'}],0,undefined,mixerBoard);beginNight(mixer,0,()=>0);assert.match(text(mixer),/^第1夜，天黑请闭眼。混血儿请睁眼/);
 }finally{f.store.close();}
});

test('server refuses daytime claim, poll and replay even with an active night lease',()=>{
 const f=voiceFixture(),clientId=randomUUID();try{
  f.setNow(1000000);f.store.tickNights();f.store.publicVoice(f.tokens[0],f.id,{action:'claim',clientId});f.store.enterDay(f.tokens[0],f.id);
  for(const action of ['claim','poll','replay'] as const)assert.throws(()=>f.store.publicVoice(f.tokens[0],f.id,{action,clientId}),/PHASE_LOCKED/);
  assert.deepEqual(f.store.publicVoice(f.tokens[0],f.id,{action:'release',clientId}).cues,[]);
 }finally{f.store.close();}
});
