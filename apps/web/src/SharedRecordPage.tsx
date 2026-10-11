import {useEffect,useState} from 'react';
import type {SharedRecord} from '../../../packages/contracts/sharing';
import {shareTokenSchema} from '../../../packages/contracts/sharing';
import {roleLabels} from '../../../packages/contracts/labels';
import {RecordContent,outcomeLabel} from './RecordPostDialog';
import {errorText} from './api';
export function SharedRecordPage({token}:{token:string}){
 const [post,setPost]=useState<SharedRecord>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 useEffect(()=>{const old=document.title;document.title='复盘分享 · 笔记狼人杀';return()=>{document.title=old;};},[]);
 useEffect(()=>{
  if(!shareTokenSchema.safeParse(token).success){setPost(undefined);setError('分享链接暂不可用');setLoading(false);return;}
  let cancelled=false,active:AbortController|undefined;
  const load=async()=>{
   active?.abort();const request=new AbortController();active=request;setLoading(true);setError('');const timeout=setTimeout(()=>request.abort(),6000);
   try{const response=await fetch(`/api/shared-records/${token}`,{signal:request.signal,cache:'no-store',credentials:'omit'}),data=await response.json();if(!response.ok)throw Error(data.message??'分享链接暂不可用');if(!cancelled&&active===request)setPost(data as SharedRecord);}
   catch(e){if(!cancelled&&active===request){setPost(undefined);setError(request.signal.aborted?'读取超时，请重试':errorText(e));}}
   finally{clearTimeout(timeout);if(!cancelled&&active===request)setLoading(false);}
  };
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000),visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;active?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[token,reload]);
 return <div className="app-shell shared-shell"><header className="app-header"><a className="brand" href="/">笔记狼人杀</a><a className="text-button" href="/">返回首页</a></header><main aria-busy={loading}>
  <section className="card shared-record"><div className="section-head"><h1>{post?.official?'房主官方复盘':'复盘分享'}</h1><button className="text-button" disabled={loading} onClick={()=>setReload(n=>n+1)}>刷新</button></div>
   {error&&<p className="night-error" role="alert">{error}</p>}{loading&&!post&&<p className="helper" role="status">正在读取复盘…</p>}
   {post&&<><p className="helper">{post.author} · 房间 {post.code} · 版本 {post.version}</p><p className="replay-winner">{outcomeLabel(post.outcome)}</p>{!post.official&&<p className="helper">个人版本，官方结果以房主为准。</p>}<section className="replay-identities"><h2>本局身份</h2><div className="replay-roles">{post.roles.map(p=><span key={p.seat}>{p.seat} 号 · {roleLabels[p.role]}</span>)}</div></section><RecordContent document={post.document}/><p className="helper shared-foot">只读分享 · 展示最新已发布版本</p></>}
  </section>
 </main></div>;
}
