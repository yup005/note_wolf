import {BoardConfigurationPanel} from './BoardConfigurationPanel';
import type {LobbyView,RoomSettings} from '../../../packages/contracts/index';
interface Props {view:LobbyView;busy:boolean;connected:boolean;onAction:(action:string,body?:unknown)=>void}
export function PreparationPanel({view,busy,connected,onAction}:Props){
 const {room,me}=view;const p=room.preparation;const seats=room.seats.filter(s=>s.memberId);const mine=seats.find(s=>s.memberId===me.id);
 const ready=seats.filter(s=>s.ready).length;const blocked=busy||!connected;
 const hostSeated=seats.some(s=>s.isHost);
 const capacity=room.board.composition.seatCount;const playable=room.board.composition.playable;
 const dealAllowed=playable&&hostSeated&&seats.length===capacity&&ready===capacity;
 function configure(settings:RoomSettings){onAction('settings',settings);}
 return <section className="preparation-panel" aria-label="准备与发牌">
  <h2>{p.phase==='lobby'?'入座与准备':p.phase==='started'?'身份已锁定':'确认进度'}</h2>
  {p.phase==='lobby'?<>
   <p className="helper">已准备 {ready} / {capacity}</p>
   {mine?<div className="prepare-actions"><button className={mine.ready?'secondary':'primary'} disabled={blocked} onClick={()=>onAction('ready',{ready:!mine.ready,settingsRevision:p.settingsRevision})}>{mine.ready?'取消准备':'准备'}</button><button className="text-button" disabled={blocked} onClick={()=>onAction('unseat')}>取消入座</button></div>:<p className="helper">请先入座{me.isHost?'，房主也须参赛':''}。</p>}
   {me.isHost&&<><button className="primary full" disabled={blocked||!dealAllowed} onClick={()=>onAction('deal')}>开始发牌</button><p className="helper">{!playable?'完整玩法开发中，暂不能发牌':!hostSeated?'房主须入座参赛':seats.length<capacity?`等待 ${capacity} 人入座`:ready<capacity?'等待所有玩家准备':'发牌后座位和设置将锁定'}</p></>}
   {me.isHost?<details className="host-settings" open><summary>选择板子与设置<span>{p.settings.dealMethod==='online'?'线上发牌':'实体牌'} · {p.settings.gameMode==='automatic'?'自动法官':'手动记录'}</span></summary><div className="settings-grid"><BoardConfigurationPanel board={room.board} settingsRevision={p.settingsRevision} blocked={blocked} onAction={onAction}/>
    <label>发牌方式<select aria-label="发牌方式" value={p.settings.dealMethod} disabled={blocked||room.testRoom} onChange={e=>configure({...p.settings,dealMethod:e.target.value as RoomSettings['dealMethod']})}><option value="online">线上随机发牌</option><option value="physical">实体牌录入</option></select></label>
    <label>游戏模式<select aria-label="游戏模式" value={p.settings.gameMode} disabled={blocked} onChange={e=>configure({...p.settings,gameMode:e.target.value as RoomSettings['gameMode']})}><option value="automatic">自动法官</option><option value="manual">纯手动记录</option></select></label>
   </div><p className="helper">更改设置后需要重新准备。</p></details>:null}
   {view.testPlayersEnabled&&me.isHost&&!room.testRoom&&playable&&<><button className="secondary full fill-test-players" disabled={blocked||!mine||p.settings.dealMethod!=='online'} onClick={()=>onAction('test-players')}>补满测试玩家</button><p className="helper">仅限管理员独占的新房间，转换后其他玩家无法加入。</p></>}
  </>:<>
   {p.phase==='identity_collection'&&<>
    <p className="helper">{p.settings.dealMethod==='physical'?`已提交 ${p.submittedCount} / ${capacity}`:`已确认 ${p.confirmedCount} / ${capacity}`}</p>
    {p.validation==='mismatch'&&<p className="validation-warning" role="alert">角色数量不匹配，请各自检查身份</p>}
    {me.isHost?<button className="primary full" disabled={blocked||p.validation!=='valid'||p.confirmedCount!==capacity} onClick={()=>onAction('start')}>开始对局</button>:<p className="helper">等待全员确认后由房主开局。</p>}
   </>}
   {p.phase==='started'&&<>{p.settings.gameMode==='automatic'?<><p className="helper">由房主统一开始首夜。</p>{me.isHost&&<button className="primary full" disabled={blocked} onClick={()=>onAction('night/enter')}>开始首夜</button>}</>:<p className="helper">纯手动记录已开启。</p>}</>}
  </>}
 </section>;
}
