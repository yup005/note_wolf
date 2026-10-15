import {useEffect,useState} from 'react';
import type {SharedRecord} from '../../../packages/contracts/sharing';
import {errorText} from './api';
export function useSharedRecord(path:string,valid=true,authenticated=false){
 const [post,setPost]=useState<SharedRecord>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 useEffect(()=>{
  if(!valid){setPost(undefined);setError('分享链接暂不可用');setLoading(false);return;}
  let cancelled=false,active:AbortController|undefined;
  const load=async()=>{
   active?.abort();const request=new AbortController();active=request;setLoading(true);setError('');const timeout=setTimeout(()=>request.abort(),6000);
   try{const response=await fetch(path,{signal:request.signal,cache:'no-store',credentials:authenticated?'same-origin':'omit'}),data=await response.json();if(!response.ok)throw Error(data.message??'分享链接暂不可用');if(!cancelled&&active===request){setPost(data as SharedRecord);if(authenticated)window.dispatchEvent(new Event('wolf:favorite-read'));}}
   catch(e){if(!cancelled&&active===request){setPost(undefined);setError(request.signal.aborted?'读取超时，请重试':errorText(e));}}
   finally{clearTimeout(timeout);if(!cancelled&&active===request)setLoading(false);}
  };
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000),visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;active?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[path,valid,authenticated,reload]);
 return {post,error,loading,refresh:()=>setReload(n=>n+1)};
}
