import type {Role} from '../contracts/index.js';
import type {RecordOutcome} from '../contracts/records.js';
import {evaluateVictory} from './victory.js';
import {createBoardConfiguration} from './boardConfig.js';
import {type BoardRole,type Ruleset,type IdiotPolicy,isWolfRole} from '../contracts/board.js';
export interface ManualVictoryFact {seat:number;personalCamp?:'wolves'|'good';learnedRole:BoardRole|null;learningKnown?:boolean;extraNightPending?:boolean;modelSeat?:number;modelCamp?:'wolves'|'good'}
export interface ManualVictoryOptions {idiotPolicy?:IdiotPolicy;flippedIdiots?:readonly number[]}
export function manualDecision(roles:readonly {seat:number;role:Role}[],dead:readonly number[],facts:readonly ManualVictoryFact[]=[],options:ManualVictoryOptions={}):{outcome:RecordOutcome;requiresAdjudication:boolean}{
 const counts:Partial<Record<BoardRole,number>>={};for(const p of roles)counts[p.role]=(counts[p.role]??0)+1;
 const ruleset:Ruleset=createBoardConfiguration({seatCount:roles.length,roles:counts,...(options.idiotPolicy?{idiotPolicy:options.idiotPolicy}:{})}).ruleset;
 // Wolf-free compositions are records, not an automatic victory simulation.
 if(!roles.some(p=>isWolfRole(p.role)))return {outcome:null,requiresAdjudication:false};
 // Pure manual games do not collect secret learning. The mechanical idiot exception
 // cannot be decided from deaths alone; preserve that uncertainty instead of ending early.
 const uncertainIdiot=roles.some(p=>{if(p.role!=='mechanicalWolf'||!counts.idiot)return false;const fact=facts.find(f=>f.seat===p.seat);return !fact||fact.learningKnown===false||fact.extraNightPending===true||fact.learnedRole==='idiot'&&dead.includes(p.seat);});
 const result=evaluateVictory(roles.map(p=>{const fact=facts.find(f=>f.seat===p.seat);return {...p,alive:!dead.includes(p.seat),...(options.idiotPolicy==='dual-category-14'&&p.role==='idiot'?{idiotFlipped:options.flippedIdiots?.includes(p.seat)??false}:{}),...(fact?.personalCamp?{personalCamp:fact.personalCamp}:{}),...(fact?.learnedRole?{learnedRole:fact.learnedRole}:{}),...(fact?.modelSeat!==undefined?{modelSeat:fact.modelSeat,modelCamp:fact.modelCamp}:{})};}),ruleset,options.idiotPolicy);
 if(result.status==='ended'&&result.winner==='wolves')return {outcome:'wolves',requiresAdjudication:false};
 if(uncertainIdiot||result.status==='unresolved')return {outcome:null,requiresAdjudication:ruleset!=='standard'};
 return {outcome:result.status==='ended'?result.winner:null,requiresAdjudication:false};
}
export function manualOutcome(roles:readonly {seat:number;role:Role}[],dead:readonly number[],facts:readonly ManualVictoryFact[]=[],options:ManualVictoryOptions={}):RecordOutcome{return manualDecision(roles,dead,facts,options).outcome;}
