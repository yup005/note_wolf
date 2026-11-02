import {z} from 'zod';

// This catalog is for the new domain foundation, not the public playable Role contract.
export const boardRoleSchema=z.enum(['wolf','villager','seer','witch','hunter','idiot','spiritSeer','guard','mechanicalWolf','armoredWolf','mixer','blackWolf','whiteWolf','wolfGirl','poisoner','dancer','mask','treasureMaster','dreamer','masked']);
export type BoardRole=z.infer<typeof boardRoleSchema>;
export const isSharedWolfRole=(role:BoardRole)=>role==='wolf'||role==='blackWolf'||role==='whiteWolf'||role==='wolfGirl';
export const isWolfRole=(role:BoardRole)=>isSharedWolfRole(role)||role==='mechanicalWolf'||role==='armoredWolf'||role==='mask';
export const isRepeatableRole=(role:BoardRole)=>['wolf','blackWolf','whiteWolf','villager'].includes(role);
export const rulesetSchema=z.enum(['standard','mechanical-seer','mechanical-armor','wolf-girl','masquerade','treasure','puppet']);
export type Ruleset=z.infer<typeof rulesetSchema>;
export const idiotPolicySchema=z.enum(['standard','dual-category-14']);
// Keep the persisted policy ID compatible with existing fourteen-player games.
export const supportsDualIdiot=(idiotCount:number|undefined)=>idiotCount===1;
export type IdiotPolicy=z.infer<typeof idiotPolicySchema>;
export const standardRoleCounts={wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1} as const;
export const boardCompositionSchema=z.object({
 variant:z.literal('puppet').optional(),
 seatCount:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
 roles:z.partialRecord(boardRoleSchema,z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
 treasureMode:z.enum(['fixed-wolf','random']).optional(),
 idiotPolicy:idiotPolicySchema.optional()
}).strict().refine(config=>Object.values(config.roles).reduce((sum,count)=>sum+count,0)===config.seatCount)
 .refine(config=>Object.entries(config.roles).every(([role,count])=>isRepeatableRole(role as BoardRole)||count!<=1))
 .refine(config=>config.idiotPolicy!=='dual-category-14'||supportsDualIdiot(config.roles.idiot));
export type BoardComposition=z.infer<typeof boardCompositionSchema>;
export interface BoardConfiguration extends BoardComposition {ruleset:Ruleset;playable:boolean}

export const boardRuleVersion='2026-10-10-v1' as const;
export const systemPresetIdSchema=z.enum(['standard-12','mechanical-12','mechanical-armor-12','wolf-girl-12','masquerade-12','treasure-12','puppet-12']);
export type SystemPresetId=z.infer<typeof systemPresetIdSchema>;
// Service capability limit, not a gameplay rule; the domain supports larger compositions.
export const serviceCompositionSchema=boardCompositionSchema.refine(value=>value.seatCount<=256);
export const boardSaveSchema=z.object({id:z.string().uuid().nullable(),revision:z.number().int().nonnegative(),name:z.string().trim().min(1).max(60),composition:serviceCompositionSchema}).strict();
export type BoardSave=z.infer<typeof boardSaveSchema>;
export const boardSelectionSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('preset'),id:systemPresetIdSchema,treasureMode:z.enum(['fixed-wolf','random']).optional()}).strict(),
 z.object({kind:z.literal('custom'),id:z.string().uuid()}).strict(),
 z.object({kind:z.literal('composition'),composition:serviceCompositionSchema}).strict()
]);
export const boardConfigureSchema=z.object({selection:boardSelectionSchema,settingsRevision:z.number().int().nonnegative()}).strict();
export type BoardConfigure=z.infer<typeof boardConfigureSchema>;
export interface BoardTemplate {id:string;name:string;revision:number;ruleVersion:typeof boardRuleVersion;composition:BoardConfiguration}
export interface BoardLibrary {presets:BoardTemplate[];custom:BoardTemplate[]}
export interface RoomBoardSnapshot {id:string;name:string;ruleVersion:typeof boardRuleVersion;composition:{variant?:'puppet';seatCount:number;roleCounts:BoardComposition['roles'];ruleset:Ruleset;playable:boolean;idiotPolicy?:IdiotPolicy;treasureMode?:TreasureMode}}
export const boardRoleLabels:Record<BoardRole,string>={dancer:'舞者',mask:'假面',wolf:'狼人',villager:'村民',seer:'预言家',witch:'女巫',hunter:'猎人',idiot:'白痴',spiritSeer:'通灵师',guard:'守卫',mechanicalWolf:'机械狼',armoredWolf:'装甲狼',mixer:'混血儿',blackWolf:'黑狼王',whiteWolf:'白狼王',wolfGirl:'狼女孩',poisoner:'毒师',treasureMaster:'盗宝大师',dreamer:'摄梦人',masked:'蒙面人'};

export type TreasureMode='fixed-wolf'|'random';
