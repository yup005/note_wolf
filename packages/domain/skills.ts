import {z} from 'zod';
import {LobbyError} from '../contracts/index.js';
import {boardRoleSchema} from '../contracts/board.js';

const positive=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const charges=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
const useSchema=z.object({requestId:z.string().min(1),night:positive,target:positive.nullable()}).strict();
const skillSchema=z.object({
 id:z.string().min(1),kind:z.enum(['poison','antidote','guard','inspect','shot','extra-knife']),
 capacity:charges,remaining:charges,availableFromNight:positive,
 parameters:z.record(z.string(),z.union([z.string(),z.number().finite(),z.boolean()])),
 copiedFrom:z.object({seat:positive,skillId:z.string().min(1),night:positive}).strict().nullable(),
 uses:z.array(useSchema)
}).strict().refine(skill=>(skill.capacity===null&&skill.remaining===null)||
 (skill.capacity!==null&&skill.remaining!==null&&skill.remaining<=skill.capacity));
const snapshotSchema=z.object({ownerSeat:positive,originalRole:boardRoleSchema,mimickedRole:boardRoleSchema.nullable(),skills:z.array(skillSchema)}).strict()
 .refine(snapshot=>new Set(snapshot.skills.map(skill=>skill.id)).size===snapshot.skills.length);
const copyMetadataSchema=z.object({copyId:z.string().min(1),ownerSeat:positive,originalRole:boardRoleSchema,night:positive,availableFromNight:positive}).strict()
 .refine(copy=>copy.availableFromNight>=copy.night);
export type SkillSnapshot=z.infer<typeof snapshotSchema>;
export type SkillUse=z.infer<typeof useSchema>;
export type CopyMetadata=z.infer<typeof copyMetadataSchema>;

function parse<T>(schema:z.ZodType<T>,input:unknown):T{
 const result=schema.safeParse(input);if(!result.success)throw new LobbyError('INVALID_SKILL_STATE');return result.data;
}

// Generic skill-instance copy. Role-specific eligibility/timing belongs to the ruleset caller.
export function copySkills(source:SkillSnapshot,metadata:CopyMetadata):SkillSnapshot{
 const snapshot=parse(snapshotSchema,source);const copy=parse(copyMetadataSchema,metadata);
 return {ownerSeat:copy.ownerSeat,originalRole:copy.originalRole,mimickedRole:snapshot.mimickedRole??snapshot.originalRole,
  skills:snapshot.skills.map(skill=>({...skill,id:`${copy.copyId}:${skill.id}`,remaining:skill.capacity,
   availableFromNight:copy.availableFromNight,copiedFrom:{seat:snapshot.ownerSeat,skillId:skill.id,night:copy.night},uses:[]}))};
}

export function useSkill(snapshot:SkillSnapshot,skillId:string,command:SkillUse,eligibility?:{inheritedWolfKnife:boolean}):SkillSnapshot{
 const next=parse(snapshotSchema,snapshot);const use=parse(useSchema,command);
 const skill=next.skills.find(skill=>skill.id===skillId);
 if(!skill)throw new LobbyError('SKILL_NOT_FOUND',409);
 const previous=skill.uses.find(entry=>entry.requestId===use.requestId);
 if(previous){
  if(previous.night!==use.night||previous.target!==use.target)throw new LobbyError('ALREADY_COMMITTED',409);
  return next;
 }
 if(use.night<skill.availableFromNight)throw new LobbyError('SKILL_NOT_ACTIVE',409);
 // Knife authority comes from the server's night-start ruleset, never from a public command.
 if(skill.kind==='extra-knife'&&eligibility?.inheritedWolfKnife!==true)throw new LobbyError('KNIFE_NOT_INHERITED',409);
 if(skill.remaining===0)throw new LobbyError('SKILL_EXHAUSTED',409);
 if(skill.remaining!==null)skill.remaining--;
 skill.uses.push(use);return next;
}
