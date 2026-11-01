import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {createNight,beginNight,advanceNight,nightCommand,type NightState} from '../packages/domain/night.js';
export const roles=['wolf','wolf','wolf','mask','villager','villager','villager','villager','seer','witch','idiot','dancer'] as const;
export function fixture(night=2){const b=boardPreset('masquerade-12');const board:RoomBoardSnapshot={id:'masquerade-12',name:'假面舞会',ruleVersion:boardRuleVersion,composition:{seatCount:12,roleCounts:b.roles,ruleset:b.ruleset,playable:true}};const first=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);if(night===1)return first;return createNight(first.players,0,{night,engine:first.engine,antidote:true,poison:true,hunterSpent:false,priorityWolf:null},board);}
export function move(s:NightState,phase:string){for(let i=0;i<40&&s.phase!==phase;i++){assert.notEqual(s.deadline,null);advanceNight(s,s.deadline!,()=>0);}assert.equal(s.phase,phase);}
export function command(s:NightState,seat:number,c:Record<string,unknown>,now=s.deadline!-1){const request={...(['dance_draft','dance_confirm','mask_draft','mask_confirm'].includes(String(c.action))?{requestId:randomUUID()}:{}),turnId:s.turnId,...c};nightCommand(s,seat,request as never,now,()=>0);return request;}
export function dance(s:NightState,targets:number[]){return command(s,12,{action:'dance_confirm',targets,expectedRevision:s.masquerade!.danceRevision});}
export function mask(s:NightState,step:'inspect'|'mask',target:number){return command(s,4,{action:'mask_confirm',step,target,expectedRevision:s.masquerade!.maskRevision});}
export function start(s:NightState){beginNight(s,0,()=>0);return s;}
