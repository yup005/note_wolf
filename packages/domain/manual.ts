import type {Role} from '../contracts/index.js';
import type {RecordOutcome} from '../contracts/records.js';
export function manualOutcome(roles:readonly {seat:number;role:Role}[],dead:readonly number[]):RecordOutcome{
 const alive=roles.filter(p=>!dead.includes(p.seat));
 if(!alive.some(p=>p.role==='villager')||!alive.some(p=>p.role!=='villager'&&p.role!=='wolf'))return 'wolves';
 return alive.some(p=>p.role==='wolf')?null:'good';
}
