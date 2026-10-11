import {useEffect,useState} from 'react';
import type {OwnShare} from '../../../packages/contracts/sharing';
import {api,errorText} from './api';
import {ShareControls} from './ShareControls';
export function MySharesPanel(){
 const [items,setItems]=useState<OwnShare[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false,sequence=0;
  const load=async()=>{const current=++sequence;try{const data=await api<{items:OwnShare[]}>('/api/shares');if(!cancelled&&current===sequence){setItems(data.items);setError('');}}catch(e){if(!cancelled&&current===sequence){setItems([]);setError(errorText(e));}}finally{if(!cancelled&&current===sequence)setLoading(false);}};
  void load();const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;document.removeEventListener('visibilitychange',visible);};
 },[retry]);
 return <section className="card my-shares-panel" aria-label="我的分享"><h2>我的分享</h2>
  {error&&<p role="alert">{error} <button className="text-button" onClick={()=>setRetry(v=>v+1)}>重新读取</button></p>}
  {loading?<p className="helper">正在读取…</p>:!error&&items.length===0?<p className="helper">暂无分享链接</p>:items.map(item=><article className="owned-share" key={item.recordId}><strong>房间 {item.code} · {item.official?'官方复盘':item.author}</strong><ShareControls id={item.recordId}/></article>)}
 </section>;
}
