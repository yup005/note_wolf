import {gameApi} from './gameApi';
import {useEffect,useRef,useState} from 'react';
import type {LobbyView,PrivateIdentity} from '../../../packages/contracts/index';
import {roleLabels} from '../../../packages/contracts/labels';
import {errorText} from './api';
interface Props {view:LobbyView;busy:boolean;connected:boolean;onAction:(action:string,body?:unknown)=>void;onPublicRefresh:()=>Promise<void>}
export function TestPlayerPanel({view,busy,connected,onAction,onPublicRefresh}:Props){
 const api=gameApi(view.room.id,view.room.gameId);
 const {room,me}=view;const actors=room.seats.filter(s=>s.memberId&&(s.isTestPlayer||s.memberId===me.id));
 const [selected,setSelected]=useState(me.id);const [card,setCard]=useState<PrivateIdentity>();const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const generation=useRef(0);const lock=useRef(false);const seat=actors.find(s=>s.memberId===selected);const phase=room.preparation.phase;
 const action=selected===me.id?'identity':`test-players/${selected}/identity`;const path=`/api/rooms/${room.id}/${action}`;
 function hide(){generation.current++;setCard(undefined);setError('');}
 useEffect(()=>{hide();const conceal=()=>hide();document.addEventListener('visibilitychange',conceal);window.addEventListener('pagehide',conceal);return ()=>{generation.current++;document.removeEventListener('visibilitychange',conceal);window.removeEventListener('pagehide',conceal);};},[selected,room.id,phase,connected]);
 async function identity(confirm=false){
  if(lock.current||!connected||!seat)return;lock.current=true;setLoading(true);setError('');const version=++generation.current;
  try{const result=await api<PrivateIdentity>(confirm?path+'/confirm':path,confirm?{}:undefined);if(version===generation.current)setCard(result);if(confirm)await onPublicRefresh();}
  catch(e){if(version===generation.current)setError(errorText(e));}finally{lock.current=false;setLoading(false);}
 }
 const blocked=busy||loading||!connected||!seat;
 return <section className="identity-panel" aria-label="测试控制台"><h2>测试控制台</h2><p className="helper">切换玩家进行准备和身份测试；开局后可进入首夜。</p>
  <label className="input-label">操作的测试玩家<select aria-label="操作的测试玩家" value={selected} disabled={busy||loading} onChange={e=>{hide();setSelected(e.target.value);}}>{actors.map(s=><option key={s.memberId!} value={s.memberId!}>{s.number} 号 · {s.memberId===me.id?'你':s.nickname}</option>)}</select></label>
  {error&&<p className="validation-warning" role="alert">{error}</p>}
  {phase==='lobby'?<button className="secondary full" disabled={blocked} onClick={()=>onAction(selected===me.id?'ready':`test-players/${selected}/ready`,{ready:!seat?.ready,settingsRevision:room.preparation.settingsRevision})}>{seat?.ready?'取消该玩家准备':'该玩家准备'}</button>:<>
   {!card?<button className="secondary full" disabled={blocked} onClick={()=>void identity()}>查看该玩家身份</button>:<>
    {card.role&&<p className="private-role" data-testid="test-role">{roleLabels[card.role]}</p>}
    {phase==='identity_collection'&&!card.confirmed&&<button className="primary full" disabled={blocked} onClick={()=>void identity(true)}>确认该玩家身份</button>}
    <button className="text-button full" onClick={hide}>隐藏该玩家身份</button>
   </>}
  </>}
 </section>;
}
