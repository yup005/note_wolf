import {z} from 'zod';
import {boardRoleSchema,rulesetSchema,boardRuleVersion,boardCompositionSchema} from './board.js';
import {snapshotSchema,skillSchema} from './abilities.js';
const seat=z.number().int().positive().max(256),id=z.string().min(1).max(200),night=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const camp=z.enum(['wolves','good']);
export const engineBoardSchema=z.object({id,name:z.string(),ruleVersion:z.literal(boardRuleVersion),composition:z.object({seatCount:seat,roleCounts:boardCompositionSchema.shape.roles,ruleset:rulesetSchema,playable:z.boolean()}).strict()}).strict();
export const engineSeedSchema=z.object({seat,role:boardRoleSchema,knifeGroup:z.enum(['shared','mechanical','armor','none'])}).strict();
export const enginePlayerSchema=engineSeedSchema.extend({
 camp:camp.nullable(),alive:z.boolean(),abilities:snapshotSchema,
 publicState:z.object({revealedRole:boardRoleSchema.nullable(),canVote:z.boolean(),canInterject:z.boolean()}).strict(),
 learning:z.object({copyId:id,sourceSeat:seat,night,at:z.number().finite().nonnegative().nullable(),sourceSnapshot:snapshotSchema,copyProfileSnapshot:snapshotSchema.optional()}).strict().nullable(),
 model:z.object({seat,camp}).strict().nullable()
}).strict();
export const abilityTypeSchema=z.enum(['wolf-knife',...skillSchema.shape.kind.options]);
export const nightActionCommandSchema=z.object({id,requestId:id,casterId:seat,targetId:seat.nullable(),abilityId:id.nullable(),abilityType:abilityTypeSchema,stage:id,at:z.number().finite().nonnegative()}).strict();
const inspectionSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('visible'),role:boardRoleSchema}).strict(),
 z.object({status:z.literal('camp'),camp}).strict()
]);
export const nightActionSchema=nightActionCommandSchema.extend({night,sourceRole:boardRoleSchema,ruleset:rulesetSchema,privateInspection:inspectionSchema.optional()}).strict();
export const effectSchema=z.object({id,actionId:id,casterId:seat,targetId:seat.nullable(),abilityType:abilityTypeSchema,sourceRole:boardRoleSchema,ruleset:rulesetSchema,night,outcome:z.enum(['killed','prevented','no-effect']),reflectTarget:seat.nullable(),preventedBy:z.array(id)}).strict();
export const resolutionDecisionSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('blocked'),reason:z.enum(['unimplemented','product-decision']),questionIds:z.array(id).min(1)}).strict(),
 z.object({status:z.literal('settled'),effects:z.array(effectSchema)}).strict()
]);
export const victorySchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('playing')}).strict(),
 z.object({status:z.literal('unresolved'),questionId:id}).strict(),
 z.object({status:z.literal('ended'),winner:camp,reason:z.enum(['all-villagers-dead','all-gods-dead','all-wolves-dead','mixer-dead-one-villager','mixer-last-civilian']),personalResults:z.array(z.object({seat,won:z.boolean()}).strict()).optional()}).strict()
]);
export const resolutionSchema=z.discriminatedUnion('status',[
 resolutionDecisionSchema.options[0],
 resolutionDecisionSchema.options[1].extend({deaths:z.array(z.object({seat,sourceEffectIds:z.array(id).min(1)}).strict())}).strict()
]);
// Internal only: never include this schema in public room, voice or admin projections.
export const engineStateSchema=z.object({formatVersion:z.literal(1),board:engineBoardSchema,night,stage:z.enum(['collecting','awaiting-resolution','resolved','awaiting-decision','ended']),players:z.array(enginePlayerSchema),actions:z.array(nightActionSchema),resolution:resolutionSchema.nullable(),victory:victorySchema}).strict();
export type EngineState=z.infer<typeof engineStateSchema>;
export type EnginePlayer=z.infer<typeof enginePlayerSchema>;
export type EngineSeed=z.infer<typeof engineSeedSchema>;
export type NightActionCommand=z.infer<typeof nightActionCommandSchema>;
export type NightAction=z.infer<typeof nightActionSchema>;
export type NightEffect=z.infer<typeof effectSchema>;
export type ResolutionDecision=z.infer<typeof resolutionDecisionSchema>;
