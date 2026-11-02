import {gameApi} from './gameApi';
import {useEffect,useRef,useState} from 'react';
import type {PrivateIdentity,Role,PreparationState} from '../../../packages/contracts/index';
import {roleLabels} from '../../../packages/contracts/labels';
import type {BoardComposition} from '../../../packages/contracts/board';
import {errorText} from './api';
interface Props {roomId:string;gameId:string;phase:PreparationState['phase'];dealMethod:'online'|'physical';connected:boolean;roleCounts:BoardComposition['roles'];onPublicRefresh:()=>Promise<void>}
export function IdentityPanel({roomId,gameId,phase,dealMethod,connected,roleCounts,onPublicRefresh}:Props){
 const api=gameApi(roomId,gameId);
 const [visible,setVisible]=useState(false);const [card,setCard]=useState<PrivateIdentity>();const [selection,setSelection]=useState<Role|''>('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const generation=useRef(0);const lock=useRef(false);
 const path=`/api/rooms/${roomId}/identity`;
 function hide(){generation.current++;setVisible(false);setCard(undefined);setSelection('');setError('');}
 useEffect(()=>{
  hide();const conceal=()=>hide();document.addEventListener('visibilitychange',conceal);window.addEventListener('pagehide',conceal);
  return ()=>{generation.current++;document.removeEventListener('visibilitychange',conceal);window.removeEventListener('pagehide',conceal);};
 },[roomId,gameId,phase,connected]);
 async function reveal(){
  if(lock.current||!connected)return;lock.current=true;setBusy(true);setError('');const version=++generation.current;
  try{const result=await api<PrivateIdentity>(path);if(version===generation.current){setCard(result);setSelection(result.role??'');setVisible(true);}}
  catch(e){if(version===generation.current)setError(errorText(e));}finally{lock.current=false;setBusy(false);}
 }
 async function save(){
  if(lock.current||!connected)return;if(dealMethod==='physical'&&selection==='')return;
  lock.current=true;setBusy(true);setError('');const version=generation.current;
  try{
   if(dealMethod==='physical')await api<PrivateIdentity>(path,{role:selection});else await api<PrivateIdentity>(path+'/confirm',{});
   if(version===generation.current)hide();await onPublicRefresh();
  }catch(e){if(version===generation.current)setError(errorText(e));}finally{lock.current=false;setBusy(false);}
 }
 return <section className="identity-panel" aria-label="私人身份"><h2>你的身份</h2>
  {error&&<p className="validation-warning" role="alert">{error}</p>}
  {!visible?<><p className="helper">仅本人可查看，请注意周围视线。</p><button className="secondary full" disabled={busy||!connected} onClick={()=>void reveal()}>{busy?'加载中…':'查看身份'}</button></>:<>
   {dealMethod==='physical'&&!card?.locked?<><label className="input-label" htmlFor="physical-role">你的实体身份</label><select id="physical-role" value={selection} disabled={busy||!connected} onChange={e=>setSelection(e.target.value as Role|'')}><option value="" disabled>选择实体牌上的角色</option>{Object.entries(roleLabels).filter(([r])=>(roleCounts[r as Role]??0)>0).map(([r,label])=><option key={r} value={r}>{label}</option>)}</select><button className="primary full" disabled={busy||!connected||selection===''} onClick={()=>void save()}>提交身份</button></>:<>
    {card?.role&&<p className="private-role" data-testid="private-role">{roleLabels[card.role]}</p>}
    {card?.treasureCamp&&<p className="helper">你是{card.treasureCamp==='good'?'好人盗宝，整局计入神职':'狼人盗宝，不与其他狼人见面'}；每晚换牌不改变阵营。</p>}
    {phase==='identity_collection'&&!card?.confirmed&&<button className="primary full" disabled={busy||!connected} onClick={()=>void save()}>确认身份</button>}
    {card?.confirmed&&<p className="helper">身份已确认</p>}
   </>}
   <button className="text-button full" onClick={hide}>隐藏身份</button>
  </>}
 </section>;
}
