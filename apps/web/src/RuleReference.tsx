import {lazy,Suspense,useEffect,useState} from 'react';
import type {RoomBoardSnapshot} from '../../../packages/contracts/board';
import {RuleReferenceShell} from './RuleReferenceShell';
const RuleReferenceDialog=lazy(()=>import('./RuleReferenceDialog'));

export function RuleReferenceButton({roomId,board}:{roomId:string;board:RoomBoardSnapshot}){
 const scope=roomId+JSON.stringify(board),[openedScope,setOpenedScope]=useState<string>();
 useEffect(()=>setOpenedScope(undefined),[scope]);
 useEffect(()=>{const hide=()=>{if(document.visibilityState!=='visible')setOpenedScope(undefined);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const close=()=>setOpenedScope(undefined);
 return <><button className="text-button rule-reference-open" aria-label="规则速查" aria-haspopup="dialog" onClick={()=>setOpenedScope(scope)}>规则</button>{openedScope===scope&&<Suspense fallback={<RuleReferenceShell board={board} onClose={close}><p role="status">正在打开规则…</p></RuleReferenceShell>}><RuleReferenceDialog board={board} onClose={close}/></Suspense>}</>;
}
