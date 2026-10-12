import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {shareTokenSchema} from '../contracts/sharing.js';
import type {AuthStore} from './auth.js';
import type {SharingStore} from './sharing.js';
import type {FavoriteSource} from './favorites.js';
interface Entry {id:string;owner:string;record_id:string;share_token:string;saved_at:number;code:string;author:string;official:number;board_metadata:string|null}
export class SharedFavoritesStore{
 constructor(private db:Database.Database,private auth:AuthStore,private sharing:SharingStore,private now:()=>number){
  db.exec(`CREATE TABLE IF NOT EXISTS shared_record_favorites(id TEXT PRIMARY KEY,owner TEXT NOT NULL,record_id TEXT NOT NULL REFERENCES record_drafts(id),share_token TEXT NOT NULL CHECK(length(share_token)=64),saved_at INTEGER NOT NULL,code TEXT NOT NULL,author TEXT NOT NULL,official INTEGER NOT NULL,board_metadata TEXT,UNIQUE(owner,share_token));`);
 }
 private owner(token:string){this.auth.requireAccount(token);return this.auth.owner(token);}
 status(token:string|undefined,share:string){
  if(!shareTokenSchema.safeParse(share).success)throw new LobbyError('SHARE_UNAVAILABLE',404);
  const account=token?this.auth.account(token):null;
  const entry=account?this.db.prepare('SELECT id FROM shared_record_favorites WHERE owner=? AND share_token=?').get(this.auth.owner(token!),share) as {id:string}|undefined:undefined;
  return {account:account??null,saved:!!entry,id:entry?.id??null};
 }
 save(token:string,share:string){
  const owner=this.owner(token);
  return this.db.transaction(()=>{
   // The original bearer link is the only authority, including for idempotent saves.
   const post=this.sharing.read(share);
   const target=this.db.prepare('SELECT l.record_id,r.board_metadata FROM record_share_links l JOIN record_drafts d ON d.id=l.record_id JOIN record_rooms r ON r.room_id=d.room_id WHERE l.token=?').get(share) as {record_id:string;board_metadata:string|null};
   this.db.prepare('INSERT OR IGNORE INTO shared_record_favorites VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),owner,target.record_id,share,this.now(),post.code,post.author,post.official?1:0,target.board_metadata);
   const entry=this.db.prepare('SELECT id FROM shared_record_favorites WHERE owner=? AND share_token=?').get(owner,share) as {id:string};return {saved:true,id:entry.id};
  }).immediate();
 }
 read(token:string,id:string){
  const entry=this.db.prepare('SELECT share_token FROM shared_record_favorites WHERE owner=? AND id=?').get(this.owner(token),id) as {share_token:string}|undefined;
  if(!entry)throw new LobbyError('NOT_FOUND',404);return this.sharing.read(entry.share_token);
 }
 sources(token:string):FavoriteSource[]{
  if(!this.auth.account(token))return [];
  const entries=this.db.prepare('SELECT * FROM shared_record_favorites WHERE owner=? ORDER BY saved_at DESC,id').all(this.auth.owner(token)) as Entry[];
  return entries.map(entry=>{
   let available=true,searchText='',detail='分享链接暂不可用';
   try{const post=this.sharing.read(entry.share_token);searchText=JSON.stringify(post.document);detail=`分享 · 版本 ${post.version} · 已发布`;}catch(error){if(!(error instanceof LobbyError&&error.code==='SHARE_UNAVAILABLE'))throw error;available=false;}
   return {kind:'share',id:entry.id,code:entry.code,author:entry.author,title:`房间 ${entry.code} · ${entry.official?'官方':entry.author} · 分享`,savedAt:entry.saved_at,board:entry.board_metadata?JSON.parse(entry.board_metadata):null,available,detail,searchText};
  });
 }
 remove(token:string,id:string){const result=this.db.prepare('DELETE FROM shared_record_favorites WHERE owner=? AND id=?').run(this.owner(token),id);return {saved:false,removed:result.changes>0};}
}
