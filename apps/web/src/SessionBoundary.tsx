import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {App} from './App';
import {SharedRecordPage} from './SharedRecordPage';
import {DisplayPage} from './DisplayPage';
import {createRecovery} from './recovery';
import {loadRecovery} from './recoveryLoad';

/** No business subtree exists until current server authority is available. */
export function SessionBoundary(){
 const content=useRef<HTMLDivElement>(null);
 const [controller]=useState(()=>createRecovery(signal=>loadRecovery(location.pathname,signal),()=>{if(content.current){content.current.hidden=true;content.current.inert=true;}}));
 const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
 const canRead=()=>document.visibilityState!=='hidden'&&navigator.onLine!==false;
 const resume=()=>{if(!canRead()){controller.hide(document.visibilityState==='hidden'?'hidden':'offline');return;}if(controller.getSnapshot().phase!=='ready')void controller.resume();};
 useEffect(()=>{
  const visibility=()=>{if(document.visibilityState==='hidden')controller.hide('hidden');else resume();};
  const pagehide=()=>controller.hide('hidden');
  const pageshow=(event:PageTransitionEvent)=>{if(event.persisted)controller.hide('hidden');resume();};
  const offline=()=>controller.hide('offline');
  const authority=()=>{if(!canRead()){controller.hide(document.visibilityState==='hidden'?'hidden':'offline');return;}void controller.retry();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);window.addEventListener('offline',offline);window.addEventListener('online',resume);window.addEventListener('wolf:session-changed',authority);
  if(canRead())resume();else controller.hide(navigator.onLine===false?'offline':'hidden');
  return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);window.removeEventListener('offline',offline);window.removeEventListener('online',resume);window.removeEventListener('wolf:session-changed',authority);controller.dispose();};
 },[controller]);
 useLayoutEffect(()=>{if(content.current&&state.phase==='ready'&&controller.getSnapshot()===state&&canRead()){content.current.hidden=false;content.current.inert=false;}},[state,controller]);
 const retry=()=>{if(canRead())void controller.retry();else controller.hide(navigator.onLine===false?'offline':'hidden');};
 const share=location.pathname.startsWith('/share/'),display=location.pathname.startsWith('/display/');
 return <><div ref={content} data-recovery-content="" hidden={state.phase!=='ready'} inert={state.phase!=='ready'}>{state.phase==='ready'&&(state.payload.kind==='lobby'?<App key={state.epoch} initialSession={state.payload.session} onSessionChange={resume}/>:state.payload.kind==='display'?<DisplayPage key={state.epoch} token={state.payload.token} initialSnapshot={state.payload.snapshot}/>:<SharedRecordPage key={state.epoch} token={state.payload.token} initialPost={state.payload.post}/>)}</div>
  {state.phase!=='ready'&&<div className={`app-shell${share?' shared-shell':''}`}><header className="app-header"><a className="brand" href="/">笔记狼人杀</a></header><main className={`card recovery-status${share?' shared-record':''}`} aria-live="polite"><h1>{state.phase==='offline'?'目前无法联机':state.phase==='failed'?display?'大屏链接暂不可用':share?'分享链接暂不可用':'暂时无法连接':state.phase==='hidden'?'内容已隐藏':'正在连接房间服务…'}</h1><p>{state.phase==='failed'?state.message:state.phase==='checking'?'正在核实当前会话与权限，请稍候。':'连接服务端后才能查看对局。离开前请保存编辑，未保存内容会清除。'}</p>{(state.phase==='failed'||state.phase==='offline')&&<button className="primary full" onClick={retry}>重新连接</button>}{(share||display)&&<a className="text-button" href="/">返回首页</a>}</main></div>}
 </>;
}
