import {z} from 'zod';
import type {VotePurpose} from './day.js';
export const displayTokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const displayCommandSchema=z.object({action:z.enum(['create','rotate','revoke']),revision:z.number().int().min(0),confirmed:z.literal(true)}).strict();
export type DisplayCommand=z.infer<typeof displayCommandSchema>;
export interface DisplayStatus {enabled:boolean;token:string|null;revision:number}
export interface DisplaySnapshot {
 roomCode:string;gameNumber:number;seatCount:number;serverNow:number;
 phase:{kind:'preparation'|'night'|'day'|'manual'|'ended';label:string;round:number|null};
 status:'running'|'paused'|'resuming';speaker:number|null;dead:number[];winner:'wolves'|'good'|null;
 timer:{milliseconds:number;running:boolean}|null;
 vote:null|{purpose:VotePurpose;counts:{seat:number;votes:number}[];ballots?:{seat:number;target:number|null}[]};
}
