import type Database from 'better-sqlite3';
import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {ZodType} from 'zod';
import {LobbyError} from '../contracts/index.js';
import {adminQuerySchema,adminExportSchema,adminShareRevokeSchema,type AdminFilter,type AdminQuery,type AdminKind,type AdminAuditItem,type AdminReportGroup,type AdminShareItem,type AdminPage,type AdminExport} from '../contracts/admin.js';
import type {AuthStore,AdminAccountChange} from './auth.js';
const parse=<T>(schema:ZodType<T>,value:unknown):T=>{const p=schema.safeParse(value);if(!p.success)throw new LobbyError('INVALID_INPUT');return p.data;};
// These are named metadata projections. Never select source body/document/token columns here.
const projections={
 reports:`SELECT c.id commentId,c.version commentVersion,a.nickname author,r.code roomCode,MAX(p.at) latestAt,COUNT(DISTINCT p.reporter_id) reportCount,SUM(p.status='open') openCount,SUM(p.status='reviewed') reviewedCount,CASE WHEN SUM(p.status='open')>0 THEN 'open' ELSE 'reviewed' END status FROM community_reports p JOIN community_comments c ON c.id=p.comment_id JOIN accounts a ON a.id=c.account_id JOIN record_rooms r ON r.room_id=c.room_id GROUP BY c.id`,
 audit:`SELECT 'admin:'||o.id id,o.at,o.operator,o.subject,o.action,o.reason,CASE WHEN o.before_value IS NULL AND o.after_value IS NULL THEN NULL ELSE COALESCE(o.before_value,'')||' → '||COALESCE(o.after_value,'') END detail FROM admin_operations o UNION ALL SELECT 'community:'||u.id id,u.at,a.nickname operator,COALESCE(t.nickname,'') subject,u.action,u.reason,CASE WHEN u.comment_id IS NULL THEN NULL ELSE 'comment '||u.comment_id END detail FROM community_audit u JOIN accounts a ON a.id=u.operator_id LEFT JOIN accounts t ON t.id=u.account_id`,
 shares:`SELECT d.id recordId,a.nickname author,r.code,d.published_version version,l.revision,l.updated_at updatedAt,CASE WHEN l.revoked=1 THEN 'revoked' WHEN a.status<>'active' OR COALESCE(v.enabled,0)=0 OR (v.expires_at IS NOT NULL AND v.expires_at<=@now) THEN 'paused' WHEN d.withdrawn=1 THEN 'withdrawn' ELSE 'active' END state FROM record_share_links l JOIN record_drafts d ON d.id=l.record_id JOIN record_rooms r ON r.room_id=d.room_id JOIN accounts a ON a.id=l.account_id LEFT JOIN vip_entitlements v ON v.account_id=a.id WHERE r.ended=1 AND d.published_version IS NOT NULL AND d.deleted=0`
};
type Data={reports:AdminReportGroup;audit:AdminAuditItem;shares:AdminShareItem};
const atColumn={reports:'latestAt',audit:'at',shares:'updatedAt'},idColumn={reports:'commentId',audit:'id',shares:'recordId'};
interface Cursor {bind:string;at:number;id:string}
export class AdminOversightStore {
 private key:Buffer;
 constructor(private db:Database.Database,private auth:AuthStore,private now:()=>number,private message:(accountId:string,body:string)=>void){
  db.exec(`CREATE TABLE IF NOT EXISTS admin_operations(id TEXT PRIMARY KEY,at INTEGER NOT NULL,operator_id TEXT NOT NULL,operator TEXT NOT NULL,subject_id TEXT NOT NULL,subject TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,before_value TEXT,after_value TEXT);
   CREATE INDEX IF NOT EXISTS admin_operation_time ON admin_operations(at DESC,id DESC);
   CREATE TABLE IF NOT EXISTS admin_revoke_receipts(admin_id TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(admin_id,request_id));
   CREATE TABLE IF NOT EXISTS admin_oversight_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO admin_oversight_settings VALUES (?,?)').run('cursor-key',randomBytes(32).toString('hex'));
  this.key=Buffer.from((db.prepare('SELECT value FROM admin_oversight_settings WHERE key=?').get('cursor-key') as {value:string}).value,'hex');
 }
 accountChange(change:AdminAccountChange){this.log(change.operatorId,change.operator,change.subjectId,change.subject,change.action,'',change.before,change.after);}
 private log(operatorId:string,operator:string,subjectId:string,subject:string,action:string,reason:string,before:string|null,after:string|null){
  this.db.prepare('INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),this.now(),operatorId,operator,subjectId,subject,action,reason,before,after);
 }
 private filter(kind:AdminKind,q:AdminFilter):AdminFilter{
  if(kind==='audit'?q.status!==undefined:q.action!==undefined)throw new LobbyError('INVALID_INPUT');
  if(kind==='reports'&&q.status!==undefined&&!['open','reviewed'].includes(q.status)||kind==='shares'&&q.status!==undefined&&!['active','paused','withdrawn','revoked'].includes(q.status))throw new LobbyError('INVALID_INPUT');
  // Fixed property order also binds cursors across equivalent query key orderings.
  return {...(q.q?{q:q.q}:{}),...(q.from===undefined?{}:{from:q.from}),...(q.to===undefined?{}:{to:q.to}),...(q.action===undefined?{}:{action:q.action}),...(q.status===undefined?{}:{status:q.status})};
 }
 private encode(c:Cursor){const b=Buffer.from(JSON.stringify(c)).toString('base64url');return b+'.'+createHmac('sha256',this.key).update(b).digest('hex');}
 private decode(value:string,bind:string):Cursor{
  try{const [b,s,...rest]=value.split('.');if(rest.length||!b||!s||! /^[a-f0-9]{64}$/.test(s)||!timingSafeEqual(Buffer.from(s,'hex'),createHmac('sha256',this.key).update(b).digest()))throw 0;
   const c=JSON.parse(Buffer.from(b,'base64url').toString());if(c.bind!==bind||!Number.isSafeInteger(c.at)||typeof c.id!=='string')throw 0;return c;
  }catch{throw new LobbyError('INVALID_INPUT');}
 }
 private select<K extends AdminKind>(kind:K,filter:AdminFilter,limit:number,cursor?:Cursor):Data[K][]{
  const where:string[]=[],args:Record<string,string|number>={max:limit};const at=atColumn[kind],id=idColumn[kind];
  if(kind==='shares')args.now=Date.now();
  if(filter.q){where.push(kind==='audit'?'(instr(subject,@q)>0 OR instr(operator,@q)>0)':'instr(author,@q)>0');args.q=filter.q;}
  if(filter.from!==undefined){where.push(`${at}>=@from`);args.from=filter.from;}
  if(filter.to!==undefined){where.push(`${at}<@to`);args.to=filter.to;}
  if(filter.action){where.push('action=@action');args.action=filter.action;}
  if(filter.status){where.push(`${kind==='shares'?'state':'status'}=@status`);args.status=filter.status;}
  if(cursor){where.push(`(${at}<@at OR (${at}=@at AND ${id}<@id))`);args.at=cursor.at;args.id=cursor.id;}
  return this.db.prepare(`SELECT * FROM (${projections[kind]}) ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY ${at} DESC,${id} DESC LIMIT @max`).all(args) as Data[K][];
 }
 private list<K extends AdminKind>(token:string,kind:K,input:unknown):AdminPage<Data[K]>{
  this.auth.requireAdmin(token);const q:AdminQuery=parse(adminQuerySchema,input),filter=this.filter(kind,q),bind=JSON.stringify([kind,filter]),cursor=q.cursor?this.decode(q.cursor,bind):undefined,limit=q.limit??20;
  const rows=this.select(kind,filter,limit+1,cursor),items=rows.slice(0,limit),last=items.at(-1) as unknown as Record<string,string|number>|undefined;
  return {items,nextCursor:rows.length>limit&&last?this.encode({bind,at:last[atColumn[kind]] as number,id:last[idColumn[kind]] as string}):null};
 }
 reports(token:string,input:unknown={}){return this.list(token,'reports',input);}
 audit(token:string,input:unknown={}){return this.list(token,'audit',input);}
 shares(token:string,input:unknown={}){return this.list(token,'shares',input);}
 export(token:string,input:unknown):AdminExport{
  this.auth.requireAdmin(token);const c=parse(adminExportSchema,input),filter=this.filter(c.kind,c.filter),rows=this.select(c.kind,filter,5001);
  if(rows.length>5000)throw new LobbyError('EXPORT_TOO_LARGE',409);
  const columns:Record<AdminKind,string[]>={reports:['commentId','commentVersion','author','roomCode','latestAt','reportCount','openCount','reviewedCount','status'],audit:['id','at','operator','subject','action','reason','detail'],shares:['recordId','author','code','version','revision','updatedAt','state']};
  const quote=(value:unknown)=>{let s=value===null||value===undefined?'':String(value);if(/^[\s\p{Cc}\p{Cf}]*[=+\-@]/u.test(s)||/^[\s\p{Cc}\p{Cf}]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const keys=columns[c.kind];return {filename:`admin-${c.kind}.csv`,csv:'\uFEFF'+[keys.map(quote).join(','),...rows.map(row=>keys.map(k=>quote((row as unknown as Record<string,unknown>)[k])).join(','))].join('\r\n')+'\r\n',count:rows.length};
 }
 revoke(token:string,input:unknown){
  return this.db.transaction(()=>{
   this.auth.requireAdmin(token);const admin=this.auth.requireAccount(token),c=parse(adminShareRevokeSchema,input);if(c.expectedAdminId!==admin.id)throw new LobbyError('UNAUTHORIZED',401);
   const payload=JSON.stringify(c),old=this.db.prepare('SELECT payload FROM admin_revoke_receipts WHERE admin_id=? AND request_id=?').get(admin.id,c.requestId) as {payload:string}|undefined;
   if(old){if(old.payload!==payload)throw new LobbyError('INVALID_INPUT');return {applied:true as const};}
   const row=this.db.prepare(`SELECT l.account_id,l.revision,l.revoked,a.nickname FROM record_share_links l JOIN record_drafts d ON d.id=l.record_id JOIN record_rooms r ON r.room_id=d.room_id JOIN accounts a ON a.id=l.account_id WHERE l.record_id=? AND r.ended=1 AND d.published_version IS NOT NULL AND d.deleted=0`).get(c.recordId) as {account_id:string;revision:number;revoked:number;nickname:string}|undefined;
   if(!row)throw new LobbyError('NOT_FOUND',404);if(row.revision!==c.revision)throw new LobbyError('STALE_SHARE',409);
   if(!row.revoked){
    this.db.prepare('UPDATE record_share_links SET revoked=1,revision=revision+1,updated_at=? WHERE record_id=?').run(this.now(),c.recordId);
    this.log(admin.id,admin.nickname,row.account_id,row.nickname,'share-revoke',c.reason,'record '+c.recordId+'; revision '+row.revision,'revoked');
    this.message(row.account_id,`公开分享链接已撤销：${c.reason}`);
   }
   this.db.prepare('INSERT INTO admin_revoke_receipts VALUES (?,?,?)').run(admin.id,c.requestId,payload);return {applied:true as const};
  }).immediate();
 }
}
