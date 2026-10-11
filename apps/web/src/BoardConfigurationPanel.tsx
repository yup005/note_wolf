import {useEffect,useState} from 'react';
import {api,errorText} from './api';
import {boardRoleSchema,boardRoleLabels,serviceCompositionSchema,type BoardLibrary,type BoardTemplate,type BoardComposition,type RoomBoardSnapshot} from '../../../packages/contracts/board';
import {createBoardConfiguration} from '../../../packages/domain/boardConfig';
interface Props {board:RoomBoardSnapshot;settingsRevision:number;blocked:boolean;onAction:(action:string,body?:unknown)=>void}
export function BoardConfigurationPanel({board,settingsRevision,blocked,onAction}:Props){
 const [library,setLibrary]=useState<BoardLibrary|null>(null);const [error,setError]=useState('');const [saving,setSaving]=useState(false);
 const [draft,setDraft]=useState<BoardComposition>({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts}});const [name,setName]=useState('');
 const compositionKey=JSON.stringify(board.composition);
 useEffect(()=>{setDraft({seatCount:board.composition.seatCount,roles:{...board.composition.roleCounts}});setName(board.id==='custom'?board.name:board.name+' · 自定义');setError('');},[board.id,board.name,compositionKey]);
 useEffect(()=>{let active=true;api<BoardLibrary>('/api/boards').then(data=>{if(active)setLibrary(data);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[]);
 const valid=serviceCompositionSchema.safeParse(draft).success;
 const total=Object.values(draft.roles).reduce((sum,count)=>sum+(count??0),0);
 const config=valid?createBoardConfiguration(draft):null;
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
  <details className="custom-board-editor"><summary>自定义调整</summary>
   <p className="helper">复制配置并另存，系统模板保持不变。</p>
   <label>名称<input aria-label="板子名称" maxLength={60} value={name} disabled={blocked||saving} onChange={e=>setName(e.target.value)}/></label>
   <label>人数<input aria-label="玩家人数" type="number" min={1} max={256} value={draft.seatCount} disabled={blocked||saving} onChange={e=>setDraft({...draft,seatCount:Number(e.target.value)})}/></label>
   <div className="board-role-editor">{boardRoleSchema.options.map(role=><label key={role}>{boardRoleLabels[role]}<input aria-label={boardRoleLabels[role]+'人数'} type="number" min={0} max={role==='wolf'||role==='villager'?256:1} value={draft.roles[role]??0} disabled={blocked||saving} onChange={e=>setDraft({...draft,roles:{...draft.roles,[role]:Number(e.target.value)}})}/></label>)}</div>
   <p className="helper">角色合计 {total} / {draft.seatCount}{config?` · ${config.ruleset==='mechanical-armor'?'机械装甲':config.ruleset==='standard'?'预女猎白':'机械狼通灵师'}`:' · 请检查人数和特殊角色唯一性'}</p>
   <button className="secondary full" disabled={blocked||saving||!valid||!name.trim()} onClick={()=>void save()}>{saving?'保存中…':'另存板子'}</button>
   <button className="text-button" disabled={blocked||saving||!valid} onClick={()=>onAction('board',{settingsRevision,selection:{kind:'composition',composition:draft}})}>应用本局配置</button>
  </details>
  {error&&<p role="alert" className="validation-warning">{error}</p>}
 </div>;
}
