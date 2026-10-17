import {z} from 'zod';
const seat=z.number().int().min(1).max(256).nullable();
export const managementStateSchema=z.object({
 phase:z.enum(['preparation','night','day','manual','ended']),round:z.number().int().positive().nullable(),
 version:z.number().int().nonnegative(),status:z.enum(['running','paused','resuming']),tempSeat:seat,
 voteSeconds:z.number().int().min(5).max(300),voteVisibility:z.enum(['individual','totals']),
 sheriff:seat,badge:z.enum(['available','elected','lost','deferred']).nullable()
}).strict();
export type ManagementState=z.infer<typeof managementStateSchema>;
export const managementActionSchema=z.enum(['pause','resume','delegate','defaults','badge-takeover']);
export type ManagementAction=z.infer<typeof managementActionSchema>;
export const managementQuerySchema=z.object({before:z.string().regex(/^[1-9][0-9]{0,15}$/).refine(v=>Number.isSafeInteger(Number(v))).optional()}).strict();
export interface ManagementHistoryEntry {id:string;at:number;operator:{seat:number|null;nickname:string};action:ManagementAction;before:ManagementState;after:ManagementState}
export interface ManagementHistoryPage {items:ManagementHistoryEntry[];next:string|null}
