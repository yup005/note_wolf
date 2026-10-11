import {LobbyError} from '../contracts/index.js';
import {boardRoleSchema,rulesetSchema,standardRoleCounts,type BoardRole,type Ruleset} from '../contracts/board.js';

export interface VictoryPlayer {seat:number;role:BoardRole;alive:boolean;learnedRole?:BoardRole}
export type VictoryResult={status:'playing'}|{status:'ended';winner:'wolves'|'good';reason:'all-villagers-dead'|'all-gods-dead'|'all-wolves-dead'}|{status:'unresolved';questionId:string};
const wolves=new Set<BoardRole>(['wolf','mechanicalWolf','armoredWolf']);
const gods=new Set<BoardRole>(['seer','witch','hunter','idiot','spiritSeer','guard']);
const simultaneousPolicy:Record<Ruleset,'wolves'|'unresolved'>={standard:'wolves','mechanical-seer':'wolves','mechanical-armor':'unresolved'};

// Input must reflect the entire settled night batch or one ordered daytime death.
// Unresolved special policies deliberately block an ordinary terminal verdict.
export function evaluateVictory(players:readonly VictoryPlayer[],ruleset:Ruleset):VictoryResult{
 if(!players.length||!rulesetSchema.safeParse(ruleset).success||
  new Set(players.map(p=>p.seat)).size!==players.length||players.some(p=>!Number.isSafeInteger(p.seat)||p.seat<1||
   !boardRoleSchema.safeParse(p.role).success||typeof p.alive!=='boolean'||
   p.learnedRole!==undefined&&!boardRoleSchema.safeParse(p.learnedRole).success)||
  ruleset==='standard'&&players.some(p=>!Object.hasOwn(standardRoleCounts,p.role))||
  ruleset!=='mechanical-armor'&&players.some(p=>p.role==='armoredWolf'))throw new LobbyError('INVALID_VICTORY_STATE');
 if(players.some(p=>p.role==='mixer'))return {status:'unresolved',questionId:'MA-VICTORY-MIXER'};
 if(players.some(p=>p.role==='mechanicalWolf'&&p.learnedRole==='idiot'))return {status:'unresolved',questionId:'MA-VICTORY-MECHANICAL-IDIOT'};
 const alive=players.filter(p=>p.alive);
 const noVillagers=!alive.some(p=>p.role==='villager');
 const noGods=!alive.some(p=>gods.has(p.role));
 const noWolves=!alive.some(p=>wolves.has(p.role));
 if(noWolves&&(noVillagers||noGods)&&simultaneousPolicy[ruleset]==='unresolved')return {status:'unresolved',questionId:'MA-VICTORY-SIMULTANEOUS'};
 if(noVillagers)return {status:'ended',winner:'wolves',reason:'all-villagers-dead'};
 if(noGods)return {status:'ended',winner:'wolves',reason:'all-gods-dead'};
 if(noWolves)return {status:'ended',winner:'good',reason:'all-wolves-dead'};
 return {status:'playing'};
}
