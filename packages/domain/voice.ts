import type {RoomSnapshot} from '../contracts/index.js';
import type {VoiceCue,VoiceFrame} from '../contracts/voice.js';
export function voiceFrame(room:RoomSnapshot,now:number):VoiceFrame{
 const n=room.night,d=room.day;
 const day=!!d&&(!n||d.day>=n.night),stage=!day&&n?`night:${n.turnId}`:'';
 const frame:VoiceFrame={skillResults:day?(d!.skillResults??[]):[],scope:stage,stage,cues:[],current:null,deathInquiry:day&&d!.phase==='death_skill'?d!.currentDeath:null,hunterTarget:day&&d!.phase==='hunter_target',ended:day&&d!.phase==='ended'};
 if(day||room.preparation.settings.gameMode!=='automatic'||room.manual||!stage)return frame;
 const add=(text:string,key=stage)=>{const cue={key,text};frame.cues.push(cue);frame.current??=cue;};
 const control=room.control;
 if(!frame.ended&&control?.status==='paused'){frame.scope=`${stage}:paused:${control.version}`;add('对局已暂停，请等待房主恢复。',frame.scope);return frame;}
 if(!frame.ended&&control?.status==='resuming'){frame.scope=`${stage}:resuming:${control.version}`;add('准备恢复，五秒后继续当前阶段。',frame.scope);return frame;}
 if(!frame.ended&&control?.reconnecting){frame.scope=`${stage}:reconnecting`;add('系统连接异常，正在重新连接，请稍候。',frame.scope);return frame;}
 if(!day&&n){
  const names={awaiting_host:'请房主开始夜晚。',mechanical_authority:'机械狼请睁眼，请查看行动状态。',guard:'守卫请睁眼，请进行操作。',wolves:'狼人请睁眼，选择目标。',eyes_closed:'请闭眼。',witch:'女巫请睁眼，请进行操作。',mechanical:'机械狼请睁眼，请进行操作。',armor:'装甲狼请睁眼，请进行操作。',spiritSeer:'通灵师请睁眼，请查验。',mixer:'混血儿请睁眼，请进行操作。',seer:'预言家请睁眼，请查验。',hunter:'猎人请睁眼，请查看技能状态。',first_night_complete:`第${n.night}夜操作完成，请房主开始白天。`,rules_pending:'当前规则待确认，请等待房主处理。'};
  add((n.opening?`第${n.night}夜，天黑请闭眼。`:'')+names[n.phase]);if(n.phase==='wolves'&&n.deadline!==null&&n.deadline-now>0&&n.deadline-now<=30000)add('狼人行动最后30秒，请确认。',`${stage}:30s`);return frame;
 }
 return frame;
}
