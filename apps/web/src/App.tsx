import {useCallback,useEffect,useRef,useState} from 'react';
import type {LobbyView,RoomSnapshot} from '../../../packages/contracts/index';
import {api,errorText,requestId} from './api';
import {OtpInput} from './OtpInput';
import {BoardCard,RoomLobby} from './RoomLobby';
import {useRoom} from './useRoom';
interface PendingCreate {requestId:string;nickname:string}
function loadPendingCreate():PendingCreate|undefined{
 try{const p=JSON.parse(localStorage.getItem('wolf.pending-create')??'null');
  if(p&&typeof p.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId)&&typeof p.nickname==='string'&&p.nickname.trim().length>0&&p.nickname.length<=24)return p;
 }catch{/* malformed display state never establishes server authority */}
 return undefined;
}
export function App(){
 const pendingCreate=useRef<PendingCreate|undefined>(loadPendingCreate());
 const [nickname,setNickname]=useState(()=>pendingCreate.current?.nickname??localStorage.getItem('wolf.nickname')??'');
 const [digits,setDigits]=useState(['','','','']);const [view,setView]=useState<LobbyView>();
 const [previous,setPrevious]=useState<LobbyView[]>([]);const [booting,setBooting]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [warning,setWarning]=useState(false);const lock=useRef(false);
 const snapshot=useCallback((room:RoomSnapshot)=>setView(current=>current&&current.room.id===room.id&&room.revision>=current.room.revision?{...current,room}:current),[]);
 const connected=useRoom(view?.room.id,snapshot);
 const initialize=useCallback(async()=>{
  setError('');setBooting(true);
  try{const session=await api<{rooms:LobbyView[]}>('/api/session');setPrevious(session.rooms);
   const remembered=localStorage.getItem('wolf.room');const active=session.rooms.find(v=>v.room.id===remembered);if(active)setView(active);
  }catch(e){setError(errorText(e));}finally{setBooting(false);}
 },[]);
 useEffect(()=>{void initialize();},[initialize]);
 function enter(next:LobbyView){localStorage.setItem('wolf.room',next.room.id);localStorage.setItem('wolf.nickname',next.me.nickname);setView(next);setError('');setPrevious(p=>[next,...p.filter(v=>v.room.id!==next.room.id)]);}
 function validName(){if(!nickname.trim()||nickname.trim().length>24){setError('请输入 1–24 个字符的昵称');return false;}return true;}
 async function run(action:()=>Promise<LobbyView>){
  if(lock.current||booting)return false;lock.current=true;setBusy(true);setError('');
  try{enter(await action());return true;}catch(e){setError(errorText(e));return false;}finally{lock.current=false;setBusy(false);}
 }
 async function create(){
  setWarning(false);if(!pendingCreate.current&&!validName())return;
  const pending=pendingCreate.current??{requestId:requestId(),nickname:nickname.trim()};
  pendingCreate.current=pending;localStorage.setItem('wolf.pending-create',JSON.stringify(pending));
  const confirmed=await run(()=>api<LobbyView>('/api/rooms',pending));
  if(confirmed){pendingCreate.current=undefined;localStorage.removeItem('wolf.pending-create');}
 }
 function requestCreate(){if(!pendingCreate.current&&!validName())return;if(localStorage.getItem('wolf.host-warning')==='seen')void create();else setWarning(true);}
 function join(code:string){if(!validName())return;void run(()=>api<LobbyView>('/api/rooms/join',{nickname,code}));}
 async function select(seat:number){
  if(!view||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const next=await api<LobbyView>(`/api/rooms/${view.room.id}/seat`,{seat});setView(current=>current&&current.room.revision>next.room.revision?{...current,me:next.me}:next);}
  catch(e){setError(errorText(e));try{const current=await api<LobbyView>(`/api/rooms/${view.room.id}`);snapshot(current.room);}catch{/* reconnect retrieves the current snapshot */}}
  finally{lock.current=false;setBusy(false);}
 }
 function home(){setView(undefined);setError('');setDigits(['','','','']);localStorage.removeItem('wolf.room');}
 return <div className="app-shell">
  <header className="app-header"><a className="brand" href="/" onClick={e=>{e.preventDefault();home();}}><span className="brand-symbol"><svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m5 6 4 3 5-2 5 2 4-3-2 13-7 4-7-4L5 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m9 14 2 1m6-1-2 1m-3 3h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></span><span>围坐<span className="brand-sub">狼人杀面杀助手</span></span></a><span className="header-label">线下面杀 · 手机辅助</span></header>
  <main>
   {error&&<div className="error-box" role="alert">{error}{booting===false&&!view&&previous.length===0&&<button className="text-button" onClick={()=>void initialize()}>重新连接</button>}</div>}
   {booting?<div className="card loading" role="status">正在连接房间服务…</div>:view?<RoomLobby view={view} connected={connected} busy={busy} onSeat={seat=>void select(seat)} onHome={home}/>:<>
    <section className="hero"><div className="eyebrow">GATHER AROUND. LET THE GAME BEGIN.</div><h1>围坐一桌，<br/>好戏开场<span className="accent-period">。</span></h1><p>放下复杂的准备，把时间留给推理。<br className="mobile-break"/>创建房间，邀请朋友，找到你的座位。</p><div className="hero-meta"><span><i className="dot"/>多人实时入座</span><span>12 人经典板</span><span>免下载</span></div></section>
    <div className="home-grid">
     <section className="card entry-card"><div className="section-head"><div><div className="eyebrow">JOIN THE TABLE</div><h2>一起入座</h2></div><span className="small-icon">↗</span></div>
      <label className="input-label" htmlFor="nickname">你的昵称</label><input id="nickname" className="name-input" maxLength={24} placeholder="让同桌的朋友认出你" value={nickname} onChange={e=>setNickname(e.target.value)} disabled={busy}/>
      <div className="join-label"><label className="input-label">输入房间号</label><span>向房主获取四位号码</span></div>
      <OtpInput digits={digits} onChange={setDigits} onComplete={join} disabled={busy}/>
      <button className="primary full" disabled={busy||digits.some(v=>!v)} onClick={()=>join(digits.join(''))}>{busy?'连接中…':'加入房间'}<span>→</span></button>
      <div className="or-divider"><span>或由你来组局</span></div><button aria-label="创建房间" className="secondary full" disabled={busy} onClick={requestCreate}><span aria-hidden="true">＋</span> 创建房间</button>
      <p className="entry-foot">{pendingCreate.current?'上次创建尚未确认，点击创建将恢复原房间。':'无需账号即可入房，输入四位号码自动查找。'}</p>
     </section>
     <div className="home-aside"><BoardCard/><section className="card how-card"><div className="eyebrow">从这里开始</div><h2>三步，坐到一起。</h2><ol><li><span>01</span><div><strong>创建一张桌子</strong><p>房主创建房间，获得四位房间号。</p></div></li><li><span>02</span><div><strong>邀请同桌的朋友</strong><p>每个人用自己的手机输入房间号。</p></div></li><li><span>03</span><div><strong>按号码入座</strong><p>选择对应的空位，全员实时同步。</p></div></li></ol></section></div>
    </div>
    {previous.length>0&&<section className="recent"><h2>这台设备加入的房间</h2><div>{previous.map(r=><button className="recent-room" key={r.room.id} onClick={()=>void run(()=>api<LobbyView>(`/api/rooms/${r.room.id}`))}><strong>{r.room.code}</strong><span>12 人 · 预女猎白</span><span>返回 →</span></button>)}</div></section>}
   </>}
  </main>
  <footer>围坐 · 让推理发生在朋友之间<span>房间大厅</span></footer>
  {warning&&<div className="modal-backdrop"><section className="card modal" role="dialog" aria-modal="true" aria-labelledby="guest-title"><div className="eyebrow">创建前的小提醒</div><h2 id="guest-title">保管好房主的设备</h2><p>未绑定账号无法跨设备恢复管理权限</p><p className="muted">本阶段以游客身份创建。请使用这台设备继续管理房间。</p><button autoFocus className="primary full" onClick={()=>{localStorage.setItem('wolf.host-warning','seen');void create();}}>以游客身份继续</button><button className="text-button full" onClick={()=>setWarning(false)}>取消</button></section></div>}
 </div>;
}
