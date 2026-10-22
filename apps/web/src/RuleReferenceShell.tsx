import {useEffect,useId,useRef,type ReactNode} from 'react';
import type {RoomBoardSnapshot} from '../../../packages/contracts/board';
import './ruleReference.css';

export function RuleReferenceShell({board,onClose,children}:{board:RoomBoardSnapshot;onClose:()=>void;children:ReactNode}){
 const titleId=useId(),dialog=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 return <div className="modal-backdrop rule-reference-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="card modal rule-reference-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
  if(e.key==='Tab'){const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button,summary,[href],[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}>
  <header className="rule-reference-header"><div><h2 id={titleId}>本局规则速查</h2><p>{board.name} · {board.composition.seatCount} 人</p></div><button className="text-button" onClick={onClose}>关闭规则</button></header>
  <div className="rule-reference-body">{children}</div>
 </section></div>;
}
