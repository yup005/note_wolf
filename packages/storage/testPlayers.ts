import type Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {LobbyError,type PublicSeat} from '../contracts/index.js';
import {PreparationStore,type MemberRow} from './preparation.js';
/** Server-owned simulated actors. They never receive usable device credentials. */
export class TestPlayersStore{
 constructor(private db:Database.Database,private enabled:boolean,private member:(token:string,id:string)=>MemberRow,private seats:(id:string)=>PublicSeat[]){}
 authorize(token:string,id:string){
  if(!this.enabled)throw new LobbyError('TEST_PLAYERS_DISABLED',404);
  const host=this.member(token,id);if(!host.is_host)throw new LobbyError('HOST_ONLY',403);return host;
 }
 actor(token:string,id:string,actorId:string){
  this.authorize(token,id);
  const actor=this.db.prepare('SELECT m.* FROM members m JOIN test_players t ON t.member_id=m.id WHERE m.room_id=? AND m.id=?').get(id,actorId) as MemberRow|undefined;
  if(!actor)throw new LobbyError('NOT_TEST_PLAYER',403);return actor;
 }
 private store(actorId:string){return new PreparationStore(this.db,(token,id)=>this.actor(token,id,actorId),this.seats);}
 fill(token:string,id:string){
  this.db.transaction(()=>{
   const host=this.authorize(token,id);const p=new PreparationStore(this.db,this.member,this.seats);p.assertLobby(id);
   if(host.seat===null)throw new LobbyError('HOST_NOT_SEATED',409);
   if(p.snapshot(id).settings.dealMethod!=='online')throw new LobbyError('TEST_ONLINE_ONLY',409);
   const humans=this.db.prepare('SELECT COUNT(*) AS n FROM members m WHERE room_id=? AND NOT EXISTS(SELECT 1 FROM test_players t WHERE t.member_id=m.id)').get(id) as {n:number};
   if(humans.n!==1)throw new LobbyError('TEST_ROOM_NOT_EMPTY',409);
   this.db.prepare('INSERT OR IGNORE INTO test_rooms(room_id) VALUES (?)').run(id);
   for(const seat of this.seats(id).filter(s=>!s.memberId)){
    const memberId=randomUUID();const hash=createHash('sha256').update(randomUUID()).digest('hex');
    this.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname,seat,ready) VALUES (?,?,?,?,?,1)').run(memberId,id,hash,`测试玩家 ${seat.number}`,seat.number);
    this.db.prepare('INSERT INTO test_players(member_id) VALUES (?)').run(memberId);
    this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);
   }
  }).immediate();
 }
 isTestRoom(id:string){return !!this.db.prepare('SELECT 1 FROM test_rooms WHERE room_id=?').get(id);}
 isActor(id:string){return !!this.db.prepare('SELECT 1 FROM test_players WHERE member_id=?').get(id);}
 prepareActors(id:string){
  if(this.enabled)this.db.prepare('UPDATE members SET ready=1 WHERE room_id=? AND id IN (SELECT member_id FROM test_players)').run(id);
 }
 confirmActors(id:string){
  if(!this.enabled)return;
  const result=this.db.prepare('UPDATE identities SET confirmed=1 WHERE room_id=? AND confirmed=0 AND member_id IN (SELECT member_id FROM test_players)').run(id);
  if(result.changes)this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);
 }
 identity(token:string,id:string,actorId:string){return this.store(actorId).identity(token,id);}
 ready(token:string,id:string,actorId:string,ready:boolean,settingsRevision:number){this.store(actorId).setReady(token,id,ready,settingsRevision);}
 confirm(token:string,id:string,actorId:string){return this.store(actorId).confirmIdentity(token,id);}
}
