import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import {createNight,beginNight,advanceNight,nightCommand,publicNight,privateNight,type NightState,type NightPlayer} from '../domain/night.js';
import type {NightCommand} from '../contracts/night.js';
import type {ControlStore} from './control.js';
import type {MemberRow} from './preparation.js';
export class NightStore {
 constructor(private db:Database.Database,private member:(token:string,id:string)=>MemberRow,private now:()=>number=Date.now,private control?:ControlStore,private board?:(id:string)=>import('../contracts/board.js').RoomBoardSnapshot){}
 private row(id:string){const row=this.db.prepare('SELECT state FROM night_games WHERE room_id=?').get(id) as {state:string}|undefined;if(!row)return null;const s=JSON.parse(row.state) as NightState;s.hunterSpent??=false;s.priorityWolf??=null;s.priorityTarget??=null;s.priorityCommitted??=false;return s;}
 private save(id:string,s:NightState,old:NightState|null){
  this.db.prepare('INSERT INTO night_games(room_id,state) VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(s));
  if(!old||old.turnId!==s.turnId||old.deadline!==s.deadline)this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);
 }
 private actor(token:string,id:string){const m=this.member(token,id);if(m.seat===null)throw new LobbyError('NOT_SEATED',409);return m;}
 enter(token:string,id:string){return this.db.transaction(()=>{
  this.control?.assertRunning(id);const m=this.actor(token,id);if(!m.is_host&&!m.is_manager)throw new LobbyError('HOST_ONLY',403);
  const prep=this.db.prepare('SELECT phase,game_mode FROM preparations WHERE room_id=?').get(id) as {phase:string;game_mode:string};
  if(prep.phase!=='started'||prep.game_mode!=='automatic')throw new LobbyError('NIGHT_UNAVAILABLE',409);
  const current=this.row(id);if(current){
   const dayRow=this.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(id) as {state:string}|undefined;
   if(!dayRow)return;const day=JSON.parse(dayRow.state) as import('../domain/day.js').DayState;
   if(current.night>day.day)return;
   if(day.phase!=='day_complete')throw new LobbyError('PHASE_LOCKED',409);
   this.db.prepare('INSERT OR IGNORE INTO game_history(room_id,kind,round,state) VALUES (?,?,?,?)').run(id,'night',current.night,JSON.stringify(current));
   const next=createNight(day.players,this.now(),{night:current.night+1,antidote:current.antidote,poison:current.poison,hunterSpent:day.hunterSpent??false,priorityWolf:day.priorityWolf,engine:day.engine,extraNightSeat:day.extraNightSeat},this.board?.(id));
   this.save(id,next,current);return;
  }
  const players=this.db.prepare('SELECT m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id WHERE m.room_id=? AND m.seat IS NOT NULL').all(id) as NightPlayer[];
  if(players.length!==(this.board?.(id).composition.seatCount??12))throw new LobbyError('IDENTITY_INCOMPLETE',409);
  this.save(id,createNight(players,this.now(),undefined,this.board?.(id)),null);
 }).immediate();}
 begin(token:string,id:string,turnId:string){this.mutate(id,s=>{
  this.assertActive(id,s);this.control?.assertRunning(id);const m=this.actor(token,id);if(!m.is_host&&!m.is_manager)throw new LobbyError('HOST_ONLY',403);if(s.turnId!==turnId)throw new LobbyError('STALE_TURN',409);beginNight(s,this.now());
 });}
 command(token:string,id:string,c:NightCommand){this.mutate(id,s=>{this.assertActive(id,s);nightCommand(s,this.actor(token,id).seat!,c,this.now());});return this.private(token,id);}
 private mutate(id:string,apply:(s:NightState)=>void){this.db.transaction(()=>{this.automatic(id);this.control?.assertRunning(id);const old=this.row(id);if(!old)throw new LobbyError('NIGHT_UNAVAILABLE',409);const next=structuredClone(old);advanceNight(next,this.now(),undefined,(s,now)=>this.control?.grace(id,s,now));apply(next);this.save(id,next,old);}).immediate();}
 private automatic(id:string){if((this.db.prepare('SELECT game_mode FROM preparations WHERE room_id=?').get(id) as {game_mode:string})?.game_mode!=='automatic')throw new LobbyError('MANUAL_MODE',409);}
 private assertActive(id:string,s:NightState){this.automatic(id);const row=this.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(id) as {state:string}|undefined;if(row&&JSON.parse(row.state).day>=s.night)throw new LobbyError('PHASE_LOCKED',409);}
 snapshot(id:string){const s=this.row(id);return s?publicNight(s,this.now()):null;}
 completedState(id:string){const s=this.row(id);if(!s||s.phase!=='first_night_complete')throw new LobbyError('PHASE_LOCKED',409);return s;}
 testActionSeat(id:string){const s=this.row(id);if(!s)return null;if(s.phase==='confession_notice')return s.engine?.confession?.target??null;const role=s.phase==='confession'?'wolfGirl':s.phase==='mechanical'||s.phase==='mechanical_authority'?'mechanicalWolf':s.phase==='armor'?'armoredWolf':s.phase;return s.phase==='puppet'?s.confirmer:s.phase==='wolves'?s.priorityWolf??s.confirmer:s.players.find(p=>p.role===role&&p.alive!==false&&!(p.role==='hunter'&&s.hunterSpent))?.seat??null;}
 private(token:string,id:string){const m=this.actor(token,id);this.automatic(id);const s=this.row(id);if(!s)throw new LobbyError('NIGHT_UNAVAILABLE',409);return this.control?.frozen(id)?{turnId:s.turnId,kind:'waiting' as const}:privateNight(s,m.seat!);}
 tick(){const changed:string[]=[];const rows=this.db.prepare("SELECT n.room_id FROM night_games n JOIN preparations p ON p.room_id=n.room_id WHERE p.game_mode='automatic'").all() as {room_id:string}[];
  for(const row of rows)this.db.transaction(()=>{const old=this.row(row.room_id)!;if(this.control?.frozen(row.room_id))return;if(old.deadline===null||old.deadline>this.now())return;const next=structuredClone(old);advanceNight(next,this.now(),undefined,(s,now)=>this.control?.grace(row.room_id,s,now));this.save(row.room_id,next,old);if(next.turnId!==old.turnId||next.deadline!==old.deadline)changed.push(row.room_id);}).immediate();return changed;
 }
 testAdvance(id:string){this.mutate(id,s=>{if(s.deadline===null)throw new LobbyError('PHASE_LOCKED',409);if(this.control?.hasGrace(id,s))throw new LobbyError('GRACE_ACTIVE',409);s.deadline=this.now();advanceNight(s,this.now());});}
}
