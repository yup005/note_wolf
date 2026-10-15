import {z} from 'zod';
export type AdminAuditAction='vip'|'status'|'share-revoke'|'dismiss'|'delete'|'warn'|'mute'|'unmute';
export interface AdminFilter {q?:string;from?:number;to?:number;action?:AdminAuditAction;status?:'open'|'reviewed'|'active'|'paused'|'withdrawn'|'revoked'}
export interface AdminAuditItem {id:string;at:number;operator:string;subject:string;action:AdminAuditAction;reason:string;detail:string|null}
export interface AdminReportGroup {commentId:string;commentVersion:number;author:string;roomCode:string;latestAt:number;reportCount:number;openCount:number;reviewedCount:number;status:'open'|'reviewed'}
export interface AdminShareItem {recordId:string;author:string;code:string;version:number;revision:number;updatedAt:number;state:'active'|'paused'|'withdrawn'|'revoked'}
export interface AdminPage<T> {items:T[];nextCursor:string|null}
export interface AdminExport {filename:string;csv:string;count:number}
export interface AdminShareRevoke {requestId:string;expectedAdminId:string;recordId:string;revision:number;confirmed:true;reason:string}
export type AdminKind='reports'|'audit'|'shares';
export type AdminQuery=AdminFilter&{cursor?:string;limit?:number};
const uint=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text=(max:number)=>z.string().trim().refine(s=>Array.from(s).length<=max);
const shape={q:text(80).optional(),from:uint.optional(),to:uint.optional(),action:z.enum(['vip','status','share-revoke','dismiss','delete','warn','mute','unmute']).optional(),status:z.enum(['open','reviewed','active','paused','withdrawn','revoked']).optional()};
const dates=(c:AdminFilter)=>c.from===undefined||c.to===undefined||c.from<c.to;
export const adminFilterSchema=z.object(shape).strict().refine(dates);
const wireUint=z.union([uint,z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(uint)]);
export const adminQuerySchema=z.object({...shape,from:wireUint.optional(),to:wireUint.optional(),cursor:z.string().min(1).max(4096).optional(),limit:wireUint.pipe(z.number().min(1).max(50)).optional()}).strict().refine(dates);
export const adminExportSchema=z.object({kind:z.enum(['reports','audit','shares']),filter:adminFilterSchema}).strict();
export const adminShareRevokeSchema=z.object({requestId:z.string().uuid(),expectedAdminId:z.string().uuid(),recordId:z.string().uuid(),revision:uint,confirmed:z.literal(true),reason:text(500).refine(s=>s.length>0)}).strict();
