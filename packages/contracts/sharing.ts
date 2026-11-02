import {z} from 'zod';
import type {RecordDocument,RecordOutcome,RecordOutcomeSource,OfficialUpdate} from './records.js';
import type {Role} from './index.js';
export const shareTokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const shareCommandSchema=z.object({action:z.enum(['create','regenerate','revoke']),revision:z.number().int().min(0)}).strict();
export type ShareCommand=z.infer<typeof shareCommandSchema>;
export interface ShareStatus {state:'none'|'active'|'paused'|'revoked'|'withdrawn';revision:number;token:string|null;canCreate:boolean}
export interface OwnShare {recordId:string;code:string;author:string;official:boolean;status:ShareStatus}
export interface SharedRecord {puppet?:import('./records.js').PuppetDisclosure;code:string;author:string;official:boolean;version:number;publishedAt:number;document:RecordDocument;outcome:RecordOutcome;outcomeSource?:RecordOutcomeSource;officialUpdate?:OfficialUpdate;roles:{seat:number;role:Role}[]}
