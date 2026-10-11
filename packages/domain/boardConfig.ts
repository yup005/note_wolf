import {LobbyError} from '../contracts/index.js';
import {boardCompositionSchema,standardRoleCounts,type BoardComposition,type BoardConfiguration} from '../contracts/board.js';

const mechanicalRoles={wolf:3,villager:4,spiritSeer:1,witch:1,hunter:1,guard:1,mechanicalWolf:1};
const presets={
 'standard-12':{seatCount:12,roles:standardRoleCounts},
 'mechanical-12':{seatCount:12,roles:mechanicalRoles},
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
 return {seatCount:parsed.data.seatCount,roles,ruleset:roles.armoredWolf?'mechanical-armor':standard?'standard':'mechanical-seer',playable:standard};
}

export function boardPreset(id:BoardPresetId):BoardConfiguration{
 if(!Object.hasOwn(presets,id))throw new LobbyError('INVALID_BOARD_CONFIGURATION');
 return createBoardConfiguration(presets[id]);
}

// Recompute eligibility; caller-provided flags cannot authorize an unfinished board.
export function assertPlayableBoard(config:BoardConfiguration):BoardConfiguration{
 const validated=createBoardConfiguration({seatCount:config.seatCount,roles:config.roles});
 if(!validated.playable)throw new LobbyError('BOARD_NOT_IMPLEMENTED',409);
 return validated;
}
