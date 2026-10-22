import {useEffect,useRef,useState,type ComponentType} from 'react';
import './tutorial.css';
export function TutorialEntry(){
 const [open,setOpen]=useState(false),[Lesson,setLesson]=useState<ComponentType>(),[failed,setFailed]=useState(false),mounted=useRef(false),generation=useRef(0),dialog=useRef<HTMLElement>(null),entry=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;};},[]);
 function hide(){generation.current++;setOpen(false);setLesson(undefined);setFailed(false);}
 function show(){const turn=++generation.current;setLesson(undefined);setFailed(false);setOpen(true);void import('./TutorialLesson').then(module=>{if(mounted.current&&generation.current===turn&&document.visibilityState==='visible')setLesson(()=>module.default);}).catch(()=>{if(mounted.current&&generation.current===turn)setFailed(true);});}
 useEffect(()=>{if(!open)return;close.current?.focus();return()=>{if(entry.current?.isConnected)entry.current.focus();};},[open]);
 return <><section className="card tutorial-entry" aria-label="新手教学"><div><h2>第一次玩？</h2><p className="helper">用合成示例体验标准 12 人流程，不占真实座位。</p></div><button ref={entry} className="secondary" onClick={show}>新手教学</button></section>
  {open&&<div className="modal-backdrop tutorial-overlay" onClick={event=>{if(event.target===event.currentTarget)hide();}}><section ref={dialog} className="card modal tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}
   if(event.key==='Tab'){const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0),first=controls[0],last=controls.at(-1);if(!controls.includes(document.activeElement as HTMLElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><header className="section-head"><h2 id="tutorial-title">新手教学</h2><button ref={close} className="text-button" onClick={hide}>退出教学</button></header><p className="tutorial-badge">教学 / 合成示例</p><>{failed?<p role="alert">教学暂时无法打开，请退出后刷新页面再试。</p>:Lesson?<Lesson/>:<p role="status">正在准备教学…</p>}</></section></div>}
 </>;
}
