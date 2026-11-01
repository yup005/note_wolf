import {useEffect,useId,useRef,useState} from 'react';
import {boardRoleLabels,type BoardComposition,type BoardLibrary,type BoardRole,type RoomBoardSnapshot} from '../../../packages/contracts/board';

export function boardRosterText(roles:BoardComposition['roles']){
 if(roles.treasureMaster)return '15张牌留底3张后发放 · 通灵 / 毒 / 猎 / 摄梦 / 蒙面 · 狼王 · 盗宝';
 return Object.entries(roles).filter(([,count])=>count).map(([role,count])=>`${boardRoleLabels[role as BoardRole]} × ${count}`).join(' · ');
}

interface Props {library:BoardLibrary;board:RoomBoardSnapshot;onSelect:(id:string)=>void;onClose:()=>void}
export function BoardPickerDialog({library,board,onSelect,onClose}:Props){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState(board.id);
 useEffect(()=>{
  const element=dialog.current!,previous=document.activeElement as HTMLElement|null;
  element.showModal();
  return()=>{element.close();if(previous?.isConnected)previous.focus();};
 },[]);
 const currentMissing=![...library.presets,...library.custom].some(t=>t.id===board.id);
 function option(key:string,name:string,seats:number,roles:BoardComposition['roles']){
  return <label className="board-picker-option" key={key}>
   <span className="board-picker-copy"><strong>{name}</strong><span>{seats} 人 · {boardRosterText(roles)}</span></span>
   <input type="radio" name={id} aria-label={name} value={key} checked={selected===key} onChange={()=>setSelected(key)}/>
  </label>;
 }
 return <dialog ref={dialog} className="board-picker card" aria-labelledby={id+'-title'} aria-describedby={id+'-hint'} onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:checked')??[]),first=controls[0],last=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}>
  <header className="board-picker-header"><div><span className="eyebrow">本局配置</span><h2 id={id+'-title'}>选择板子</h2></div><button type="button" className="text-button" onClick={onClose}>取消</button></header>
  <div className="board-picker-scroll">
   <p id={id+'-hint'} className="board-picker-hint">点选只预览，确认后才应用到房间。</p>
   {currentMissing&&<fieldset className="board-picker-group"><legend>当前配置</legend>{option(board.id,board.name,board.composition.seatCount,board.composition.roleCounts)}</fieldset>}
   <fieldset className="board-picker-group"><legend>官方板子</legend>{library.presets.map(t=>option(t.id,t.name,t.composition.seatCount,t.composition.roles))}</fieldset>
   {library.custom.length>0&&<fieldset className="board-picker-group"><legend>我的自定义板子</legend>{library.custom.map(t=>option(t.id,t.name,t.composition.seatCount,t.composition.roles))}</fieldset>}
  </div>
  <footer className="board-picker-footer"><p>确认更换后，全员需要重新准备。</p><button type="button" className="primary full" disabled={selected===board.id} onClick={()=>onSelect(selected)}>确认板子</button></footer>
 </dialog>;
}
