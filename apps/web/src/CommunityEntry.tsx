import {lazy,Suspense,useState} from 'react';
import type {CommunityScope} from '../../../packages/contracts/community';
import './community.css';
const CommentsPanel=lazy(()=>import('./CommentsPanel'));
export function CommunityEntry({scope,available=true}:{scope:CommunityScope;available?:boolean}){
 const [open,setOpen]=useState(false);
 return <section className="community-entry" aria-label="对局评论"><button className="secondary full" disabled={!available} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'收起评论':'查看评论'}</button>{open&&<Suspense fallback={<p role="status">正在读取评论…</p>}><CommentsPanel scope={scope} available={available}/></Suspense>}</section>;
}
