import type Database from 'better-sqlite3';
import {createHash,randomBytes,randomUUID,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {LobbyError} from '../contracts/index.js';
import type {Account} from '../contracts/auth.js';
const derive=promisify(scrypt);
export const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
type Row={id:string;username:string;nickname:string;role:'user'|'admin';status:'active'|'disabled';created_at:number;password_hash:string;salt:string};
const publicAccount=(r:Row):Account=>({id:r.id,username:r.username,nickname:r.nickname,role:r.role,status:r.status,createdAt:r.created_at});
export class AuthStore {
 constructor(private db:Database.Database){
  db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,nickname TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','admin')),status TEXT NOT NULL CHECK(status IN ('active','disabled')),created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS vip_entitlements(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,enabled INTEGER NOT NULL,expires_at INTEGER);
   CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON accounts(role) WHERE role='admin';`);
  if(!(db.prepare('PRAGMA table_info(sessions)').all() as {name:string}[]).some(c=>c.name==='account_id'))db.exec('ALTER TABLE sessions ADD COLUMN account_id TEXT REFERENCES accounts(id)');
  db.pragma('user_version = 10');
 }
 private public(r:Row):Account{const v=this.db.prepare('SELECT enabled,expires_at FROM vip_entitlements WHERE account_id=?').get(r.id) as {enabled:number;expires_at:number|null}|undefined;return {...publicAccount(r),vip:{active:!!v?.enabled&&(v.expires_at===null||v.expires_at>Date.now()),expiresAt:v?.expires_at??null}};}
 setVip(token:string,id:string,enabled:boolean,expiresAt:number|null){this.requireAdmin(token);if(!this.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(id))throw new LobbyError('NOT_FOUND',404);if(enabled&&expiresAt!==null&&expiresAt<=Date.now())throw new LobbyError('INVALID_INPUT');this.db.prepare('INSERT INTO vip_entitlements VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled,expires_at=excluded.expires_at').run(id,enabled?1:0,expiresAt);return {id,enabled,expiresAt};}
 account(token:string):Account|null{const r=this.db.prepare('SELECT a.* FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.session_hash=? AND a.status=\'active\'').get(sessionHash(token)) as Row|undefined;return r?this.public(r):null;}
 owner(token:string){const a=this.account(token);return a?'account:'+a.id:sessionHash(token);}
 requireAdmin(token:string){if(this.account(token)?.role!=='admin')throw new LobbyError('ADMIN_ONLY',403);}
 adminExists(){return !!this.db.prepare("SELECT 1 FROM accounts WHERE role='admin'").get();}
 async createAccount(username:string,password:string,nickname:string,role:'user'|'admin'='user'){
  const salt=randomBytes(16).toString('hex');const hash=await derive(password,salt,64) as Buffer;
  const row:Row={id:randomUUID(),username:username.toLowerCase(),nickname,password_hash:hash.toString('hex'),salt,role,status:'active',created_at:Date.now()};
  try{this.db.prepare('INSERT INTO accounts VALUES (@id,@username,@nickname,@password_hash,@salt,@role,@status,@created_at)').run(row);}catch(e){if(this.db.prepare('SELECT 1 FROM accounts WHERE username=?').get(row.username))throw new LobbyError('USERNAME_TAKEN',409);if(role==='admin'&&this.db.prepare("SELECT 1 FROM accounts WHERE role='admin'").get())throw new LobbyError('ADMIN_EXISTS',409);throw e;}
  return this.public(row);
 }
 async register(token:string,username:string,password:string,nickname:string){
  if(this.account(token))throw new LobbyError('ALREADY_LOGGED_IN',409);
  const account=await this.createAccount(username,password,nickname);
  try{return this.link(token,account);}catch(e){this.db.prepare('DELETE FROM accounts WHERE id=?').run(account.id);throw e;}
 }
 async login(token:string,username:string,password:string){
  const row=this.db.prepare('SELECT * FROM accounts WHERE username=?').get(username.toLowerCase()) as Row|undefined;
  // Unknown names still run the same password derivation.
  const hash=await derive(password,row?.salt??'0'.repeat(32),64) as Buffer;
  if(!row||!timingSafeEqual(hash,Buffer.from(row.password_hash,'hex')))throw new LobbyError('LOGIN_FAILED',401);
  const fresh=this.db.prepare('SELECT * FROM accounts WHERE id=?').get(row.id) as Row;
  if(fresh.status!=='active')throw new LobbyError('ACCOUNT_DISABLED',403);
  const current=this.account(token);if(current&&current.id!==row.id)throw new LobbyError('ALREADY_LOGGED_IN',409);
  return this.link(token,this.public(fresh));
 }
 private link(token:string,account:Account){return this.db.transaction(()=>{
  if(!this.db.prepare('SELECT 1 FROM sessions WHERE session_hash=?').get(sessionHash(token)))throw new LobbyError('UNAUTHORIZED',401);
  const old=this.owner(token),owner='account:'+account.id;
  if(old!==owner){
   const guests=this.db.prepare('SELECT * FROM members WHERE session_hash=?').all(old) as {id:string;room_id:string;seat:number|null;is_host:number}[];
   for(const guest of guests){const existing=this.db.prepare('SELECT * FROM members WHERE room_id=? AND session_hash=?').get(guest.room_id,owner) as typeof guest|undefined;
    if(existing){if(guest.seat!==null&&existing.seat!==null)throw new LobbyError('ACCOUNT_ROOM_CONFLICT',409);
     const keep=guest.seat!==null?guest:existing.seat!==null?existing:guest.is_host?guest:existing;const discard=keep===guest?existing:guest;
     if(this.db.prepare('SELECT 1 FROM identities WHERE member_id=?').get(discard.id))throw new LobbyError('ACCOUNT_ROOM_CONFLICT',409);
     this.db.prepare('UPDATE members SET is_host=? WHERE id=?').run(guest.is_host||existing.is_host,keep.id);
     this.db.prepare('DELETE FROM members WHERE id=?').run(discard.id);
     this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(guest.room_id);
    }
   }
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='record_drafts'").get()){
    if(this.db.prepare('SELECT 1 FROM record_drafts g JOIN record_drafts a ON a.room_id=g.room_id AND a.owner=? WHERE g.owner=?').get(owner,old))throw new LobbyError('RECORD_ACCOUNT_CONFLICT',409);
    this.db.prepare('UPDATE record_drafts SET owner=? WHERE owner=?').run(owner,old);
    for(const r of this.db.prepare('SELECT room_id,participants FROM record_rooms').all() as {room_id:string;participants:string}[]){const p=JSON.parse(r.participants) as string[];if(p.includes(old))this.db.prepare('UPDATE record_rooms SET participants=? WHERE room_id=?').run(JSON.stringify([...new Set(p.map(x=>x===old?owner:x))]),r.room_id);}
    this.db.prepare('UPDATE record_rooms SET host_owner=? WHERE host_owner=?').run(owner,old);
    this.db.prepare('INSERT OR IGNORE INTO record_favorites SELECT ?,record_id,saved_at FROM record_favorites WHERE owner=?').run(owner,old);this.db.prepare('DELETE FROM record_favorites WHERE owner=?').run(old);
   }
   this.db.prepare('UPDATE members SET session_hash=? WHERE session_hash=?').run(owner,old);
   if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='board_templates'").get())this.db.prepare('UPDATE board_templates SET owner=? WHERE owner=?').run(owner,old);
   this.db.prepare('INSERT OR IGNORE INTO create_requests SELECT ?,request_id,room_id FROM create_requests WHERE session_hash=?').run(owner,old);this.db.prepare('DELETE FROM create_requests WHERE session_hash=?').run(old);
   this.db.prepare('INSERT OR IGNORE INTO saved_replays SELECT ?,room_id,code,winner,saved_at,record FROM saved_replays WHERE owner_hash=?').run(owner,old);this.db.prepare('DELETE FROM saved_replays WHERE owner_hash=?').run(old);
  }
  const next=randomBytes(32).toString('hex');this.db.prepare('DELETE FROM sessions WHERE session_hash=? OR account_id=?').run(sessionHash(token),account.id);this.db.prepare('INSERT INTO sessions(session_hash,created_at,account_id) VALUES (?,?,?)').run(sessionHash(next),Date.now(),account.id);
  return {token:next,account};
 }).immediate();}
 logout(token:string){this.db.prepare('DELETE FROM sessions WHERE session_hash=?').run(sessionHash(token));const next=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO sessions(session_hash,created_at) VALUES (?,?)').run(sessionHash(next),Date.now());return next;}
 users(token:string){this.requireAdmin(token);return (this.db.prepare('SELECT * FROM accounts ORDER BY created_at DESC,id').all() as Row[]).map(r=>this.public(r));}
 setStatus(token:string,id:string,status:'active'|'disabled'){
  this.requireAdmin(token);const user=this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id) as Row|undefined;if(!user)throw new LobbyError('NOT_FOUND',404);if(user.role==='admin')throw new LobbyError('ADMIN_PROTECTED',409);
  this.db.transaction(()=>{this.db.prepare('UPDATE accounts SET status=? WHERE id=?').run(status,id);if(status==='disabled')this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(id);}).immediate();return {id,status};
 }
}
