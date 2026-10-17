import {useEffect,useRef,useState} from 'react';
import type {ManagementHistoryPage,ManagementState,ManagementHistoryEntry} from '../../../packages/contracts/management';
import {ApiError,api,errorText} from './api';
const actionLabels={'pause':'暂停对局','resume':'恢复对局','delegate':'调整临时房主','defaults':'修改未来投票设置','badge-takeover':'接管警徽移交'};
const statusLabels={running:'进行中',paused:'已暂停',resuming:'准备恢复'};
const visibilityLabels={individual:'逐人票型',totals:'汇总票数'};
const badgeLabel=(s:ManagementState)=>s.badge==='lost'?'警徽流失':s.sheriff===null?'无警长':`${s.sheriff} 号`;
function changes(row:ManagementHistoryEntry){const {before:b,after:a}=row;switch(row.action){
 case 'pause':case 'resume':return [`${statusLabels[b.status]} → ${statusLabels[a.status]}`];
 case 'delegate':return [`${b.tempSeat===null?'未授权':b.tempSeat+' 号'} → ${a.tempSeat===null?'未授权':a.tempSeat+' 号'}`];
 case 'defaults':return [`${b.voteSeconds} 秒 → ${a.voteSeconds} 秒`,`${visibilityLabels[b.voteVisibility]} → ${visibilityLabels[a.voteVisibility]}`];
 case 'badge-takeover':return [`${badgeLabel(b)} → ${badgeLabel(a)}`];
 }}
function phaseLabel(state:ManagementState){return state.phase==='night'?`第 ${state.round} 夜`:state.phase==='day'?`第 ${state.round} 天`:state.phase==='ended'?'已结束':state.phase==='manual'?'手动记录':'准备阶段';}
export default function ManagementHistory({roomId,onUnavailable}:{roomId:string;onUnavailable:()=>Promise<void>}){
 const [page,setPage]=useState<ManagementHistoryPage|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),alive=useRef(false);
 async function load(before?:string){const seq=++generation.current;setBusy(true);setError('');try{const result=await api<ManagementHistoryPage>(`/api/rooms/${roomId}/management-history${before?'?before='+encodeURIComponent(before):''}`);if(!alive.current||seq!==generation.current)return;setPage(previous=>before&&previous?{items:[...previous.items,...result.items.filter(row=>!previous.items.some(old=>old.id===row.id))],next:result.next}:result);}catch(e){if(!alive.current||seq!==generation.current)return;setPage(null);setError(errorText(e));if(e instanceof ApiError&&[401,403,404].includes(e.status))void onUnavailable().catch(()=>{});}finally{if(alive.current&&seq===generation.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=window.setInterval(refresh,30000);return()=>{alive.current=false;generation.current++;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[roomId]);
 return <section className="management-history-panel" role="region" aria-label="对局管理记录"><div className="section-head"><h3>管理记录</h3><button className="text-button" disabled={busy} onClick={()=>void load()}>刷新记录</button></div><p className="helper">仅记录公开管理变更，不含身份、技能或私人笔记。</p>{error&&<p className="night-error" role="alert">{error}</p>}{busy&&!page&&<p role="status">正在读取管理记录…</p>}{page&&page.items.length===0&&<p className="helper">暂无管理记录</p>}{page?.items.map(row=><article className="management-history-entry" key={row.id}><div className="management-history-meta"><strong>{row.operator.seat===null?'房间成员':`${row.operator.seat} 号`} · {row.operator.nickname}</strong><time dateTime={new Date(row.at).toISOString()}>{new Date(row.at).toLocaleString()}</time></div><h4>{actionLabels[row.action]}</h4><p className="helper">{phaseLabel(row.before)}</p>{changes(row).map((line,i)=><p key={i}>{line}</p>)}</article>)}{page?.next&&<button className="secondary full" disabled={busy} onClick={()=>void load(page.next!)}>{busy?'正在读取…':'更早记录'}</button>}</section>;
}
