import {z} from 'zod';

// This catalog is for the new domain foundation, not the public playable Role contract.
export const boardRoleSchema=z.enum(['wolf','villager','seer','witch','hunter','idiot','spiritSeer','guard','mechanicalWolf','armoredWolf','mixer']);
export type BoardRole=z.infer<typeof boardRoleSchema>;
export const rulesetSchema=z.enum(['standard','mechanical-seer','mechanical-armor']);
export type Ruleset=z.infer<typeof rulesetSchema>;
export const idiotPolicySchema=z.enum(['standard','dual-category-14']);
export type IdiotPolicy=z.infer<typeof idiotPolicySchema>;
export const standardRoleCounts={wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1} as const;
export const boardCompositionSchema=z.object({
 seatCount:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
 roles:z.partialRecord(boardRoleSchema,z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
 idiotPolicy:idiotPolicySchema.optional()
}).strict().refine(config=>Object.values(config.roles).reduce((sum,count)=>sum+count,0)===config.seatCount)
 .refine(config=>Object.entries(config.roles).every(([role,count])=>role==='wolf'||role==='villager'||count!<=1))
 .refine(config=>config.idiotPolicy!=='dual-category-14'||config.seatCount===14&&config.roles.idiot===1);
export type BoardComposition=z.infer<typeof boardCompositionSchema>;
export interface BoardConfiguration extends BoardComposition {ruleset:Ruleset;playable:boolean}

export const boardRuleVersion='2026-10-10-v1' as const;
export const systemPresetIdSchema=z.enum(['standard-12','mechanical-12','mechanical-armor-12']);
export type SystemPresetId=z.infer<typeof systemPresetIdSchema>;
// Service capability limit, not a gameplay rule; the domain supports larger compositions.
export const serviceCompositionSchema=boardCompositionSchema.refine(value=>value.seatCount<=256);
export const boardSaveSchema=z.object({id:z.string().uuid().nullable(),revision:z.number().int().nonnegative(),name:z.string().trim().min(1).max(60),composition:serviceCompositionSchema}).strict();
export type BoardSave=z.infer<typeof boardSaveSchema>;
export const boardSelectionSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('preset'),id:systemPresetIdSchema}).strict(),
 z.object({kind:z.literal('custom'),id:z.string().uuid()}).strict(),
 z.object({kind:z.literal('composition'),composition:serviceCompositionSchema}).strict()
]);
export const boardConfigureSchema=z.object({selection:boardSelectionSchema,settingsRevision:z.number().int().nonnegative()}).strict();
export type BoardConfigure=z.infer<typeof boardConfigureSchema>;
export interface BoardTemplate {id:string;name:string;revision:number;ruleVersion:typeof boardRuleVersion;composition:BoardConfiguration}
export interface BoardLibrary {presets:BoardTemplate[];custom:BoardTemplate[]}
export interface RoomBoardSnapshot {id:string;name:string;ruleVersion:typeof boardRuleVersion;composition:{seatCount:number;roleCounts:BoardComposition['roles'];ruleset:Ruleset;playable:boolean;idiotPolicy?:IdiotPolicy}}
export const boardRoleLabels:Record<BoardRole,string>={wolf:'狼人',villager:'村民',seer:'预言家',witch:'女巫',hunter:'猎人',idiot:'白痴',spiritSeer:'通灵师',guard:'守卫',mechanicalWolf:'机械狼',armoredWolf:'装甲狼',mixer:'混血儿'};
