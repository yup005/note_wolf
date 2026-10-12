import type {Role} from '../contracts/index.js';
import type {RecordOutcome} from '../contracts/records.js';
import {evaluateVictory} from './victory.js';
import {createBoardConfiguration} from './boardConfig.js';
import type {BoardRole,Ruleset} from '../contracts/board.js';
export interface ManualVictoryFact {seat:number;learnedRole:BoardRole|null;learningKnown?:boolean;extraNightPending?:boolean;modelSeat?:number;modelCamp?:'wolves'|'good'}
export function manualDecision(roles:readonly {seat:number;role:Role}[],dead:readonly number[],facts:readonly ManualVictoryFact[]=[]):{outcome:RecordOutcome;requiresAdjudication:boolean}{
 const counts:Partial<Record<BoardRole,number>>={};for(const p of roles)counts[p.role]=(counts[p.role]??0)+1;
 const ruleset:Ruleset=createBoardConfiguration({seatCount:roles.length,roles:counts}).ruleset;
 // Pure manual games do not collect secret learning. The mechanical idiot exception
 // cannot be decided from deaths alone; preserve that uncertainty instead of ending early.
 const uncertainIdiot=roles.some(p=>{if(p.role!=='mechanicalWolf'||!counts.idiot)return false;const fact=facts.find(f=>f.seat===p.seat);return !fact||fact.learningKnown===false||fact.extraNightPending===true||fact.learnedRole==='idiot'&&dead.includes(p.seat);});
 const result=evaluateVictory(roles.map(p=>{const fact=facts.find(f=>f.seat===p.seat);return {...p,alive:!dead.includes(p.seat),...(fact?.learnedRole?{learnedRole:fact.learnedRole}:{}),...(fact?.modelSeat!==undefined?{modelSeat:fact.modelSeat,modelCamp:fact.modelCamp}:{})};}),ruleset);
 if(result.status==='ended'&&result.winner==='wolves')return {outcome:'wolves',requiresAdjudication:false};
 if(uncertainIdiot||result.status==='unresolved')return {outcome:null,requiresAdjudication:ruleset!=='standard'};
 return {outcome:result.status==='ended'?result.winner:null,requiresAdjudication:false};
}
export function manualOutcome(roles:readonly {seat:number;role:Role}[],dead:readonly number[],facts:readonly ManualVictoryFact[]=[]):RecordOutcome{return manualDecision(roles,dead,facts).outcome;}
