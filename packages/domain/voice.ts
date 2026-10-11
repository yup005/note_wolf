import type {RoomSnapshot} from '../contracts/index.js';
import type {VoiceCue,VoiceFrame} from '../contracts/voice.js';
export function voiceFrame(room:RoomSnapshot,now:number):VoiceFrame{
 const n=room.night,d=room.day;
 const day=!!d&&(!n||d.day>=n.night),stage=day?`day:${d!.turnId}`:n?`night:${n.turnId}`:'';
 const frame:VoiceFrame={skillResults:day?(d!.skillResults??[]):[],scope:stage,stage,cues:[],current:null,deathInquiry:day&&d!.phase==='death_skill'?d!.currentDeath:null,hunterTarget:day&&d!.phase==='hunter_target',ended:day&&d!.phase==='ended'};
 if(room.preparation.settings.gameMode!=='automatic'||room.manual||!stage)return frame;
 const add=(text:string,key=stage)=>{const cue={key,text};frame.cues.push(cue);frame.current??=cue;};
 const control=room.control;
 if(!frame.ended&&control?.status==='paused'){frame.scope=`${stage}:paused:${control.version}`;add('对局已暂停，请等待房主恢复。',frame.scope);return frame;}
 if(!frame.ended&&control?.status==='resuming'){frame.scope=`${stage}:resuming:${control.version}`;add('准备恢复，五秒后继续当前阶段。',frame.scope);return frame;}
 if(!frame.ended&&control?.reconnecting){frame.scope=`${stage}:reconnecting`;add('系统连接异常，正在重新连接，请稍候。',frame.scope);return frame;}
 if(!day&&n){
  const names={awaiting_host:'请房主开始夜晚。',wolves:`第${n.night}夜，天黑请闭眼。狼人请睁眼，选择目标。`,eyes_closed:'请闭眼，等待下一阶段。',witch:'女巫请睁眼，请进行操作。',seer:'预言家请睁眼，请查验。',hunter:'猎人请睁眼，请查看技能状态。',first_night_complete:`第${n.night}夜操作完成，请房主开始白天。`};
  add(names[n.phase]);if(n.phase==='wolves'&&n.deadline!==null&&n.deadline-now>0&&n.deadline-now<=30000)add('狼人行动最后30秒，请确认。',`${stage}:30s`);return frame;
 }
 if(!d)return frame;
 const seat=d.currentDeath;
 const vote=d.vote?.purpose.startsWith('sheriff')?'警长':'放逐';
 switch(d.phase){
  case 'awaiting_host':add('请房主开始白天。');break;
  case 'sheriff_signup':add(`第${d.day}天，警长竞选开始，请报名。`);break;
  case 'sheriff_speech':add(d.speaker===null?'警上发言开始。':`请${d.speaker}号玩家进行警上发言。`);break;
  case 'sheriff_withdraw':add('警上发言结束，请选择退水；结束后进入投票。');break;
  case 'vote_setup':add(`请房主选择${vote}投票方式。`);break;
  case 'voting':add(`${vote}投票开始。${d.vote?.method==='offline'?'请线下举手，由房主录入结果。':'请在手机上投票。'}`);break;
  case 'vote_result':{
   const r=d.result;const counts=r?.counts.filter(c=>c.votes>0).map(c=>`${c.seat}号${c.votes}票`).join('，');
   add(`投票结束。${counts?counts+'。':'全员弃票。'}${r?.leaders.length&&r.leaders.length>1?'最高票平票，等待房主处理。':'请房主确认结果。'}`);break;
  }
  case 'night_announcement':{
   const badge=d.badge==='elected'&&d.sheriff!==null?`${d.sheriff}号玩家当选警长。`:d.badge==='lost'?'警徽流失。':d.badge==='deferred'?'警长竞选顺延。':'';
   const deaths=d.announcement===null?'请房主公布夜间死讯。':d.announcement.length?`${d.announcement.join('、')}号玩家死亡。`:'昨夜平安夜。';add(`第${d.day}天。${badge}${deaths}`);break;
  }
  case 'death_skill':if(seat!==null)add(`${seat}号玩家是否发动技能？`);break;
  case 'hunter_target':add('技能已发动，请线下指定目标，由房主录入。');break;
  case 'last_words':if(seat!==null)add(`请${seat}号玩家发表遗言。`);break;
  case 'badge_transfer':if(seat!==null)add(`请${seat}号玩家移交或撕掉警徽。`);break;
  case 'day_direction':add('白天发言开始，请选择发言方式。');break;
  case 'day_speech':add(d.speaker===null?'白天发言开始。':`请${d.speaker}号玩家发言。`);break;
  case 'free_speech':add('自由发言开始，结束后由房主开启投票。');break;
  case 'day_complete':add('白天结束，请房主开始下一夜。');break;
  case 'ended':add(`游戏结束，${d.winner==='wolves'?'狼人获胜':d.winner==='good'?'好人获胜':'请查看最终结果'}。`);break;
  case 'rules_pending':add('当前规则待确认，请等待房主处理。');break;
 }
 return frame;
}
