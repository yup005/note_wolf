import {useEffect,useRef,useState} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {DaySelf} from '../../../packages/contracts/day';
import {boardRoleLabels} from '../../../packages/contracts/board';
import {api,ApiError,errorText} from './api';
const skillLabels:Record<DaySelf['skills'][number]['kind'],string>={antidote:'解药',poison:'毒药',guard:'守护',inspect:'查验',shot:'开枪','extra-knife':'独立狼刀','explode-take':'自爆带人'};
export default function DaySelfDialog({view,onClose,onRefresh}:{view:LobbyView;onClose:()=>void;onRefresh:()=>Promise<void>}){
 const [card,setCard]=useState<DaySelf>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLElement>(null),alive=useRef(false),sequence=useRef(0),{room,me}=view;
 async function load(){const seq=++sequence.current;setCard(undefined);setError('');setBusy(true);try{const result=await api<DaySelf>(`/api/rooms/${room.id}/day/self`);if(!alive.current||sequence.current!==seq||document.visibilityState!=='visible')return;if(result.turnId!==room.day!.turnId||result.seat!==me.seat){onClose();void onRefresh().catch(()=>{});return;}setCard(result);}catch(e){if(!alive.current||sequence.current!==seq)return;setError(errorText(e));if(e instanceof ApiError&&[401,403,404,409].includes(e.status))void onRefresh().catch(()=>{});}finally{if(alive.current&&sequence.current===seq)setBusy(false);}}
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();void load();return()=>{alive.current=false;sequence.current++;previous?.focus();};},[]);
 return <div className="modal-backdrop day-self-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="card modal day-self-dialog" role="dialog" aria-modal="true" aria-labelledby="day-self-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}if(e.key==='Tab'){const buttons=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
  <div className="section-head"><h2 id="day-self-title">我的身份与技能</h2><button className="text-button" onClick={onClose}>关闭</button></div><p className="helper">仅本人可见，请注意周围视线。</p>
  {busy&&<p role="status">正在读取…</p>}{error&&<><p role="alert" className="night-error">{error}</p><button className="secondary full" onClick={()=>void load()}>重新读取</button></>}
  {card&&<><p className="day-self-role">{boardRoleLabels[card.role]}</p><p className="helper">{card.seat} 号 · 此处仅查看，技能按对局规则发动。</p>{card.learnedRole&&<p>已学习：{boardRoleLabels[card.learnedRole]}</p>}{card.modelSeat!==null&&<p>榜样：{card.modelSeat} 号</p>}{card.idiotRevealed!==null&&<p>白痴翻牌：{card.idiotRevealed?'已翻牌':'未翻牌'}</p>}{card.skills.length?<ul className="day-self-skills">{card.skills.map((skill,i)=><li key={i}><strong>{skillLabels[skill.kind]}</strong><span>{skill.remaining===null?'每夜依规则使用':skill.remaining===0?'已用尽':`剩余 ${skill.remaining} 次`}</span>{skill.remaining!==0&&skill.availableFromNight>room.day!.day&&<small>第 {skill.availableFromNight} 夜起可用</small>}</li>)}</ul>:<p className="helper">没有额外技能次数</p>}</>}
  <button className="primary full" onClick={onClose}>隐藏身份</button>
 </section></div>;
}
