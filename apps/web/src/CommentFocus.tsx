import {useEffect,useRef,useState} from 'react';
import type {CommunityComment,CommunityScope} from '../../../packages/contracts/community';
import {api,errorText} from './api';
type Focus={comment:CommunityComment;parent:CommunityComment|null};
export default function CommentFocus({scope,commentId,available}:{scope:CommunityScope;commentId:string;available:boolean}){
 const [data,setData]=useState<Focus>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);const generation=useRef(0),region=useRef<HTMLElement>(null),key=JSON.stringify(scope);
 useEffect(()=>{if(data&&available){region.current?.scrollIntoView({block:'nearest'});region.current?.focus({preventScroll:true});}},[data,available]);
 useEffect(()=>{let active=true;const load=async()=>{const turn=++generation.current;setData(undefined);if(!available||document.visibilityState!=='visible')return;setLoading(true);setError('');try{const next=await api<Focus>('/api/community/focus',{scope,commentId});if(active&&generation.current===turn&&document.visibilityState==='visible')setData(next);}catch(e){if(active&&generation.current===turn)setError(errorText(e));}finally{if(active&&generation.current===turn)setLoading(false);}};void load();const refresh=()=>{void load();};document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{active=false;generation.current++;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};},[key,commentId,available]);
 function card(comment:CommunityComment){return <article key={comment.id} data-comment-id={comment.id}><strong>{comment.author}</strong><p className="community-body">{comment.deleted?'此评论已删除':comment.body}</p></article>;}
 return <section ref={region} tabIndex={-1} className="comment-focus" role="region" aria-label="通知定位评论"><h3>通知相关评论</h3>{loading&&<p role="status">正在定位评论…</p>}{error&&<p role="alert">{error}</p>}{available&&data&&<>{data.parent&&card(data.parent)}{card(data.comment)}</>}</section>;
}
