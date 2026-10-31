import {useEffect,useRef,useState} from 'react';
import type {DisplaySnapshot} from '../../../packages/contracts/display';
import {errorText} from './api';
import {readDisplay} from './recoveryLoad';
import './display.css';

export function DisplayPage({token,initialSnapshot}:{token:string;initialSnapshot:DisplaySnapshot}){
 const [current,setCurrent]=useState<{snapshot:DisplaySnapshot;received:number}|null>(()=>({snapshot:initialSnapshot,received:performance.now()}));
 const [clock,setClock]=useState(()=>performance.now()),[error,setError]=useState(''),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 const active=useRef(false);
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>,abort:AbortController|undefined;
  active.current=true;
  async function poll(){
   if(disposed||document.visibilityState==='hidden'||navigator.onLine===false)return;
   abort=new AbortController();const controller=abort;setBusy(true);
   const timeout=setTimeout(()=>controller.abort(),6000);
   try{const snapshot=await readDisplay(token,controller.signal);if(disposed||controller.signal.aborted)return;setCurrent({snapshot,received:performance.now()});setError('');timer=setTimeout(()=>void poll(),3000);}
   catch(e){if(!disposed){setCurrent(null);setError(controller.signal.aborted?'读取超时，请重新连接':errorText(e));}}
   finally{clearTimeout(timeout);if(!disposed)setBusy(false);}
  }
  if(retry)void poll();else timer=setTimeout(()=>void poll(),3000);
  return()=>{disposed=true;active.current=false;clearTimeout(timer);abort?.abort();};
 },[token,retry]);
 useEffect(()=>{if(!current?.snapshot.timer?.running)return;const timer=setInterval(()=>setClock(performance.now()),1000);return()=>clearInterval(timer);},[current]);
 async function fullscreen(){try{if(!document.documentElement.requestFullscreen)throw Error();await document.documentElement.requestFullscreen();if(active.current)setNotice('已进入全屏');}catch{if(active.current)setNotice('当前设备无法进入全屏，可继续使用此页面。');}}
 if(!current)return <main className="display-unavailable"><h1>大屏链接暂不可用</h1><p>{error}</p><button className="primary" disabled={busy} onClick={()=>setRetry(n=>n+1)}>{busy?'正在连接…':'重新连接'}</button><a href="/">返回首页</a></main>;
 const s=current.snapshot,remaining=s.timer?Math.max(0,s.timer.milliseconds-(s.timer.running?Math.max(0,clock-current.received):0)):null,seconds=remaining===null?null:Math.ceil(remaining/1000);
 return <main className="display-screen">
  <header className="display-header"><span>笔记狼人杀 · 公共大屏</span><div><button className="secondary" onClick={()=>void fullscreen()}>全屏显示</button><a href="/">返回首页</a></div></header>
  {notice&&<p className="display-notice" role="status">{notice}</p>}
  <div className="display-meta">房间 {s.roomCode} · 第 {s.gameNumber} 局{s.phase.round!==null&&` · 第 ${s.phase.round} ${s.phase.kind==='night'?'夜':'天'}`}</div>
  <section className="display-stage"><h1>{s.phase.label}</h1>{s.status!=='running'&&<p className="display-state">{s.status==='paused'?'已暂停':'准备恢复'}</p>}{s.speaker!==null&&<p className="display-speaker">{s.speaker} 号发言</p>}{seconds!==null&&<div className="display-timer" aria-label="公开倒计时">{Math.floor(seconds/60).toString().padStart(2,'0')}:{(seconds%60).toString().padStart(2,'0')}</div>}{s.winner&&<p className="display-winner">{s.winner==='good'?'好人获胜':'狼人获胜'}</p>}</section>
  <section className="display-seats" aria-label="公开座位状态">{Array.from({length:s.seatCount},(_,i)=>i+1).map(seat=><div key={seat} className={`display-seat${s.dead.includes(seat)?' is-dead':''}${s.speaker===seat?' is-speaking':''}`}><strong>{seat}<small>号</small></strong><span>{s.dead.includes(seat)?'已公布出局':s.speaker===seat?'正在发言':'未公布出局'}</span></div>)}</section>
  {s.vote&&<section className="display-vote"><h2>已公布投票结果</h2><div>{s.vote.counts.map(c=><span key={c.seat}>{c.seat} 号：{c.votes} 票</span>)}</div>{s.vote.ballots&&<p>{s.vote.ballots.map(b=>`${b.seat} 号 → ${b.target===null?'弃票':b.target+' 号'}`).join('；')}</p>}</section>}
  <footer className="display-footer">仅显示已公布的信息 · 约每 3 秒更新</footer>
 </main>;
}
