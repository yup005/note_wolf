import {useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
interface Props {view:LobbyView;connected:boolean;busy:boolean;onSeat:(seat:number)=>void;onHome:()=>void}
export function RoomLobby({view,connected,busy,onSeat,onHome}:Props){
 const {room,me}=view;const seated=room.seats.filter(s=>s.memberId).length;
 const own=room.seats.find(s=>s.memberId===me.id)?.number;const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(room.code);setCopied(true);}catch{setCopied(false);}}
 return <>
  <div className="lobby-top"><button className="back" onClick={onHome}>← 返回首页</button><span className="live" role="status"><i className={connected?'dot':'dot amber'}/>{connected?'实时同步':'正在重新连接'}</span></div>
  <div className="lobby-grid">
   <aside className="room-sidebar">
    <section className="card room-code-card"><div className="eyebrow">ROOM · 房间号</div><div className="room-code" data-testid="room-code">{room.code}</div><p>把房间号告诉同桌的朋友</p><button className="subtle full" onClick={copy}>{copied?'已复制房间号':'复制房间号'}</button></section>
    <BoardCard/>
    <section className="card identity-card"><div className="avatar">{me.nickname.slice(0,1)}</div><div><strong>{me.nickname}</strong><p>{me.isHost?'房主 · 管理权限保留在此设备':'玩家'}</p></div></section>
   </aside>
   <section className="card seats-card">
    <div className="section-head"><div><div className="eyebrow">TAKE A SEAT</div><h1>选择你的座位</h1></div><span className="count" data-testid="seated-count">{seated} / 12</span></div>
    <p className="section-description">按线下的位置入座，让每个号码都有归属。</p>
    <div className="legend"><span><i className="legend-dot"/>空位</span><span><i className="legend-dot occupied"/>已入座</span><span><i className="legend-dot yours"/>你的座位</span></div>
    <div className="seat-grid">
     {room.seats.map(s=>{
      const yours=s.memberId===me.id;return <button key={s.number} className={`seat ${s.memberId?'occupied':''} ${yours?'yours':''}`} disabled={busy||!!s.memberId||!!own||!connected}
       aria-label={`${s.number} 号座位，${s.nickname??'空位'}${yours?'，你的座位':''}`} onClick={()=>onSeat(s.number)}>
       <span className="seat-number">{String(s.number).padStart(2,'0')}</span><span className="seat-person">{s.memberId?<span className="person-avatar">{s.nickname?.slice(0,1)}</span>:<span className="empty-person">＋</span>}</span>
       <span className="seat-name">{s.nickname??'点击入座'}</span><span className="seat-tag">{yours?'你已入座':s.isHost?'房主':s.memberId?'已入座':'空位'}</span>
      </button>;
     })}
    </div>
    <div className="seat-feedback">{own?<><span className="check-circle">✓</span><div><strong>你的座位</strong><p>已入座 {own} 号，刷新页面后仍会保留。</p></div></>:<><span className="check-circle neutral">↗</span><div><strong>{seated===12?'座位已满':'等待你入座'}</strong><p>{seated===12?'所有座位都已有人，请向房主确认。':'选择一个空位，即可加入这张桌子。'}</p></div></>}</div>
    <div className="stage-note">当前开放房间大厅。发牌与对局功能将在后续开放。</div>
   </section>
  </div>
 </>;
}
export function BoardCard(){return <section className="card board-card"><div className="eyebrow">本局板子</div><h2>12 人 · 预女猎白</h2><div className="role-chips"><span>狼人 ×4</span><span>预言家 ×1</span><span>女巫 ×1</span><span>猎人 ×1</span><span>白痴 ×1</span><span>村民 ×4</span></div><div className="board-foot"><span>屠边</span><span>线下面杀</span></div></section>;}
