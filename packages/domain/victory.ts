import {LobbyError} from '../contracts/index.js';
import {boardRoleSchema,rulesetSchema,standardRoleCounts,type BoardRole,type Ruleset} from '../contracts/board.js';

export interface VictoryPlayer {seat:number;role:BoardRole;alive:boolean;learnedRole?:BoardRole;modelSeat?:number;modelCamp?:'wolves'|'good'}
export type VictoryResult={status:'playing'}|{status:'ended';winner:'wolves'|'good';reason:'all-villagers-dead'|'all-gods-dead'|'all-wolves-dead'|'mixer-dead-one-villager'|'mixer-last-civilian';personalResults?:{seat:number;won:boolean}[]}|{status:'unresolved';questionId:string};
const wolves=new Set<BoardRole>(['wolf','mechanicalWolf','armoredWolf']);
const gods=new Set<BoardRole>(['seer','witch','hunter','idiot','spiritSeer','guard']);
const simultaneousPolicy:Record<Ruleset,'wolves'|'unresolved'>={standard:'wolves','mechanical-seer':'wolves','mechanical-armor':'unresolved'};
export function playerCamp(role:BoardRole):'wolves'|'good'|null{
 return wolves.has(role)?'wolves':gods.has(role)||role==='villager'?'good':null;
}

// Input must reflect the entire settled night batch or one ordered daytime death.
// Unresolved special policies deliberately block an ordinary terminal verdict.
export function evaluateVictory(players:readonly VictoryPlayer[],ruleset:Ruleset):VictoryResult{
 if(!players.length||!rulesetSchema.safeParse(ruleset).success||
  new Set(players.map(p=>p.seat)).size!==players.length||players.some(p=>!Number.isSafeInteger(p.seat)||p.seat<1||
   !boardRoleSchema.safeParse(p.role).success||typeof p.alive!=='boolean'||
   p.learnedRole!==undefined&&!boardRoleSchema.safeParse(p.learnedRole).success)||
  ruleset==='standard'&&players.some(p=>!Object.hasOwn(standardRoleCounts,p.role))||
  ruleset!=='mechanical-armor'&&players.some(p=>p.role==='armoredWolf'))throw new LobbyError('INVALID_VICTORY_STATE');
 const mixer=players.find(p=>p.role==='mixer');
 const model=mixer?players.find(p=>p.seat===mixer.modelSeat):undefined;
 if(players.filter(p=>p.role==='mixer').length>1)throw new LobbyError('INVALID_VICTORY_STATE');
 if(mixer&&(mixer.modelSeat===undefined||mixer.modelCamp===undefined))return {status:'unresolved',questionId:'MA-VICTORY-MIXER'};
 if(mixer&&(mixer.modelSeat===mixer.seat||!model||playerCamp(model.role)!==mixer.modelCamp))throw new LobbyError('INVALID_VICTORY_STATE');
 if(players.some(p=>p.role==='mechanicalWolf'&&p.learnedRole==='idiot'))return {status:'unresolved',questionId:'MA-VICTORY-MECHANICAL-IDIOT'};
 const alive=players.filter(p=>p.alive);
 const noVillagers=players.some(p=>p.role==='villager')&&!alive.some(p=>p.role==='villager');
 const noGods=players.some(p=>gods.has(p.role))&&!alive.some(p=>gods.has(p.role));
 const noWolves=players.some(p=>wolves.has(p.role))&&!alive.some(p=>wolves.has(p.role));
 const mixerThreshold=!!mixer&&!mixer.alive&&players.some(p=>p.role==='villager')&&alive.filter(p=>p.role==='villager').length===1;
 const mixerLastCivilian=!!mixer&&mixer.alive&&!alive.some(p=>p.role==='villager');
 if(noWolves&&(noVillagers||noGods||mixerThreshold||mixerLastCivilian)&&simultaneousPolicy[ruleset]==='unresolved')return {status:'unresolved',questionId:'MA-VICTORY-SIMULTANEOUS'};
 const ended=(winner:'wolves'|'good',reason:Extract<VictoryResult,{status:'ended'}>['reason']):VictoryResult=>({status:'ended',winner,reason,
  ...(mixer?{personalResults:[{seat:mixer.seat,won:mixer.modelCamp===winner}]}:{})});
 if(noVillagers)return ended('wolves','all-villagers-dead');
 if(noGods)return ended('wolves','all-gods-dead');
 if(mixerThreshold)return ended('wolves','mixer-dead-one-villager');
 if(mixerLastCivilian)return ended('wolves','mixer-last-civilian');
 if(noWolves)return ended('good','all-wolves-dead');
 return {status:'playing'};
}
