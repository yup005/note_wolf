import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {publicVoiceAudioManifest} from '../apps/web/src/publicVoiceAudioManifest.js';
import {recordedVoiceParts,chineseVoiceNumber} from '../apps/web/src/recordedPublicVoice.js';
import {voiceFrame} from '../packages/domain/voice.js';
import type {RoomSnapshot} from '../packages/contracts/index.js';
import type {DayPhase} from '../packages/contracts/day.js';
import type {NightPhase} from '../packages/contracts/night.js';

test('all active public night cues retain numeric facts and have static local audio',()=>{
 const base={id:'r',preparation:{settings:{gameMode:'automatic'}},control:{status:'running'},night:null,day:null} as unknown as RoomSnapshot;
 const night:NightPhase[]=['awaiting_host','mechanical_authority','guard','wolves','eyes_closed','witch','mechanical','armor','spiritSeer','mixer','seer','hunter','first_night_complete','rules_pending'];
 const day:DayPhase[]=['awaiting_host','sheriff_signup','sheriff_speech','sheriff_withdraw','vote_setup','voting','vote_result','night_announcement','death_skill','hunter_target','white_wolf_target','last_words','badge_transfer','day_direction','day_speech','free_speech','day_complete','ended','rules_pending'];
 const frames=night.map(phase=>voiceFrame({...base,night:{phase,night:23,turnId:'n',deadline:15000}} as RoomSnapshot,0));
 for(const phase of day)for(const method of ['phone','offline'])frames.push(voiceFrame({...base,day:{phase,day:13,turnId:'d',deadline:null,currentDeath:256,speaker:13,interjection:null,badge:'elected',sheriff:13,announcement:[13,256],vote:{purpose:'exile',method},result:{leaders:[13,256],counts:[{seat:13,votes:1.5},{seat:256,votes:2}]},winner:'good'}} as unknown as RoomSnapshot,0));
 for(const frame of frames)for(const cue of frame.cues){let parts:string[];try{parts=recordedVoiceParts(cue.text);}catch{assert.fail('Missing public audio vocabulary for '+cue.text);}assert.ok(parts.length>0,cue.text);for(const path of parts){assert.ok(existsSync('apps/web/public'+path),path);assert.ok(statSync('apps/web/public'+path).size>1000,path);}}
 assert.equal(chineseVoiceNumber('13'),'十三');assert.equal(chineseVoiceNumber('101'),'一百零一');assert.equal(chineseVoiceNumber('256'),'二百五十六');assert.equal(chineseVoiceNumber('1.5'),'一点五');
 assert.deepEqual(recordedVoiceParts('13'),['十','三'].map(word=>'/voice/'+publicVoiceAudioManifest[word as keyof typeof publicVoiceAudioManifest]));
});

test('recorded opening can precede guard or mechanical authority without repeating at wolves',()=>{
 for(const action of ['守卫请睁眼，请进行操作。','机械狼请睁眼，请查看行动状态。','狼人请睁眼，选择目标。']){
  assert.ok(recordedVoiceParts('第2夜，天黑请闭眼。'+action).length>0);
  assert.ok(recordedVoiceParts(action).length>0);
 }
});

test('unknown/private text is rejected rather than sent to a speech service',()=>{
 assert.throws(()=>recordedVoiceParts('9号女巫毒了13号'),/UNSUPPORTED_PUBLIC_PROMPT/);
 assert.throws(()=>recordedVoiceParts('private-note-secret'),/UNSUPPORTED_PUBLIC_PROMPT/);
});

test('recorded playback ignores cancelled loads and stops the active audio source',async()=>{
 const {RecordedPublicVoice}=await import('../apps/web/src/recordedPublicVoice.js');let starts=0,stops=0,finished=0,current=true,resolve!:()=>void;
 const data=Float32Array.from({length:1000},()=>0.1),buffer={length:data.length,getChannelData:()=>data};
 const context={state:'running',sampleRate:24000,destination:{},decodeAudioData:async()=>buffer,createBuffer:(_channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)}),createBufferSource:()=>({buffer:null,onended:null,connect:()=>{},disconnect:()=>{},start:()=>{starts++;},stop:()=>{stops++;}})} as unknown as AudioContext;
 const gate=new Promise<void>(r=>{resolve=r;}),player=new RecordedPublicVoice(context,async()=>{await gate;return new Response(new Uint8Array([1]));});
 const loading=player.play('公共播报。',()=>current,()=>{},()=>{finished++;});current=false;player.cancel();resolve();await loading;assert.equal(starts,0);assert.equal(finished,0);
 current=true;await player.play('公共播报。',()=>current,()=>{},()=>{finished++;});assert.equal(starts,1);current=false;player.cancel();assert.equal(stops,1);assert.equal(finished,0);
});

test('death-list separators cannot merge two public seat numbers',()=>{
 const paths=(words:string[])=>words.map(word=>'/voice/'+publicVoiceAudioManifest[word as keyof typeof publicVoiceAudioManifest]);
 assert.deepEqual(recordedVoiceParts('1、3号玩家死亡。'),paths(['一','和','三','号玩家死亡']));
 assert.deepEqual(recordedVoiceParts('13、14号玩家死亡。'),paths(['十','三','和','十','四','号玩家死亡']));
 assert.equal(recordedVoiceParts('狼人行动最后30秒，请确认。').length,1);
});

test('failed audio startup still permits safe cancellation',async()=>{
 const {RecordedPublicVoice}=await import('../apps/web/src/recordedPublicVoice.js'),data=Float32Array.from({length:1000},()=>0.1);
 const context={state:'running',sampleRate:24000,destination:{},decodeAudioData:async()=>({length:data.length,getChannelData:()=>data}),createBuffer:()=>({getChannelData:()=>new Float32Array(data.length)}),createBufferSource:()=>({buffer:null,onended:null,connect:()=>{},disconnect:()=>{},start:()=>{throw Error('audio unavailable');},stop:()=>{throw Error('not started');}})} as unknown as AudioContext;
 const player=new RecordedPublicVoice(context,async()=>new Response(new Uint8Array([1])));await assert.rejects(()=>player.play('公共播报。',()=>true,()=>{},()=>{}),/audio unavailable/);assert.doesNotThrow(()=>player.cancel());
});

test('the eyes-closed interval announces only closing eyes and uses a reusable local recording',()=>{
 const room={id:'r',preparation:{settings:{gameMode:'automatic'}},control:{status:'running'},night:{phase:'eyes_closed',night:1,turnId:'n',deadline:5000},day:null} as unknown as RoomSnapshot;
 const cues=voiceFrame(room,0).cues;assert.equal(cues.length,1);assert.equal(cues[0].text,'请闭眼。');
 const parts=recordedVoiceParts(cues[0].text);assert.equal(parts.length,1);assert.ok(existsSync('apps/web/public'+parts[0]));
});
