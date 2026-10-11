import {PublicVoiceControls} from './PublicVoice';
import {useEffect,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {ControlCommand} from '../../../packages/contracts/control';
import {api,errorText} from './api';
import {canManageGame,gameFrozen} from './gameAccess';
export {canManageGame,gameFrozen} from './gameAccess';
interface Props {view:LobbyView;connected:boolean;onRefresh:()=>Promise<void>}
export function GameControls({view,connected,onRefresh}:Props){
 const {room,me}=view,control=room.control;const manager=canManageGame(view),frozen=gameFrozen(view);
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
 const [confirm,setConfirm]=useState<ControlCommand['action']|null>(null);const [seat,setSeat]=useState('');const [duration,setDuration]=useState(30);const [visibility,setVisibility]=useState<'individual'|'totals'>('individual');const [seconds,setSeconds]=useState(0);
 useEffect(()=>{if(!control)return;const offset=control.serverNow-Date.now();const update=()=>setSeconds(control.resumeAt===null?0:Math.max(0,Math.ceil((control.resumeAt-Date.now()-offset)/1000)));update();const timer=setInterval(update,200);return()=>clearInterval(timer);},[control?.resumeAt,control?.serverNow]);
 useEffect(()=>{setConfirm(null);setError('');},[control?.version]);
 useEffect(()=>{if(!manager)setOpen(false);},[manager]);
 if(!control)return null;
 const night=room.night!,day=room.day;const alive=day&&day.day>=night.night?day.alive:night.alive;
 const submit=async()=>{
  if(!confirm||pending||!connected)return;const body:ControlCommand=confirm==='delegate'?{action:confirm,confirmed:true,version:control.version,seat:seat?Number(seat):null}:confirm==='defaults'?{action:confirm,confirmed:true,version:control.version,voteSeconds:duration,voteVisibility:visibility}:{action:confirm,confirmed:true,version:control.version};setPending(true);setError('');
  try{await api(`/api/rooms/${room.id}/control`,body);setConfirm(null);setOpen(false);await onRefresh();}catch(e){setError(errorText(e));await onRefresh().catch(()=>{});}finally{setPending(false);}
 };
 const labels={pause:'暂停对局',resume:'恢复对局',delegate:seat?`授权 ${seat} 号管理`:'收回临时权限',defaults:'保存未来投票设置'};
 return <>
  {manager&&<button className="text-button game-manage" onClick={()=>setOpen(true)}>管理</button>}
  {frozen&&<div className="game-frozen" role="status" aria-label="对局暂停状态"><section className="card frozen-card"><span className="eyebrow">房间 {room.code}</span><h1>{control.status==='resuming'?'准备恢复':'对局已暂停'}</h1>{control.status==='resuming'?<strong className="resume-clock">{seconds}</strong>:control.remainingMs!==null&&<p>本阶段剩余 {Math.ceil(control.remainingMs/1000)} 秒</p>}<p>{control.status==='resuming'?'请准备，倒计时后继续原阶段':'等待房主恢复对局'}</p>{manager&&<button className="primary full" disabled={!connected} onClick={()=>{setOpen(true);setConfirm(control.status==='paused'?'resume':'pause');}}>{control.status==='paused'?'恢复对局':'再次暂停'}</button>}{!connected&&<p className="helper">正在重新连接</p>}</section></div>}
  {open&&manager&&<div className="modal-backdrop game-control-modal"><section className="card modal" role="dialog" aria-modal="true" aria-labelledby="game-control-title"><h2 id="game-control-title">{confirm?`确认${labels[confirm]}？`:'对局管理'}</h2>{error&&<p role="alert" className="night-error">{error}</p>}
   {confirm?<><p>{confirm==='pause'?'冻结当前倒计时、技能和投票。':confirm==='resume'?'全员准备 5 秒后，按原剩余时间继续。':confirm==='delegate'?'临时房主只能管理公开流程，死亡后权限自动收回。':'仅用于后续投票，不改变当前阶段。'}</p><button className="primary full" disabled={pending||!connected} onClick={()=>void submit()}>确认{labels[confirm]}</button><button className="text-button full" disabled={pending} onClick={()=>setConfirm(null)}>返回</button></>:<>
    <button className="primary full" disabled={!connected} onClick={()=>setConfirm(control.status==='paused'?'resume':'pause')}>{control.status==='paused'?'恢复对局':'暂停对局'}</button>
    {me.isHost&&<div className="control-settings"><label>临时房主<select aria-label="临时房主" value={seat} onChange={e=>setSeat(e.target.value)}><option value="">收回临时权限</option>{room.seats.filter(s=>s.memberId&&!s.isHost&&alive.includes(s.number)).map(s=><option key={s.number} value={s.number}>{s.number} 号 · {s.nickname}</option>)}</select></label><button className="secondary full" disabled={!connected} onClick={()=>setConfirm('delegate')}>确认授权设置</button>{control.tempSeat!==null&&<p className="helper">当前临时房主：{control.tempSeat} 号</p>}</div>}
    {control.status==='paused'&&<div className="control-settings"><p>未来投票设置</p><label>默认秒数<input aria-label="未来投票秒数" type="number" min={5} max={300} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>公开程度<select aria-label="未来票型公开程度" value={visibility} onChange={e=>setVisibility(e.target.value as typeof visibility)}><option value="individual">个人票型</option><option value="totals">汇总票数</option></select></label><button className="secondary full" disabled={!connected||!Number.isInteger(duration)||duration<5||duration>300} onClick={()=>setConfirm('defaults')}>保存未来设置</button></div>}
    <PublicVoiceControls/><button className="text-button full" onClick={()=>setOpen(false)}>关闭</button>
   </>}
  </section></div>}
 </>;
}
