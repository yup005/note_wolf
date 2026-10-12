import {useEffect} from 'react';
import {shareTokenSchema} from '../../../packages/contracts/sharing';
import {SharedRecordContent} from './SharedRecordContent';
import {SharedCollectControls} from './SharedCollectControls';
import {useSharedRecord} from './useSharedRecord';
export function SharedRecordPage({token}:{token:string}){
 const valid=shareTokenSchema.safeParse(token).success,{post,error,loading,refresh}=useSharedRecord(`/api/shared-records/${token}`,valid);
 useEffect(()=>{const old=document.title;document.title='复盘分享 · 笔记狼人杀';return()=>{document.title=old;};},[]);
 return <div className="app-shell shared-shell"><header className="app-header"><a className="brand" href="/">笔记狼人杀</a><a className="text-button" href="/">返回首页</a></header><main aria-busy={loading}>
  <section className="card shared-record"><div className="section-head"><h1>{post?.official?'房主官方复盘':'复盘分享'}</h1><button className="text-button" disabled={loading} onClick={refresh}>刷新</button></div>
   {error&&<p className="night-error" role="alert">{error}</p>}{loading&&!post&&<p className="helper" role="status">正在读取复盘…</p>}
   {post&&<SharedRecordContent post={post}/>} {valid&&<SharedCollectControls token={token} available={!!post&&!loading}/>}
  </section>
 </main></div>;
}
