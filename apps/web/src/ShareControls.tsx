import {useEffect,useRef,useState} from 'react';
import type {ShareCommand,ShareStatus} from '../../../packages/contracts/sharing';
import {api,errorText} from './api';
const labels:Record<ShareStatus['state'],string>={none:'尚未生成链接',active:'链接有效',paused:'VIP 暂未生效，链接已暂停',revoked:'已撤销，旧链接不会恢复',withdrawn:'复盘已撤回，链接暂不可用'};
export function ShareControls({id}:{id:string}){
 const [open,setOpen]=useState(false),[status,setStatus]=useState<ShareStatus>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<'regenerate'|'revoke'|null>(null);
 const alive=useRef(true),sequence=useRef(0),working=useRef(false);const path=`/api/records/${id}/share`;
 useEffect(()=>{alive.current=true;setStatus(undefined);return()=>{alive.current=false;sequence.current++;};},[path]);
 useEffect(()=>{
  if(!open)return;let cancelled=false;
  const load=async()=>{if(working.current)return;const seq=++sequence.current;try{const data=await api<ShareStatus>(path);if(!cancelled&&seq===sequence.current){setStatus(data);setError('');}}catch(e){if(!cancelled&&seq===sequence.current){setStatus(undefined);setError(errorText(e));}}};
  void load();const interval=setInterval(()=>void load(),30000),visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{cancelled=true;clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
 },[open,path]);
 async function command(action:ShareCommand['action']){
  if(!status||working.current)return;working.current=true;const seq=++sequence.current;setBusy(true);setError('');setNotice('');
  try{const next=await api<ShareStatus>(path,{action,revision:status.revision});if(alive.current&&seq===sequence.current){setStatus(next);setConfirm(null);}}
  catch(e){if(alive.current&&seq===sequence.current){setError(errorText(e));try{const fresh=await api<ShareStatus>(path);if(alive.current&&seq===sequence.current)setStatus(fresh);}catch{if(alive.current&&seq===sequence.current)setStatus(undefined);}}}
  finally{working.current=false;if(alive.current)setBusy(false);}
 }
 const url=status?.token?`${location.origin}/share/${status.token}`:'';
 async function copy(){try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(url);if(alive.current)setNotice('链接已复制');}catch{if(alive.current)setNotice('当前浏览器无法复制，请长按链接手动复制');}}
 return <details className="share-controls" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>对外分享</summary>
  <p className="helper">持有链接的人可查看本局身份与已发布内容。链接跟随最新发布版本。</p>
  {error&&<p className="night-error" role="alert">{error}</p>}{notice&&<p className="helper" role="status">{notice}</p>}
  {status?<><p className="share-state" role="status">{labels[status.state]}</p>{!status.canCreate&&<p className="helper">生成链接需要有效 VIP，且复盘已发布。</p>}
   {url&&<label>分享链接<textarea aria-label="分享链接" readOnly value={url} rows={3} onFocus={e=>e.currentTarget.select()}/></label>}
   {confirm?<div className="share-confirm"><p>{confirm==='revoke'?'撤销后旧链接不会恢复。':'重新生成后旧链接立即失效。'}</p><button className="primary full" disabled={busy} onClick={()=>void command(confirm)}>{confirm==='revoke'?'确认撤销':'确认重新生成'}</button><button className="text-button full" disabled={busy} onClick={()=>setConfirm(null)}>取消</button></div>:<div className="share-actions">
    {status.state==='none'?status.canCreate&&<button className="secondary full" disabled={busy} onClick={()=>void command('create')}>生成分享链接</button>:<>
     {status.state==='active'&&<button className="secondary full" disabled={busy} onClick={()=>void copy()}>复制链接</button>}
     {status.canCreate&&<button className="secondary full" disabled={busy} onClick={()=>setConfirm('regenerate')}>重新生成链接</button>}
     {status.state!=='revoked'&&<button className="text-button full" disabled={busy} onClick={()=>setConfirm('revoke')}>撤销链接</button>}
    </>}
   </div>}</>:!error&&<p className="helper">正在读取链接状态…</p>}
 </details>;
}
