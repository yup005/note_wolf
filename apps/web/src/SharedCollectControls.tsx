import {useEffect,useRef,useState} from 'react';
import type {Account} from '../../../packages/contracts/auth';
import {AccountDialog,type AccountSession} from './AccountDialog';
import {api,errorText} from './api';
interface CollectionStatus {account:Account|null;saved:boolean;id:string|null}
export function SharedCollectControls({token,available}:{token:string;available:boolean}){
 const [status,setStatus]=useState<CollectionStatus>(),[accountOpen,setAccountOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true),turn=useRef(0),locked=useRef(false);
 const path=`/api/shared-records/${token}/favorite`;
 async function load(clearError=false){if(clearError)setError('');const current=++turn.current;try{const next=await api<CollectionStatus>(path);if(mounted.current&&current===turn.current)setStatus(next);}catch(e){if(mounted.current&&current===turn.current)setError(errorText(e));}}
 useEffect(()=>{mounted.current=true;void load();const visible=()=>{if(document.visibilityState==='visible'&&!locked.current)void load();};document.addEventListener('visibilitychange',visible);return()=>{mounted.current=false;turn.current++;document.removeEventListener('visibilitychange',visible);};},[path]);
 async function collect(){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{
  if(!status?.account){const session=await api<AccountSession>('/api/session');if(mounted.current){setStatus({account:session.account,saved:false,id:null});if(!session.account)setAccountOpen(true);}if(session.account)await load();}
  else{await api(status.saved?`/api/shared-favorites/${status.id}/remove`:path,{});await load();}
 }catch(e){if(mounted.current){setError(errorText(e));await load();}}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 function session(next:AccountSession){setStatus({account:next.account,saved:false,id:null});void load();}
 return <div className="shared-collect">{error&&<><p role="alert">{error}</p><button className="text-button" disabled={busy} onClick={()=>void load(true)}>重试收藏状态</button></>}<button className="secondary full" disabled={busy||!status||!available&&!status.saved} onClick={()=>void collect()}>{busy?'处理中…':!status?.account?'登录后收藏':status.saved?'取消收藏':'收藏复盘'}</button>{accountOpen&&<AccountDialog account={status?.account??null} onClose={()=>setAccountOpen(false)} onSession={session} onProfileSession={session}/>}</div>;
}
