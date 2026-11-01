import {LobbyError} from '../contracts/index.js';
import {boardRoleSchema,rulesetSchema,standardRoleCounts,idiotPolicySchema,supportsDualIdiot,isWolfRole,type IdiotPolicy,type BoardRole,type Ruleset} from '../contracts/board.js';

export interface VictoryPlayer {seat:number;role:BoardRole;alive:boolean;personalCamp?:'wolves'|'good';idiotFlipped?:boolean;learnedRole?:BoardRole;modelSeat?:number;modelCamp?:'wolves'|'good'}
export type VictoryResult={status:'playing'}|{status:'ended';winner:'wolves'|'good';reason:'all-villagers-dead'|'all-gods-dead'|'all-wolves-dead'|'mixer-dead-one-villager'|'mixer-last-civilian';personalResults?:{seat:number;won:boolean}[]}|{status:'unresolved';questionId:string};
const gods=new Set<BoardRole>(['seer','witch','hunter','idiot','spiritSeer','guard','poisoner']);
export function playerCamp(role:BoardRole):'wolves'|'good'|null{
 return isWolfRole(role)?'wolves':gods.has(role)||role==='villager'?'good':null;
}

// Input must reflect the entire settled night batch or one ordered daytime death.
// Unresolved special policies deliberately block an ordinary terminal verdict.
export function evaluateVictory(players:readonly VictoryPlayer[],ruleset:Ruleset,idiotPolicy:IdiotPolicy='standard'):VictoryResult{
 const dual=idiotPolicy==='dual-category-14';
 if(!players.length||!rulesetSchema.safeParse(ruleset).success||
  !idiotPolicySchema.safeParse(idiotPolicy).success||dual&&!supportsDualIdiot(players.filter(p=>p.role==='idiot').length)||
  new Set(players.map(p=>p.seat)).size!==players.length||players.some(p=>!Number.isSafeInteger(p.seat)||p.seat<1||
   !boardRoleSchema.safeParse(p.role).success||typeof p.alive!=='boolean'||p.idiotFlipped!==undefined&&(typeof p.idiotFlipped!=='boolean'||p.idiotFlipped&&(!dual||p.role!=='idiot'))||
   p.learnedRole!==undefined&&!boardRoleSchema.safeParse(p.learnedRole).success)||
  ruleset==='standard'&&players.some(p=>!Object.hasOwn(standardRoleCounts,p.role))||
  ruleset!=='mechanical-armor'&&players.some(p=>p.role==='armoredWolf'))throw new LobbyError('INVALID_VICTORY_STATE');
 if(ruleset==='puppet'){
  const alive=players.filter(p=>p.alive),wolf=(p:VictoryPlayer)=>isWolfRole(p.role)||p.personalCamp==='wolves';
  const reason=!alive.some(p=>p.role==='villager'&&!wolf(p))?'all-villagers-dead':!alive.some(p=>gods.has(p.role)&&!wolf(p))?'all-gods-dead':!alive.some(wolf)?'all-wolves-dead':null;
  if(!reason)return {status:'playing'};const winner=reason==='all-wolves-dead'?'good':'wolves';
  return {status:'ended',winner,reason,personalResults:players.map(p=>({seat:p.seat,won:(wolf(p)?'wolves':'good')===winner}))};
 }
 if(ruleset==='wolf-girl'){
  const alive=players.filter(p=>p.alive);
  const winner=!alive.some(p=>isWolfRole(p.role))?'good':!alive.some(p=>p.role==='villager')||!alive.some(p=>gods.has(p.role))?'wolves':null;
  return winner?{status:'ended',winner,reason:winner==='good'?'all-wolves-dead':!alive.some(p=>p.role==='villager')?'all-villagers-dead':'all-gods-dead',personalResults:players.map(p=>({seat:p.seat,won:(p.personalCamp??playerCamp(p.role))===winner}))}:{status:'playing'};
 }
 const mixer=players.find(p=>p.role==='mixer');
 const model=mixer?players.find(p=>p.seat===mixer.modelSeat):undefined;
 if(players.filter(p=>p.role==='mixer').length>1)throw new LobbyError('INVALID_VICTORY_STATE');
 if(mixer&&(mixer.modelSeat===undefined||mixer.modelCamp===undefined))return {status:'unresolved',questionId:'MA-VICTORY-MIXER'};
 if(mixer&&(mixer.modelSeat===mixer.seat||!model||playerCamp(model.role)!==mixer.modelCamp))throw new LobbyError('INVALID_VICTORY_STATE');
 // The daytime orchestrator handles the confirmed exile-only extra-night exception.
 // A learned idiot alone never blocks ordinary night settlement or wolves-first victory.
 const alive=players.filter(p=>p.alive);
 // Confirmed 12-player 3-villager + mixed-blood variant keeps four civilian
 // identities. The expanded-board early thresholds never apply to this roster.
 const standardMixerCounts={...standardRoleCounts,villager:3,mixer:1};
 const standardMixer=players.length===12&&Object.entries(standardMixerCounts).every(([role,count])=>players.filter(p=>p.role===role).length===count);
 const civilian=(p:VictoryPlayer)=>p.role==='villager'||standardMixer&&p.role==='mixer'||dual&&p.role==='idiot';
 const godAlive=(p:VictoryPlayer)=>gods.has(p.role)&&!(dual&&p.role==='idiot'&&p.idiotFlipped);
 const noVillagers=players.some(civilian)&&!alive.some(civilian);
 const noGods=players.some(p=>gods.has(p.role))&&!alive.some(godAlive);
 const noWolves=players.some(p=>isWolfRole(p.role))&&!alive.some(p=>isWolfRole(p.role));
 const mixerThreshold=!standardMixer&&!!mixer&&!mixer.alive&&players.some(p=>p.role==='villager')&&alive.filter(p=>p.role==='villager').length===1;
 const mixerLastCivilian=!standardMixer&&!!mixer&&mixer.alive&&!alive.some(civilian);
 // All confirmed rulesets give wolves priority when both sides finish in the same batch.
 const ended=(winner:'wolves'|'good',reason:Extract<VictoryResult,{status:'ended'}>['reason']):VictoryResult=>({status:'ended',winner,reason,
  ...(mixer?{personalResults:[{seat:mixer.seat,won:mixer.modelCamp===winner}]}:{})});
 if(noVillagers)return ended('wolves','all-villagers-dead');
 if(noGods)return ended('wolves','all-gods-dead');
 if(mixerThreshold)return ended('wolves','mixer-dead-one-villager');
 if(mixerLastCivilian)return ended('wolves','mixer-last-civilian');
 if(noWolves)return ended('good','all-wolves-dead');
 return {status:'playing'};
}
