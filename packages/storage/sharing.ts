import type Database from 'better-sqlite3';
import {randomBytes} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {shareCommandSchema,shareTokenSchema,type ShareCommand,type ShareStatus,type SharedRecord,type OwnShare} from '../contracts/sharing.js';
import type {AuthStore} from './auth.js';
import {officialUpdate} from './officialUpdate.js';
interface Post {id:string;owner:string;published_version:number|null;withdrawn:number;ended:number}
interface Link {record_id:string;account_id:string;token:string;revoked:number;revision:number;updated_at:number}
export class SharingStore {
 constructor(private db:Database.Database,private auth:AuthStore,private now:()=>number){
  db.exec(`CREATE TABLE IF NOT EXISTS record_share_links(record_id TEXT PRIMARY KEY REFERENCES record_drafts(id),account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,token TEXT NOT NULL UNIQUE CHECK(length(token)=64),revoked INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL); PRAGMA user_version=14;`);
 }
 private owner(token:string,recordId:string){
  const account=this.auth.account(token);if(!account)throw new LobbyError('LOGIN_REQUIRED',403);
  const post=this.db.prepare('SELECT d.id,d.owner,d.published_version,d.withdrawn,r.ended FROM record_drafts d JOIN record_rooms r ON r.room_id=d.room_id WHERE d.id=?').get(recordId) as Post|undefined;
  if(!post||post.owner!=='account:'+account.id)throw new LobbyError('SHARE_AUTHOR_ONLY',403);
  return {account,post};
 }
 private link(id:string){return this.db.prepare('SELECT * FROM record_share_links WHERE record_id=?').get(id) as Link|undefined;}
 private project(activeVip:boolean,post:Post,link:Link|undefined):ShareStatus{
  const published=!!post.ended&&post.published_version!==null&&!post.withdrawn;
  return {state:!link?'none':link.revoked?'revoked':!activeVip?'paused':!published?'withdrawn':'active',revision:link?.revision??0,token:link?.token??null,canCreate:activeVip&&published};
 }
 status(token:string,id:string):ShareStatus{
  const {account,post}=this.owner(token,id);return this.project(!!account.vip?.active,post,this.link(id));
 }
 list(token:string):OwnShare[]{
  const account=this.auth.account(token);if(!account)throw new LobbyError('LOGIN_REQUIRED',403);
  // Archive metadata only: management must survive withdrawn bodies and deleted rooms.
  const rows=this.db.prepare(`SELECT d.id,d.owner,d.author,d.official,d.published_version,d.withdrawn,r.ended,r.code,l.*
   FROM record_share_links l JOIN record_drafts d ON d.id=l.record_id JOIN record_rooms r ON r.room_id=d.room_id
   WHERE l.account_id=? AND d.owner=? ORDER BY l.updated_at DESC,d.id`).all(account.id,'account:'+account.id) as (Post&Link&{code:string;author:string;official:number})[];
  return rows.map(r=>({recordId:r.id,code:r.code,author:r.author,official:!!r.official,status:this.project(!!account.vip?.active,r,r)}));
 }
 command(token:string,id:string,input:ShareCommand):ShareStatus{
  const parsed=shareCommandSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const c=parsed.data;
  return this.db.transaction(()=>{
   const {account,post}=this.owner(token,id),link=this.link(id);
   if(c.action!=='revoke'){
    if(!account.vip?.active)throw new LobbyError('VIP_ONLY',403);
    if(!post.ended||post.published_version===null||post.withdrawn)throw new LobbyError('SHARE_UNPUBLISHED',409);
    if(c.action==='create'&&link){if(link.revoked)throw new LobbyError('SHARE_REVOKED',409);return this.status(token,id);}
   }
   if((link?.revision??0)!==c.revision)throw new LobbyError('STALE_SHARE',409);
   if(c.action==='revoke'){
    if(!link)throw new LobbyError('NOT_FOUND',404);
    if(!link.revoked)this.db.prepare('UPDATE record_share_links SET revoked=1,revision=revision+1,updated_at=? WHERE record_id=?').run(this.now(),id);
   }else{
    if(c.action==='regenerate'&&!link)throw new LobbyError('NOT_FOUND',404);
    const secret=randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO record_share_links VALUES (?,?,?,0,?,?) ON CONFLICT(record_id) DO UPDATE SET token=excluded.token,revoked=0,revision=excluded.revision,updated_at=excluded.updated_at').run(id,account.id,secret,(link?.revision??0)+1,this.now());
   }
   return this.status(token,id);
  }).immediate();
 }
 read(token:string):SharedRecord{
  const unavailable=()=>new LobbyError('SHARE_UNAVAILABLE',404);if(!shareTokenSchema.safeParse(token).success)throw unavailable();
  // Explicit projection: never read draft text, participant owners, or automatic secret events.
  const r=this.db.prepare(`SELECT d.room_id,d.author,d.official,d.published_version AS version,v.document,v.outcome,COALESCE(src.source,'computed') AS outcomeSource,v.published_at AS publishedAt,r.code,r.roles
   FROM record_share_links l JOIN accounts a ON a.id=l.account_id JOIN vip_entitlements vip ON vip.account_id=a.id
   JOIN record_drafts d ON d.id=l.record_id JOIN record_rooms r ON r.room_id=d.room_id
   JOIN record_versions v ON v.record_id=d.id AND v.version=d.published_version
   LEFT JOIN record_version_sources src ON src.record_id=v.record_id AND src.version=v.version
   WHERE l.token=? AND l.revoked=0 AND a.status='active' AND vip.enabled=1 AND (vip.expires_at IS NULL OR vip.expires_at>?)
   AND d.withdrawn=0 AND r.ended=1 AND d.owner='account:'||a.id`).get(token,Date.now()) as {room_id:string;author:string;official:number;version:number;document:string;outcome:SharedRecord['outcome'];outcomeSource:SharedRecord['outcomeSource'];publishedAt:number;code:string;roles:string}|undefined;
  if(!r)throw unavailable();return {code:r.code,author:r.author,official:!!r.official,version:r.version,publishedAt:r.publishedAt,document:JSON.parse(r.document),outcome:r.outcome,outcomeSource:r.outcomeSource,...(r.official?{officialUpdate:officialUpdate(this.db,r.room_id)}:{}),roles:JSON.parse(r.roles)};
 }
}
