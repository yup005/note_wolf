import {useEffect,useRef,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {NightCommand,NightPrivate} from '../../../packages/contracts/night';
import {roleLabels} from '../../../packages/contracts/labels';
import {RecordsButton} from './RecordsPanel';
import {GameControls,canManageGame,gameFrozen} from './GameControls';
import {useWakeLock} from './useWakeLock';
import {useTestRoles} from './useTestRoles';
import {api,errorText} from './api';
type WithoutTurn<T> = T extends unknown?Omit<T,'turnId'>:never;
interface Props {view:LobbyView;connected:boolean;busy:boolean;onHome:()=>void;onAction:(action:string,body?:unknown)=>void;onPublicRefresh:()=>Promise<void>}
const phases={awaiting_host:'等待房主入夜',wolves:'狼人行动',eyes_closed:'闭眼间隔',witch:'女巫行动',seer:'预言家行动',hunter:'猎人查看状态',first_night_complete:'首夜操作完成'};
export function NightPanel({view,connected,busy,onHome,onAction,onPublicRefresh}:Props){
 const frozen=gameFrozen(view);const manager=canManageGame(view);const {room,me}=view;const night=room.night!;const testing=view.testPlayersEnabled&&me.isHost&&room.testRoom;const testRoles=useTestRoles(view);
 const [actor,setActor]=useState(me.id);const [shown,setVisible]=useState(false);const [privateState,setCard]=useState<NightPrivate>();const [loadedActor,setLoadedActor]=useState('');const [target,setTarget]=useState<number|null>(null);
 const [receipt,setReceipt]=useState<{actor:string;night:number;choice:'save'|'poison'|'skip';target:number|null}>();const privacyVersion=useRef(0);
 const [choice,setChoice]=useState<'save'|'poison'|'skip'>('skip');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const [autoFollow,setAutoFollow]=useState(true);const [foreground,setForeground]=useState(document.visibilityState==='visible');
 const [keepAwake,setKeepAwake]=useState(true);const wake=useWakeLock(keepAwake&&night.phase!=='first_night_complete');
 const [seconds,setSeconds]=useState(0);const readSequence=useRef(0);const generation=useRef(0);const lock=useRef(false);const selectionTurn=useRef(`${night.turnId}:${actor}`);const draftKey=useRef('');
 const visible=shown&&privateState?.turnId===night.turnId&&loadedActor===actor&&connected&&foreground&&!frozen;const card=visible?privateState:undefined;
 const selectedSeat=room.seats.find(s=>s.memberId===actor)?.number;const privatePath=`/api/rooms/${room.id}/${actor===me.id?'night':`test-players/${actor}/night`}`;
 function conceal(clearResult=true){if(clearResult){privacyVersion.current++;setReceipt(undefined);}generation.current++;setVisible(false);setCard(undefined);setError('');}
 useEffect(()=>{
  conceal(!connected||frozen);const selection=`${night.turnId}:${actor}`;if(selectionTurn.current!==selection){setTarget(null);setChoice('skip');draftKey.current='';selectionTurn.current=selection;}
  const hide=()=>{const active=document.visibilityState==='visible';setForeground(active);if(!active)conceal();};const pageHide=()=>{setForeground(false);conceal();};document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',pageHide);
  return ()=>{generation.current++;document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',pageHide);};
 },[night.turnId,actor,room.id,connected,frozen]);
 useEffect(()=>{
  if(!testing||!autoFollow||!connected||frozen)return;let cancelled=false;const version=generation.current;
  void api<{actorId:string|null;turnId:string}>(`/api/rooms/${room.id}/night/test-actor`).then(next=>{
   if(cancelled||next.turnId!==night.turnId)return;
   if(next.actorId)setActor(next.actorId);
  }).catch(()=>{});return ()=>{cancelled=true;};
 },[testing,autoFollow,connected,room.id,night.turnId,frozen]);
 useEffect(()=>{if(!frozen&&connected&&foreground&&!visible&&!lock.current&&!error)void reveal();},[actor,night.turnId,connected,foreground,visible,pending,frozen]);
 useEffect(()=>{if(!['witch','eyes_closed'].includes(night.phase))setReceipt(undefined);},[night.phase]);
 useEffect(()=>{const offset=night.serverNow-Date.now();const update=()=>setSeconds(night.deadline===null?0:Math.max(0,Math.ceil((night.deadline-Date.now()-offset)/1000)));update();const id=setInterval(update,250);return ()=>clearInterval(id);},[night.deadline,night.serverNow]);
 useEffect(()=>{
  if(!visible||!connected)return;let stopped=false;let pollPending=false;
  const id=setInterval(()=>{if(lock.current||pollPending)return;pollPending=true;const version=generation.current;const request=++readSequence.current;void api<NightPrivate>(privatePath+'/private').then(result=>{if(!stopped&&request===readSequence.current&&generation.current===version&&result.turnId===night.turnId)setCard(result);}).catch(()=>{}).finally(()=>{pollPending=false;});},1500);
  return ()=>{stopped=true;clearInterval(id);};
 },[visible,connected,privatePath,night.turnId]);
 async function reveal(){
  if(lock.current||!connected||frozen)return;lock.current=true;setPending(true);setError('');const version=++generation.current;
  try{const result=await api<NightPrivate>(privatePath+'/private');if(version===generation.current&&result.turnId===night.turnId){setCard(result);setLoadedActor(actor);setVisible(true);if(result.kind==='wolves'&&draftKey.current!==`${night.turnId}:${actor}`)setTarget(result.priorityWolf===selectedSeat?result.priorityTarget??null:result.myVote??null);}}
  catch(e){if(version===generation.current)setError(errorText(e));}finally{lock.current=false;setPending(false);}
 }
 async function send(command:WithoutTurn<NightCommand>){
  if(lock.current||!connected||frozen)return;lock.current=true;setPending(true);setError('');const version=++generation.current;const privacy=privacyVersion.current;
  try{const result=await api<NightPrivate>(privatePath+'/command',{...command,turnId:night.turnId});if(version===generation.current&&result.turnId===night.turnId)setCard(result);if(privacy===privacyVersion.current&&result.witchReceipt)setReceipt({actor,night:night.night,...result.witchReceipt});await onPublicRefresh();}
  catch(e){if(version===generation.current)setError(errorText(e));await onPublicRefresh().catch(()=>{});}finally{lock.current=false;setPending(false);}
 }
 const resultReceipt=!frozen&&connected&&foreground&&['witch','eyes_closed'].includes(night.phase)?(receipt?.actor===actor&&receipt.night===night.night?receipt:visible?card?.witchReceipt:undefined):undefined;
 const skillReceipt=card?.skillReceipt;
 const resultText=skillReceipt?skillReceipt.role==='seer'?`查验 ${skillReceipt.target} 号：${skillReceipt.result==='wolf'?'狼人':'好人'}`:`技能${skillReceipt.canShoot?'可发动':'不可发动'}`:resultReceipt?resultReceipt.choice==='save'?`已救 ${resultReceipt.target} 号`:resultReceipt.choice==='poison'?`已毒 ${resultReceipt.target} 号`:'本夜未用药':card?.kind==='seer'&&card.result?`查验 ${card.target} 号：${card.result==='wolf'?'狼人':'好人'}`:card?.kind==='hunter'?`技能${card.canShoot?'可发动':'不可发动'}`:null;
 const blocked=busy||pending||!connected||frozen;const interactive=visible&&(card?.kind==='wolves'||card?.kind==='seer'&&!card.committed||card?.kind==='witch'&&choice==='poison'&&!card.committed);
 const hasPriority=card?.kind==='wolves'&&card.priorityWolf!=null;const isPriority=hasPriority&&card.priorityWolf===selectedSeat;
 const completedLabel=night.night===1?phases.first_night_complete:'夜间操作完成';const dayLabel=night.night===1?'第一天':`第 ${night.night} 天`;
 const phase=night.phase;const voteGroups=new Map<number|'empty'|'pending',number[]>();
 if(card?.kind==='wolves')for(const seat of card.wolves??[]){const vote=card.votes?.find(v=>v.seat===seat);const key=vote?vote.target??'empty':'pending';voteGroups.set(key,[...(voteGroups.get(key)??[]),seat]);}
 return <div className={`night-screen${frozen?' is-frozen':''}`}>
  <nav className="night-nav" aria-label="游戏导航"><button className="back" onClick={onHome}>← 首页</button><span>房间 {room.code} · 你在 {me.seat} 号</span><span className="live" role="status"><i className={connected?'dot':'dot amber'}/>{connected?room.control?.reconnecting?'连接异常':'已连接':'重连中'}</span><GameControls view={view} connected={connected} onRefresh={onPublicRefresh}/><RecordsButton view={view} onRefresh={onPublicRefresh}/></nav>
  {testing&&<div className="night-test-tools"><label>测试<select aria-label="操作的测试玩家" value={actor} disabled={pending} onChange={e=>{conceal();setAutoFollow(false);setTarget(null);draftKey.current='';setActor(e.target.value);}}>{room.seats.filter(s=>s.memberId&&(s.isTestPlayer||s.memberId===me.id)).map(s=><option key={s.memberId!} value={s.memberId!}>{s.number} 号 · {s.memberId===me.id?'你':s.nickname}{testRoles[s.number]?` · ${roleLabels[testRoles[s.number]]}`:''}</option>)}</select></label><label className="test-follow"><input type="checkbox" checked={autoFollow} onChange={e=>{conceal();setAutoFollow(e.target.checked);}}/>自动跟随</label>{night.deadline!==null&&<button className="text-button" disabled={blocked} onClick={()=>onAction('night/test-advance')}>推进测试阶段</button>}</div>}
  <section className={`card night-stage${card?.kind==='wolves'?' wolf-operation':''}`} aria-label="夜间操作">
   <header className="night-heading"><div><span className="eyebrow">第 {night.night} 夜</span><h1>{phase==='first_night_complete'?completedLabel:phases[phase]}</h1></div><div className="night-clock-group"><button className="text-button wake-toggle" aria-pressed={keepAwake} onClick={()=>setKeepAwake(v=>!v)}>{wake==='unavailable'?'常亮不可用':wake==='active'?'常亮已开':'常亮已关'}</button><strong className="night-clock" aria-label="剩余时间">{night.deadline!==null?`${seconds} 秒`:'—'}</strong></div></header>
   <div className="night-note" aria-live="polite">
    {error?<span className="night-error" role="alert">{error}</span>:resultText?<div className="skill-result" role="status" aria-label="技能结果">{resultReceipt&&<span>本夜操作已确认</span>}<strong>{resultText}</strong>{phase==='eyes_closed'&&<span>请闭眼，等待下一阶段</span>}</div>:phase==='awaiting_host'?'由房主统一开始夜晚，无需再次准备。':phase==='eyes_closed'?'请所有玩家闭眼，等待下一阶段。':phase==='first_night_complete'?`${completedLabel}，等待房主开始${dayLabel}。`:!visible?'请闭眼，等待自己的行动阶段。':card?.kind==='wolves'?<>
     <div className="wolf-confirmer">{hasPriority?'优先指刀':'确认者'}：<strong>{hasPriority?card.priorityWolf:card.confirmer} 号{(hasPriority?card.priorityWolf:card.confirmer)===selectedSeat?'（你）':''}</strong>{hasPriority&&<span> · 优先刀口：{card.priorityTarget==null?'空刀':`${card.priorityTarget} 号`} · 超时后采用狼队票型</span>}</div>
     <div className="wolf-votes" role="list" aria-label="狼队票型">{[...voteGroups].sort(([a],[b])=>typeof a==='number'&&typeof b==='number'?a-b:typeof a==='number'?-1:typeof b==='number'?1:a==='empty'?-1:1).map(([key,seats])=><div className="wolf-vote-group" role="listitem" key={key}><strong>{key==='pending'?'未投票':key==='empty'?'空刀':`${key} 号`}</strong><span>{seats.join('、')} 号{key==='pending'?'未提交':'选择'}</span></div>)}</div>
    </>:card?.kind==='witch'?card.committed?'本夜操作已确认':`${card.knife===undefined?'刀口不可见':`刀口 ${card.knife===null?'空刀':card.knife+' 号'}`} · 解药${!card.antidote?'已用':card.knife===selectedSeat?'不可自救':card.knife==null?'暂无可救目标':'可用'} · 毒药${card.poison?'可用':'已用'}`:card?.kind==='seer'&&card.result?`查验 ${card.target} 号：${card.result==='wolf'?'狼人':'好人'}`:card?.kind==='hunter'?`技能${card.canShoot?'可发动':'不可发动'}`:'当前请闭眼，等待自己的行动阶段。'}
   </div>
   <div className="night-targets" aria-label="座位目标">
    {room.seats.map(s=>{const alive=night.alive.includes(s.number);const votes=card?.kind==='wolves'?card.votes?.filter(v=>v.target===s.number).length??0:0;return <button key={s.number} className={`night-target${target===s.number&&interactive?' selected':''}${s.number===selectedSeat?' self':''}${alive?'':' dead'}`} disabled={!interactive||blocked||!alive} aria-label={`目标 ${s.number} 号，${s.nickname}${alive?'':'，已死亡'}`} aria-pressed={interactive?target===s.number:undefined} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setTarget(s.number);}}><strong>{s.number}</strong><span>{s.nickname}</span><small>{[testRoles[s.number]?roleLabels[testRoles[s.number]]:null,!alive?'已死亡':null,votes?`${votes} 票`:s.number===selectedSeat?'你':null].filter(Boolean).join(' · ')||'　'}</small></button>;})}
   </div>
   <div className="night-actions">
    {phase==='awaiting_host'?<>
     {manager?<button className="primary full" disabled={blocked} onClick={()=>onAction('night/begin',{turnId:night.turnId})}>开始夜晚</button>:<p className="helper">等待房主开始夜晚</p>}
    </>:phase==='first_night_complete'?<>{manager?<button className="primary full" disabled={blocked} onClick={()=>onAction('day/enter')}>开始{dayLabel}</button>:<p className="helper">等待房主开始{dayLabel}</p>}</>:phase==='eyes_closed'?<p className="helper">请保持闭眼</p>:!visible?<p className="helper">等待自己的行动阶段</p>:<>
     {card?.kind==='wolves'&&<><div className="night-action-row"><button className="secondary" disabled={blocked} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setTarget(null);}}>空刀</button><button className="primary" disabled={blocked} onClick={()=>void send({action:'vote',target})}>{isPriority?'提交优先刀口':'提交刀口'}{target!==null?` · ${target} 号`:''}</button></div><div className="night-action-row">{isPriority?<button className="primary" disabled={blocked||card.priorityCommitted} onClick={()=>void send({action:'priority_knife',target})}>确认优先指刀 · {target===null?'空刀':`${target} 号`}</button>:card.confirmer===selectedSeat&&<button className="primary" disabled={blocked||hasPriority} onClick={()=>void send({action:'confirm_wolves'})}>确认狼队刀口</button>}</div></>}
     {card?.kind==='witch'&&!card.committed&&<><div className="night-action-row potion-options"><button className={choice==='save'?'primary':'secondary'} disabled={blocked||!card.antidote||card.knife==null||card.knife===selectedSeat} onClick={()=>{setChoice('save');setTarget(card.knife??null);}}>救人</button><button className={choice==='poison'?'primary':'secondary'} disabled={blocked||!card.poison} onClick={()=>{setChoice('poison');setTarget(null);}}>用毒</button><button className={choice==='skip'?'primary':'secondary'} disabled={blocked} onClick={()=>{setChoice('skip');setTarget(null);}}>不用药</button></div><button className="primary full" disabled={blocked||(choice==='poison'&&target===null)} onClick={()=>void send({action:'witch',choice,target:choice==='skip'?null:target})}>{choice==='skip'?'确认不用药':`确认${choice==='save'?'救':'毒'} ${target??'—'} 号`}</button></>}
     {card?.kind==='seer'&&card.committed&&<button className="primary full" disabled={blocked} onClick={()=>void send({action:'seer_finish'})}>结束操作</button>}
     {card?.kind==='seer'&&!card.committed&&<button className="primary full" disabled={blocked||target===null} onClick={()=>void send({action:'seer',target:target!})}>确认查验{target!==null?` · ${target} 号`:''}</button>}
     {card?.kind==='hunter'&&<button className="primary full" disabled={blocked||card.seen} onClick={()=>void send({action:'hunter_seen'})}>{card.seen?'已查看':'确认已查看'}</button>}

    </>}
   </div>
  </section>

 </div>;
}
