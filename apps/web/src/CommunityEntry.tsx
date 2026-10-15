import {lazy,Suspense,useState} from 'react';
import type {CommunityScope} from '../../../packages/contracts/community';
import './community.css';
const CommentFocus=lazy(()=>import('./CommentFocus'));
const CommentsPanel=lazy(()=>import('./CommentsPanel'));
export function CommunityEntry({scope,available=true,focusCommentId}:{scope:CommunityScope;available?:boolean;focusCommentId?:string}){
 const [open,setOpen]=useState(!!focusCommentId);
 return <section className="community-entry" aria-label="对局评论"><button className="secondary full" disabled={!available} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'收起评论':'查看评论'}</button>{open&&<Suspense fallback={<p role="status">正在读取评论…</p>}>{focusCommentId&&<CommentFocus scope={scope} commentId={focusCommentId} available={available}/>}<CommentsPanel scope={scope} available={available}/></Suspense>}</section>;
}
