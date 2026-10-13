import {useEffect,useId,useState} from 'react';
import {api,errorText} from './api';
import {boardRoleSchema,boardRoleLabels,serviceCompositionSchema,type BoardRole,type BoardLibrary,type BoardTemplate,type BoardComposition,type RoomBoardSnapshot} from '../../../packages/contracts/board';
import {createBoardConfiguration} from '../../../packages/domain/boardConfig';
interface Props {board:RoomBoardSnapshot;settingsRevision:number;blocked:boolean;onAction:(action:string,body?:unknown)=>void}
export function BoardConfigurationPanel({board,settingsRevision,blocked,onAction}:Props){
 const countId=useId();
 const [library,setLibrary]=useState<BoardLibrary|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 const [draft,setDraft]=useState<BoardComposition>({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts},...(board.composition.idiotPolicy?{idiotPolicy:board.composition.idiotPolicy}:{})});const [name,setName]=useState('');
 const compositionKey=JSON.stringify(board.composition);
 useEffect(()=>{setDraft({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts},...(board.composition.idiotPolicy?{idiotPolicy:board.composition.idiotPolicy}:{})});setName(board.id==='custom'?board.name:board.name+' · 自定义');setError('');},[board.id,board.name,compositionKey]);
 useEffect(()=>{let active=true;api<BoardLibrary>('/api/boards').then(data=>{if(active)setLibrary(data);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 const valid=serviceCompositionSchema.safeParse(draft).success;
 const total=Object.values(draft.roles).reduce((sum,count)=>sum+(count??0),0);
 const config=valid?createBoardConfiguration(draft):null;
 function setRole(role:BoardRole,count:number){
  setDraft(previous=>{
   const roles={...previous.roles,[role]:Math.max(0,count)},seatCount=Object.values(roles).reduce((sum,n)=>sum+(n??0),0);
   const keepPolicy=seatCount===14&&roles.idiot===1&&previous.idiotPolicy==='dual-category-14';
   return {seatCount,roles,...(keepPolicy?{idiotPolicy:'dual-category-14' as const}:{})};
  });
 }
 function select(value:string){const id=value==='seer-witch-hunter-idiot-12'?'standard-12':value;setError('');onAction('board',{settingsRevision,selection:{kind:library?.presets.some(t=>t.id===id)?'preset':'custom',id}});}
 async function save(){
  setSaving(true);setError('');try{
   const saved=await api<BoardTemplate>('/api/boards',{id:null,revision:0,name,composition:draft});
   setLibrary(await api<BoardLibrary>('/api/boards'));onAction('board',{settingsRevision,selection:{kind:'custom',id:saved.id}});
  }catch(e){setError(errorText(e));}finally{setSaving(false);}
 }
 const selectedExists=library&&[...library.presets,...library.custom].some(t=>t.id===board.id);
 return <div className="board-configuration">
  <label>板子<select aria-label="选择板子" value={board.id==='standard-12'?'seer-witch-hunter-idiot-12':board.id} disabled={blocked||saving||!library} onChange={e=>select(e.target.value)}>
   {!selectedExists&&<option value={board.id}>{board.name}</option>}
   {library?.presets.map(t=><option key={t.id} value={t.id==='standard-12'?'seer-witch-hunter-idiot-12':t.id}>{t.name}</option>)}
   {!!library?.custom.length&&<optgroup label="我的自定义板子">{library.custom.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
  </select></label>
  {board.composition.idiotPolicy==='dual-category-14'&&<p className="helper">双边白痴 · 翻牌后神边出局、民边存活</p>}
  <details className="custom-board-editor"><summary>自定义调整</summary>
   <p className="helper">复制配置并另存，系统模板保持不变。</p>
   <label>名称<input aria-label="板子名称" maxLength={60} value={name} disabled={blocked||saving} onChange={e=>setName(e.target.value)}/></label>
   <p className="board-player-count" data-testid="draft-player-count" role="status">共 {total} 人</p>
   <div className="board-role-editor" role="group" aria-label="角色选择">{boardRoleSchema.options.map(role=>{
    const count=draft.roles[role]??0,label=boardRoleLabels[role],repeat=role==='wolf'||role==='villager';
    const tag=<button type="button" className={'board-role-tag'+(count?' selected':'')} aria-label={label} aria-describedby={countId+'-'+role} aria-pressed={count>0} data-role-count={count} disabled={blocked||saving||!count&&total>=256} onClick={()=>setRole(role,count?0:1)}>{label}{count>0&&<span className="role-count">{count}</span>}<span id={countId+'-'+role} hidden>{label} {count} 名</span></button>;
    return repeat?<div className="board-role-stepper" key={role}>{tag}<button type="button" className="role-step" aria-label={'减少'+label} disabled={blocked||saving||count===0} onClick={()=>setRole(role,count-1)}>−</button><button type="button" className="role-step" aria-label={'增加'+label} disabled={blocked||saving||total>=256} onClick={()=>setRole(role,count+1)}>+</button></div>:<div key={role}>{tag}</div>;
   })}</div>
   {!!draft.roles.idiot&&<label>白痴规则<select aria-label="白痴规则" value={draft.idiotPolicy??'standard'} disabled={blocked||saving} onChange={e=>{const {idiotPolicy:_,...base}=draft;setDraft(e.target.value==='dual-category-14'?{...base,idiotPolicy:'dual-category-14'}:base);}}><option value="standard">默认规则</option><option value="dual-category-14" disabled={draft.seatCount!==14||draft.roles.idiot!==1}>14 人双边白痴</option></select></label>}
   {draft.idiotPolicy==='dual-category-14'&&<p className="helper">须为 14 人且有一名白痴。翻牌后无发言、插嘴或投票权，仍可被刀或毒杀。</p>}
   <p className="helper">{config?config.ruleset==='mechanical-armor'?'机械装甲':config.ruleset==='standard'?'预女猎白':'机械狼通灵师':'请选择 1–256 个角色'}</p>
   <button className="secondary full" disabled={blocked||saving||!valid||!name.trim()} onClick={()=>void save()}>{saving?'保存中…':'另存板子'}</button>
   <button className="text-button" disabled={blocked||saving||!valid} onClick={()=>onAction('board',{settingsRevision,selection:{kind:'composition',composition:draft}})}>应用本局配置</button>
  </details>
  {error&&<p role="alert" className="validation-warning">{error}</p>}
 </div>;
}
