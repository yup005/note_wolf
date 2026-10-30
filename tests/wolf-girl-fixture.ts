import assert from 'node:assert/strict';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {createNight,advanceNight,type NightState} from '../packages/domain/night.js';
export const roles=['wolf','wolf','wolf','wolfGirl','villager','villager','villager','villager','seer','poisoner','hunter','guard'] as const;
export function girlFixture(){const c=boardPreset('wolf-girl-12');const board:RoomBoardSnapshot={id:'wolf-girl-12',name:'狼女孩',ruleVersion:boardRuleVersion,composition:{seatCount:12,roleCounts:c.roles,ruleset:c.ruleset,playable:true}};return createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);}
export function move(s:NightState,phase:string){for(let i=0;i<35&&s.phase!==phase;i++){assert.notEqual(s.deadline,null);advanceNight(s,s.deadline!,()=>0);}assert.equal(s.phase,phase);}
