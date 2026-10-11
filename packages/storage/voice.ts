import type Database from 'better-sqlite3';
import {sessionHash} from './auth.js';
import {LobbyError,type RoomSnapshot} from '../contracts/index.js';
import {voiceCommandSchema,type VoiceCommand,type VoiceResponse,type VoiceFrame} from '../contracts/voice.js';
import {voiceFrame} from '../domain/voice.js';
interface Lease {session_hash:string;client_id:string;member_id:string;until:number}
interface Observation {stage:string;deathInquiry:number|null;at:number}
const ttl=15000;
export class VoiceStore {
 constructor(private db:Database.Database,private now:()=>number,private maySpeak:(id:string,memberId:string)=>boolean){
  db.exec(`CREATE TABLE IF NOT EXISTS voice_leases(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,session_hash TEXT NOT NULL REFERENCES sessions(session_hash) ON DELETE CASCADE,client_id TEXT NOT NULL,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,until INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS voice_deliveries(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,cue_key TEXT NOT NULL,PRIMARY KEY(room_id,cue_key));
   CREATE TABLE IF NOT EXISTS voice_observations(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,state TEXT NOT NULL);
   PRAGMA user_version=13;`);
 }
 command(token:string,memberId:string,room:RoomSnapshot,input:VoiceCommand):VoiceResponse{
  const p=voiceCommandSchema.safeParse(input);if(!p.success)throw new LobbyError('INVALID_INPUT');const c=p.data;
  return this.db.transaction(()=>{
   const now=this.now(),hash=sessionHash(token);const frame=voiceFrame(room,now);
   let lease=this.db.prepare('SELECT * FROM voice_leases WHERE room_id=?').get(room.id) as Lease|undefined;
   if(lease&&(lease.until<=now||!this.maySpeak(room.id,lease.member_id))){this.db.prepare('DELETE FROM voice_leases WHERE room_id=?').run(room.id);lease=undefined;}
   const owns=lease?.session_hash===hash&&lease?.client_id===c.clientId;
   if(c.action==='release'){
    if(!owns)throw new LobbyError('VOICE_LEASE_LOST',409);this.db.prepare('DELETE FROM voice_leases WHERE room_id=?').run(room.id);
    return {revision:room.revision,serverNow:now,leaseUntil:now,scope:frame.scope,cues:[],current:frame.current};
   }
   if(!this.maySpeak(room.id,memberId))throw new LobbyError('HOST_ONLY',403);
   if(room.preparation.settings.gameMode!=='automatic'||room.manual){this.db.prepare('DELETE FROM voice_leases WHERE room_id=?').run(room.id);throw new LobbyError('MANUAL_MODE',409);}
   if(!frame.stage)throw new LobbyError('PHASE_LOCKED',409);
   if(c.action==='claim'){if(lease&&!owns)throw new LobbyError('VOICE_BUSY',409);}
   else if(!owns)throw new LobbyError('VOICE_LEASE_LOST',409);
   this.db.prepare('INSERT INTO voice_leases VALUES (?,?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET session_hash=excluded.session_hash,client_id=excluded.client_id,member_id=excluded.member_id,until=excluded.until').run(room.id,hash,c.clientId,memberId,now+ttl);
   const row=this.db.prepare('SELECT state FROM voice_observations WHERE room_id=?').get(room.id) as {state:string}|undefined;
   const before:Observation|undefined=row?JSON.parse(row.state):undefined;
   const cues=[...frame.cues];
   // A failed or forbidden transaction rolls back observations and delivery markers.
   if(c.action==='poll'&&before&&before.at+ttl>=now&&!frame.ended){
    for(const result of frame.skillResults){
     if(!result.activated&&result.at>=before.at&&result.at<=now)cues.unshift({key:`${result.key}:no-skill`,text:`${result.seat}号玩家未发动技能。`});
    }
   }
   const next:Observation={stage:frame.stage,deathInquiry:frame.deathInquiry,at:now};
   this.db.prepare('INSERT INTO voice_observations VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET state=excluded.state').run(room.id,JSON.stringify(next));
   const sent=c.action==='replay'?(frame.current?[frame.current]:[]):cues.filter(cue=>this.db.prepare('INSERT OR IGNORE INTO voice_deliveries VALUES (?,?)').run(room.id,cue.key).changes>0);
   return {revision:room.revision,serverNow:now,leaseUntil:now+ttl,scope:frame.scope,cues:sent,current:frame.current};
  }).immediate();
 }
}
