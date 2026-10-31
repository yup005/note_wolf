import {useEffect,useRef,useState} from 'react';
import type {SharedRecord} from '../../../packages/contracts/sharing';
import {errorText} from './api';
import {readSharedRecord} from './recoveryLoad';
export function useSharedRecord(path:string,valid=true,authenticated=false,initial?:{path:string;post:SharedRecord}){
 const seed=useRef(initial);
 const [post,setPost]=useState<SharedRecord|undefined>(initial?.path===path?initial.post:undefined),[error,setError]=useState(''),[loading,setLoading]=useState(!initial||initial.path!==path),[reload,setReload]=useState(0);
 useEffect(()=>{
  if(!valid){setPost(undefined);setError('分享链接暂不可用');setLoading(false);return;}
  let cancelled=false,active:AbortController|undefined;
  const load=async()=>{
   active?.abort();const request=new AbortController();active=request;setPost(undefined);setLoading(true);setError('');const timeout=setTimeout(()=>request.abort(),6000);
   try{const data=await readSharedRecord(path,authenticated,request.signal);if(!cancelled&&active===request){setPost(data);if(authenticated)window.dispatchEvent(new Event('wolf:favorite-read'));}}
   catch(e){if(!cancelled&&active===request){setPost(undefined);setError(request.signal.aborted?'读取超时，请重试':errorText(e));}}
   finally{clearTimeout(timeout);if(!cancelled&&active===request)setLoading(false);}
  };
  if(seed.current?.path===path){seed.current=undefined;setLoading(false);}else void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000),visible=()=>{if(document.visibilityState==='visible')void load();else{active?.abort();setPost(undefined);}};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;active?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[path,valid,authenticated,reload]);
 return {post,error,loading,refresh:()=>setReload(n=>n+1)};
}
