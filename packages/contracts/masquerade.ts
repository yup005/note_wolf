import {z} from 'zod';
const seat=z.number().int().min(1).max(256);
export const masqueradeHistorySchema=z.object({night:z.number().int().positive(),actor:seat,target:seat,id:z.string().min(1),source:z.enum(['manual','draft','random'])}).strict();
export const masqueradeStateSchema=z.object({version:z.literal(1),danced:z.array(masqueradeHistorySchema),inspected:z.array(masqueradeHistorySchema),masked:z.array(masqueradeHistorySchema),pool:z.array(seat).max(3),mask:seat.nullable(),penalties:z.array(z.object({seat,reason:z.enum(['dance-repeat','inspect-repeat','mask-repeat']),id:z.string()}).strict())}).strict();
export type MasqueradeState=z.infer<typeof masqueradeStateSchema>;
export interface MasqueradeReceipt {target:number|null;source:'manual'|'draft'|'random'|'skipped';inPool?:boolean}
export interface MasqueradePrivate {
 danceRevision?:number;maskRevision?:number;draft?:number[];pool?:number[];poolSource?:'manual'|'draft'|'random'|'skipped';cannotDance?:boolean;
 canSkip?:boolean;step?:'inspect'|'mask'|'done';inspectDraft?:number|null;maskDraft?:number|null;inspection?:MasqueradeReceipt;mask?:MasqueradeReceipt;penalized?:boolean;
}
export interface MasqueradeRuntime {
 schedule:import('./night.js').NightPhase[];index:number;alive:number[];shared:number[];inherited:number|null;
 danceDraft:number[];danceRevision:number;danceDone:boolean;poolSource?:MasqueradePrivate['poolSource'];
 inspectDraft:number|null;maskDraft:number|null;maskRevision:number;inspection?:MasqueradeReceipt;mask?:MasqueradeReceipt;
 requests:Record<string,{seat:number;payload:string}>;locked:Record<number,{turnId:string;action:string;target:number|null;choice?:string}>;
}
