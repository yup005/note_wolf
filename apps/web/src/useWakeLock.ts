import {useEffect,useState} from 'react';
export function useWakeLock(enabled:boolean){
 const [status,setStatus]=useState<'active'|'unavailable'|'off'>('off');
 useEffect(()=>{
  let stopped=false;let requesting=false;let sentinel:WakeLockSentinel|undefined;
  async function request(){
   if(stopped||requesting||sentinel&&!sentinel.released||!enabled||document.visibilityState!=='visible')return;
   if(!navigator.wakeLock){setStatus('unavailable');return;}
   requesting=true;try{const lock=await navigator.wakeLock.request('screen');if(stopped){await lock.release();return;}sentinel=lock;setStatus('active');lock.addEventListener('release',()=>{if(!stopped)setStatus('off');});}
   catch{if(!stopped)setStatus('unavailable');}finally{requesting=false;}
  }
  const visibility=()=>{if(document.visibilityState==='visible')void request();};
  if(enabled)void request();else setStatus('off');document.addEventListener('visibilitychange',visibility);
  return ()=>{stopped=true;document.removeEventListener('visibilitychange',visibility);void sentinel?.release().catch(()=>{});};
 },[enabled]);return status;
}
