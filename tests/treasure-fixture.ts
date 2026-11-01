import assert from 'node:assert/strict';
import {createNight,advanceNight,type NightState} from '../packages/domain/night.js';
import {dealTreasure} from '../packages/domain/treasure.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
export function fixture(mode:'random'|'fixed-wolf'='fixed-wolf',pick=0){
 const d=dealTreasure(mode,n=>Math.min(pick,n-1)),c=boardPreset('treasure-12');const board:RoomBoardSnapshot={id:'treasure-12',name:'盗宝',ruleVersion:boardRuleVersion,composition:{seatCount:12,roleCounts:c.roles,ruleset:c.ruleset,playable:true,treasureMode:mode}};
 return createNight(d.deck.map((role,i)=>({seat:i+1,role})),0,undefined,board,d);
}
export function move(s:NightState,p:string){for(let i=0;i<40&&s.phase!==p;i++){assert.notEqual(s.deadline,null);advanceNight(s,s.deadline!,()=>0);}assert.equal(s.phase,p);}
export const seat=(s:NightState,r:string)=>s.players.find(p=>p.role===r)!.seat;
