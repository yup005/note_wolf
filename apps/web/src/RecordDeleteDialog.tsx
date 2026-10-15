import {useEffect,useRef,useState} from 'react';
import type {OwnRecordSummary,RecordDelete} from '../../../packages/contracts/records';
import {api,ApiError,errorText,requestId} from './api';
export function RecordDeleteDialog({record,onClose,onDeleted,onRefresh}:{record:OwnRecordSummary;onClose:()=>void;onDeleted:()=>void;onRefresh:()=>Promise<void>}){
 // One mounted confirmation owns one immutable command, including ambiguous retries.
 const [command]=useState<Readonly<RecordDelete>>(()=>Object.freeze({requestId:requestId(),confirmed:true,revision:record.revision,publishedVersion:record.publishedVersion,withdrawn:record.withdrawn}));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[definitive,setDefinitive]=useState(false),[attempted,setAttempted]=useState(false);
 const unresolved=attempted&&!definitive;
 const dialog=useRef<HTMLElement>(null),locked=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();return()=>{mounted.current=false;previous?.focus();};},[]);
 async function remove(){if(locked.current||definitive)return;locked.current=true;setBusy(true);setError('');setAttempted(true);try{await api(`/api/records/${record.id}/delete`,command);if(mounted.current)onDeleted();}catch(e){if(mounted.current){setError(errorText(e));setDefinitive(e instanceof ApiError&&e.status>=400&&e.status<500&&![408,429].includes(e.status));}}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 async function refresh(){if(locked.current)return;locked.current=true;setBusy(true);try{await onRefresh();if(mounted.current)onClose();}catch(e){if(mounted.current)setError(errorText(e));}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 return <div className="modal-backdrop record-overlay record-delete-overlay"><section ref={dialog} className="card modal record-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="record-delete-title" aria-describedby="record-delete-boundary" onKeyDown={e=>{
  if(e.key==='Escape'&&!busy&&!unresolved){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><h2 id="record-delete-title">永久删除我的记录？</h2><p>房间 {record.code} · 修订 {record.revision} · {record.versionCount} 个已发布版本</p><p id="record-delete-boundary">将永久删除你的已保存草稿、当前未保存内容及全部已发布版本，相关分享将失效。无法恢复。</p><p className="helper">官方事实、其他作者的记录、对局档案和对局评论保留。</p>{error&&<p className="night-error" role="alert">{error}{!definitive&&' 尚未确认结果，请重试同一次删除。'}</p>}{definitive?<button className="secondary full" disabled={busy} onClick={()=>void refresh()}>读取最新状态</button>:<button className="primary full" disabled={busy} onClick={()=>void remove()}>{busy?'正在删除…':attempted?'重试永久删除':'确认永久删除'}</button>}<button data-cancel className="text-button full" disabled={busy||unresolved} onClick={onClose}>取消</button></section></div>;
}
