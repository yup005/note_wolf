import type {RoomSnapshot} from '../contracts/index.js';
import type {VoiceCue,VoiceFrame} from '../contracts/voice.js';
export function voiceFrame(room:RoomSnapshot,now:number):VoiceFrame{
 const n=room.night,d=room.day;
 const terminal=room.board?.composition.ruleset==='masquerade'&&!!d?.terminalAnnouncement&&['night_announcement','ended'].includes(d.phase);
 const day=!!d&&(!n||d.day>=n.night),stage=terminal?`day:${d!.turnId}`:!day&&n?`night:${n.turnId}`:'';
 const frame:VoiceFrame={skillResults:day?(d!.skillResults??[]):[],scope:stage,stage,cues:[],current:null,deathInquiry:day&&d!.phase==='death_skill'?d!.currentDeath:null,hunterTarget:day&&d!.phase==='hunter_target',ended:day&&d!.phase==='ended'};
 if(day&&!terminal||room.preparation.settings.gameMode!=='automatic'||room.manual||!stage)return frame;
 const add=(text:string,key=stage)=>{const cue={key,text};frame.cues.push(cue);frame.current??=cue;};
 const control=room.control;
 if(!frame.ended&&control?.status==='paused'){frame.scope=`${stage}:paused:${control.version}`;add('对局已暂停，请等待房主恢复。',frame.scope);return frame;}
 if(!frame.ended&&control?.status==='resuming'){frame.scope=`${stage}:resuming:${control.version}`;add('准备恢复，五秒后继续当前阶段。',frame.scope);return frame;}
 if(!frame.ended&&control?.reconnecting){frame.scope=`${stage}:reconnecting`;add('系统连接异常，正在重新连接，请稍候。',frame.scope);return frame;}
 if(terminal){const deaths=d!.announcement?.length?`${d!.announcement.join('、')}号死亡。`:'平安夜，无人死亡。';add(deaths+(d!.winner?`${d!.winner==='wolves'?'狼人':'好人'}获胜，游戏结束。`:''));return frame;}
 if(!day&&n){
  const names={dancer:'舞者请睁眼，请选择三人共舞。',mask:'假面请睁眼，请查验舞池并戴面具。',treasure:'盗宝大师请睁眼，请选择身份并发动技能。',dreamer:'摄梦人请睁眼，请选择梦游目标。',hunter_signal:'猎人请举手示意，确认后请放手。',masked_signal:'蒙面人请举手示意，确认后请放手。',confession:'狼女孩请睁眼，请进行表白。',confession_notice:'被表白者请单独查看信息。',poisoner:'毒师请睁眼，请进行操作。',awaiting_host:'请房主开始夜晚。',mechanical_authority:'机械狼请睁眼，请查看行动状态。',guard:'守卫请睁眼，请进行操作。',wolves:['wolf-girl','treasure'].includes(room.board?.composition.ruleset)&&n.night===1?'狼人请睁眼，认识队友，首夜不能刀人。':'狼人请睁眼，选择目标。',eyes_closed:'请闭眼。',witch:'女巫请睁眼，请进行操作。',mechanical:'机械狼请睁眼，请进行操作。',armor:'装甲狼请睁眼，请进行操作。',spiritSeer:'通灵师请睁眼，请查验。',mixer:'混血儿请睁眼，请进行操作。',seer:'预言家请睁眼，请查验。',hunter:'猎人请睁眼，请查看技能状态。',first_night_complete:`第${n.night}夜操作完成，请房主开始白天。`,rules_pending:'当前规则待确认，请等待房主处理。'};
  add((n.opening?`第${n.night}夜，天黑请闭眼。`:'')+names[n.phase]);if(n.phase==='wolves'&&n.deadline!==null&&n.deadline-now>0&&n.deadline-now<=30000)add('狼人行动最后30秒，请确认。',`${stage}:30s`);return frame;
 }
 return frame;
}
