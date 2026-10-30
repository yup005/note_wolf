import {JudgeControls} from './JudgeControls';
import {PublicVoiceShortcut} from './PublicVoice';
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
export const nightPhaseLabels={confession:'狼女孩表白',confession_notice:'被表白者查看信息',poisoner:'毒师行动',awaiting_host:'等待房主入夜',mechanical_authority:'狼刀权限确认',guard:'守卫行动',wolves:'狼人行动',eyes_closed:'闭眼间隔',witch:'女巫行动',mechanical:'机械狼行动',armor:'装甲狼行动',spiritSeer:'通灵师行动',mixer:'混血儿选择榜样',seer:'预言家行动',hunter:'猎人查看状态',rules_pending:'等待规则裁定',first_night_complete:'首夜操作完成'};
type AbilityChoice='learn'|'guard'|'poison'|'inspect'|'extra-knife'|'skip';
const abilityLabels:Record<Exclude<AbilityChoice,'learn'|'skip'>,string>={guard:'守护',poison:'毒药',inspect:'查验','extra-knife':'额外一刀'};
function defaultAbility(card:NightPrivate):AbilityChoice {
 if(card.kind==='guard')return 'guard';if(card.kind==='spiritSeer')return 'inspect';
 if(card.canLearn)return 'learn';return card.skills?.find(skill=>skill.available)?.kind??'skip';
}
export function NightPanel({view,connected,busy,onHome,onAction,onPublicRefresh}:Props){
 const frozen=gameFrozen(view);const manager=canManageGame(view);const {room,me}=view;const night=room.night!;const testing=view.testPlayersEnabled&&me.isHost&&room.testRoom;const testRoles=useTestRoles(view);
 const [noticeRequested,setNoticeRequested]=useState(false);
 const [actor,setActor]=useState(me.id);const [shown,setVisible]=useState(false);const [privateState,setCard]=useState<NightPrivate>();const [loadedActor,setLoadedActor]=useState('');const [target,setTarget]=useState<number|null>(null);
 const [receipt,setReceipt]=useState<{actor:string;night:number;choice:'save'|'poison'|'skip';target:number|null}>();const privacyVersion=useRef(0);
 const [choice,setChoice]=useState<'save'|'poison'|'skip'>('skip');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const [abilityChoice,setAbilityChoice]=useState<AbilityChoice>('skip');
 const [autoFollow,setAutoFollow]=useState(true);const [foreground,setForeground]=useState(document.visibilityState==='visible');
 const [keepAwake,setKeepAwake]=useState(true);const wake=useWakeLock(keepAwake&&night.phase!=='first_night_complete');
 const [seconds,setSeconds]=useState(0);const readSequence=useRef(0);const generation=useRef(0);const lock=useRef(false);const selectionTurn=useRef(`${night.turnId}:${actor}`);const draftKey=useRef('');
 const visible=shown&&privateState?.turnId===night.turnId&&loadedActor===actor&&connected&&foreground&&!frozen;const card=visible?privateState:undefined;
 const selectedSeat=room.seats.find(s=>s.memberId===actor)?.number;const privatePath=`/api/rooms/${room.id}/${actor===me.id?'night':`test-players/${actor}/night`}`;
 function conceal(clearResult=true){setNoticeRequested(false);if(clearResult){privacyVersion.current++;setReceipt(undefined);}generation.current++;setVisible(false);setCard(undefined);setError('');}
 useEffect(()=>{
  conceal(!connected||frozen);const selection=`${night.turnId}:${actor}`;if(selectionTurn.current!==selection){setTarget(null);setChoice('skip');setAbilityChoice('skip');draftKey.current='';selectionTurn.current=selection;}
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
 useEffect(()=>{if(!frozen&&connected&&foreground&&!visible&&!lock.current&&!error&&(night.phase!=='confession_notice'||noticeRequested))void reveal();},[actor,night.turnId,connected,foreground,visible,pending,frozen,noticeRequested]);
 useEffect(()=>{if(!['witch','eyes_closed'].includes(night.phase))setReceipt(undefined);},[night.phase]);
 useEffect(()=>{const offset=night.serverNow-Date.now();const update=()=>setSeconds(night.deadline===null?0:Math.max(0,Math.ceil((night.deadline-Date.now()-offset)/1000)));update();const id=setInterval(update,250);return ()=>clearInterval(id);},[night.deadline,night.serverNow]);
 useEffect(()=>{
  if(!visible||!connected)return;let stopped=false;let pollPending=false;
  const id=setInterval(()=>{if(lock.current||pollPending)return;pollPending=true;const version=generation.current;const request=++readSequence.current;void api<NightPrivate>(privatePath+'/private').then(result=>{if(!stopped&&request===readSequence.current&&generation.current===version&&result.turnId===night.turnId)setCard(result);}).catch(()=>{}).finally(()=>{pollPending=false;});},1500);
  return ()=>{stopped=true;clearInterval(id);};
 },[visible,connected,privatePath,night.turnId]);
 async function reveal(){
  if(lock.current||!connected||frozen)return;lock.current=true;setPending(true);setError('');const version=++generation.current;
  try{const result=await api<NightPrivate>(privatePath+'/private');if(version===generation.current&&result.turnId===night.turnId){setCard(result);setLoadedActor(actor);setVisible(true);if(draftKey.current!==`${night.turnId}:${actor}`){setAbilityChoice(defaultAbility(result));if(result.kind==='wolves')setTarget(result.priorityWolf===selectedSeat?result.priorityTarget??null:result.myVote??null);else setTarget(result.target??null);}}}
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
 const blocked=busy||pending||!connected||frozen;
 const copiedStage=card?.kind==='mechanical'||card?.kind==='armor';
 const abilityStage=copiedStage||card?.kind==='guard'||card?.kind==='spiritSeer';
 const activeAbility=abilityChoice==='learn'?card?.canLearn:abilityChoice==='skip'?false:card?.skills?.some(skill=>skill.kind===abilityChoice&&skill.available);
 const abilitySelecting=abilityStage&&!card?.committed&&!!activeAbility;
 const interactive=visible&&(card?.kind==='wolves'&&!card.recognitionOnly||card?.kind==='confession'||card?.kind==='poisoner'&&!!card.poison||card?.kind==='seer'&&!card.committed||card?.kind==='witch'&&choice==='poison'&&!card.committed||abilitySelecting||card?.kind==='mixer'&&!card.committed);
 const legalTarget=(seat:number)=>{if(card?.legalTargets?!card.legalTargets.includes(seat):!night.alive.includes(seat))return false;if((abilitySelecting&&['learn','inspect'].includes(abilityChoice)||card?.kind==='mixer')&&seat===selectedSeat)return false;return true;};
 const hasPriority=card?.kind==='wolves'&&card.priorityWolf!=null;const isPriority=hasPriority&&card.priorityWolf===selectedSeat;
 const completedLabel=night.night===1?nightPhaseLabels.first_night_complete:'夜间操作完成';const dayLabel=night.night===1?'第一天':`第 ${night.night} 天`;
 const phase=night.phase;const voteGroups=new Map<number|'empty'|'pending',number[]>();
 const egg=card?.learningReceipt?.civilianEasterEgg;
 const eggIndex=egg?.text.indexOf(egg.emphasis)??-1;
 const inspection=card?.inspectionRole?`查验 ${card.target} 号：${roleLabels[card.inspectionRole]}`:abilityStage&&card?.committed&&abilityChoice==='inspect'?(card.target==null?'本夜空验':card.result?`查验 ${card.target} 号：${card.result==='wolf'?'狼人':'好人'}`:null):null;
 if(card?.kind==='wolves')for(const seat of card.wolves??[]){const vote=card.votes?.find(v=>v.seat===seat);const key=vote?vote.target??'empty':'pending';voteGroups.set(key,[...(voteGroups.get(key)??[]),seat]);}
 return <div className={`night-screen${frozen?' is-frozen':''}`}>
  <nav className="night-nav" aria-label="游戏导航"><button className="back" onClick={onHome}>← 首页</button><span>房间 {room.code} · 你在 {me.seat} 号</span><span className="live" role="status"><i className={connected?'dot':'dot amber'}/>{connected?room.control?.reconnecting?'连接异常':'已连接':'重连中'}</span><GameControls view={view} connected={connected} onRefresh={onPublicRefresh}/>{manager&&<PublicVoiceShortcut/>}<RecordsButton view={view} onRefresh={onPublicRefresh}/><JudgeControls view={view} connected={connected} onRefresh={onPublicRefresh}/></nav>
  {testing&&<div className="night-test-tools"><label>测试<select aria-label="操作的测试玩家" value={actor} disabled={pending} onChange={e=>{conceal();setAutoFollow(false);setTarget(null);draftKey.current='';setActor(e.target.value);}}>{room.seats.filter(s=>s.memberId&&(s.isTestPlayer||s.memberId===me.id)).map(s=><option key={s.memberId!} value={s.memberId!}>{s.number} 号 · {s.memberId===me.id?'你':s.nickname}{testRoles[s.number]?` · ${roleLabels[testRoles[s.number]]}`:''}</option>)}</select></label><label className="test-follow"><input type="checkbox" checked={autoFollow} onChange={e=>{conceal();setAutoFollow(e.target.checked);}}/>自动跟随</label>{night.deadline!==null&&<button className="text-button" disabled={blocked} onClick={()=>onAction('night/test-advance')}>推进测试阶段</button>}</div>}
  <section className={`card night-stage${card?.kind==='wolves'?' wolf-operation':''}`} aria-label="夜间操作">
   <header className="night-heading"><div><span className="eyebrow">第 {night.night} 夜</span><h1>{phase==='first_night_complete'?completedLabel:nightPhaseLabels[phase]}</h1></div><div className="night-clock-group"><button className="text-button wake-toggle" aria-pressed={keepAwake} onClick={()=>setKeepAwake(v=>!v)}>{wake==='unavailable'?'常亮不可用':wake==='active'?'常亮已开':'常亮已关'}</button><strong className="night-clock" aria-label="剩余时间">{night.deadline!==null?`${seconds} 秒`:'—'}</strong></div></header>
   <div className="night-note" aria-live="polite">
    {error?<span className="night-error" role="alert">{error}</span>:resultText?<div className="skill-result" role="status" aria-label="技能结果">{resultReceipt&&<span>本夜操作已确认</span>}<strong>{resultText}</strong>{phase==='eyes_closed'&&<span>请闭眼，等待下一阶段</span>}</div>:phase==='awaiting_host'?'由房主统一开始夜晚，无需再次准备。':phase==='eyes_closed'?'请所有玩家闭眼，等待下一阶段。':phase==='first_night_complete'?`${completedLabel}，等待房主开始${dayLabel}。`:phase==='rules_pending'?'当前组合需要规则裁定，请等待房主管理操作。':!visible?'请闭眼，等待自己的行动阶段。':card?.kind==='mechanical_authority'?<strong>{card.inheritedKnife?'本夜已继承狼刀，在狼人行动阶段出刀':'本夜没有狼刀权限'}</strong>:abilityStage?<div className="skill-result" role="status" aria-label="私人技能反馈">
     {card?.learningReceipt?<><strong>学习成功：{roleLabels[card.learningReceipt.role]}</strong>{egg&&eggIndex>=0&&<span>{egg.text.slice(0,eggIndex)}<strong style={{color:'#b42318'}}>{egg.emphasis}</strong>{egg.text.slice(eggIndex+egg.emphasis.length)}</span>}</>:copiedStage&&card?.learnedRole?<strong>已学习：{roleLabels[card.learnedRole]}</strong>:null}
     {inspection?<strong>{inspection}</strong>:card?.committed?<span>本夜操作已确认</span>:card?.kind==='guard'?<span>可自守、空守，不可连续守同一目标。</span>:card?.kind==='spiritSeer'?<span>选择其他存活玩家查验具体身份，也可空验。</span>:card?.canLearn?<span>选择其他存活玩家学习，也可空过。</span>:<span>本夜{card?.skills?.some(skill=>skill.available)?'请选择复制技能':'没有可用复制技能'}。</span>}
     {copiedStage&&card?.skills?.map(skill=><span key={skill.kind}>{abilityLabels[skill.kind]} · {skill.remaining===null?'不限次数':`剩余 ${skill.remaining} 次`}{skill.available?'':' · 本夜不可用'}</span>)}
    </div>:card?.kind==='confession'?'选择一名非狼人玩家表白；超时随机选择。':card?.kind==='confession_notice'?card.confession?.accepted?`你已成为狼混，个人胜负跟随狼人；狼女孩是 ${card.confession.girl} 号。你仍是平民，查验为好人，无狼刀。`:'你被表白了；身份、阵营与技能不变。':card?.kind==='poisoner'?`仅有一瓶毒药，无解药，可自毒。毒药${card.poison?'可用':'已用'}`:card?.kind==='mixer'?card.committed?`榜样：${card.modelSeat??card.target} 号（仅本人可见）`:'选择一名其他存活玩家为榜样；超时将随机指定。':card?.kind==='wolves'?<>
     {card.recognitionOnly&&<p>首夜仅相认，不能刀人。</p>}<div className="wolf-confirmer">{hasPriority?'优先指刀':'确认者'}：<strong>{hasPriority?card.priorityWolf:card.confirmer} 号{(hasPriority?card.priorityWolf:card.confirmer)===selectedSeat?'（你）':''}</strong>{hasPriority&&<span> · 优先刀口：{card.priorityTarget==null?'空刀':`${card.priorityTarget} 号`} · 超时后采用狼队票型</span>}</div>
     <div className="wolf-votes" role="list" aria-label="狼队票型">{[...voteGroups].sort(([a],[b])=>typeof a==='number'&&typeof b==='number'?a-b:typeof a==='number'?-1:typeof b==='number'?1:a==='empty'?-1:1).map(([key,seats])=><div className="wolf-vote-group" role="listitem" key={key}><strong>{key==='pending'?'未投票':key==='empty'?'空刀':`${key} 号`}</strong><span>{seats.join('、')} 号{key==='pending'?'未提交':'选择'}</span></div>)}</div>
    </>:card?.kind==='witch'?card.committed?'本夜操作已确认':`${card.knife===undefined?'刀口不可见':`刀口 ${card.knife===null?'空刀':card.knife+' 号'}`} · 解药${!card.antidote?'已用':card.knife===selectedSeat?'不可自救':card.knife==null?'暂无可救目标':'可用'} · 毒药${card.poison?'可用':'已用'}`:card?.kind==='seer'&&card.result?`查验 ${card.target} 号：${card.result==='wolf'?'狼人':'好人'}`:card?.kind==='hunter'?`技能${card.canShoot?'可发动':'不可发动'}`:'当前请闭眼，等待自己的行动阶段。'}
   </div>
   <div className="night-targets" aria-label="座位目标">
    {room.seats.map(s=>{const alive=night.alive.includes(s.number);const votes=card?.kind==='wolves'?card.votes?.filter(v=>v.target===s.number).length??0:0;return <button key={s.number} className={`night-target${target===s.number&&interactive?' selected':''}${s.number===selectedSeat?' self':''}${alive?'':' dead'}`} disabled={!interactive||blocked||!legalTarget(s.number)} aria-label={`目标 ${s.number} 号，${s.nickname}${alive?'':'，已死亡'}`} aria-pressed={interactive?target===s.number:undefined} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setTarget(s.number);}}><strong>{s.number}</strong><span>{s.nickname}</span><small>{[testRoles[s.number]?roleLabels[testRoles[s.number]]:null,!alive?'已死亡':null,votes?`${votes} 票`:s.number===selectedSeat?'你':null].filter(Boolean).join(' · ')||'　'}</small></button>;})}
   </div>
   <div className="night-actions">
    {phase==='awaiting_host'?<>
     {manager?<button className="primary full" disabled={blocked} onClick={()=>onAction('night/begin',{turnId:night.turnId})}>开始夜晚</button>:<p className="helper">等待房主开始夜晚</p>}
    </>:phase==='first_night_complete'?<>{manager?<button className="primary full" disabled={blocked} onClick={()=>onAction('day/enter')}>开始{dayLabel}</button>:<p className="helper">等待房主开始{dayLabel}</p>}</>:phase==='eyes_closed'?<p className="helper">请保持闭眼</p>:!visible&&phase==='confession_notice'?<button className="primary full" disabled={blocked} onClick={()=>setNoticeRequested(true)}>查看私密信息</button>:!visible?<p className="helper">等待自己的行动阶段</p>:<>
     {card?.kind==='wolves'&&!card.recognitionOnly&&<><div className="night-action-row"><button className="secondary" disabled={blocked} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setTarget(null);}}>空刀</button><button className="primary" disabled={blocked} onClick={()=>void send({action:'vote',target})}>{isPriority?'提交优先刀口':'提交刀口'}{target!==null?` · ${target} 号`:''}</button></div><div className="night-action-row">{isPriority?<button className="primary" disabled={blocked||card.priorityCommitted} onClick={()=>void send({action:'priority_knife',target})}>确认优先指刀 · {target===null?'空刀':`${target} 号`}</button>:card.confirmer===selectedSeat&&<button className="primary" disabled={blocked||hasPriority} onClick={()=>void send({action:'confirm_wolves'})}>确认狼队刀口</button>}</div></>}
     {card?.kind==='wolves'&&card.recognitionOnly&&card.confirmer===selectedSeat&&<button className="primary full" disabled={blocked} onClick={()=>void send({action:'confirm_wolves'})}>确认相认完成</button>}
     {card?.kind==='confession'&&<button className="primary full" disabled={blocked||target===null||!legalTarget(target)} onClick={()=>void send({action:'confess',target:target!})}>确认表白 · {target??'—'} 号</button>}
     {card?.kind==='confession_notice'&&<button className="primary full" disabled={blocked||card.seen} onClick={()=>void send({action:'confession_seen'})}>{card.seen?'已查看':'确认信息已查看'}</button>}
     {card?.kind==='poisoner'&&<><button className="secondary full" disabled={blocked} onClick={()=>void send({action:'poisoner',target:null})}>本夜不用毒</button>{card.poison&&<button className="primary full" disabled={blocked||target===null||!legalTarget(target)} onClick={()=>void send({action:'poisoner',target:target!})}>确认毒杀 · {target??'—'} 号</button>}</>}
     {card?.kind==='witch'&&!card.committed&&<><div className="night-action-row potion-options"><button className={choice==='save'?'primary':'secondary'} disabled={blocked||!card.antidote||card.knife==null||card.knife===selectedSeat} onClick={()=>{setChoice('save');setTarget(card.knife??null);}}>救人</button><button className={choice==='poison'?'primary':'secondary'} disabled={blocked||!card.poison} onClick={()=>{setChoice('poison');setTarget(null);}}>用毒</button><button className={choice==='skip'?'primary':'secondary'} disabled={blocked} onClick={()=>{setChoice('skip');setTarget(null);}}>不用药</button></div><button className="primary full" disabled={blocked||(choice==='poison'&&target===null)} onClick={()=>void send({action:'witch',choice,target:choice==='skip'?null:target})}>{choice==='skip'?'确认不用药':`确认${choice==='save'?'救':'毒'} ${target??'—'} 号`}</button></>}
     {card?.kind==='seer'&&card.committed&&<button className="primary full" disabled={blocked} onClick={()=>void send({action:'seer_finish'})}>结束操作</button>}
     {card?.kind==='seer'&&!card.committed&&<button className="primary full" disabled={blocked||target===null} onClick={()=>void send({action:'seer',target:target!})}>确认查验{target!==null?` · ${target} 号`:''}</button>}
     {card?.kind==='hunter'&&<button className="primary full" disabled={blocked||card.seen} onClick={()=>void send({action:'hunter_seen'})}>{card.seen?'已查看':'确认已查看'}</button>}
     {card?.kind==='mechanical_authority'&&<button className="primary full" disabled={blocked||card.seen} onClick={()=>void send({action:'authority_seen'})}>{card.seen?'已查看':'确认刀权已查看'}</button>}
     {abilityStage&&!card?.committed&&<>
      {copiedStage&&<div className="night-action-row">{card?.canLearn&&<button className={abilityChoice==='learn'?'primary':'secondary'} disabled={blocked} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setAbilityChoice('learn');setTarget(null);}}>学习</button>}{card?.skills?.map(skill=><button key={skill.kind} className={abilityChoice===skill.kind?'primary':'secondary'} disabled={blocked||!skill.available} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setAbilityChoice(skill.kind);setTarget(null);}}>{abilityLabels[skill.kind]}</button>)}<button className={abilityChoice==='skip'?'primary':'secondary'} disabled={blocked} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setAbilityChoice('skip');setTarget(null);}}>空过</button></div>}
      {['guard','inspect'].includes(abilityChoice)&&<button className="secondary full" disabled={blocked||!activeAbility} onClick={()=>{draftKey.current=`${night.turnId}:${actor}`;setTarget(null);}}>{abilityChoice==='guard'?'空守':'空验'}</button>}
      <button className="primary full" disabled={blocked||(abilityChoice!=='skip'&&!activeAbility)||(['learn','poison','extra-knife'].includes(abilityChoice)&&target===null)||(target!==null&&!legalTarget(target))} onClick={()=>void send({action:'ability',choice:abilityChoice,target:abilityChoice==='skip'?null:target})}>{abilityChoice==='skip'?'确认空过':`确认${abilityChoice==='learn'?'学习':abilityLabels[abilityChoice]}${target===null?abilityChoice==='guard'?' · 空守':abilityChoice==='inspect'?' · 空验':' · 选择目标':` · ${target} 号`}`}</button>
     </>}
     {abilityStage&&card?.committed&&<button className="primary full" disabled={blocked||card.seen} onClick={()=>void send({action:'ability_finish'})}>{card.seen?'已查看':'确认结果已查看'}</button>}
     {copiedStage&&<p className="helper">本阶段按计时结束，请闭眼等待。</p>}
     {card?.kind==='mixer'&&!card.committed&&<button className="primary full" disabled={blocked||target===null||!legalTarget(target)} onClick={()=>void send({action:'mixer',target:target!})}>确认榜样{target!==null?` · ${target} 号`:''}</button>}
    </>}
   </div>
  </section>

 </div>;
}
