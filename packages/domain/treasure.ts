import {randomInt} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import type {TreasureMode} from '../contracts/board.js';
import type {VictoryResult} from './victory.js';
export const treasureGods=['spiritSeer','poisoner','hunter','dreamer','masked'] as const;
export const treasurePool:Role[]=[...treasureGods,...Array<Role>(5).fill('villager'),'blackWolf',...Array<Role>(3).fill('wolf'),'treasureMaster'];
export interface TreasureDeal {mode:TreasureMode;bottoms:Role[];camp:'wolves'|'good';deck:Role[]}
export const treasureWolf=(role:Role,camp:TreasureDeal['camp'])=>role==='wolf'||role==='blackWolf'||role==='treasureMaster'&&camp==='wolves';
export const treasureGod=(role:Role,camp:TreasureDeal['camp'])=>treasureGods.includes(role as typeof treasureGods[number])||role==='treasureMaster'&&camp==='good';
export function dealTreasure(mode:TreasureMode,choose=(n:number)=>randomInt(n)):TreasureDeal{
 if(!['fixed-wolf','random'].includes(mode))throw new LobbyError('INVALID_BOARD_CONFIGURATION');
 const pick=<T>(items:T[])=>{const i=choose(items.length);if(!Number.isInteger(i)||i<0||i>=items.length)throw new LobbyError('INVALID_INPUT');return items.splice(i,1)[0];};
 const candidates:Role[]=[...treasureGods,...(mode==='random'?['wolf' as const]:[])];
 const bottoms:Role[]=['villager',mode==='random'?pick(candidates):'wolf',pick(candidates)];
 const deck=[...treasurePool];for(const r of bottoms)deck.splice(deck.indexOf(r),1);
 for(let i=deck.length-1;i>0;i--){const j=choose(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new LobbyError('INVALID_INPUT');[deck[i],deck[j]]=[deck[j],deck[i]];}
 return {mode,bottoms,camp:bottoms.includes('wolf')?'wolves':'good',deck};
}
export function validateTreasureDeal(input:unknown):TreasureDeal{
 const d=input as TreasureDeal;if(!d||!Array.isArray(d.bottoms)||d.bottoms.length!==3||new Set(d.bottoms).size!==3||!d.bottoms.includes('villager')||!Array.isArray(d.deck)||d.deck.length!==12||!['fixed-wolf','random'].includes(d.mode)||d.camp!==(d.bottoms.includes('wolf')?'wolves':'good')||d.mode==='fixed-wolf'&&d.camp!=='wolves')throw new LobbyError('INVALID_TREASURE_DEAL');
 const all=[...d.deck,...d.bottoms];if(all.some(r=>!treasurePool.includes(r))||new Set(all).size!==new Set(treasurePool).size||treasurePool.some(r=>all.filter(x=>x===r).length!==treasurePool.filter(x=>x===r).length)||d.bottoms.some(r=>r!=='villager'&&r!=='wolf'&&!treasureGods.includes(r as typeof treasureGods[number])))throw new LobbyError('INVALID_TREASURE_DEAL');
 return structuredClone(d);
}
export function treasureVictory(players:readonly {seat:number;role:Role;alive:boolean}[],camp:TreasureDeal['camp']):VictoryResult{
 const alive=players.filter(p=>p.alive),noGods=!alive.some(p=>treasureGod(p.role,camp)),noCivilians=!alive.some(p=>p.role==='villager'),noWolves=!alive.some(p=>treasureWolf(p.role,camp));
 // Owner confirmed standard-board wolves-first priority for a simultaneous batch.
 if(noGods||noCivilians)return {status:'ended',winner:'wolves',reason:noGods?'all-gods-dead':'all-villagers-dead'};
 return noWolves?{status:'ended',winner:'good',reason:'all-wolves-dead'}:{status:'playing'};
}
