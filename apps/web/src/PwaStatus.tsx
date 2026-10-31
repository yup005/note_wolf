import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {hasWaitingUpdate,subscribePwaUpdate} from './pwaClient';
import './pwa.css';
export function PwaStatus({installable=true}:{installable?:boolean}){
 const waiting=useSyncExternalStore(subscribePwaUpdate,hasWaitingUpdate,()=>false),[dismissed,setDismissed]=useState(false),[open,setOpen]=useState(false),close=useRef<HTMLButtonElement>(null);
 const standalone=typeof navigator!=='undefined'&&((navigator as Navigator&{standalone?:boolean}).standalone===true||window.matchMedia('(display-mode: standalone)').matches);
 useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[open]);
 return <>{waiting&&!dismissed&&<section className="pwa-update" role="status"><p>新版本已准备，请先保存笔记，关闭本站所有窗口后重新打开</p><button className="text-button" onClick={()=>setDismissed(true)}>稍后</button></section>}
  {installable&&!standalone&&<button className="text-button pwa-install" onClick={()=>setOpen(true)}>添加到主屏幕</button>}
  {open&&<div className="modal-backdrop"><section className="card modal pwa-guide" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title" onKeyDown={event=>{if(event.key==='Escape')setOpen(false);if(event.key==='Tab'){event.preventDefault();close.current?.focus();}}}><h2 id="pwa-guide-title">添加到主屏幕</h2><p>iPhone：在 Safari 打开本站，点击“分享”，再选择“添加到主屏幕”。之后可从主屏幕独立打开。</p><p>其他设备：使用浏览器菜单中的“安装应用”或“添加到主屏幕”；没有该选项时可继续在浏览器使用。</p><p className="helper">对局需要联网。离开页面前请先保存笔记，后台或断网后未保存的编辑会清除；返回时重新核实当前状态。</p><button ref={close} className="primary full" onClick={()=>setOpen(false)}>关闭</button></section></div>}
 </>;
}
