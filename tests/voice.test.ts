import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceFrame} from '../packages/domain/voice.js';
import {voiceFixture} from './helpers/voice-fixture.js';
import {createDay,dayCommand,publicDay} from '../packages/domain/day.js';
import {createNight} from '../packages/domain/night.js';
import {firstDayRules} from '../packages/contracts/day.js';
const text=(r:ReturnType<typeof voiceFrame>)=>r.cues.map(c=>c.text).join(' ');
test('public voice uses only stage information, never private inputs or nicknames',()=>{
 const {store:s,id}=voiceFixture();try{const room=s.snapshot(id),a=voiceFrame(room,1000);assert.match(text(a),/狼人.*睁眼/);
 const changed={...room,seats:room.seats.map(p=>({...p,nickname:'秘密刀口8女巫毒5'})),knife:8,result:'wolf',confirmer:2,canShoot:false,poison:true};assert.deepEqual(voiceFrame(changed,1000),a);assert.doesNotMatch(text(a),/8|刀口|确认者|毒|不能/);
 }finally{s.close();}
});
test('wolves last thirty seconds is once-per-turn cue and never fires early or after deadline',()=>{
 const {store:s,id}=voiceFixture();try{const room=s.snapshot(id),end=room.night!.deadline!;assert.equal(voiceFrame(room,end-30001).cues.length,1);assert.match(text(voiceFrame(room,end-30000)),/最后30秒/);assert.match(text(voiceFrame(room,end-1)),/最后30秒/);assert.doesNotMatch(text(voiceFrame(room,end)),/最后30秒/);
 }finally{s.close();}
});
test('dead divine roles keep the same public night prompts; pause and reconnect suppress action prompts',()=>{
 const {store:s,id}=voiceFixture();try{const room=s.snapshot(id);for(const phase of ['witch','seer','hunter'] as const){const r={...room,night:{...room.night!,phase,alive:[]}};assert.deepEqual(voiceFrame(r,1000),voiceFrame({...r,night:{...r.night,alive:[9,10,11]}},1000));assert.match(text(voiceFrame(r,1000)),/睁眼/);}
 const paused={...room,control:{...room.control!,status:'paused' as const}};assert.match(text(voiceFrame(paused,1000)),/暂停/);assert.doesNotMatch(text(voiceFrame(paused,1000)),/睁眼/);
 const reconnecting={...room,control:{...room.control!,reconnecting:true}};assert.equal(text(voiceFrame(reconnecting,1000)),'系统连接异常，正在重新连接，请稍候。');
 }finally{s.close();}
});
test('published deaths, sheriff and victory remain silent during daytime',()=>{
 const {store:s,id,tokens:t,setNow}=voiceFixture();try{setNow(1000000);s.tickNights();s.enterDay(t[0],id);let room=s.snapshot(id);assert.doesNotMatch(text(voiceFrame(room,1000000)),/死讯|刀|毒/);
 for(const seat of [5,10,11,12]){room={...room,day:{...room.day!,phase:'death_skill',currentDeath:seat,turnId:'same'}};assert.equal(text(voiceFrame(room,1000000)),'');}
 room={...room,day:{...room.day!,phase:'night_announcement',announcement:[5,8],sheriff:3,badge:'elected'}};assert.equal(text(voiceFrame(room,1000000)),'');assert.doesNotMatch(text(voiceFrame(room,1000000)),/狼刀|毒杀/);
 room={...room,day:{...room.day!,phase:'ended',winner:'wolves',reason:'神职全部死亡'}};assert.equal(text(voiceFrame(room,1000000)),'');assert.doesNotMatch(text(voiceFrame(room,1000000)),/发动技能|睁眼/);
 }finally{s.close();}
});
test('manual mode has no automated voice even when old automatic states remain',()=>{
 const {store:s,id}=voiceFixture();try{const r=s.snapshot(id);assert.equal(voiceFrame({...r,preparation:{...r.preparation,settings:{...r.preparation.settings,gameMode:'manual'}}},1000).cues.length,0);}finally{s.close();}
});
test('daytime interjection and its restored speaker stay silent without changing gameplay timing',()=>{
 const {store:s,id}=voiceFixture();try{
  const night=createNight([{seat:1,role:'wolf'},{seat:2,role:'villager'},{seat:3,role:'mechanicalWolf'},{seat:4,role:'hunter'}],0);night.phase='first_night_complete';
  const day=createDay(night,firstDayRules,0);day.phase='day_speech';day.speaker=2;day.speakers=[4];day.deadline=90000;day.players[2].alive=false;day.flippedIdiots=[3];
  const room=s.snapshot(id),frame=(now:number)=>voiceFrame({...room,night:null,day:publicDay(day,now)},now);
  const original=frame(0);assert.equal(text(original),'');
  dayCommand(day,{seat:3,isHost:false},{action:'interject',turnId:day.turnId},1000);
  const interjecting=frame(1000);assert.equal(text(interjecting),'');assert.doesNotMatch(text(interjecting),/2号玩家发言|机械|狼人|额外夜/);assert.notEqual(day.turnId,'same');
  for(const control of [{...room.control!,status:'paused' as const},{...room.control!,status:'resuming' as const},{...room.control!,reconnecting:true}])assert.doesNotMatch(text(voiceFrame({...room,night:null,day:publicDay(day,1000),control},1000)),/3号|插话/);
  dayCommand(day,{seat:3,isHost:false},{action:'end_interjection',turnId:day.turnId},4000);
  const resumed=frame(4000);assert.equal(text(resumed),'');assert.equal(day.interjection,null);assert.equal(day.deadline,93000);
 }finally{s.close();}
});
