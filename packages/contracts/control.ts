import {z} from 'zod';
export interface GameControl {
 status:'running'|'paused'|'resuming';version:number;remainingMs:number|null;resumeAt:number|null;serverNow:number;tempSeat:number|null;reconnecting:boolean;
 voteDefaults?:{seconds:number;visibility:'individual'|'totals'};
}
const base={confirmed:z.literal(true),version:z.number().int().min(0)};
export const controlSchema=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('pause')}).strict(),
 z.object({...base,action:z.literal('resume')}).strict(),
 z.object({...base,action:z.literal('delegate'),seat:z.number().int().min(1).max(256).nullable()}).strict(),
 z.object({...base,action:z.literal('defaults'),voteSeconds:z.number().int().min(5).max(300),voteVisibility:z.enum(['individual','totals'])}).strict()
]);
export type ControlCommand=z.infer<typeof controlSchema>;
export interface FutureVoteDefaults {version:number;seconds:number;visibility:'individual'|'totals'}
