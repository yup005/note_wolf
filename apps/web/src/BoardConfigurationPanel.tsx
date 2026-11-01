import {useEffect,useId,useState} from 'react';
import {api,errorText} from './api';
import {supportsDualIdiot,boardRoleSchema,boardRoleLabels,serviceCompositionSchema,type BoardRole,type BoardLibrary,type BoardTemplate,type BoardComposition,type RoomBoardSnapshot} from '../../../packages/contracts/board';
import {createBoardConfiguration} from '../../../packages/domain/boardConfig';
import {BoardPickerDialog,boardRosterText} from './BoardPickerDialog';
interface Props {board:RoomBoardSnapshot;settingsRevision:number;blocked:boolean;onAction:(action:string,body?:unknown)=>void}
export function BoardConfigurationPanel({board,settingsRevision,blocked,onAction}:Props){
 const countId=useId();
 const [library,setLibrary]=useState<BoardLibrary|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 const [pickerRevision,setPickerRevision]=useState<number|null>(null);
 const [draft,setDraft]=useState<BoardComposition>({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts},...(board.composition.variant?{variant:board.composition.variant}:{}),...(board.composition.idiotPolicy?{idiotPolicy:board.composition.idiotPolicy}:{})});const [name,setName]=useState('');
 const compositionKey=JSON.stringify(board.composition);
 useEffect(()=>{setPickerRevision(null);},[settingsRevision,blocked,board.id,compositionKey]);
 useEffect(()=>{setDraft({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts},...(board.composition.variant?{variant:board.composition.variant}:{}),...(board.composition.idiotPolicy?{idiotPolicy:board.composition.idiotPolicy}:{})});setName(board.id==='custom'?board.name:board.name+' · 自定义');setError('');},[board.id,board.name,compositionKey]);
 useEffect(()=>{let active=true;api<BoardLibrary>('/api/boards').then(data=>{if(active)setLibrary(data);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 const valid=serviceCompositionSchema.safeParse(draft).success;
 const total=Object.values(draft.roles).reduce((sum,count)=>sum+(count??0),0);
 const config=valid?createBoardConfiguration(draft):null;
 function setRole(role:BoardRole,count:number){
  setDraft(previous=>{
   const roles={...previous.roles,[role]:Math.max(0,count)},seatCount=Object.values(roles).reduce((sum,n)=>sum+(n??0),0);
   const keepPolicy=supportsDualIdiot(roles.idiot)&&previous.idiotPolicy==='dual-category-14';
   return {seatCount,roles,...(previous.variant?{variant:previous.variant}:{}),...(keepPolicy?{idiotPolicy:'dual-category-14' as const}:{})};
  });
 }
 function select(value:string){const id=value==='seer-witch-hunter-idiot-12'?'standard-12':value;setError('');onAction('board',{settingsRevision,selection:{kind:library?.presets.some(t=>t.id===id)?'preset':'custom',id}});}
 async function save(){
  setSaving(true);setError('');try{
   const saved=await api<BoardTemplate>('/api/boards',{id:null,revision:0,name,composition:draft});
   setLibrary(await api<BoardLibrary>('/api/boards'));onAction('board',{settingsRevision,selection:{kind:'custom',id:saved.id}});
  }catch(e){setError(errorText(e));}finally{setSaving(false);}
 }
 return <div className="board-configuration">
  <span className="board-setting-label">板子</span>
  <button type="button" className="board-current-trigger" aria-label="更换板子" aria-describedby={countId+'-current'} aria-haspopup="dialog" disabled={blocked||saving||!library} onClick={()=>setPickerRevision(settingsRevision)}><span id={countId+'-current'} className="board-current-copy"><strong>{board.name}</strong><small>{boardRosterText(board.composition.roleCounts)}</small></span><span className="board-current-action" aria-hidden="true"><b>›</b>更换</span></button>
  {library&&pickerRevision===settingsRevision&&!blocked&&!saving&&<BoardPickerDialog library={library} board={board} onClose={()=>setPickerRevision(null)} onSelect={id=>{setPickerRevision(null);select(id);}}/>}
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
   {!!draft.roles.idiot&&<label>白痴规则<select aria-label="白痴规则" value={draft.idiotPolicy??'standard'} disabled={blocked||saving} onChange={e=>{const {idiotPolicy:_,...base}=draft;setDraft(e.target.value==='dual-category-14'?{...base,idiotPolicy:'dual-category-14'}:base);}}><option value="standard">默认规则</option><option value="dual-category-14" disabled={!supportsDualIdiot(draft.roles.idiot)}>双边白痴（不限人数）</option></select></label>}
   {draft.idiotPolicy==='dual-category-14'&&<p className="helper">须有一名真实白痴，不限人数。翻牌后无发言、插嘴或投票权，仍可被刀或毒杀。</p>}
   <p className="helper">{config?config.ruleset==='puppet'?'唯邻是从·傀儡（固定12人阵容及同阵容副本）':config.ruleset==='wolf-girl'?'狼女孩（首版支持固定12人阵容及其副本）':config.ruleset==='mechanical-armor'?'机械装甲':config.ruleset==='standard'?'预女猎白':'机械狼通灵师':'请选择 1–256 个角色'}</p>
   <button className="secondary full" disabled={blocked||saving||!valid||!name.trim()} onClick={()=>void save()}>{saving?'保存中…':'另存板子'}</button>
   <button className="text-button" disabled={blocked||saving||!valid} onClick={()=>onAction('board',{settingsRevision,selection:{kind:'composition',composition:draft}})}>应用本局配置</button>
  </details>
  {error&&<p role="alert" className="validation-warning">{error}</p>}
 </div>;
}
