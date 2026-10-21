import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import type {GameRef} from '../contracts/rematch.js';
import type {RematchCommand} from '../contracts/rematch.js';
import {randomUUID} from 'node:crypto';

/** Historical identifiers never resolve to another game's live state. */
export function runtimeRoom(db:Database.Database,gameId:string):string|null{
 const row=db.prepare('SELECT room_id FROM room_game_heads WHERE game_id=?').get(gameId) as {room_id:string}|undefined;
 return row?.room_id??null;
}
export class RoomGamesStore {
 preserveAudits(roomId:string){
  const game=this.current(roomId);
  this.db.prepare('UPDATE room_management_history SET game_id=? WHERE room_id=? AND game_id IS NULL').run(game.gameId,roomId);
  this.db.prepare('INSERT OR IGNORE INTO game_judge_audits SELECT ?,id,at,operator_member,operator_seat,action,detail FROM judge_audit WHERE room_id=?').run(game.gameId,roomId);
  // Private source audit has a runtime FK; its preserved copy has no room cascade.
  this.db.prepare('DELETE FROM judge_audit WHERE room_id=?').run(roomId);
 }
 receipt(owner:string,roomId:string,command:RematchCommand):GameRef|null{
  const r=this.db.prepare('SELECT payload,result_id FROM rematch_receipts WHERE owner=? AND room_id=? AND request_id=?').get(owner,roomId,command.requestId) as {payload:string;result_id:string}|undefined;
  if(!r)return null;
  if(r.payload!==JSON.stringify(command))throw new LobbyError('REMATCH_REQUEST_CONFLICT',409);
  return this.info(r.result_id);
 }
 advance(owner:string,roomId:string,command:RematchCommand):GameRef{
  this.assertCurrent(roomId,command.expectedGameId);const current=this.current(roomId),id=randomUUID();
  this.db.prepare('INSERT INTO room_games VALUES (?,?,?,?)').run(id,roomId,current.gameNumber+1,this.now());
  for(const table of ['identities','night_games','day_games','game_history','manual_games','room_controls','room_judges','judge_drafts','judge_requests','judge_manual_checkpoints','judge_knowledge','judge_stale_turns','voice_leases','voice_deliveries','voice_observations'])this.db.prepare(`DELETE FROM ${table} WHERE room_id=?`).run(roomId);
  if(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='board_engine_states'").get())this.db.prepare('DELETE FROM board_engine_states WHERE room_id=?').run(roomId);
  this.db.prepare('UPDATE members SET ready=0 WHERE room_id=?').run(roomId);
  this.db.prepare("UPDATE preparations SET phase='lobby',settings_revision=settings_revision+1 WHERE room_id=?").run(roomId);
  this.db.prepare('UPDATE member_presence SET turn_id=NULL,lost_ms=0,grace_used=0,grace_turn=NULL WHERE room_id=?').run(roomId);
  this.db.prepare('UPDATE room_game_heads SET game_id=? WHERE room_id=?').run(id,roomId);
  this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(roomId);
  this.db.prepare('INSERT INTO rematch_receipts VALUES (?,?,?,?,?)').run(owner,roomId,command.requestId,JSON.stringify(command),id);
  return this.info(id);
 }
 constructor(private db:Database.Database,private now:()=>number){
  db.exec(`CREATE TABLE IF NOT EXISTS room_games(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,number INTEGER NOT NULL CHECK(number>0),created_at INTEGER NOT NULL,UNIQUE(room_id,number));
   CREATE TABLE IF NOT EXISTS room_game_heads(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,game_id TEXT NOT NULL UNIQUE REFERENCES room_games(id));
   CREATE TABLE IF NOT EXISTS rematch_receipts(owner TEXT NOT NULL,room_id TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,result_id TEXT NOT NULL REFERENCES room_games(id),PRIMARY KEY(owner,room_id,request_id));`);
  db.exec('CREATE TABLE IF NOT EXISTS game_judge_audits(game_id TEXT NOT NULL,id INTEGER NOT NULL,at INTEGER NOT NULL,operator_member TEXT NOT NULL,operator_seat INTEGER,action TEXT NOT NULL,detail TEXT NOT NULL,PRIMARY KEY(game_id,id))');
  for(const {id} of db.prepare('SELECT id FROM rooms').all() as {id:string}[])this.initialize(id);
 }
 migrate(){this.db.transaction(()=>{
  for(const {id} of this.db.prepare('SELECT id FROM rooms').all() as {id:string}[])this.initialize(id);
  for(const {room_id} of this.db.prepare('SELECT room_id FROM record_rooms').all() as {room_id:string}[])this.db.prepare('INSERT OR IGNORE INTO room_games VALUES (?,?,1,?)').run(room_id,room_id,this.now());
  for(const {room_id} of this.db.prepare('SELECT DISTINCT room_id FROM saved_replays').all() as {room_id:string}[])this.db.prepare('INSERT OR IGNORE INTO room_games VALUES (?,?,1,?)').run(room_id,room_id,this.now());
 }).immediate();}
 initialize(roomId:string):GameRef{
  const head=this.db.prepare('SELECT game_id FROM room_game_heads WHERE room_id=?').get(roomId) as {game_id:string}|undefined;
  if(head)return this.info(head.game_id);
  this.db.prepare('INSERT OR IGNORE INTO room_games VALUES (?,?,1,?)').run(roomId,roomId,this.now());
  this.db.prepare('INSERT INTO room_game_heads VALUES (?,?)').run(roomId,roomId);return this.info(roomId);
 }
 info(gameId:string):GameRef{
  const r=this.db.prepare('SELECT id AS gameId,room_id AS roomId,number AS gameNumber FROM room_games WHERE id=?').get(gameId) as GameRef|undefined;
  if(!r)throw new LobbyError('NOT_FOUND',404);return r;
 }
 current(roomId:string):GameRef{
  const r=this.db.prepare('SELECT game_id FROM room_game_heads WHERE room_id=?').get(roomId) as {game_id:string}|undefined;
  if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);return this.info(r.game_id);
 }
 runtime(gameId:string){return runtimeRoom(this.db,gameId);}
 assertCurrent(roomId:string,expectedGameId:string|undefined){
  const current=this.current(roomId);
  if(expectedGameId!==undefined?expectedGameId!==current.gameId:current.gameNumber!==1)throw new LobbyError('STALE_GAME',409);
 }
}
