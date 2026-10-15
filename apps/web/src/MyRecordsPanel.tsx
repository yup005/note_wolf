import {useEffect,useRef,useState} from 'react';
import type {OwnRecordSummary} from '../../../packages/contracts/records';
import {api,errorText} from './api';
import {RecordDeleteDialog} from './RecordDeleteDialog';
export function MyRecordsPanel(){
 const [open,setOpen]=useState(false),[items,setItems]=useState<OwnRecordSummary[]>(),[error,setError]=useState(''),[loading,setLoading]=useState(false),[target,setTarget]=useState<OwnRecordSummary>();
 const mounted=useRef(true),generation=useRef(0);
 useEffect(()=>()=>{mounted.current=false;generation.current++;},[]);
 async function load(){const turn=++generation.current;setLoading(true);setError('');try{const result=await api<{items:OwnRecordSummary[]}>('/api/my-records');if(mounted.current&&turn===generation.current)setItems(result.items);}catch(e){if(mounted.current&&turn===generation.current)setError(errorText(e));throw e;}finally{if(mounted.current&&turn===generation.current)setLoading(false);}}
 return <section className="card favorites-panel" aria-label="我的记录"><div className="section-head"><h2>我的记录</h2><button className="text-button" aria-expanded={open} onClick={()=>{if(!open){setOpen(true);void load().catch(()=>{});}else setOpen(false);}}>{open?'收起':'我的记录'}</button></div>{open&&<>{error&&<p role="alert">{error}<button className="text-button" disabled={loading} onClick={()=>void load().catch(()=>{})}>重试</button></p>}{loading?<p role="status">正在读取…</p>:items?.length?<div className="favorite-games">{items.map(record=><div className="favorite-game" key={record.id}><div><strong>房间 {record.code}</strong><p className="helper">修订 {record.revision} · {record.versionCount} 个已发布版本{record.withdrawn?' · 已撤回':''}</p></div><button className="text-button" onClick={()=>setTarget(record)}>永久删除我的记录</button></div>)}</div>:!error&&<p className="helper">暂无个人记录</p>}</>}{target&&<RecordDeleteDialog key={target.id} record={target} onClose={()=>setTarget(undefined)} onRefresh={load} onDeleted={()=>{setItems(list=>list?.filter(item=>item.id!==target.id));setTarget(undefined);}}/>}</section>;
}
