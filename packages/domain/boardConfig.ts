import {LobbyError} from '../contracts/index.js';
import {boardCompositionSchema,standardRoleCounts,isWolfRole,type BoardRole,type BoardComposition,type BoardConfiguration} from '../contracts/board.js';

export const wolfGirlRoles={wolf:3,wolfGirl:1,villager:4,seer:1,poisoner:1,hunter:1,guard:1} as const;
const mechanicalRoles={wolf:3,villager:4,spiritSeer:1,witch:1,hunter:1,guard:1,mechanicalWolf:1};
const presets={
 'wolf-girl-12':{seatCount:12,roles:wolfGirlRoles},
 'standard-12':{seatCount:12,roles:standardRoleCounts},
 'mechanical-12':{seatCount:12,roles:mechanicalRoles},
 'mechanical-armor-12':{seatCount:12,roles:{...mechanicalRoles,wolf:2,armoredWolf:1}},
 'mechanical-mixer-13':{seatCount:13,roles:{...mechanicalRoles,mixer:1}},
 'mechanical-expanded-15':{seatCount:15,roles:{...mechanicalRoles,wolf:4,villager:5,idiot:1}}
} satisfies Record<string,BoardComposition>;
export type BoardPresetId=keyof typeof presets;

export function createBoardConfiguration(input:unknown):BoardConfiguration{
 const parsed=boardCompositionSchema.safeParse(input);
 if(!parsed.success)throw new LobbyError('INVALID_BOARD_CONFIGURATION');
 const roles=Object.fromEntries(Object.entries(parsed.data.roles).filter(([,count])=>count!>0)) as BoardComposition['roles'];
 const standard=parsed.data.seatCount===12&&Object.keys(roles).length===6&&
  Object.entries(standardRoleCounts).every(([role,count])=>roles[role as keyof typeof standardRoleCounts]===count);
 const wolfCount=Object.entries(roles).reduce((sum,[role,count])=>sum+(isWolfRole(role as BoardRole)?count!:0),0);
 return {seatCount:parsed.data.seatCount,roles,...(parsed.data.idiotPolicy?{idiotPolicy:parsed.data.idiotPolicy}:{}),ruleset:roles.wolfGirl||roles.poisoner?'wolf-girl':roles.armoredWolf?'mechanical-armor':standard?'standard':'mechanical-seer',playable:parsed.data.seatCount<=256&&wolfCount>0&&wolfCount<parsed.data.seatCount};
}

export function boardPreset(id:BoardPresetId):BoardConfiguration{
 if(!Object.hasOwn(presets,id))throw new LobbyError('INVALID_BOARD_CONFIGURATION');
 return createBoardConfiguration(presets[id]);
}

// Recompute eligibility; caller-provided flags cannot authorize an unfinished board.
export function boardStartError(config:BoardConfiguration,mode:'automatic'|'manual'='automatic'):string|null{
 if(config.ruleset==='wolf-girl'&&(config.seatCount!==12||Object.keys(config.roles).length!==Object.keys(wolfGirlRoles).length||Object.entries(wolfGirlRoles).some(([role,count])=>config.roles[role as BoardRole]!==count)))return 'BOARD_NOT_IMPLEMENTED';
 if(config.seatCount>256)return 'BOARD_NOT_IMPLEMENTED';
 const wolves=Object.entries(config.roles).reduce((sum,[role,count])=>sum+(isWolfRole(role as BoardRole)?count!:0),0);
 if(wolves===config.seatCount)return 'INVALID_BOARD_FACTIONS';
 if(!wolves&&mode!=='manual')return 'WOLF_FREE_MANUAL_ONLY';
 return null;
}
export function assertPlayableBoard(config:BoardConfiguration,mode:'automatic'|'manual'='automatic'):BoardConfiguration{
 const validated=createBoardConfiguration({seatCount:config.seatCount,roles:config.roles,...(config.idiotPolicy?{idiotPolicy:config.idiotPolicy}:{})});
 const reason=boardStartError(validated,mode);if(reason)throw new LobbyError(reason,409);
 return validated;
}
