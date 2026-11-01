import type {BoardRole} from '../contracts/board.js';
import {isSharedWolfRole} from '../contracts/board.js';
import type {EngineState} from '../contracts/engine.js';

const gods=new Set<BoardRole>(['seer','witch','guard','hunter']);
/** Seats are one-based around a circular table, in final deal order. */
export function puppetCandidates(roles:readonly BoardRole[]):number[]{
 const candidates=new Set<number>();
 roles.forEach((role,i)=>{if(isSharedWolfRole(role))for(const n of [(i+roles.length-1)%roles.length,(i+1)%roles.length])if(!isSharedWolfRole(roles[n]))candidates.add(n+1);});
 return [...candidates].sort((a,b)=>a-b);
}
export function hasNeighborGod(roles:readonly BoardRole[]):boolean{return puppetCandidates(roles).some(seat=>gods.has(roles[seat-1]));}
/** Both attempts remain transient. Only the returned final deck may be persisted/published. */
export function dealPuppetDeck<T extends BoardRole>(candidate:()=>T[]):T[]{const first=candidate();return hasNeighborGod(first)?first:candidate();}
export function puppetInspection(state:Pick<EngineState,'players'|'puppet'>,actor:number,target:number):'wolves'|'good'{
 const p=state.players.find(p=>p.seat===target)!;
 const wolf=isSharedWolfRole(p.role)||state.puppet?.target===target;
 return (state.puppet?.target===actor?!wolf:wolf)?'wolves':'good';
}
