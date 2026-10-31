import type {RoomBoardSnapshot} from '../../../packages/contracts/board';
import {buildRuleReference} from '../../../packages/domain/ruleReference';
import {RuleReferenceShell} from './RuleReferenceShell';

export default function RuleReferenceDialog({board,onClose}:{board:RoomBoardSnapshot;onClose:()=>void}){
 const reference=buildRuleReference(board);
 return <RuleReferenceShell board={board} onClose={onClose}><p className="helper">只读速查，打开和关闭不暂停或重置对局。</p>
   {reference.cautions.map(note=><p className="validation-warning" key={note}>{note}</p>)}
   {reference.supported&&<><h3>公开角色目录</h3>{reference.roles.map(role=><details className="rule-reference-role" key={role.role}><summary>{role.label} × {role.count}</summary><ul>{role.notes.map(note=><li key={note}>{note}</li>)}</ul><small>依据：{role.source}</small></details>)}
    <h3>本局机制</h3><ul>{reference.mechanics.map(note=><li key={note}>{note}</li>)}</ul>
    <h3>本人实际身份与技能</h3><p>发牌后使用原“查看身份”；夜间只在本人合法阶段查看和操作；白天使用“我的身份与技能”查看真实余量和对应限制。这里的目录不代表本人身份或实际剩余次数。</p>
   </>}
   <p className="helper">规则说明 {reference.version} · 本局规则 {board.ruleVersion}</p>
 </RuleReferenceShell>;
}
