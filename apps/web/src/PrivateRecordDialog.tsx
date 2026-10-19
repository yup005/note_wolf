import {useEffect,useRef,useState} from 'react';
import type {PrivateRecordFavorite} from '../../../packages/contracts/records';
import {RecordContent} from './RecordPostDialog';
import {api,errorText} from './api';

export default function PrivateRecordDialog({id,onClose}:{id:string;onClose:()=>void}){
 const [record,setRecord]=useState<PrivateRecordFavorite>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLElement>(null),alive=useRef(false),sequence=useRef(0);
 async function load(){
  const seq=++sequence.current;setRecord(undefined);setError('');setBusy(true);
  try{const result=await api<PrivateRecordFavorite>(`/api/record-favorites/${id}/private`);if(alive.current&&seq===sequence.current&&document.visibilityState==='visible')setRecord(result);}
  catch(e){if(alive.current&&seq===sequence.current)setError(errorText(e));}
  finally{if(alive.current&&seq===sequence.current)setBusy(false);}
 }
 useEffect(()=>{
  if(document.visibilityState!=='visible'){onClose();return;}
  alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();void load();
  const visible=()=>{if(document.visibilityState==='hidden'){sequence.current++;setRecord(undefined);onClose();}else void load();};
  const focus=()=>{if(document.visibilityState==='visible')void load();};
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',focus);const timer=window.setInterval(focus,30000);
  return()=>{alive.current=false;sequence.current++;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',focus);previous?.focus();};
 },[id]);
 useEffect(()=>{if(dialog.current&&!dialog.current.contains(document.activeElement))dialog.current.querySelector<HTMLButtonElement>('button')?.focus();},[record,error,busy]);
 return <div className="modal-backdrop record-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="card modal replay-sheet" role="dialog" aria-modal="true" aria-labelledby="private-record-title" onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}>
  <div className="section-head"><h2 id="private-record-title">未发布官方记录</h2><button className="text-button" onClick={onClose}>关闭</button></div><p className="helper">仅本人可见 · 展示已保存草稿，请注意周围视线。</p>
  {busy&&<p role="status">正在读取…</p>}{error&&<><p className="night-error" role="alert">{error}</p><button className="secondary full" onClick={()=>void load()}>重新读取</button></>}
  {record&&<><p className="helper">{record.author} · 房间 {record.code} · 草稿修订 {record.revision}</p><RecordContent document={record.document}/></>}
  <button className="secondary full" disabled={busy} onClick={()=>void load()}>刷新记录</button>
 </section></div>;
}
