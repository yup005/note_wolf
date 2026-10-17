import {lazy,Suspense,useEffect,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import {canManageGame} from './gameAccess';
import './managementHistory.css';
const ManagementHistory=lazy(()=>import('./ManagementHistory'));
export function ManagementHistoryEntry({view,onRefresh}:{view:LobbyView;onRefresh:()=>Promise<void>}){
 const manager=canManageGame(view),[open,setOpen]=useState(false);useEffect(()=>{if(!manager)setOpen(false);},[manager]);
 if(!manager)return null;
 return <section className="management-history"><button className="secondary full" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'收起管理记录':'查看管理记录'}</button>{open&&<Suspense fallback={<p role="status">正在读取管理记录…</p>}><ManagementHistory roomId={view.room.id} onUnavailable={onRefresh}/></Suspense>}</section>;
}
