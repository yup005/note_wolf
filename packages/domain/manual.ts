import type {Role} from '../contracts/index.js';
import type {RecordOutcome} from '../contracts/records.js';
import {evaluateVictory} from './victory.js';
export function manualOutcome(roles:readonly {seat:number;role:Role}[],dead:readonly number[]):RecordOutcome{
 const result=evaluateVictory(roles.map(p=>({...p,alive:!dead.includes(p.seat)})),'standard');
 return result.status==='ended'?result.winner:null;
}
