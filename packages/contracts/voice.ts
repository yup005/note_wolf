import {z} from 'zod';
export interface VoiceCue {key:string;text:string}
export interface VoiceFrame {skillResults:{key:string;seat:number;activated:boolean;at:number}[];scope:string;stage:string;cues:VoiceCue[];current:VoiceCue|null;deathInquiry:number|null;hunterTarget:boolean;ended:boolean}
export interface VoiceResponse {revision:number;serverNow:number;leaseUntil:number;scope:string;cues:VoiceCue[];current:VoiceCue|null}
export const voiceCommandSchema=z.object({action:z.enum(['claim','poll','release','replay']),clientId:z.string().uuid()}).strict();
export type VoiceCommand=z.infer<typeof voiceCommandSchema>;
