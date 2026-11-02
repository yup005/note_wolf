import {boardRuleVersion} from '../contracts/board.js';
import type {EngineState} from '../contracts/engine.js';
import type {ResolutionStrategy} from './engine.js';
/** Effects retain separate evidence even when multiple attacks kill one seat. */
export function masqueradeResolution():ResolutionStrategy{
 return {ruleset:'masquerade',ruleVersion:boardRuleVersion,resolve:(e:Readonly<EngineState>)=>{
  const m=e.masquerade!;const dancer=e.players.find(p=>p.role==='dancer')!;const protectedSeats=m.pool.includes(dancer.seat)?m.pool:[];
  return {status:'settled',effects:e.actions.filter(a=>['wolf-knife','poison','dance-death','rule-penalty'].includes(a.abilityType)).map(a=>{
   const saved=a.abilityType==='wolf-knife'?e.actions.filter(x=>x.abilityType==='antidote'&&x.targetId===a.targetId):[];
   const immune=a.abilityType==='wolf-knife'&&protectedSeats.includes(a.targetId!)||a.abilityType==='poison'&&e.players.some(p=>p.seat===a.targetId&&['dancer','mask'].includes(p.role));
   return {id:a.id,actionId:a.id,casterId:a.casterId,targetId:a.targetId,abilityType:a.abilityType,sourceRole:a.sourceRole,ruleset:a.ruleset,night:a.night,outcome:a.targetId===null?'no-effect' as const:immune||saved.length?'prevented' as const:'killed' as const,reflectTarget:null,preventedBy:saved.map(s=>s.id)};
  })};
 }};
}
