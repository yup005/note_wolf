import type Database from 'better-sqlite3';
import {LobbyError,type RoomSettings,type PreparationState,type PrivateIdentity,type PublicSeat,type Role,settingsSchema,roleSchema} from '../contracts/index.js';
import {assertCanDeal,createDeck,rolesMatchBoard} from '../domain/preparation.js';
import {boardPreset,assertPlayableBoard} from '../domain/boardConfig.js';
import type {BoardConfiguration} from '../contracts/board.js';
export interface MemberRow {id:string;room_id:string;nickname:string;is_host:number;is_manager?:boolean;seat:number|null;ready:number}
interface PreparationRow {settings_revision:number;phase:PreparationState['phase'];deal_method:RoomSettings['dealMethod'];game_mode:RoomSettings['gameMode']}
export class PreparationStore{
 constructor(private db:Database.Database,private member:(token:string,id:string)=>MemberRow,private seats:(id:string)=>PublicSeat[],private board:(id:string)=>BoardConfiguration=()=>boardPreset('standard-12')){}
 private row(id:string):PreparationRow{
  const row=this.db.prepare('SELECT * FROM preparations WHERE room_id=?').get(id) as PreparationRow|undefined;
  if(!row)throw new LobbyError('ROOM_NOT_FOUND',404);return row;
 }
 private host(token:string,id:string){const m=this.member(token,id);if(!m.is_host)throw new LobbyError('HOST_ONLY',403);return m;}
 private seated(token:string,id:string){const m=this.member(token,id);if(m.seat===null)throw new LobbyError('NOT_SEATED',409);return m;}
 assertLobby(id:string){if(this.row(id).phase!=='lobby')throw new LobbyError('PHASE_LOCKED',409);}
 private bump(id:string){this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);}
 configure(token:string,id:string,settings:RoomSettings){
  const parsed=settingsSchema.safeParse(settings);if(!parsed.success)throw new LobbyError('INVALID_INPUT');
  this.db.transaction(()=>{this.host(token,id);this.assertLobby(id);const r=this.row(id);
   if(r.deal_method===settings.dealMethod&&r.game_mode===settings.gameMode)return;
   this.db.prepare('UPDATE preparations SET deal_method=?,game_mode=?,settings_revision=settings_revision+1 WHERE room_id=?').run(settings.dealMethod,settings.gameMode,id);
   this.db.prepare('UPDATE members SET ready=0 WHERE room_id=?').run(id);this.bump(id);
  }).immediate();
 }
 setReady(token:string,id:string,ready:boolean,settingsRevision:number){
  if(typeof ready!=='boolean')throw new LobbyError('INVALID_INPUT');
  this.db.transaction(()=>{const m=this.seated(token,id);this.assertLobby(id);
   if(!Number.isSafeInteger(settingsRevision)||settingsRevision!==this.row(id).settings_revision)throw new LobbyError('SETTINGS_CHANGED',409);
   if(Boolean(m.ready)===ready)return;
   this.db.prepare('UPDATE members SET ready=? WHERE id=?').run(Number(ready),m.id);this.bump(id);
  }).immediate();
 }
 deal(token:string,id:string){
  this.db.transaction(()=>{this.host(token,id);if(this.row(id).phase!=='lobby')return;
   const r=this.row(id);const config=assertPlayableBoard(this.board(id),r.game_mode);const seats=this.seats(id);assertCanDeal(seats,config,r.game_mode);
   this.db.prepare("UPDATE preparations SET phase='identity_collection' WHERE room_id=?").run(id);
   if(r.deal_method==='online'){
    const deck=createDeck(config,r.game_mode);const insert=this.db.prepare('INSERT INTO identities(room_id,member_id,role,confirmed) VALUES (?,?,?,0)');
    seats.forEach((s,i)=>insert.run(id,s.memberId,deck[i]));
   }
   this.bump(id);
  }).immediate();
 }
 identity(token:string,id:string):PrivateIdentity{
  const m=this.seated(token,id);const r=this.row(id);
  if(r.phase==='lobby')throw new LobbyError('IDENTITY_UNAVAILABLE',409);
  const card=this.db.prepare('SELECT role,confirmed FROM identities WHERE room_id=? AND member_id=?').get(id,m.id) as {role:Role;confirmed:number}|undefined;
  return {role:card?.role??null,confirmed:!!card?.confirmed,locked:r.phase==='started'};
 }
 submitIdentity(token:string,id:string,role:Role):PrivateIdentity{
  if(!roleSchema.safeParse(role).success)throw new LobbyError('INVALID_INPUT');
  return this.db.transaction(()=>{const m=this.seated(token,id);const r=this.row(id);
   if(r.phase!=='identity_collection'||r.deal_method!=='physical')throw new LobbyError('PHASE_LOCKED',409);
   const old=this.identity(token,id);if(old.role!==role||!old.confirmed){
    this.db.prepare('INSERT INTO identities(room_id,member_id,role,confirmed) VALUES (?,?,?,1) ON CONFLICT(room_id,member_id) DO UPDATE SET role=excluded.role,confirmed=1').run(id,m.id,role);this.bump(id);
   }
   return this.identity(token,id);
  }).immediate();
 }
 confirmIdentity(token:string,id:string):PrivateIdentity{
  return this.db.transaction(()=>{const m=this.seated(token,id);const r=this.row(id);
   if(r.phase!=='identity_collection'||r.deal_method!=='online')throw new LobbyError('PHASE_LOCKED',409);
   const old=this.identity(token,id);if(!old.role)throw new LobbyError('IDENTITY_UNAVAILABLE',409);
   if(!old.confirmed){this.db.prepare('UPDATE identities SET confirmed=1 WHERE room_id=? AND member_id=?').run(id,m.id);this.bump(id);}
   return this.identity(token,id);
  }).immediate();
 }
 start(token:string,id:string){
  this.db.transaction(()=>{this.host(token,id);const r=this.row(id);if(r.phase==='started')return;
   if(r.phase!=='identity_collection')throw new LobbyError('PHASE_LOCKED',409);
   const config=assertPlayableBoard(this.board(id),r.game_mode);const p=this.snapshot(id);if(p.confirmedCount!==config.seatCount)throw new LobbyError('IDENTITY_INCOMPLETE',409);
   if(p.validation!=='valid')throw new LobbyError('ROLE_MISMATCH',409);
   this.db.prepare("UPDATE preparations SET phase='started' WHERE room_id=?").run(id);this.bump(id);
  }).immediate();
 }
 snapshot(id:string):PreparationState{
  const r=this.row(id);const cards=this.db.prepare('SELECT role,confirmed FROM identities WHERE room_id=?').all(id) as {role:Role;confirmed:number}[];
  return {settingsRevision:r.settings_revision,phase:r.phase,settings:{dealMethod:r.deal_method,gameMode:r.game_mode},submittedCount:cards.length,confirmedCount:cards.filter(c=>c.confirmed).length,
   validation:cards.length!==this.board(id).seatCount?'waiting':rolesMatchBoard(cards.map(c=>c.role),this.board(id))?'valid':'mismatch'};
 }
}
