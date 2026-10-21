import {GameRecordPanel} from './GameRecordPanel';
import {PwaStatus} from './PwaStatus';
import {NotificationBell} from './NotificationBell';
import {PublicVoiceProvider} from './PublicVoice';
import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import type {LobbyView,RoomSnapshot} from '../../../packages/contracts/index';
import {api,errorText,requestId} from './api';
import {OtpInput} from './OtpInput';
import {RoomLobby} from './RoomLobby';
import {MySharesPanel} from './MySharesPanel';
import {AccountDialog,type AccountSession} from './AccountDialog';
import {AdminPanel} from './AdminPanel';
import {ProfileAvatar} from './ProfileEditor';
import {RecordsPanel} from './RecordsPanel';
import type {Account} from '../../../packages/contracts/auth';
import {useRoom,expireRoomNavigation,acceptRoomActionView,type RoomExpiration} from './useRoom';
const MyRecordsPanel=lazy(()=>import('./MyRecordsPanel').then(module=>({default:module.MyRecordsPanel})));
const FavoritesPanel=lazy(()=>import('./FavoritesPanel').then(module=>({default:module.FavoritesPanel})));
interface PendingCreate {requestId:string;nickname:string}
function loadPendingCreate():PendingCreate|undefined{
 try{const p=JSON.parse(localStorage.getItem('wolf.pending-create')??'null');
  if(p&&typeof p.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId)&&typeof p.nickname==='string'&&p.nickname.trim().length>0&&p.nickname.length<=24)return p;
 }catch{/* malformed display state never establishes server authority */}
 return undefined;
}
export function App({initialSession,onSessionChange}:{initialSession:AccountSession;onSessionChange:()=>void}){
 const [account,setAccount]=useState<Account|null>(initialSession.account);const [accountOpen,setAccountOpen]=useState(false);const [adminOpen,setAdminOpen]=useState(false);const [sessionRevision,setSessionRevision]=useState(0);
 const pendingCreate=useRef<PendingCreate|undefined>(loadPendingCreate());
 const [nickname,setNickname]=useState(()=>initialSession.account?.nickname??pendingCreate.current?.nickname??localStorage.getItem('wolf.nickname')??'');
 const [digits,setDigits]=useState(['','','','']);const [view,setView]=useState<LobbyView|undefined>(()=>initialSession.rooms.find(v=>v.room.id===localStorage.getItem('wolf.room')));
 const [recordGame,setRecordGame]=useState<string>();
 const [recordRoom,setRecordRoom]=useState<string>();const recordNavigationGeneration=useRef(0);
 const [previous,setPrevious]=useState<LobbyView[]>(initialSession.rooms);const booting=false;const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');const [warning,setWarning]=useState(false);const lock=useRef(false);
 const snapshot=useCallback((room:RoomSnapshot)=>setView(current=>current&&current.room.id===room.id&&room.revision>=current.room.revision?{...current,room}:current),[]);
 const navigation=useRef({view,previous});navigation.current={view,previous};
 const expiredRoom=useCallback((event:RoomExpiration)=>{
  const next=expireRoomNavigation({...navigation.current,rememberedRoom:localStorage.getItem('wolf.room')},event.roomId);navigation.current={view:next.view,previous:next.previous};
  setPrevious(rooms=>rooms.filter(room=>room.room.id!==event.roomId));
  if(localStorage.getItem('wolf.room')===event.roomId)localStorage.removeItem('wolf.room');
  if(next.wasCurrent){setView(current=>current?.room.id===event.roomId?undefined:current);setDigits(['','','','']);setError(event.message);}
 },[]);
 const connected=useRoom(view?.room.id,snapshot,sessionRevision,expiredRoom);
 const initialize=onSessionChange;
 useEffect(()=>{const remembered=localStorage.getItem('wolf.room');if(remembered&&!initialSession.rooms.some(v=>v.room.id===remembered))localStorage.removeItem('wolf.room');},[initialSession]);
 function enter(next:LobbyView){navigation.current.view=next;localStorage.setItem('wolf.room',next.room.id);localStorage.setItem('wolf.nickname',next.me.nickname);setView(next);setError('');setPrevious(p=>[next,...p.filter(v=>v.room.id!==next.room.id)]);}
 function validName(){if(!nickname.trim()||nickname.trim().length>24){setError('请输入 1–24 个字符的昵称');return false;}return true;}
 async function run(action:()=>Promise<LobbyView>,isCurrent?:()=>boolean){
  if(lock.current||booting)return false;lock.current=true;setBusy(true);setError('');
  try{const next=await action();if(isCurrent&&!isCurrent())return false;enter(next);return true;}catch(e){if(!isCurrent||isCurrent())setError(errorText(e));return false;}finally{lock.current=false;setBusy(false);}
 }
 async function openRecordRoom(id:string){const version=recordNavigationGeneration.current,isCurrent=()=>version===recordNavigationGeneration.current;if(await run(()=>api<LobbyView>(`/api/rooms/${id}`),isCurrent)&&isCurrent()&&navigation.current.view?.room.id===id)setRecordRoom(id);}
 async function create(){
  setWarning(false);if(!pendingCreate.current&&!validName())return;
  const pending=pendingCreate.current??{requestId:requestId(),nickname:nickname.trim()};
  pendingCreate.current=pending;localStorage.setItem('wolf.pending-create',JSON.stringify(pending));
  const confirmed=await run(()=>api<LobbyView>('/api/rooms',pending));
  if(confirmed){pendingCreate.current=undefined;localStorage.removeItem('wolf.pending-create');}
 }
 function requestCreate(){if(account){void create();return;}if(!pendingCreate.current&&!validName())return;if(localStorage.getItem('wolf.host-warning')==='seen')void create();else setWarning(true);}
 function join(code:string){if(!validName())return;void run(()=>api<LobbyView>('/api/rooms/join',{nickname,code}));}
 async function roomAction(action:string,body:unknown={}){
  if(!view||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const next=await api<LobbyView>(`/api/rooms/${view.room.id}/${action}`,body,{gameId:view.room.gameId});setView(current=>acceptRoomActionView(current,next));}
  catch(e){setError(errorText(e));try{const current=await api<LobbyView>(`/api/rooms/${view.room.id}`);snapshot(current.room);}catch{/* reconnect retrieves the current snapshot */}}
  finally{lock.current=false;setBusy(false);}
 }
 async function refreshRoom(){if(view){const next=await api<LobbyView>(`/api/rooms/${view.room.id}`);snapshot(next.room);}}
 function accountSession(session:AccountSession){recordNavigationGeneration.current++;pendingCreate.current=undefined;localStorage.removeItem('wolf.pending-create');if(!session.account)localStorage.removeItem('wolf.room');onSessionChange();}
 function profileSession(session:AccountSession){setAccount(session.account);setPrevious(session.rooms);setView(current=>{if(!current)return current;const updated=session.rooms.find(room=>room.room.id===current.room.id);return updated?{...updated,room:updated.room.revision>=current.room.revision?updated.room:current.room}:current;});if(session.account){setNickname(session.account.nickname);localStorage.setItem('wolf.nickname',session.account.nickname);}}
 const closeAdmin=useCallback(()=>setAdminOpen(false),[]);
 function home(){recordNavigationGeneration.current++;setRecordRoom(undefined);setRecordGame(undefined);const current=navigation.current.view;if(current)setPrevious(rooms=>[current,...rooms.filter(v=>v.room.id!==current.room.id)]);navigation.current.view=undefined;setView(undefined);setError('');setDigits(['','','','']);localStorage.removeItem('wolf.room');}
 return <div className={`app-shell${view?` in-room${(view.room.night||view.room.manual)?' in-night':''}`:''}`}>
  <header className="app-header"><a className="brand" href="/" onClick={e=>{e.preventDefault();home();}}><span className="brand-symbol"><svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="m5 6 4 3 5-2 5 2 4-3-2 13-7 4-7-4L5 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m9 14 2 1m6-1-2 1m-3 3h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></span><span>笔记狼人杀</span></a><div className="account-tools">{account&&<NotificationBell key={`notifications:${account.id}:${sessionRevision}`} accountId={account.id}/>}{account?.role==='admin'&&<button className="text-button" onClick={()=>{home();setAdminOpen(true);}}>后台</button>}<button className="text-button header-account-button" onClick={()=>setAccountOpen(true)} disabled={booting}>{account&&<ProfileAvatar url={account.avatarUrl} nickname={account.nickname} className="avatar header-account-avatar"/>}<span className="header-account-name">{account?account.nickname:'登录 / 注册'}</span></button></div></header>
  <PwaStatus installable={!view}/><main>
   {error&&<div className="error-box" role="alert">{error}{booting===false&&!view&&previous.length===0&&<button className="text-button" onClick={()=>void initialize()}>重新连接</button>}</div>}
   {booting?<div className="card loading" role="status">正在连接房间服务…</div>:adminOpen&&account?.role==='admin'?<AdminPanel key={`admin:${account.id}:${sessionRevision}`} adminId={account.id} onClose={closeAdmin}/>:view?<PublicVoiceProvider key={`${view.room.id}:${view.room.gameId}:${sessionRevision}`} view={view} connected={connected}><RoomLobby view={view} connected={connected} busy={busy} onSeat={seat=>void roomAction('seat',{seat})} onAction={(action,body)=>void roomAction(action,body)} onPublicRefresh={refreshRoom} onHome={home}/>{recordRoom===view.room.id&&<RecordsPanel key={`home-record:${view.room.id}:${view.room.gameId}:${sessionRevision}`} view={view} onRefresh={refreshRoom} onClose={()=>setRecordRoom(undefined)}/>}</PublicVoiceProvider>:<>
    <section className="hero"><h1>房间大厅</h1></section>
    <div className="home-grid home-entry">
     <section className="card entry-card"><div className="section-head"><div><h2>加入或创建房间</h2></div><span className="small-icon">↗</span></div>
      <label className="input-label" htmlFor="nickname">你的昵称</label><input id="nickname" className="name-input" maxLength={24} placeholder="输入昵称" value={nickname} onChange={e=>setNickname(e.target.value)} disabled={busy}/>
      <div className="join-label"><label className="input-label">输入房间号</label><span>向房主获取四位号码</span></div>
      <OtpInput digits={digits} onChange={setDigits} onComplete={join} disabled={busy}/>
      <button className="primary full" disabled={busy||digits.some(v=>!v)} onClick={()=>join(digits.join(''))}>{busy?'连接中…':'加入房间'}<span>→</span></button>
      <div className="or-divider"><span>或</span></div><button aria-label="创建房间" className="secondary full" disabled={busy} onClick={requestCreate}><span aria-hidden="true">＋</span> 创建房间</button>
      {pendingCreate.current&&<p className="entry-foot">上次创建尚未确认，点击创建将恢复原房间。</p>}
     </section>

    </div>
    {previous.length>0&&<section className="recent"><h2>{account?'我的房间':'这台设备加入的房间'}</h2><div>{previous.map(r=><button className="recent-room" key={r.room.id} onClick={()=>void run(()=>api<LobbyView>(`/api/rooms/${r.room.id}`))}><strong>{r.room.code}</strong><span>{r.room.board.composition.seatCount} 人 · {r.room.board.name}</span><span>返回 →</span></button>)}</div></section>}
    <Suspense fallback={<p role="status">正在读取…</p>}><MyRecordsPanel key={`records:${sessionRevision}`} rooms={previous} vip={!!account?.vip?.active} busy={busy} onOpenRoom={openRecordRoom} onOpenGame={setRecordGame}/></Suspense>
    <Suspense fallback={<section className="card favorites-panel" aria-label="我的收藏"><h2>我的收藏</h2><p className="helper" role="status">正在读取…</p></section>}><FavoritesPanel key={`favorites:${sessionRevision}`}/></Suspense>
    {account&&<MySharesPanel key={`shares:${sessionRevision}`}/>}
   </>}
  </main>

  {recordGame&&<GameRecordPanel key={`${recordGame}:${sessionRevision}`} gameId={recordGame} onClose={()=>setRecordGame(undefined)}/>}
  {accountOpen&&<AccountDialog account={account} onClose={()=>setAccountOpen(false)} onSession={accountSession} onProfileSession={profileSession}/>}
  {warning&&<div className="modal-backdrop"><section className="card modal" role="dialog" aria-modal="true" aria-labelledby="guest-title"><div className="eyebrow">创建前的小提醒</div><h2 id="guest-title">保管好房主的设备</h2><p>未绑定账号无法跨设备恢复管理权限</p><p className="muted">游客房间可在登录后关联账号。</p><button autoFocus className="primary full" onClick={()=>{localStorage.setItem('wolf.host-warning','seen');void create();}}>以游客身份继续</button><button className="text-button full" onClick={()=>setWarning(false)}>取消</button></section></div>}
 </div>;
}
