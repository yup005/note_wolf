import type {GameReplay} from '../contracts/game.js';
import type {Role} from '../contracts/index.js';
import {deathCauses,type RecordDocument,type PuppetDisclosure} from '../contracts/records.js';
import {isWolfRole} from '../contracts/board.js';
import {finalReplay,summarizeReplay} from './replay.js';
import {evaluateVictory} from './victory.js';
/** Construct only ended official facts, never pretend frozen actions describe offline play. */
export function manualPuppetReplay(roles:{seat:number;role:Role}[],document:RecordDocument,winner:'wolves'|'good',puppet:PuppetDisclosure,adjudicated:boolean):GameReplay{
 const rounds:GameReplay['rounds']=[{kind:'night',round:1,events:[{type:'puppet_selected',at:puppet.at,target:puppet.target}]}];
 const record:GameReplay={winner,roles,rounds,personalResults:roles.map(p=>({seat:p.seat,won:(p.seat===puppet.target||isWolfRole(p.role)?'wolves':'good')===winner}))};
 // Manual chronology is the committed public record, without invented event times.
 const summary=summarizeReplay(record);
 for(const round of [...new Set(document.deaths.map(d=>d.round))].sort((a,b)=>a-b))summary.push({title:`第 ${round} 轮 · 手动官方记录`,lines:document.deaths.filter(d=>d.round===round).map(d=>`${d.period==='night'?'夜晚':'白天'} ${d.seat} 号死亡（${deathCauses[d.cause]}）`)});
 const victory=evaluateVictory(roles.map(p=>({...p,alive:!document.deaths.some(d=>d.seat===p.seat),...(p.seat===puppet.target?{personalCamp:'wolves' as const}:{})})),'puppet');
 const reason=victory.status==='ended'?({'all-wolves-dead':'全部有效狼人出局','all-gods-dead':'有效神职全部出局','all-villagers-dead':'有效平民全部出局','mixer-dead-one-villager':'屠民','mixer-last-civilian':'屠民'}[victory.reason]):'现场裁定';
 summary.push({title:'胜负依据',lines:[`有效狼人包含首夜傀儡，傀儡退出原神／民边；同夜同时达成狼人优先。${adjudicated?'房主人工裁定':reason}，${winner==='wolves'?'狼人':'好人'}获胜。未补录的线下技能不自动推演。`]});
 return finalReplay({...record,summary});
}
