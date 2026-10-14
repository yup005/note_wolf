import {useEffect,useRef,useState} from 'react';
import type {CommunityMe} from '../../../packages/contracts/community';
import {api,errorText} from './api';
import './moderation.css';
export const moderationLabels:Record<string,string>={dismiss:'驳回举报',delete:'删除评论',warn:'警告',mute:'禁评',unmute:'解除禁评'};
export function restrictionLabel(until:number|null){return until===null?'永久禁评':until===0?'可以发表评论':until<=Date.now()?'禁评已到期':`禁评至 ${new Date(until).toLocaleString('zh-CN')}`;}
export default function CommunityNotices({accountId}:{accountId:string}){
 const [data,setData]=useState<CommunityMe|null>(null),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{let active=true;const read=async()=>{const version=++generation.current;try{const next=await api<CommunityMe>('/api/community/me');if(active&&version===generation.current&&next.viewer.account?.id===accountId){setData(next);setError('');}}catch(e){if(active&&version===generation.current){setData(null);setError(errorText(e));}}};void read();const visible=()=>{generation.current++;setData(null);if(document.visibilityState==='visible')void read();};document.addEventListener('visibilitychange',visible);return()=>{active=false;generation.current++;document.removeEventListener('visibilitychange',visible);};},[accountId]);
 return <section className="community-own-notices" aria-label="我的评论权限与消息">{error&&<p className="helper" role="alert">{error}</p>}{data?.viewer.account?.id===accountId&&<>{data.viewer.restriction&&<p className="community-restriction">{restrictionLabel(data.viewer.restriction.until)} · {data.viewer.restriction.reason}</p>}{data.notices.length>0&&<details><summary>审核消息 · {data.notices.length}</summary>{data.notices.map(notice=><article key={notice.id}><strong>{moderationLabels[notice.action]??'审核消息'}{notice.action==='mute'?` · ${restrictionLabel(notice.until)}`:''}</strong><p>{notice.reason}</p><small>{new Date(notice.at).toLocaleString('zh-CN')}</small></article>)}</details>}</>}
 </section>;
}
