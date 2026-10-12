import {z} from 'zod';
export type NightPhase='awaiting_host'|'wolves'|'eyes_closed'|'witch'|'seer'|'hunter'|'first_night_complete'|'mechanical_authority'|'guard'|'mechanical'|'armor'|'spiritSeer'|'mixer'|'rules_pending';
export interface NightPublic {night:number;phase:NightPhase;turnId:string;deadline:number|null;serverNow:number;alive:number[]}
export interface NightPrivate {
 turnId:string;kind:'waiting'|'wolves'|'witch'|'seer'|'hunter'|'mechanical_authority'|'guard'|'mechanical'|'armor'|'spiritSeer'|'mixer';
 canLearn?:boolean;learnedRole?:import('./index.js').Role|null;inheritedKnife?:boolean;
 skills?:{kind:'guard'|'poison'|'inspect'|'extra-knife';remaining:number|null;available:boolean}[];
 legalTargets?:number[];inspectionRole?:import('./index.js').Role;modelSeat?:number;
 learningReceipt?:{role:import('./index.js').Role;civilianEasterEgg?:{text:string;emphasis:string;color:'red'}};
 votes?:{seat:number;target:number|null}[];wolves?:number[];confirmer?:number;myVote?:number|null;
 priorityWolf?:number|null;priorityTarget?:number|null;priorityCommitted?:boolean;
 knife?:number|null;antidote?:boolean;poison?:boolean;committed?:boolean;choice?:'save'|'poison'|'skip';target?:number|null;
 skillReceipt?:{role:'seer'|'hunter';target?:number;result?:'good'|'wolf';canShoot?:boolean};
 witchReceipt?:{choice:'save'|'poison'|'skip';target:number|null};
 result?:'good'|'wolf';canShoot?:boolean|null;seen?:boolean;
}
const target=z.number().int().min(1).max(256);
export const nightCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('ability'),turnId:z.string().uuid(),choice:z.enum(['learn','guard','poison','inspect','extra-knife','skip']),target:target.nullable()}).strict(),
 z.object({action:z.literal('ability_finish'),turnId:z.string().uuid()}).strict(),
 z.object({action:z.literal('mixer'),turnId:z.string().uuid(),target}).strict(),
 z.object({action:z.literal('authority_seen'),turnId:z.string().uuid()}).strict(),
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
