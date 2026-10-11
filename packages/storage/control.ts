import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import {controlSchema,type ControlCommand,type GameControl} from '../contracts/control.js';
import type {MemberRow} from './preparation.js';
import type {NightState} from '../domain/night.js';
import type {DayState} from '../domain/day.js';
interface ControlRow {room_id:string;status:GameControl['status'];version:number;remaining_ms:number|null;resume_at:number|null;kind:'night'|'day'|null;turn_id:string|null;temp_member:string|null;vote_seconds:number;vote_visibility:'individual'|'totals';notice_until:number}
interface Presence {member_id:string;connected:number;disconnected_at:number|null;turn_id:string|null;lost_ms:number;grace_used:number}
type Active={kind:'night'|'day';state:NightState|DayState};
export class ControlStore {
 private connections=new Map<string,{roomId:string;memberId:string}>();
 constructor(private db:Database.Database,private now:()=>number=Date.now){
  db.exec(`CREATE TABLE IF NOT EXISTS room_controls(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'running',version INTEGER NOT NULL DEFAULT 0,remaining_ms INTEGER,resume_at INTEGER,kind TEXT,turn_id TEXT,temp_member TEXT REFERENCES members(id) ON DELETE SET NULL,vote_seconds INTEGER NOT NULL DEFAULT 30,vote_visibility TEXT NOT NULL DEFAULT 'individual',notice_until INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS member_presence(member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,connected INTEGER NOT NULL DEFAULT 0,disconnected_at INTEGER,turn_id TEXT,lost_ms INTEGER NOT NULL DEFAULT 0,grace_used INTEGER NOT NULL DEFAULT 0,grace_turn TEXT);
   PRAGMA user_version=11;`);
  // Persistent flags represent the prior process's sockets, which no longer exist.
  for(const p of db.prepare('SELECT member_id,room_id FROM member_presence WHERE connected=1').all() as {member_id:string;room_id:string}[])this.offline(p.room_id,p.member_id);
 }
 private row(id:string){this.db.prepare('INSERT OR IGNORE INTO room_controls(room_id) VALUES (?)').run(id);return this.db.prepare('SELECT * FROM room_controls WHERE room_id=?').get(id) as ControlRow;}
 private active(id:string):Active|null{
  if((this.db.prepare('SELECT game_mode FROM preparations WHERE room_id=?').get(id) as {game_mode:string})?.game_mode==='manual')return null;
  const read=(kind:'night'|'day')=>{const row=this.db.prepare(`SELECT state FROM ${kind}_games WHERE room_id=?`).get(id) as {state:string}|undefined;return row?JSON.parse(row.state):null;};
  const night=read('night') as NightState|null,day=read('day') as DayState|null;
  if(day&&(!night||day.day>=night.night))return {kind:'day',state:day};if(night)return {kind:'night',state:night};return null;
 }
 private started(a:Active|null){return a?.state.events.findLast(e=>e.type===a.state.phase)?.at??this.now();}
 private bump(id:string){this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);}
 private saveActive(id:string,a:Active){this.db.prepare(`UPDATE ${a.kind}_games SET state=? WHERE room_id=?`).run(JSON.stringify(a.state),id);}
 private living(id:string,seat:number|null){return seat!==null&&this.active(id)?.state.players.some(p=>p.seat===seat&&p.alive!==false);}
 defaults(id:string){const r=this.row(id);return {seconds:r.vote_seconds,visibility:r.vote_visibility};}
 canManage(id:string,m:MemberRow){return !!m.is_host||(this.row(id).temp_member===m.id&&!!this.living(id,m.seat));}
 assertRunning(id:string){if(this.row(id).status!=='running')throw new LobbyError('GAME_PAUSED',409);}
 frozen(id:string){return this.row(id).status!=='running';}
 snapshot(id:string):GameControl{
  const r=this.row(id),a=this.active(id);const m=r.temp_member?this.db.prepare('SELECT seat FROM members WHERE id=? AND room_id=?').get(r.temp_member,id) as {seat:number|null}|undefined:null;
  return {status:r.status,version:r.version,remainingMs:r.remaining_ms,resumeAt:r.resume_at,serverNow:this.now(),tempSeat:m&&this.living(id,m.seat)?m.seat:null,reconnecting:r.notice_until>this.now(),...(a?.kind==='day'&&a.state.phase==='vote_setup'?{voteDefaults:(a.state as DayState).voteDefaults??{seconds:r.vote_seconds,visibility:r.vote_visibility}}:{})};
 }
 command(id:string,m:MemberRow,input:ControlCommand){const parsed=controlSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const c=parsed.data;
  this.db.transaction(()=>{const r=this.row(id);if(!this.canManage(id,m))throw new LobbyError('HOST_ONLY',403);if(c.version!==r.version)throw new LobbyError('STALE_CONTROL',409);const a=this.active(id);if(!a||a.state.phase==='ended')throw new LobbyError('PHASE_LOCKED',409);
   if(a.kind==='day'&&a.state.phase==='vote_setup'&&!(a.state as DayState).voteDefaults){(a.state as DayState).voteDefaults={seconds:r.vote_seconds,visibility:r.vote_visibility};this.saveActive(id,a);}
   if(c.action==='delegate'){
    if(!m.is_host)throw new LobbyError('HOST_ONLY',403);const target=c.seat===null?null:this.db.prepare('SELECT id,seat,is_host FROM members WHERE room_id=? AND seat=?').get(id,c.seat) as {id:string;seat:number;is_host:number}|undefined;
    if(c.seat!==null&&(!target||target.is_host||!this.living(id,target.seat)))throw new LobbyError('INVALID_DELEGATE',409);
    this.db.prepare('UPDATE room_controls SET temp_member=? WHERE room_id=?').run(target?.id??null,id);
   }else if(c.action==='defaults'){
    if(r.status!=='paused')throw new LobbyError('PHASE_LOCKED',409);this.db.prepare('UPDATE room_controls SET vote_seconds=?,vote_visibility=? WHERE room_id=?').run(c.voteSeconds,c.voteVisibility,id);
   }else if(c.action==='pause'){
    if(r.status==='paused')throw new LobbyError('STALE_CONTROL',409);const remaining=r.status==='resuming'?r.remaining_ms:a.state.deadline===null?null:Math.max(0,a.state.deadline-this.now());
    for(const p of this.db.prepare('SELECT * FROM member_presence WHERE room_id=?').all(id) as Presence[]){const lost=(p.turn_id===a.state.turnId?p.lost_ms:0)+(p.connected||p.disconnected_at===null?0:Math.max(0,this.now()-Math.max(p.disconnected_at,this.started(a))));this.db.prepare('UPDATE member_presence SET lost_ms=?,turn_id=?,disconnected_at=NULL WHERE member_id=?').run(Math.min(15000,lost),a.state.turnId,p.member_id);}
    this.db.prepare("UPDATE room_controls SET status='paused',remaining_ms=?,resume_at=NULL,kind=?,turn_id=? WHERE room_id=?").run(remaining,a.kind,a.state.turnId,id);a.state.deadline=null;this.saveActive(id,a);
   }else{
    if(r.status!=='paused')throw new LobbyError('STALE_CONTROL',409);this.db.prepare("UPDATE room_controls SET status='resuming',resume_at=? WHERE room_id=?").run(this.now()+5000,id);
   }
   this.db.prepare('UPDATE room_controls SET version=version+1 WHERE room_id=?').run(id);this.bump(id);
  }).immediate();
 }
 tick(){const changed:string[]=[];for(const r of this.db.prepare('SELECT * FROM room_controls').all() as ControlRow[])this.db.transaction(()=>{
   let dirty=false;const a=this.active(r.room_id);
   if(r.temp_member){const m=this.db.prepare('SELECT seat FROM members WHERE id=?').get(r.temp_member) as {seat:number|null}|undefined;if(!m||!this.living(r.room_id,m.seat)){this.db.prepare('UPDATE room_controls SET temp_member=NULL,version=version+1 WHERE room_id=?').run(r.room_id);dirty=true;}}
   if(r.status==='resuming'&&r.resume_at!==null&&this.now()>=r.resume_at){
    if(!a||a.kind!==r.kind||a.state.turnId!==r.turn_id)throw new Error('Frozen phase changed');a.state.deadline=r.remaining_ms===null?null:r.resume_at+r.remaining_ms;this.saveActive(r.room_id,a);
    this.db.prepare("UPDATE room_controls SET status='running',remaining_ms=NULL,resume_at=NULL,version=version+1 WHERE room_id=?").run(r.room_id);
    // Preserve pre-pause loss; start counting offline playable time at resume.
    this.db.prepare('UPDATE member_presence SET lost_ms=CASE WHEN turn_id=? THEN lost_ms ELSE 0 END,turn_id=?,disconnected_at=CASE WHEN connected=0 THEN ? ELSE NULL END WHERE room_id=?').run(a.state.turnId,a.state.turnId,r.resume_at,r.room_id);dirty=true;
   }
   if(r.notice_until&&r.notice_until<=this.now()){this.db.prepare('UPDATE room_controls SET notice_until=0 WHERE room_id=?').run(r.room_id);dirty=true;}
   if(dirty){this.bump(r.room_id);changed.push(r.room_id);}
  }).immediate();return changed;
 }
 connect(id:string,memberId:string,connectionId:string){
  const member=this.db.prepare('SELECT id FROM members WHERE id=? AND room_id=?').get(memberId,id);if(!member)throw new LobbyError('NOT_MEMBER',403);
  const prior=this.connections.get(connectionId);if(prior?.roomId===id&&prior.memberId===memberId)return [];
  const changed=this.disconnect(connectionId);this.connections.set(connectionId,{roomId:id,memberId});
  if([...this.connections.values()].filter(p=>p.memberId===memberId).length>1)return changed;
  const p=this.db.prepare('SELECT * FROM member_presence WHERE member_id=?').get(memberId) as Presence|undefined;const a=this.active(id),turn=a?.state.turnId??null;
  const lost=p?Math.min(15000,(p.turn_id===turn?p.lost_ms:0)+(!this.frozen(id)&&p.disconnected_at!==null?Math.max(0,this.now()-Math.max(p.disconnected_at,this.started(a))):0)):0;
  this.db.prepare('INSERT INTO member_presence(member_id,room_id,connected,turn_id,lost_ms) VALUES (?,?,1,?,?) ON CONFLICT(member_id) DO UPDATE SET connected=1,disconnected_at=NULL,turn_id=excluded.turn_id,lost_ms=excluded.lost_ms').run(memberId,id,turn,lost);return changed;
 }
 disconnect(connectionId:string){const p=this.connections.get(connectionId);if(!p)return [];this.connections.delete(connectionId);if([...this.connections.values()].some(v=>v.memberId===p.memberId))return [];this.offline(p.roomId,p.memberId);return [p.roomId];}
 forgetRooms(ids:readonly string[]){const removed=new Set(ids);for(const [connectionId,p] of this.connections)if(removed.has(p.roomId))this.connections.delete(connectionId);}
 private offline(id:string,memberId:string){const turn=this.active(id)?.state.turnId??null;this.row(id);
  this.db.prepare('UPDATE member_presence SET connected=0,disconnected_at=?,lost_ms=CASE WHEN turn_id=? THEN lost_ms ELSE 0 END,turn_id=? WHERE member_id=?').run(this.frozen(id)?null:this.now(),turn,turn,memberId);
  if(this.active(id)){this.db.prepare('UPDATE room_controls SET notice_until=? WHERE room_id=?').run(this.now()+15000,id);this.bump(id);}
 }
 hasGrace(id:string,s:NightState){return !!this.db.prepare('SELECT 1 FROM member_presence WHERE room_id=? AND grace_turn=?').get(id,s.turnId);}
 grace(id:string,s:NightState,now:number){
  if(!['witch','seer','hunter'].includes(s.phase)||s.deadline===null)return;
  if(s.phase==='witch'&&(s.witchChoice||!s.antidote&&!s.poison)||s.phase==='seer'&&s.seerCheck||s.phase==='hunter'&&(s.hunterSeen||s.hunterSpent))return;
  const player=s.players.find(p=>p.role===s.phase&&p.alive!==false);if(!player)return;
  const p=this.db.prepare('SELECT p.* FROM member_presence p JOIN members m ON m.id=p.member_id WHERE m.room_id=? AND m.seat=?').get(id,player.seat) as Presence|undefined;
  if(!p||p.grace_used)return;
  const lost=p.connected?p.turn_id===s.turnId?p.lost_ms:0:15000;if(!lost)return;
  this.db.prepare('UPDATE member_presence SET grace_used=1,grace_turn=? WHERE member_id=?').run(s.turnId,p.member_id);s.deadline+=Math.min(15000,lost);
  const r=this.row(id);if(r.notice_until<now+Math.min(15000,lost))this.db.prepare('UPDATE room_controls SET notice_until=? WHERE room_id=?').run(now+Math.min(15000,lost),id);
 }
}
