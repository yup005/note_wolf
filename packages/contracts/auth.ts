import {z} from 'zod';
export interface Account {id:string;username:string;nickname:string;role:'user'|'admin';status:'active'|'disabled';createdAt:number;vip?:{active:boolean;expiresAt:number|null}}
export const credentialsSchema=z.object({username:z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/).transform(s=>s.toLowerCase()),password:z.string().min(8).max(128)}).strict();
export const registerSchema=credentialsSchema.extend({nickname:z.string().trim().min(1).max(24)}).strict();
export const userStatusSchema=z.object({status:z.enum(['active','disabled'])}).strict();
export const vipSchema=z.object({enabled:z.boolean(),expiresAt:z.number().int().positive().nullable()}).strict();
