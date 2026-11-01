import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type BoardRole,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {createNight,advanceNight,type NightState} from '../packages/domain/night.js';
export const roles:BoardRole[]=['wolf','guard','villager','witch','wolf','seer','villager','hunter','blackWolf','villager','villager','villager'];
export function puppetFixture(){const c=boardPreset('puppet-12');const board:RoomBoardSnapshot={id:'puppet-12',name:'傀儡',ruleVersion:boardRuleVersion,composition:{variant:'puppet',seatCount:12,roleCounts:c.roles,ruleset:c.ruleset,playable:true}};return createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);}
export function move(s:NightState,phase:string){for(let i=0;i<40&&s.phase!==phase;i++){if(s.deadline===null)throw new Error(`stuck ${s.phase} before ${phase}`);advanceNight(s,s.deadline,()=>0);}if(s.phase!==phase)throw new Error(`missing ${phase}`);}
