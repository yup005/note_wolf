import type {NightCommand,NightPrivate} from '../../../packages/contracts/night';
import {requestId} from './api';
type Command=NightCommand extends infer C?C extends NightCommand?Omit<C,'turnId'>:never:never;
interface Props {card:NightPrivate;alive:number[];blocked:boolean;onCommand:(c:Command)=>Promise<void>}
const source=(value:string)=>value==='random'?'系统随机':value==='draft'?'截止采用草稿':value==='skipped'?'无合法目标，自动跳过':'本人确认';
/** All editable drafts come from the authenticated server projection, never public room state. */
export function MasqueradeActions({card,alive,blocked,onCommand}:Props){
 const m=card.masquerade;if(!m)return null;
 const send=(c:Record<string,unknown>)=>void onCommand({...c,requestId:requestId()} as Command);
 return <section className="masquerade-private" aria-label="假面舞会私密操作">
  {m.penalized&&<p role="status">本夜操作已违规，后续技能停止；死亡将在天亮统一公布。</p>}
  {m.pool&&<p role="status">最终共舞：{m.pool.length?m.pool.join('、')+' 号':'今晚不能舞'}{m.poolSource?' · '+source(m.poolSource):''}</p>}
  {card.kind==='dancer'&&!m.pool&&!m.penalized&&<>{m.cannotDance&&<p role="status">今晚不能舞；重复入池目标仍可选择，违规将使自己出局。</p>}
   <p>选择三人，可包含自己。重复选择本局已入池者，确认或保留到超时将使自己出局。</p>
   <div className="night-targets" aria-label="共舞座位">{alive.map(seat=><button key={seat} type="button" className={`night-target${m.draft?.includes(seat)?' selected':''}`} aria-label={`共舞目标 ${seat} 号`} aria-pressed={m.draft?.includes(seat)??false} disabled={blocked||!m.draft?.includes(seat)&&(m.draft?.length??0)>=3} onClick={()=>send({action:'dance_draft',expectedRevision:m.danceRevision,targets:m.draft?.includes(seat)?m.draft.filter(t=>t!==seat):[...(m.draft??[]),seat]})}>{seat} 号</button>)}</div>
   <button className="primary full" disabled={blocked||m.draft?.length!==3} onClick={()=>send({action:'dance_confirm',expectedRevision:m.danceRevision,targets:m.draft})}>确认三人共舞</button>
  </>}
  {(m.inspection||m.mask)&&<div aria-label="假面私密结果" role="status">{m.inspection&&<p>查验 {m.inspection.target===null?'跳过':`${m.inspection.target} 号：${m.inspection.inPool?'入池':'未入池'}`} · {source(m.inspection.source)}</p>}{m.mask&&<p>面具：{m.mask.target===null?'跳过':`${m.mask.target} 号`} · {source(m.mask.source)}</p>}</div>}
  {card.kind==='mask'&&!m.penalized&&m.step!=='done'&&<>
   <p>查验与面具共用本阶段倒计时。重复目标的确认或超时草稿会使自己出局。</p>
   {m.canSkip&&<button className="secondary full" disabled={blocked} onClick={()=>send({action:'mask_skip',step:m.step,expectedRevision:m.maskRevision})}>无合法目标，跳过{m.step==='inspect'?'查验':'面具'}</button>}
   <label>{m.step==='inspect'?'查验是否入池':'戴面具'}<select aria-label={m.step==='inspect'?'假面查验目标':'假面面具目标'} disabled={blocked} value={(m.step==='inspect'?m.inspectDraft:m.maskDraft)??''} onChange={e=>send({action:'mask_draft',step:m.step,expectedRevision:m.maskRevision,target:e.target.value?Number(e.target.value):null})}><option value="">未选择</option>{alive.map(seat=><option key={seat} value={seat}>{seat} 号</option>)}</select></label>
   <button className="primary full" disabled={blocked||(m.step==='inspect'?m.inspectDraft:m.maskDraft)==null} onClick={()=>send({action:'mask_confirm',step:m.step,target:m.step==='inspect'?m.inspectDraft:m.maskDraft,expectedRevision:m.maskRevision})}>{m.step==='inspect'?'确认查验舞池':'确认戴面具'}</button>
  </>}
 </section>;
}
