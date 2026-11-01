import {lazy,Suspense} from 'react';
import type {LobbyView,RoomSettings} from '../../../packages/contracts/index';
import {createBoardConfiguration,boardStartError} from '../../../packages/domain/boardConfig';
import {RoomSettingsChoices} from './RoomSettingsChoices';
import './preparationSettings.css';
const BoardConfigurationPanel=lazy(()=>import('./BoardConfigurationPanel').then(module=>({default:module.BoardConfigurationPanel})));
interface Props {view:LobbyView;busy:boolean;connected:boolean;onAction:(action:string,body?:unknown)=>void}
export function PreparationPanel({view,busy,connected,onAction}:Props){
 const {room,me}=view;const p=room.preparation;const seats=room.seats.filter(s=>s.memberId);const mine=seats.find(s=>s.memberId===me.id);
 const ready=seats.filter(s=>s.ready).length;const blocked=busy||!connected;
 const hostSeated=seats.some(s=>s.isHost);
 const capacity=room.board.composition.seatCount;const composition=room.board.composition;
 const boardError=boardStartError(createBoardConfiguration({seatCount:capacity,roles:composition.roleCounts,...(composition.idiotPolicy?{idiotPolicy:composition.idiotPolicy}:{})}),p.settings.gameMode);
 const playable=boardError===null;
 const boardMessage=boardError==='WOLF_FREE_MANUAL_ONLY'?'没有狼人角色，只能选择纯手动记录':boardError==='INVALID_BOARD_FACTIONS'?'只有狼人角色，不能正常开局':'完整玩法开发中，暂不能发牌';
 const dealAllowed=playable&&hostSeated&&seats.length===capacity&&ready===capacity;
 function configure(settings:RoomSettings){onAction('settings',settings);}
 return <section className="preparation-panel" aria-label="准备与发牌">
  <h2>{p.phase==='lobby'?'入座与准备':p.phase==='started'?'身份已锁定':'确认进度'}</h2>
  {p.phase==='lobby'?<>
   <p className="helper waiting-hint">可单人或少于 {capacity} 人候场；发牌需按本局板子满 {capacity} 人并全部准备。</p>
   <p className="helper">已准备 {ready} / {capacity}</p>
   {mine?<div className="prepare-actions"><button className={mine.ready?'secondary':'primary'} disabled={blocked} onClick={()=>onAction('ready',{ready:!mine.ready,settingsRevision:p.settingsRevision})}>{mine.ready?'取消准备':'准备'}</button><button className="text-button" disabled={blocked} onClick={()=>onAction('unseat')}>取消入座</button></div>:<p className="helper">请先入座{me.isHost?'，房主也须参赛':''}。</p>}
   {me.isHost&&<><button className="primary full" disabled={blocked||!dealAllowed} onClick={()=>onAction('deal')}>开始发牌</button><p className="helper">{!playable?boardMessage:!hostSeated?'房主须入座参赛':seats.length<capacity?`等待 ${capacity} 人入座`:ready<capacity?'等待所有玩家准备':'发牌后座位和设置将锁定'}</p></>}
   {me.isHost?<details className="host-settings" open><summary>选择板子与设置<span>{p.settings.dealMethod==='online'?'线上发牌':'实体牌'} · {p.settings.gameMode==='automatic'?'自动法官':'手动记录'}</span></summary><div className="settings-grid"><Suspense fallback={<p className="helper">正在读取板子…</p>}><BoardConfigurationPanel key={room.id+':'+room.gameId} board={room.board} settingsRevision={p.settingsRevision} blocked={blocked} onAction={onAction}/></Suspense>
    <RoomSettingsChoices key={room.id+':'+room.gameId} settings={p.settings} settingsRevision={p.settingsRevision} blocked={blocked} testRoom={!!room.testRoom} onChange={configure}/>
   </div><p className="helper">确认修改后，全员需要重新准备。</p></details>:null}
   {view.testPlayersEnabled&&me.isHost&&!room.testRoom&&playable&&<><button className="secondary full fill-test-players" disabled={blocked||!mine||p.settings.dealMethod!=='online'} onClick={()=>onAction('test-players')}>补满测试玩家</button><p className="helper">仅限管理员独占的新房间，转换后其他玩家无法加入。</p></>}
  </>:<>
   {p.phase==='identity_collection'&&<>
    <p className="helper">{p.settings.dealMethod==='physical'?`已提交 ${p.submittedCount} / ${capacity}`:`已确认 ${p.confirmedCount} / ${capacity}`}</p>
    {p.settings.dealMethod==='online'&&<p className="helper">请先查看并确认自己的身份，房主也需要确认。</p>}
    {p.validation==='mismatch'&&<p className="validation-warning" role="alert">角色数量不匹配，请各自检查身份</p>}
    {me.isHost?<button className="primary full" disabled={blocked||p.validation!=='valid'||p.confirmedCount!==capacity} onClick={()=>onAction('start')}>开始对局</button>:<p className="helper">等待全员确认后由房主开局。</p>}
   </>}
   {p.phase==='started'&&<>{p.settings.gameMode==='automatic'?<><p className="helper">由房主统一开始首夜。</p>{me.isHost&&<button className="primary full" disabled={blocked} onClick={()=>onAction('night/enter')}>开始首夜</button>}</>:<p className="helper">纯手动记录已开启。</p>}</>}
  </>}
 </section>;
}
