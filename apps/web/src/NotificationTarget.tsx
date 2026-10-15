import {useEffect,useRef} from 'react';
import {RecordPostDialog} from './RecordPostDialog';
import {SharedFavoriteDialog} from './SharedFavoriteDialog';
import {SharedRecordContent} from './SharedRecordContent';
import {CommunityEntry} from './CommunityEntry';
import {useSharedRecord} from './useSharedRecord';
import type {NotificationTarget as Target} from '../../../packages/contracts/notifications';
export function NotificationTarget({target,onClose,returnFocus}:{target:Target;onClose:()=>void;returnFocus?:HTMLElement|null}){
 const {scope,focusCommentId}=target,container=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=returnFocus??(document.activeElement instanceof HTMLElement?document.activeElement:null);container.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{requestAnimationFrame(()=>{if(previous?.isConnected)previous.focus();});};},[]);
 return <div className="notification-target" ref={container} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}if(e.key==='Tab'){const nodes=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(node=>node.getClientRects().length>0);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>{scope.kind==='record'?<RecordPostDialog id={scope.id} focusCommentId={focusCommentId} onClose={onClose}/>:scope.kind==='shared-favorite'?<SharedFavoriteDialog id={scope.id} focusCommentId={focusCommentId} onClose={onClose}/>:<ShareTarget token={scope.token} focusCommentId={focusCommentId} onClose={onClose}/>}</div>;
}
function ShareTarget({token,focusCommentId,onClose}:{token:string;focusCommentId?:string;onClose:()=>void}){
 const {post,error,loading,refresh}=useSharedRecord(`/api/shared-records/${token}`,true,true);
 return <div className="modal-backdrop notification-source-overlay"><section className="card modal record-post notification-source" role="dialog" aria-modal="true" aria-label="分享复盘"><div className="section-head"><h2>分享复盘</h2><button className="text-button" onClick={onClose}>关闭</button></div>{error&&<p role="alert">{error}</p>}{loading&&!post&&<p role="status">正在读取复盘…</p>}{post&&<SharedRecordContent post={post}/>}<button className="secondary full" disabled={loading} onClick={refresh}>刷新复盘</button><CommunityEntry scope={{kind:'share',token}} available={!!post&&!loading} focusCommentId={focusCommentId}/></section></div>;
}
