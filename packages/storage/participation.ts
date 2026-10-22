import type Database from 'better-sqlite3';
import {z} from 'zod';
import {boardRoleSchema,type BoardRole} from '../contracts/board.js';
import {runtimeRoom} from './roomGames.js';
interface Participant {owner:string;seat:number;role:BoardRole}
const rosterSchema=z.array(z.object({seat:z.number().int().min(1).max(256),role:boardRoleSchema}).strict()).min(1).max(256),ownersSchema=z.array(z.string().min(1)).min(1).max(256);
function decode(archive:{roles:string;participants:string}){
 try{const roles=rosterSchema.safeParse(JSON.parse(archive.roles)),owners=ownersSchema.safeParse(JSON.parse(archive.participants));if(!roles.success||!owners.success||new Set(roles.data.map(r=>r.seat)).size!==roles.data.length)return null;return {roles:roles.data,owners:owners.data};}catch{return null;}
}
/** Private proof of the original seat/owner correspondence; never a public roster. */
export class ParticipationStore {
 constructor(private db:Database.Database){
  const roles=boardRoleSchema.options.map(role=>`'${role}'`).join(',');
  db.exec(`CREATE TABLE IF NOT EXISTS game_statistics_eligibility(game_id TEXT PRIMARY KEY REFERENCES record_rooms(room_id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('ordinary','test')));
   CREATE TABLE IF NOT EXISTS game_participants(game_id TEXT NOT NULL REFERENCES record_rooms(room_id) ON DELETE CASCADE,owner TEXT NOT NULL,seat INTEGER NOT NULL CHECK(seat BETWEEN 1 AND 256),role TEXT NOT NULL CHECK(role IN (${roles})),PRIMARY KEY(game_id,owner,seat));`);
 }
 backfillLive(){for(const row of this.db.prepare('SELECT h.game_id FROM room_game_heads h JOIN record_rooms r ON r.room_id=h.game_id').all() as {game_id:string}[])this.capture(row.game_id);}
 games(owner:string){return (this.db.prepare("SELECT DISTINCT p.game_id FROM game_participants p JOIN game_statistics_eligibility e ON e.game_id=p.game_id WHERE p.owner=? AND e.kind='ordinary' ORDER BY p.game_id").all(owner) as {game_id:string}[]).map(row=>row.game_id);}
 capture(gameId:string){
  if(this.db.prepare('SELECT 1 FROM game_statistics_eligibility WHERE game_id=?').get(gameId))return;
  // Older standalone record schemas cannot prove confirmed identities.
  if(!(this.db.prepare('PRAGMA table_info(identities)').all() as {name:string}[]).some(c=>c.name==='confirmed'))return;
  this.db.transaction(()=>{
   if(this.db.prepare('SELECT 1 FROM game_statistics_eligibility WHERE game_id=?').get(gameId))return;
   const live=runtimeRoom(this.db,gameId);if(!live||!this.db.prepare("SELECT 1 FROM rooms r JOIN preparations p ON p.room_id=r.id WHERE r.id=? AND p.phase='started'").get(live))return;
   const archive=this.db.prepare('SELECT roles,participants FROM record_rooms WHERE room_id=?').get(gameId) as {roles:string;participants:string}|undefined;if(!archive)return;
   const roster=decode(archive);if(!roster)return;const {roles,owners}=roster;
   const players=this.db.prepare('SELECT m.session_hash AS owner,m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id WHERE m.room_id=? AND i.confirmed=1 ORDER BY m.seat').all(live) as Participant[];
   if(!roles.length||players.length!==roles.length||new Set(players.map(p=>p.seat)).size!==players.length||players.some(p=>!owners.includes(p.owner)||!Number.isInteger(p.seat)||p.seat<1||p.seat>256||!boardRoleSchema.safeParse(p.role).success)||roles.some(r=>!players.some(p=>p.seat===r.seat&&p.role===r.role)))return;
   const test=!!this.db.prepare('SELECT 1 FROM test_rooms WHERE room_id=?').get(live);
   this.db.prepare('INSERT INTO game_statistics_eligibility VALUES (?,?)').run(gameId,test?'test':'ordinary');
   if(!test){const insert=this.db.prepare('INSERT INTO game_participants VALUES (?,?,?,?)');for(const p of players)insert.run(gameId,p.owner,p.seat,p.role);}
  }).immediate();
 }
 identity(gameId:string,owner:string):{seat:number;role:BoardRole}|null{
  const archive=this.db.prepare('SELECT roles,participants FROM record_rooms WHERE room_id=?').get(gameId) as {roles:string;participants:string}|undefined;const roster=archive?decode(archive):null;if(!roster?.owners.includes(owner))return null;
  const rows=this.db.prepare("SELECT p.seat,p.role FROM game_participants p JOIN game_statistics_eligibility e ON e.game_id=p.game_id WHERE p.game_id=? AND p.owner=? AND e.kind='ordinary'").all(gameId,owner) as {seat:number;role:BoardRole}[];
  return rows.length===1&&roster.roles.some(r=>r.seat===rows[0].seat&&r.role===rows[0].role)?rows[0]:null;
 }
}
