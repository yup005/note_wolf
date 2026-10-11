import {z} from 'zod';
export type NightPhase='awaiting_host'|'wolves'|'eyes_closed'|'witch'|'seer'|'hunter'|'first_night_complete';
export interface NightPublic {night:number;phase:NightPhase;turnId:string;deadline:number|null;serverNow:number;alive:number[]}
export interface NightPrivate {
 turnId:string;kind:'waiting'|'wolves'|'witch'|'seer'|'hunter';
 votes?:{seat:number;target:number|null}[];wolves?:number[];confirmer?:number;myVote?:number|null;
 priorityWolf?:number|null;priorityTarget?:number|null;priorityCommitted?:boolean;
 knife?:number|null;antidote?:boolean;poison?:boolean;committed?:boolean;choice?:'save'|'poison'|'skip';target?:number|null;
 skillReceipt?:{role:'seer'|'hunter';target?:number;result?:'good'|'wolf';canShoot?:boolean};
 witchReceipt?:{choice:'save'|'poison'|'skip';target:number|null};
 result?:'good'|'wolf';canShoot?:boolean|null;seen?:boolean;
}
const target=z.number().int().min(1).max(12);
export const nightCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('vote'),turnId:z.string().uuid(),target:target.nullable()}).strict(),
 z.object({action:z.literal('confirm_wolves'),turnId:z.string().uuid()}).strict(),
 z.object({action:z.literal('priority_knife'),turnId:z.string().uuid(),target:target.nullable()}).strict(),
 z.object({action:z.literal('witch'),turnId:z.string().uuid(),choice:z.enum(['save','poison','skip']),target:target.nullable()}).strict(),
 z.object({action:z.literal('seer'),turnId:z.string().uuid(),target}).strict(),
 z.object({action:z.literal('seer_finish'),turnId:z.string().uuid()}).strict(),
 z.object({action:z.literal('hunter_seen'),turnId:z.string().uuid()}).strict()
]);
export type NightCommand=z.infer<typeof nightCommandSchema>;
export const beginNightSchema=z.object({turnId:z.string().uuid()}).strict();
