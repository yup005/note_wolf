import {z} from 'zod';

// This catalog is for the new domain foundation, not the public playable Role contract.
export const boardRoleSchema=z.enum(['wolf','villager','seer','witch','hunter','idiot','spiritSeer','guard','mechanicalWolf','armoredWolf','mixer']);
export type BoardRole=z.infer<typeof boardRoleSchema>;
export const rulesetSchema=z.enum(['standard','mechanical-seer','mechanical-armor']);
export type Ruleset=z.infer<typeof rulesetSchema>;
export const standardRoleCounts={wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1} as const;
export const boardCompositionSchema=z.object({
 seatCount:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
 roles:z.partialRecord(boardRoleSchema,z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
}).strict().refine(config=>Object.values(config.roles).reduce((sum,count)=>sum+count,0)===config.seatCount)
 .refine(config=>Object.entries(config.roles).every(([role,count])=>role==='wolf'||role==='villager'||count!<=1));
export type BoardComposition=z.infer<typeof boardCompositionSchema>;
export interface BoardConfiguration extends BoardComposition {ruleset:Ruleset;playable:boolean}
