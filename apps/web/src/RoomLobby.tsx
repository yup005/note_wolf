import {RuleReferenceButton} from './RuleReference';
import {boardRoleLabels,type RoomBoardSnapshot,type BoardRole} from '../../../packages/contracts/board';
import {useState} from 'react';
import {ProfileAvatar} from './ProfileEditor';
import {ManualPanel} from './ManualPanel';
import {PreparationPanel} from './PreparationPanel';
import {IdentityPanel} from './IdentityPanel';
import {NightPanel} from './NightPanel';
import {DayPanel} from './DayPanel';
import {TestPlayerPanel} from './TestPlayerPanel';
import {useTestRoles} from './useTestRoles';
import {roleLabels} from '../../../packages/contracts/labels';
import type {LobbyView} from '../../../packages/contracts/index';
interface Props {view:LobbyView;connected:boolean;busy:boolean;onSeat:(seat:number)=>void;onHome:()=>void;onAction:(action:string,body?:unknown)=>void;onPublicRefresh:()=>Promise<void>}
export function RoomLobby({view,connected,busy,onSeat,onHome,onAction,onPublicRefresh}:Props){
 const testRoles=useTestRoles(view);const {room,me}=view;const phase=room.preparation.phase;
 const seated=room.seats.filter(s=>s.memberId).length;
 const own=room.seats.find(s=>s.memberId===me.id)?.number;
 const [copied,setCopied]=useState(false);const [testing,setTesting]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(room.code);setCopied(true);}catch{setCopied(false);}}
 if(room.manual)return <ManualPanel view={view} connected={connected} onHome={onHome} onPublicRefresh={onPublicRefresh}/>;
 if(room.day&&(!room.night||room.day.day>=room.night.night))return <DayPanel view={view} connected={connected} busy={busy} onHome={onHome} onAction={onAction} onPublicRefresh={onPublicRefresh}/>;
 if(room.night)return <NightPanel view={view} connected={connected} busy={busy} onHome={onHome} onAction={onAction} onPublicRefresh={onPublicRefresh}/>;
 return <div className="room-page" data-phase={phase}>
  <nav className="room-toolbar" aria-label="房间导航">
   <button className="back" onClick={onHome}>← 首页</button>
   <button className="room-copy subtle" aria-label="复制房间号" onClick={copy}><span>房间</span><strong data-testid="room-code">{room.code}</strong><span>{copied?'已复制':'复制'}</span></button>
   <div className="room-utilities"><RuleReferenceButton roomId={room.id} board={room.board}/>
   <span className="live" role="status"><i className={connected?'dot':'dot amber'}/>{connected?'已连接':'重连中'}</span>
   </div>
  </nav>
  <div className="room-overview"><span>{room.board.name}</span>{room.gameNumber>1&&<span>第 {room.gameNumber} 局</span>}<strong>{own?`你在 ${own} 号`:'等待入座'}{me.isHost?' · 房主':''}</strong></div>
  {room.testRoom&&<p className="test-room-label">测试房间 · 模拟玩家</p>}
  <div className="room-workspace">
   <section className="card seats-card" aria-label="本局座位">
    <div className="section-head"><h1>{phase==='lobby'?'选择你的座位':'本局座位'}</h1><span className="count" data-testid="seated-count">{seated} / {room.board.composition.seatCount}</span></div>
    <div className="legend"><span><i className="legend-dot"/>空位</span><span><i className="legend-dot occupied"/>已入座</span><span><i className="legend-dot yours"/>你的座位</span></div>
    <div className="seat-grid">
     {room.seats.map(s=>{
      const yours=s.memberId===me.id;return <button key={s.number} className={`seat ${s.memberId?'occupied':''} ${yours?'yours':''}`} disabled={busy||!!s.memberId||!connected||phase!=='lobby'}
       aria-label={`${s.number} 号座位，${s.nickname??'空位'}${yours?'，你的座位':''}`} onClick={()=>onSeat(s.number)}>
       <span className="seat-number">{String(s.number).padStart(2,'0')}</span><span className="seat-person">{s.memberId?<ProfileAvatar url={s.avatarUrl} nickname={s.nickname??''} className="person-avatar"/>:<span className="empty-person">＋</span>}</span>
       <span className="seat-name">{s.nickname??'点击入座'}</span><span className="seat-tag">{testRoles[s.number]?roleLabels[testRoles[s.number]]:phase==='lobby'&&s.ready?'已准备':yours?'你':s.isHost?'房主':s.memberId?'玩家':'空位'}</span>
      </button>;
     })}
    </div>
    {!own&&seated===room.board.composition.seatCount&&<p className="helper">座位已满</p>}
   </section>
   <section className="card room-focus" aria-label="当前阶段">
    {phase!=='lobby'&&own&&<IdentityPanel roomId={room.id} gameId={room.gameId} roleCounts={room.board.composition.roleCounts} phase={phase} dealMethod={room.preparation.settings.dealMethod} connected={connected} onPublicRefresh={onPublicRefresh}/>}
    <PreparationPanel view={view} busy={busy} connected={connected} onAction={onAction}/>
   </section>
  </div>
  <details className="card room-details"><summary>房间详情<span>{phase==='lobby'?'板子与说明':'板子与本局设置'}</span></summary>
   <BoardCard board={room.board}/>
   <p className="helper">这是同一房间的第 {room.gameNumber} 场游戏，重新开局后累加，与第几天、第几夜无关。</p>
   <p className="helper">{room.preparation.settings.dealMethod==='online'?'线上随机发牌':'实体牌录入'} · {room.preparation.settings.gameMode==='automatic'?'自动法官':'纯手动记录'}</p>
   <p className="helper">{me.nickname}{me.isHost?' · 房主':''} · {phase==='lobby'?'发牌前可改选空位，房主须参赛。':phase==='started'?'座位与身份已锁定。':'座位已锁定，请各自确认身份。'}</p>
  </details>
  {view.testPlayersEnabled&&me.isHost&&room.testRoom&&<details className="card test-console" onToggle={e=>setTesting(e.currentTarget.open)}><summary>测试控制台<span>切换模拟玩家</span></summary>{testing&&<TestPlayerPanel view={view} busy={busy} connected={connected} onAction={onAction} onPublicRefresh={onPublicRefresh}/>}</details>}
 </div>;
}
export function BoardCard({board}:{board?:RoomBoardSnapshot}){if(board)return <section className="card board-card"><div className="eyebrow">本局板子</div><h2>{board.name}</h2><div className="role-chips">{Object.entries(board.composition.roleCounts).map(([role,count])=><span key={role}>{boardRoleLabels[role as BoardRole]} ×{count}</span>)}</div><div className="board-foot"><span>{board.composition.seatCount} 人</span><span>线下面杀</span></div></section>;return <section className="card board-card"><div className="eyebrow">本局板子</div><h2>12 人 · 预女猎白</h2><div className="role-chips"><span>狼人 ×4</span><span>预言家 ×1</span><span>女巫 ×1</span><span>猎人 ×1</span><span>白痴 ×1</span><span>村民 ×4</span></div><div className="board-foot"><span>屠边</span><span>线下面杀</span></div></section>;}
