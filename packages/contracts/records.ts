import {z} from 'zod';
import {seatSchema,type Role} from './index.js';
const round=z.number().int().min(1).max(100);
export const deathCauses={knife:'狼刀',poison:'毒杀',exile:'放逐',shot:'猎人射杀',explosion:'自爆',unrecorded:'未记录'} as const;
export const recordDocumentSchema=z.object({
 deaths:z.array(z.object({seat:seatSchema,round,period:z.enum(['night','day']),cause:z.enum(['knife','poison','exile','shot','explosion','unrecorded'])}).strict()).max(256),
 badges:z.array(z.object({round,seat:seatSchema.nullable()}).strict()).max(100),
 exiles:z.array(z.object({round,seat:seatSchema.nullable()}).strict()).max(100),
 votes:z.array(z.object({round,kind:z.enum(['sheriff','exile']),ballots:z.array(z.object({voter:seatSchema,target:seatSchema.nullable()}).strict()).max(256)}).strict()).max(100),
 notes:z.string().max(2000)
}).strict().superRefine((d,c)=>{
 if(new Set(d.deaths.map(x=>x.seat)).size!==d.deaths.length)c.addIssue({code:'custom',message:'重复死亡座位'});
 for(const vote of d.votes)if(new Set(vote.ballots.map(x=>x.voter)).size!==vote.ballots.length)c.addIssue({code:'custom',message:'重复投票者'});
});
export type RecordDocument=z.infer<typeof recordDocumentSchema>;
export const emptyRecord=():RecordDocument=>({deaths:[],badges:[],exiles:[],votes:[],notes:''});
export const recordSaveSchema=z.object({revision:z.number().int().min(0),document:recordDocumentSchema}).strict();
export const recordRevisionSchema=z.object({revision:z.number().int().min(0)}).strict();
export const manualSwitchSchema=z.object({confirmed:z.literal(true)}).strict();
export const manualResolveSchema=z.object({version:z.number().int().min(0),hostRevision:z.number().int().min(0),accept:z.boolean()}).strict();
export const manualAdjudicateSchema=z.object({confirmed:z.literal(true),version:z.number().int().min(0),revision:z.number().int().min(0),winner:z.enum(['wolves','good'])}).strict();
export type ManualAdjudicate=z.infer<typeof manualAdjudicateSchema>;
export type RecordOutcomeSource='computed'|'host-adjudicated';
export type RecordOutcome='wolves'|'good'|null;
export interface RecordDraft {id:string;revision:number;document:RecordDocument;publishedVersion:number|null;withdrawn:boolean;official:boolean;shareManage:boolean}
export interface RecordPostSummary {id:string;code:string;author:string;official:boolean;version:number;withdrawn:boolean;publishedAt:number}
export interface RecordPost extends RecordPostSummary {document:RecordDocument;outcome:RecordOutcome;outcomeSource?:RecordOutcomeSource;roles:{seat:number;role:Role}[];versions:number[];saved:boolean;shareAccess:{manage:boolean;create:boolean}}
export interface RecordList {canRecord:boolean;own:RecordDraft|null;posts:RecordPostSummary[]}
export interface RecordFavorite extends RecordPostSummary {savedAt:number;board?:import('./favorites.js').FavoriteBoard|null}
export interface ManualPublic {status:'playing'|'pending'|'ended';version:number;dead:number[];winner:RecordOutcome;outcomeSource?:RecordOutcomeSource;revealed:{seat:number;role:Role}[]}
export interface OfficialRevision {version:number;at:number;document:RecordDocument;outcome:RecordOutcome;outcomeSource?:RecordOutcomeSource}
