import type {RoomSnapshot} from '../contracts/index.js';
import type {DisplaySnapshot} from '../contracts/display.js';
const labels:Record<string,string>={awaiting_host:'白天准备',sheriff_signup:'警长竞选报名',sheriff_speech:'警长竞选发言',sheriff_withdraw:'竞选退水',vote_setup:'投票准备',voting:'投票中',vote_result:'投票结果',night_announcement:'死讯公布',last_words:'遗言',day_direction:'发言准备',day_speech:'白天发言',free_speech:'自由发言',day_complete:'白天结束',ended:'游戏结束'};
const speaking=new Set(['sheriff_speech','day_speech','last_words']);
/** Select fields, never spread the participant snapshot into the observer response. */
export function projectDisplay(room:RoomSnapshot,now:number):DisplaySnapshot{
 const d=room.day,m=room.manual,night=!!room.night&&(!d||room.night.night>d.day),count=room.board.composition.seatCount;
 const seat=(n:number)=>Number.isInteger(n)&&n>=1&&n<=count;
 const out:DisplaySnapshot={roomCode:room.code,gameNumber:room.gameNumber,seatCount:count,serverNow:now,phase:{kind:'preparation',label:'候场',round:null},status:room.control?.status??'running',speaker:null,dead:[],winner:null,timer:null,vote:null};
 if(m){out.phase={kind:m.status==='ended'?'ended':'manual',label:m.status==='ended'?'记录已结束':'手动记录',round:null};out.dead=m.dead.filter(seat);out.winner=m.status==='ended'?m.winner:null;return out;}
 // Only day.dead contains announced deaths; night.alive includes unannounced outcomes.
 out.dead=d?.dead.filter(seat)??[];
 if(night){out.phase={kind:'night',label:'夜晚',round:room.night!.night};return out;}
 if(d){
  const known=Object.hasOwn(labels,d.phase);out.phase={kind:d.phase==='ended'?'ended':'day',label:labels[d.phase]??'公开流程处理中',round:d.day};
  out.winner=d.phase==='ended'?d.winner:null;
  if(speaking.has(d.phase)){const speaker=d.interjection?.seat??(d.phase==='last_words'?d.currentDeath:d.speaker);out.speaker=speaker!==null&&seat(speaker)?speaker:null;}
  const frozen=room.control?.status==='paused'||room.control?.status==='resuming';
  if(known&&d.phase!=='ended'&&(frozen?room.control?.remainingMs!==null&&room.control?.remainingMs!==undefined:d.deadline!==null)){const paused=room.control?.status==='paused';out.timer={milliseconds:Math.max(0,paused?(room.control?.remainingMs??0):room.control?.status==='resuming'?(room.control.resumeAt??now)-now:(d.deadline??now)-now),running:!paused};}
  if(d.phase==='vote_result'&&d.result){out.vote={purpose:d.result.purpose,counts:d.result.counts.filter(c=>seat(c.seat)).map(c=>({seat:c.seat,votes:c.votes}))};if(d.vote?.visibility==='individual'&&d.result.ballots)out.vote.ballots=d.result.ballots.filter(b=>seat(b.seat)&&(b.target===null||seat(b.target))).map(b=>({seat:b.seat,target:b.target}));}
 }
 return out;
}
