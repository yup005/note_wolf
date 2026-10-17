import {lazy,Suspense,useEffect,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import './daySelf.css';
const DaySelfDialog=lazy(()=>import('./DaySelfDialog'));
export function DaySelfButton({view,connected,onRefresh}:{view:LobbyView;connected:boolean;onRefresh:()=>Promise<void>}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{const hide=()=>{if(document.visibilityState!=='visible')setOpen(false);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 return <div className="day-self-entry"><button className="secondary full" aria-haspopup="dialog" disabled={!connected} onClick={()=>{if(document.visibilityState==='visible')setOpen(true);}}>我的身份与技能</button>{open&&connected&&<Suspense fallback={<p role="status">正在准备私密查看…</p>}><DaySelfDialog view={view} onClose={()=>setOpen(false)} onRefresh={onRefresh}/></Suspense>}</div>;
}
