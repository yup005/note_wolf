import {useEffect,useRef,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {DisplayCommand,DisplayStatus} from '../../../packages/contracts/display';
import {api,errorText} from './api';
import './display.css';

export function DisplayControls({view}:{view:LobbyView}){
 const [open,setOpen]=useState(false);
 if(!view.me.isHost||view.room.testRoom)return null;
 return <><button className="text-button display-entry" onClick={()=>setOpen(true)}>公共大屏</button>{open&&<DisplayDialog view={view} onClose={()=>setOpen(false)}/>}</>;
}
function DisplayDialog({view,onClose}:{view:LobbyView;onClose:()=>void}){
 const [status,setStatus]=useState<DisplayStatus>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(true),[confirm,setConfirm]=useState<'rotate'|'revoke'>();
 const dialog=useRef<HTMLElement>(null),mounted=useRef(false),locked=useRef(false),sequence=useRef(0),readAbort=useRef<AbortController|undefined>(undefined);
 const path=`/api/rooms/${view.room.id}/display`;
 async function load(){
  const seq=++sequence.current;readAbort.current?.abort();const controller=new AbortController();readAbort.current=controller;const timeout=setTimeout(()=>controller.abort(),6000);setBusy(true);
  try{const next=await api<DisplayStatus>(path,undefined,{signal:controller.signal});if(mounted.current&&seq===sequence.current){setStatus(next);setError('');return true;}}
  catch(e){if(mounted.current&&seq===sequence.current){setStatus(undefined);setError(controller.signal.aborted?'读取超时，请重新读取':errorText(e));}}
  finally{clearTimeout(timeout);if(mounted.current&&seq===sequence.current)setBusy(false);}
  return false;
 }
 useEffect(()=>{mounted.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();void load();return()=>{mounted.current=false;sequence.current++;readAbort.current?.abort();previous?.focus();};},[]);
 useEffect(()=>{if(dialog.current&&!dialog.current.contains(document.activeElement))dialog.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();},[status,busy,confirm,error]);
 async function command(action:DisplayCommand['action']){
  if(locked.current||busy||!status)return;locked.current=true;setBusy(true);setError('');setNotice('');setConfirm(undefined);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);
  try{const next=await api<DisplayStatus>(path,{action,revision:status.revision,confirmed:true},{gameId:view.room.gameId,signal:controller.signal});if(mounted.current)setStatus(next);}
  catch(e){if(mounted.current){const verified=await load();if(mounted.current)setError(`${errorText(e)}。${verified?'已重新核实链接状态，请确认后再操作。':'链接状态尚未确认，请重新读取后再操作。'}`);}}
  finally{clearTimeout(timeout);locked.current=false;if(mounted.current)setBusy(false);}
 }
 const address=status?.token?`${location.origin}/display/${status.token}`:'';
 async function copy(){try{await navigator.clipboard.writeText(address);if(mounted.current)setNotice('链接已复制');}catch{if(mounted.current)setNotice('请选中链接后复制');}}
 return <div className="modal-backdrop display-overlay"><section ref={dialog} className="card modal display-dialog" role="dialog" aria-modal="true" aria-labelledby="display-title" onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]')??[]),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><div className="section-head"><h2 id="display-title">公共大屏</h2><button className="text-button" onClick={onClose}>关闭</button></div><p>将链接在平板或电脑打开，显示已公布的阶段、发言、死讯和投票结果。</p><p className="helper">持有链接的人均可查看公开信息。可随时重新生成或撤销；同房重开继续使用。</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {status?.enabled?<><label>大屏链接<input className="name-input" readOnly value={address} onFocus={e=>e.currentTarget.select()}/></label><div className="display-actions"><button className="secondary" disabled={busy} onClick={()=>void copy()}>复制链接</button><a className="secondary" href={address} target="_blank" rel="noreferrer">打开大屏</a></div><div className="display-actions"><button className="text-button" disabled={busy} onClick={()=>setConfirm('rotate')}>重新生成链接</button><button className="text-button" disabled={busy} onClick={()=>setConfirm('revoke')}>撤销链接</button></div></>:status?<button className="primary full" disabled={busy} onClick={()=>void command('create')}>生成链接</button>:<p>{busy?'正在读取…':'链接状态尚未确认'}</p>}
 {confirm&&<div className="display-confirm"><p>{confirm==='rotate'?'重新生成后，旧地址将无法继续查看。':'撤销后，现有大屏将停止显示。'}</p><button className="primary" disabled={busy} onClick={()=>void command(confirm)}>{confirm==='rotate'?'确认重新生成':'确认撤销'}</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(undefined)}>取消</button></div>}
 <button className="text-button full" disabled={busy} onClick={()=>void load()}>重新读取状态</button></section></div>;
}
