import {z} from 'zod';
import type {Role} from './index.js';
export type DayPhase='awaiting_host'|'sheriff_signup'|'sheriff_speech'|'sheriff_withdraw'|'vote_setup'|'voting'|'vote_result'|'night_announcement'|'death_skill'|'hunter_target'|'white_wolf_target'|'last_words'|'badge_transfer'|'day_direction'|'day_speech'|'free_speech'|'day_complete'|'ended'|'rules_pending';
export type VotePurpose='sheriff'|'sheriff_pk'|'exile'|'exile_pk';
export interface DayVoteResult {purpose:VotePurpose;counts:{seat:number;votes:number}[];ballots?:{seat:number;target:number|null}[];leaders:number[]}
export interface DayPublic {
 skillResults?:{key:string;seat:number;activated:boolean;at:number}[];
 day:number;phase:DayPhase;turnId:string;deadline:number|null;serverNow:number;alive:number[];dead:number[];
 interjection?:{seat:number;originalSpeaker:number}|null;
 speechMode:'phone'|'free'|null;direction:'ascending'|'descending'|null;speechStart:number|null;nightDeaths:number[];
 signupCount:number;sheriff:number|null;badge:'available'|'elected'|'lost'|'deferred';candidates:number[];originalCandidates:number[];speaker:number|null;currentDeath:number|null;
 vote:null|{purpose:VotePurpose;method:'phone'|'offline';visibility:'individual'|'totals';eligible:number[];candidates:number[];submittedCount:number};
 result:DayVoteResult|null;announcement:number[]|null;revealed:{seat:number;role:Role}[];winner:'wolves'|'good'|null;reason:string|null;
}
export interface DayPrivate {turnId:string;seat:number;canSignup:boolean;signup:boolean|null;canWithdraw:boolean;canVote:boolean;voted:boolean;myVote:number|null;canShoot:boolean;canExplode:boolean;canEndSpeech:boolean;canTransfer:boolean;canInterject?:boolean;canEndInterjection?:boolean;interjectionRemainingMs?:number;mixerModel?:{seat:number}}
export interface DaySelf {turnId:string;seat:number;role:Role;learnedRole:Role|null;modelSeat:number|null;idiotRevealed:boolean|null;skills:{kind:'poison'|'antidote'|'guard'|'inspect'|'shot'|'extra-knife'|'explode-take';remaining:number|null;availableFromNight:number}[]}
const turn=z.string().uuid();const seat=z.number().int().min(1).max(256);
export const dayCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),turnId:turn}).strict(),
 z.object({action:z.literal('signup'),turnId:turn,join:z.boolean()}).strict(),
 z.object({action:z.literal('close_signup'),turnId:turn}).strict(),
 z.object({action:z.literal('withdraw'),turnId:turn}).strict(),
 z.object({action:z.literal('end_speech'),turnId:turn}).strict(),
 z.object({action:z.literal('interject'),turnId:turn}).strict(),
 z.object({action:z.literal('end_interjection'),turnId:turn}).strict(),
 z.object({action:z.literal('close_withdraw'),turnId:turn}).strict(),
 z.object({action:z.literal('start_vote'),turnId:turn,method:z.enum(['phone','offline']),visibility:z.enum(['individual','totals']),seconds:z.number().int().min(5).max(300)}).strict(),
 z.object({action:z.literal('vote'),turnId:turn,target:seat.nullable()}).strict(),
 z.object({action:z.literal('offline_vote'),turnId:turn,voter:seat,target:seat.nullable()}).strict(),
 z.object({action:z.literal('offline_ballots'),turnId:turn,ballots:z.array(z.object({seat,target:seat.nullable()}).strict()).min(1).max(256)}).strict(),
 z.object({action:z.literal('offline_results'),turnId:turn,counts:z.array(z.object({seat,votes:z.number().finite().min(0).max(256.5).multipleOf(0.5)}).strict()).min(1).max(256)}).strict(),
 z.object({action:z.literal('close_vote'),turnId:turn}).strict(),
 z.object({action:z.literal('continue'),turnId:turn}).strict(),
 z.object({action:z.literal('shoot'),turnId:turn}).strict(),
 z.object({action:z.literal('record_shot'),turnId:turn,target:seat}).strict(),
 z.object({action:z.literal('record_take'),turnId:turn,target:seat}).strict(),
 z.object({action:z.literal('transfer_badge'),turnId:turn,target:seat.nullable(),takeover:z.boolean().optional()}).strict(),
 z.object({action:z.literal('speech_mode'),turnId:turn,mode:z.enum(['phone','free','ordered'])}).strict(),
 z.object({action:z.literal('direction'),turnId:turn,direction:z.enum(['ascending','descending']),start:seat.optional()}).strict(),
 z.object({action:z.literal('explode'),turnId:turn,confirmed:z.literal(true)}).strict()
]);
export type DayCommand=z.infer<typeof dayCommandSchema>;
export interface FirstDayRules {winTiming:'after_election'|'before_election'|null;preAnnouncementEligibility:'all'|null;explosionOrder:'announce_resolve_words_night'|null;exilePkEligibility:'all_alive'|'excluding_candidates'|null;zeroVotes:'no_result'|'pk'|null;explosionLock:'during_vote'|'after_any_vote'|null}
// Confirmed directly by the user; remaining vote boundaries are deliberately unresolved.
export const firstDayRules:FirstDayRules={winTiming:'after_election',preAnnouncementEligibility:'all',explosionOrder:'announce_resolve_words_night',exilePkEligibility:'excluding_candidates',zeroVotes:'no_result',explosionLock:'during_vote'};
