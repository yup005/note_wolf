import {z} from 'zod';
import {LobbyError} from '../contracts/index.js';

import {snapshotSchema,useSchema,copyMetadataSchema,type SkillSnapshot,type SkillUse,type CopyMetadata} from '../contracts/abilities.js';
export type {SkillSnapshot,SkillUse,CopyMetadata} from '../contracts/abilities.js';

function parse<T>(schema:z.ZodType<T>,input:unknown):T{
 const result=schema.safeParse(input);if(!result.success)throw new LobbyError('INVALID_SKILL_STATE');return result.data;
}

// Generic skill-instance copy. Role-specific eligibility/timing belongs to the ruleset caller.
export function copySkills(source:SkillSnapshot,metadata:CopyMetadata):SkillSnapshot{
 const snapshot=parse(snapshotSchema,source);const copy=parse(copyMetadataSchema,metadata);
 return {ownerSeat:copy.ownerSeat,originalRole:copy.originalRole,mimickedRole:snapshot.mimickedRole??snapshot.originalRole,
  skills:snapshot.skills.map(skill=>({...skill,id:`${copy.copyId}:${skill.id}`,remaining:skill.capacity,
   availableFromNight:copy.availableFromNight,lastTarget:null,copiedFrom:{seat:snapshot.ownerSeat,skillId:skill.id,night:copy.night},uses:[]}))};
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
 skill.lastTarget=use.target;skill.uses.push(use);return next;
}
