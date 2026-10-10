import Database from 'better-sqlite3';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { LobbyError, nameSchema, codeSchema, seatSchema, type LobbyView, type RoomSnapshot } from '../contracts/index.js';
import { mvpBoard } from '../domain/board.js';
interface RoomRow {id:string;code:string;revision:number}
interface MemberRow {id:string;room_id:string;nickname:string;is_host:number;seat:number|null}
const sessionKey=(token:string)=>createHash('sha256').update(token).digest('hex');
export class LobbyStore {
 private db:Database.Database;
 constructor(path:string,private codeStart:()=>number=()=>randomInt(10000)){
  this.db=new Database(path);this.db.pragma('journal_mode = WAL');this.db.pragma('foreign_keys = ON');this.db.pragma('busy_timeout = 5000');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE CHECK(length(code)=4),revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,nickname TEXT NOT NULL,is_host INTEGER NOT NULL DEFAULT 0,seat INTEGER CHECK(seat BETWEEN 1 AND 12),UNIQUE(room_id,session_hash),UNIQUE(room_id,seat));
   CREATE TABLE IF NOT EXISTS create_requests(session_hash TEXT NOT NULL,request_id TEXT NOT NULL,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,PRIMARY KEY(session_hash,request_id));
   CREATE TABLE IF NOT EXISTS sessions(session_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
   PRAGMA user_version = 1;
  `);
 }
 private nickname(value:string){const p=nameSchema.safeParse(value);if(!p.success)throw new LobbyError('INVALID_NAME');return p.data;}
 private member(token:string,roomId:string):MemberRow{
  const m=this.db.prepare('SELECT * FROM members WHERE room_id=? AND session_hash=?').get(roomId,sessionKey(token)) as MemberRow|undefined;
  if(!m)throw new LobbyError('NOT_MEMBER',403);return m;
 }
 create(token:string,nickname:string,requestId:string=randomUUID()):LobbyView{
  const name=this.nickname(nickname);
  return this.db.transaction(()=>{
   const previous=this.db.prepare('SELECT room_id FROM create_requests WHERE session_hash=? AND request_id=?').get(sessionKey(token),requestId) as {room_id:string}|undefined;
   if(previous)return this.view(token,previous.room_id);
   // Scan starting at a cryptographically random code. Bounded probing also handles an exhausted namespace.
   const start=this.codeStart();let code:string|undefined;
   for(let i=0;i<10000;i++){
    const candidate=((start+i)%10000).toString().padStart(4,'0');
    if(!this.db.prepare('SELECT 1 FROM rooms WHERE code=?').get(candidate)){code=candidate;break;}
   }
   if(code===undefined)throw new LobbyError('ROOM_CODES_FULL',503);
   const roomId=randomUUID();
   this.db.prepare('INSERT INTO rooms(id,code,created_at) VALUES (?,?,?)').run(roomId,code,Date.now());
   this.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname,is_host) VALUES (?,?,?,?,1)').run(randomUUID(),roomId,sessionKey(token),name);
   this.db.prepare('INSERT INTO create_requests VALUES (?,?,?)').run(sessionKey(token),requestId,roomId);
   return this.view(token,roomId);
  }).immediate();
 }
 join(token:string,code:string,nickname:string):LobbyView{
  const name=this.nickname(nickname);if(!codeSchema.safeParse(code).success)throw new LobbyError('INVALID_CODE');
  return this.db.transaction(()=>{
   const r=this.db.prepare('SELECT * FROM rooms WHERE code=?').get(code) as RoomRow|undefined;
   if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);
   if(!this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND session_hash=?').get(r.id,sessionKey(token))){
    this.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run(randomUUID(),r.id,sessionKey(token),name);
    this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(r.id);
   }
   return this.view(token,r.id);
  }).immediate();
 }
 select(token:string,roomId:string,seat:number):LobbyView{
  if(!seatSchema.safeParse(seat).success)throw new LobbyError('INVALID_SEAT');
  return this.db.transaction(()=>{
   const m=this.member(token,roomId);
   if(m.seat===seat)return this.view(token,roomId);
   if(m.seat!==null && mvpBoard.policies.reseating.status==='unresolved')throw new LobbyError('RULE_UNRESOLVED',409);
   if(this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND seat=?').get(roomId,seat))throw new LobbyError('SEAT_TAKEN',409);
   this.db.prepare('UPDATE members SET seat=? WHERE id=?').run(seat,m.id);
   this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(roomId);
   return this.view(token,roomId);
  }).immediate();
 }
 view(token:string,roomId:string):LobbyView{
  const m=this.member(token,roomId);
  return {room:this.snapshot(roomId),me:{id:m.id,nickname:m.nickname,isHost:m.is_host===1,seat:m.seat}};
 }
 snapshot(roomId:string):RoomSnapshot{
  const r=this.db.prepare('SELECT * FROM rooms WHERE id=?').get(roomId) as RoomRow|undefined;
  if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);
  const members=this.db.prepare('SELECT id,nickname,is_host,seat FROM members WHERE room_id=? AND seat IS NOT NULL').all(roomId) as MemberRow[];
  return {id:r.id,code:r.code,boardId:'seer-witch-hunter-idiot-12',revision:r.revision,seats:Array.from({length:12},(_,i)=>{
   const m=members.find(m=>m.seat===i+1);return {number:i+1,memberId:m?.id??null,nickname:m?.nickname??null,isHost:m?.is_host===1};
  })};
 }
 roomsFor(token:string):LobbyView[]{
  const rows=this.db.prepare('SELECT room_id FROM members WHERE session_hash=? ORDER BY rowid DESC LIMIT 20').all(sessionKey(token)) as {room_id:string}[];
  return rows.map(r=>this.view(token,r.room_id));
 }
 issueSession(token:string){this.db.prepare('INSERT INTO sessions VALUES (?,?)').run(sessionKey(token),Date.now());}
 hasSession(token:string){return !!this.db.prepare('SELECT 1 FROM sessions WHERE session_hash=?').get(sessionKey(token));}
 close(){this.db.close();}
}
