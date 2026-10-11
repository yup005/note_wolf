import {z} from 'zod';
import {boardRoleSchema} from './board.js';

const positive=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const charges=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
export const useSchema=z.object({requestId:z.string().min(1),night:positive,target:positive.nullable()}).strict();
export const skillSchema=z.object({
 id:z.string().min(1),kind:z.enum(['poison','antidote','guard','inspect','shot','extra-knife']),
 capacity:charges,remaining:charges,availableFromNight:positive,
 parameters:z.record(z.string(),z.json()),lastTarget:positive.nullable().optional(),
 copiedFrom:z.object({seat:positive,skillId:z.string().min(1),night:positive}).strict().nullable(),
 uses:z.array(useSchema)
}).strict().refine(skill=>(skill.capacity===null&&skill.remaining===null)||
 (skill.capacity!==null&&skill.remaining!==null&&skill.remaining<=skill.capacity));
export const snapshotSchema=z.object({ownerSeat:positive,originalRole:boardRoleSchema,mimickedRole:boardRoleSchema.nullable(),skills:z.array(skillSchema)}).strict()
 .refine(snapshot=>new Set(snapshot.skills.map(skill=>skill.id)).size===snapshot.skills.length);
export const copyMetadataSchema=z.object({copyId:z.string().min(1),ownerSeat:positive,originalRole:boardRoleSchema,night:positive,availableFromNight:positive}).strict()
 .refine(copy=>copy.availableFromNight>=copy.night);
export type SkillSnapshot=z.infer<typeof snapshotSchema>;
export type SkillUse=z.infer<typeof useSchema>;
export type CopyMetadata=z.infer<typeof copyMetadataSchema>;
