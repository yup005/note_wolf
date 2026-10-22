import {useCallback,useEffect,useRef,useState} from 'react';
import type {PlayerStatistics} from '../../../packages/contracts/statistics';
import {boardRoleLabels} from '../../../packages/contracts/board';
import {api,errorText} from './api';
import './statistics.css';
const percentage=(value:number|null)=>value===null?'—':new Intl.NumberFormat('zh-CN',{style:'percent',maximumFractionDigits:1}).format(value);
export function StatisticsPanel({accountId}:{accountId:string}){
 const [open,setOpen]=useState(false),[data,setData]=useState<PlayerStatistics>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const mounted=useRef(false),generation=useRef(0),request=useRef<AbortController|undefined>(undefined);
 const load=useCallback(async()=>{
  const turn=++generation.current;request.current?.abort();const controller=new AbortController();request.current=controller;let timedOut=false;
  setData(undefined);setError('');setBusy(true);const timeout=setTimeout(()=>{timedOut=true;controller.abort();},6000);
  try{const result=await api<PlayerStatistics>('/api/my-stats',undefined,{signal:controller.signal});if(mounted.current&&turn===generation.current&&!controller.signal.aborted)setData(result);}
  catch(e){if(mounted.current&&turn===generation.current)setError(timedOut?'读取超时，请重试':errorText(e));}
  finally{clearTimeout(timeout);if(mounted.current&&turn===generation.current)setBusy(false);}
 },[accountId]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;request.current?.abort();};},[accountId]);
 useEffect(()=>{if(!open)return;const changed=()=>void load();window.addEventListener('wolf:records-changed',changed);return()=>window.removeEventListener('wolf:records-changed',changed);},[open,load]);
 function toggle(){if(open){generation.current++;request.current?.abort();setData(undefined);setError('');setBusy(false);setOpen(false);}else{setOpen(true);void load();}}
 return <section className="card favorites-panel statistics-panel" aria-label="我的战绩"><div className="section-head"><h2>我的战绩</h2><button className="text-button" aria-expanded={open} onClick={toggle}>{open?'收起战绩':'查看战绩'}</button></div>
  <p className="helper">已结束对局的本人参赛与胜率</p>
  {open&&<>{busy&&<p role="status">正在读取战绩…</p>}{error&&<p role="alert">{error}<button className="text-button" onClick={()=>void load()}>重试战绩</button></p>}
   {data&&<div className="statistics-body"><dl className="stats-summary"><div><dt>参赛</dt><dd aria-label="参赛次数">{data.played}</dd></div><div><dt>可判本人胜负</dt><dd aria-label="可判本人胜负场次">{data.resolved}</dd></div><div><dt>胜率</dt><dd aria-label="本人胜率">{percentage(data.winRate)}</dd></div></dl><p className="stats-outcomes">{data.wins} 胜 · {data.losses} 负 · {data.unresolved} 场未计入胜率</p>
    {data.roles.length>0&&<><h3>角色战绩</h3><ul className="stats-roles">{data.roles.map(row=><li className="stats-role" key={row.role}><strong>{boardRoleLabels[row.role]}</strong><span>{row.played} 场 · 可判 {row.resolved} 场 · {row.wins} 胜 · {percentage(row.winRate)}</span></li>)}</ul></>}
    {data.boards.length>0&&<><h3>常玩板子</h3><ol className="stats-boards">{data.boards.map((board,index)=><li key={index}><span>{board.name}</span><strong>{board.played} 场</strong></li>)}</ol></>}
    {data.played===0&&<p className="helper">暂无可统计的已结束对局</p>}
    <p className="helper stats-coverage">未判胜或本人阵营资料不足的对局不计入胜率。仅统计可验证的本人普通对局，部分旧记录资料不足。</p>
   </div>}
   <div className="stats-actions"><button className="secondary" disabled={busy} onClick={()=>void load()}>刷新战绩</button></div>
  </>}
 </section>;
}
