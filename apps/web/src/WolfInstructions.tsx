import {useRef} from 'react';
import {useHelpPreference} from './useHelpPreference';

export function WolfInstructions({recognitionOnly,hasPriority,isPriority,isConfirmer}:{recognitionOnly:boolean;hasPriority:boolean;isPriority:boolean;isConfirmer:boolean}){
 const [expanded,setExpanded]=useHelpPreference('wolves');const entry=useRef<HTMLButtonElement>(null);
 return <div className="wolf-instructions">
  <button ref={entry} className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>狼人操作说明</button>
  {expanded&&<section className="wolf-guide" aria-label="狼人操作说明">
   <p>{recognitionOnly?'本夜只认队友，不选刀口。':hasPriority?isPriority?'点座位选目标 → 提交优先刀口（暂存）→ 确认优先指刀（生效并结束）。可选空刀。':'点座位选目标 → 提交刀口。优先指刀者确认后直接生效；其超时未确认才按狼队票型结算。':'点座位选目标 → 提交刀口。可重新选人并提交；选空刀后也需提交。'}</p>
   {!hasPriority&&<p>{recognitionOnly?isConfirmer?'你是确认者：队友相认后点“确认相认完成”。':'等待确认者点“确认相认完成”。':`${isConfirmer?'你是确认者：商量好后点“确认狼队刀口”，结束本阶段。':'商量好后，由确认者点“确认狼队刀口”。'}按票数最多的目标结算，平票随机；没有有效目标为空刀，超时也按票型结算。`}</p>}
   <button className="text-button" aria-label="不再显示狼人说明" onClick={()=>{setExpanded(false);entry.current?.focus();}}>以后不再显示</button>
  </section>}
 </div>;
}
