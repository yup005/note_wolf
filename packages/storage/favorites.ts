import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import {favoriteQuerySchema,favoriteNameSchema,type FavoriteQuery,type FavoriteName,type FavoriteItem,type FavoriteKind,type FavoriteLibrary} from '../contracts/favorites.js';
import type {AuthStore} from './auth.js';
export type FavoriteSource=Omit<FavoriteItem,'customName'|'nameRevision'>&{searchText:string};
export class FavoriteLibraryStore{
 constructor(private db:Database.Database,private auth:AuthStore,private sources:(token:string)=>FavoriteSource[]){
  db.transaction(()=>{
   const old=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='favorite_names'").get() as {sql:string}|undefined;
   if(old&&!old.sql.includes("'share'"))db.exec('ALTER TABLE favorite_names RENAME TO favorite_names_legacy');
   db.exec("CREATE TABLE IF NOT EXISTS favorite_names(owner TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('game','record','share')),target_id TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(owner,kind,target_id));");
   if(old&&!old.sql.includes("'share'"))db.exec('INSERT INTO favorite_names SELECT * FROM favorite_names_legacy; DROP TABLE favorite_names_legacy');
  }).immediate();
 }
 private vip(token:string){if(!this.auth.account(token)?.vip?.active)throw new LobbyError('VIP_ONLY',403);}
 private name(token:string,kind:FavoriteKind,id:string){return this.db.prepare('SELECT name,revision FROM favorite_names WHERE owner=? AND kind=? AND target_id=?').get(this.auth.owner(token),kind,id) as {name:string;revision:number}|undefined;}
 view(token:string,input:Partial<FavoriteQuery>={}):FavoriteLibrary{
  const parsed=favoriteQuerySchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const q=parsed.data;
  const advanced=this.auth.account(token)?.vip?.active===true;
  if(q.q||q.board||q.author||q.from!==undefined||q.to!==undefined||q.sort!=='saved-desc')this.vip(token);
  const sources=this.sources(token),boards=[...new Map(sources.filter(s=>s.board).map(s=>[s.board!.id,s.board!])).values()],authors=[...new Set(sources.map(s=>s.author).filter(Boolean))].sort();
  const items=sources.flatMap(s=>{
   const name=this.name(token,s.kind,s.id),title=name?.name||s.title;
   if(q.board&&(s.board?.id??'unknown')!==q.board||q.author&&s.author!==q.author||q.from!==undefined&&s.savedAt<q.from||q.to!==undefined&&s.savedAt>q.to)return [];
   const searchable=[title,s.title,s.code,s.author,s.board?.name??'',s.available?s.searchText:''].join(' ').toLocaleLowerCase('zh-CN');
   if(q.q&&!searchable.includes(q.q.toLocaleLowerCase('zh-CN')))return [];
   return [{kind:s.kind,id:s.id,code:s.code,author:s.author,title,customName:name?.name||null,nameRevision:name?.revision??0,savedAt:s.savedAt,board:s.board,available:s.available,detail:s.detail}];
  }).sort((a,b)=>(q.sort==='saved-asc'?a.savedAt-b.savedAt:b.savedAt-a.savedAt)||(`${a.kind}:${a.id}`<`${b.kind}:${b.id}`?-1:`${a.kind}:${a.id}`>`${b.kind}:${b.id}`?1:0));
  return {advanced,items,boards,authors};
 }
 rename(token:string,kind:FavoriteKind,id:string,input:FavoriteName){
  const parsed=favoriteNameSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');this.vip(token);
  return this.db.transaction(()=>{
   if(!this.sources(token).some(s=>s.kind===kind&&s.id===id))throw new LobbyError('NOT_FOUND',404);
   const current=this.name(token,kind,id),{name,revision}=parsed.data;
   if((current?.revision??0)!==revision)throw new LobbyError('STALE_FAVORITE',409);
   this.db.prepare('INSERT INTO favorite_names VALUES (?,?,?,?,?) ON CONFLICT(owner,kind,target_id) DO UPDATE SET name=excluded.name,revision=excluded.revision').run(this.auth.owner(token),kind,id,name,revision+1);
   return {customName:name||null,nameRevision:revision+1};
  }).immediate();
 }
 clearName(token:string,kind:FavoriteKind,id:string){
  // Keep the revision tombstone so a stale editor cannot rename a removed/re-added favorite.
  this.db.prepare('INSERT INTO favorite_names VALUES (?,?,?,\'\',1) ON CONFLICT(owner,kind,target_id) DO UPDATE SET name=\'\',revision=revision+1').run(this.auth.owner(token),kind,id);
 }
}
