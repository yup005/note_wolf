import {z} from 'zod';
import {nightCommandSchema,type NightPrivate,type NightPublic} from './night.js';
import {dayCommandSchema,type DayPrivate,type DayPublic} from './day.js';
import type {Role} from './index.js';
import type {EnginePlayer} from './engine.js';
import type {RecordDocument} from './records.js';
const version=z.number().int().nonnegative(),seat=z.number().int().min(1).max(256);
export const judgeAppointSchema=z.object({confirmed:z.literal(true),version,seat:seat.nullable(),deathSkillsComplete:z.literal(true).optional()}).strict();
export const judgeDraftSchema=z.object({assignmentVersion:version,manualVersion:version,requestId:z.string().uuid()}).strict();
const draftFields={...judgeDraftSchema.shape,draftId:z.string().uuid(),draftVersion:version};
export const judgeSupplementSchema=z.object({...draftFields,operation:z.discriminatedUnion('kind',[
 z.object({kind:z.literal('masquerade-knife'),target:seat.nullable()}).strict(),
 z.object({kind:z.literal('masquerade'),actorSeat:seat,command:nightCommandSchema,source:z.enum(['manual','draft','random'])}).strict(),
 z.object({kind:z.literal('night'),actorSeat:seat,command:nightCommandSchema}).strict(),
 z.object({kind:z.literal('day'),actorSeat:seat,command:dayCommandSchema}).strict(),
 z.object({kind:z.literal('advance')}).strict(),z.object({kind:z.literal('enter-night')}).strict(),z.object({kind:z.literal('enter-day')}).strict()
])}).strict();
export const judgeReturnSchema=z.object({...draftFields,confirmed:z.literal(true)}).strict();
export type JudgeAppoint=z.infer<typeof judgeAppointSchema>;
export type JudgeDraftCommand=z.infer<typeof judgeDraftSchema>;
export type JudgeSupplement=z.infer<typeof judgeSupplementSchema>;
export type JudgeReturn=z.infer<typeof judgeReturnSchema>;
export interface JudgePublic {seat:number|null;version:number;candidates:number[]}
export interface JudgeDraft {id:string;version:number;manualVersion:number;assignmentVersion:number;kind:'night'|'day';round:number;phase:string;turnId:string}
export interface JudgePrivate {
 masquerade?:import('./masquerade.js').MasqueradeState;
 confession?:import('./engine.js').EngineState['confession'];
 assignmentVersion:number;manualVersion:number|null;
 roles:{seat:number;role:Role;alive:boolean;inventory?:{antidote?:boolean;poison?:boolean;hunterSpent?:boolean};abilities?:EnginePlayer['abilities'];learning?:EnginePlayer['learning'];model?:EnginePlayer['model']}[];
 night:NightPublic|null;day:DayPublic|null;
 cards:{seat:number;night:NightPrivate|null;day:DayPrivate|null}[];
 history:{kind:'night'|'day';round:number;events:import('./game.js').GameEvent[];nightDetails?:{masquerade?:import('./masquerade.js').MasqueradeState;knife:number|null;witchChoice:{choice:'save'|'poison'|'skip';target:number|null}|null;seerCheck:{target:number;result:'good'|'wolf'}|null;hunterSeen:boolean;actions?:import('./engine.js').NightAction[]}}[];
 official:RecordDocument;draft:JudgeDraft|null;
 audit:{at:number;operatorSeat:number|null;action:string}[];
}
