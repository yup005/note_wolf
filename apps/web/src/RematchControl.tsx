import {useEffect,useRef,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {RematchCommand,RematchResult} from '../../../packages/contracts/rematch';
import {api,errorText,requestId,ApiError} from './api';
export function RematchControl({view,connected,onResult}:{view:LobbyView;connected:boolean;onResult:(result:RematchResult)=>void}){
 const {room,me}=view,[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),dialog=useRef<HTMLElement>(null);
 const key=`wolf.rematch:${me.id}:${room.id}:${room.gameId}`;
 const pending=useRef<RematchCommand|undefined>(undefined);
 useEffect(()=>{if(!confirm)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previous?.focus();},[confirm]);
 if(!me.isHost||!(room.day?.phase==='ended'||room.manual?.status==='ended'))return null;
 async function submit(){
  if(lock.current||!connected)return;lock.current=true;setBusy(true);setError('');
  try{
   if(!pending.current){try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(saved?.expectedGameId===room.gameId&&typeof saved.requestId==='string')pending.current=saved;}catch{}}
   pending.current??={requestId:requestId(),expectedGameId:room.gameId};
   try{localStorage.setItem(key,JSON.stringify(pending.current));}catch{}
   const result=await api<RematchResult>(`/api/rooms/${room.id}/rematch`,pending.current,{gameId:room.gameId});
   try{localStorage.removeItem(key);}catch{}pending.current=undefined;setConfirm(false);onResult(result);
  }catch(e){setError(errorText(e));if(e instanceof ApiError&&e.status>=400&&e.status<500&&![408,429].includes(e.status)){pending.current=undefined;try{localStorage.removeItem(key);}catch{}}}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="card rematch-control"><button className="secondary full" disabled={!connected||busy} onClick={()=>setConfirm(true)}>再来一局</button>{error&&!confirm&&<p role="alert">{error}</p>}{confirm&&<div className="modal-backdrop"><section ref={dialog} className="card modal" role="dialog" aria-modal="true" aria-labelledby="rematch-title" onKeyDown={event=>{if(event.key==='Escape'&&!busy)setConfirm(false);if(event.key==='Tab'){const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);if(buttons.length<1){event.preventDefault();return;}const first=buttons[0],last=buttons.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}}>
  <h2 id="rematch-title">再来一局？</h2><p>将先保存第 {room.gameNumber} 局，再保留房间、玩家和座位回到候场。所有人需要重新准备、重新确认身份。</p><p className="helper">上一局的笔记、版本、收藏和有效分享继续独立保留。</p>{error&&<p role="alert">{error}</p>}
  <button className="primary full" disabled={busy||!connected} onClick={()=>void submit()}>{busy?'正在保存并重开…':'确认再来一局'}</button><button className="text-button full" disabled={busy} onClick={()=>setConfirm(false)}>返回</button>
 </section></div>}</section>;
}
