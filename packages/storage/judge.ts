import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import {judgeAppointSchema,judgeDraftSchema,judgeSupplementSchema,judgeReturnSchema,type JudgeAppoint,type JudgeDraftCommand,type JudgeSupplement,type JudgeReturn,type JudgePrivate,type JudgePublic} from '../contracts/judge.js';
import {emptyRecord,type RecordDocument} from '../contracts/records.js';
import type {FirstDayRules} from '../contracts/day.js';
import {isWolfRole,type RoomBoardSnapshot} from '../contracts/board.js';
import type {MemberRow} from './preparation.js';
import {createNight,publicNight,privateNight,type NightState} from '../domain/night.js';
import {dayCommand,publicDay,privateDay,type DayState} from '../domain/day.js';
import {runtimeFacts,assertOfficialAgreement,phaseDuration,supplementRuntime,type JudgeRuntime} from '../domain/judge.js';
interface Assignment {member_id:string|null;version:number}
interface Manual {status:string;version:number;official:string;request:string|null}
interface Draft {id:string;version:number;manual_version:number;assignment_version:number;state:string}
export class JudgeStore {
 constructor(private db:Database.Database,private member:(token:string,id:string)=>MemberRow,private validSession:(token:string)=>boolean,private board:(id:string)=>RoomBoardSnapshot,private rules:FirstDayRules,private now:()=>number){
  db.exec(`CREATE TABLE IF NOT EXISTS room_judges(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,member_id TEXT REFERENCES members(id) ON DELETE SET NULL,version INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS judge_audit(id INTEGER PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,at INTEGER NOT NULL,operator_member TEXT NOT NULL,operator_seat INTEGER,action TEXT NOT NULL,detail TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS judge_drafts(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,member_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0,manual_version INTEGER NOT NULL,assignment_version INTEGER NOT NULL,state TEXT NOT NULL,source TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
   CREATE UNIQUE INDEX IF NOT EXISTS judge_active_draft ON judge_drafts(room_id) WHERE active=1;
   CREATE TABLE IF NOT EXISTS judge_requests(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,request_id TEXT NOT NULL,member_id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(room_id,request_id));
   CREATE TABLE IF NOT EXISTS judge_manual_checkpoints(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,at INTEGER NOT NULL,state TEXT NOT NULL,control TEXT);
   CREATE TABLE IF NOT EXISTS judge_revision_private_causes(room_id TEXT NOT NULL REFERENCES record_rooms(room_id),version INTEGER NOT NULL,seat INTEGER NOT NULL,PRIMARY KEY(room_id,version,seat));
   CREATE TABLE IF NOT EXISTS judge_knowledge(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,member_id TEXT NOT NULL,seat INTEGER NOT NULL,PRIMARY KEY(room_id,member_id));
   CREATE TABLE IF NOT EXISTS judge_stale_turns(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,turn_id TEXT NOT NULL,PRIMARY KEY(room_id,turn_id));`);
 }
 private assignment(id:string):Assignment{return this.db.prepare('SELECT member_id,version FROM room_judges WHERE room_id=?').get(id) as Assignment|undefined??{member_id:null,version:0};}
 private manual(id:string){return this.db.prepare('SELECT * FROM manual_games WHERE room_id=?').get(id) as Manual|undefined;}
 private read<T>(kind:'night'|'day',id:string):T|null{const row=this.db.prepare(`SELECT state FROM ${kind}_games WHERE room_id=?`).get(id) as {state:string}|undefined;return row?JSON.parse(row.state):null;}
 private active(id:string){const night=this.read<NightState>('night',id),day=this.read<DayState>('day',id);return {night,day,kind:day&&(!night||day.day>=night.night)?'day' as const:'night' as const};}
 private authenticated(token:string,id:string){if(!this.validSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.member(token,id);}
 isJudge(id:string,m:MemberRow){return this.assignment(id).member_id===m.id;}
 private assertJudge(token:string,id:string){const m=this.authenticated(token,id);if(!this.isJudge(id,m))throw new LobbyError('JUDGE_ONLY',403);return m;}
 assertPlayer(id:string,m:MemberRow){if(this.isJudge(id,m))throw new LobbyError('JUDGE_PLAYER_ACTION',403);}
 assertFreshTurn(id:string,turnId:string){if(this.db.prepare('SELECT 1 FROM judge_stale_turns WHERE room_id=? AND turn_id=?').get(id,turnId))throw new LobbyError('STALE_TURN',409);}
 private publicDead(id:string){const manual=this.manual(id);if(manual)return (JSON.parse(manual.official) as RecordDocument).deaths.map(d=>d.seat);return this.active(id).day?.deaths.map(d=>d.seat)??[];}
 private queued(id:string,seat:number){const d=this.active(id).day;return !!d&&(d.pendingDeaths.some(p=>p.seat===seat)||d.tasks.some(t=>t.seat===seat&&t.step==='skill')||d.currentDeath===seat&&['death_skill','hunter_target','white_wolf_target'].includes(d.phase));}
 public(id:string):JudgePublic{
  const a=this.assignment(id);const m=a.member_id?this.db.prepare('SELECT seat FROM members WHERE room_id=? AND id=?').get(id,a.member_id) as {seat:number|null}|undefined:undefined;
  const members=this.db.prepare('SELECT seat FROM members WHERE room_id=? AND seat IS NOT NULL').all(id) as {seat:number}[];
  return {seat:m?.seat??null,version:a.version,candidates:this.publicDead(id).filter(seat=>members.some(m=>m.seat===seat)&&(!!this.manual(id)||!this.queued(id,seat))).sort((a,b)=>a-b)};
 }
 private bump(id:string){this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);}
 audit(id:string,m:MemberRow,action:string,detail:unknown){this.db.prepare('INSERT INTO judge_audit(room_id,at,operator_member,operator_seat,action,detail) VALUES (?,?,?,?,?,?)').run(id,this.now(),m.id,m.seat,action,JSON.stringify(detail));}
 captureManualCheckpoint(token:string,id:string){
  const host=this.member(token,id);if(!host.is_host)throw new LobbyError('HOST_ONLY',403);if(this.manual(id))return;
  const state=this.active(id),control=this.db.prepare('SELECT * FROM room_controls WHERE room_id=?').get(id)??null;
  this.db.prepare('INSERT INTO judge_manual_checkpoints VALUES (?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET at=excluded.at,state=excluded.state,control=excluded.control').run(id,this.now(),JSON.stringify(state),JSON.stringify(control));
 }
 private endNomineeInterjection(id:string,target:MemberRow,host:MemberRow){
  const day=this.read<DayState>('day',id);if(!day?.interjection||day.interjection.seat!==target.seat)return;
  const control=this.db.prepare('SELECT status FROM room_controls WHERE room_id=?').get(id) as {status:string}|undefined;
  const manual=this.manual(id),checkpoint=this.db.prepare('SELECT at FROM judge_manual_checkpoints WHERE room_id=?').get(id) as {at:number}|undefined;
  const oldTurn=day.turnId,remaining=day.interjection.remainingSpeechMs;
  const at=day.interjection.pausedElapsedMs!==undefined?day.interjection.startedAt+day.interjection.pausedElapsedMs:manual?checkpoint?.at??day.interjection.startedAt:this.now();
  // Reuse the ordinary completion operation with a frozen boundary. Time spent
  // paused, resuming or in manual mode cannot consume the player's old budget.
  day.deadline=null;dayCommand(day,{seat:host.seat!,isHost:true},{action:'end_interjection',turnId:oldTurn},at);
  if(manual||control?.status!=='running')day.deadline=null;
  this.db.prepare('UPDATE day_games SET state=? WHERE room_id=?').run(JSON.stringify(day),id);
  if(!manual)this.db.prepare("UPDATE room_controls SET remaining_ms=CASE WHEN status='running' THEN NULL ELSE ? END,kind='day',turn_id=?,version=version+1 WHERE room_id=?").run(remaining,day.turnId,id);
  this.audit(id,host,'interjection-ended-for-appointment',{seat:target.seat,oldTurn,newTurn:day.turnId,remainingSpeechMs:remaining});
 }
 appoint(token:string,id:string,input:JudgeAppoint){const p=judgeAppointSchema.safeParse(input);if(!p.success)throw new LobbyError('INVALID_INPUT');const c=p.data;this.db.transaction(()=>{
  const host=this.authenticated(token,id);if(!host.is_host)throw new LobbyError('HOST_ONLY',403);const a=this.assignment(id);if(a.version!==c.version)throw new LobbyError('STALE_JUDGE',409);
  const prep=this.db.prepare('SELECT phase FROM preparations WHERE room_id=?').get(id) as {phase:string};if(prep.phase!=='started')throw new LobbyError('PHASE_LOCKED',409);
  let target:MemberRow|undefined;
  if(c.seat!==null){target=this.db.prepare('SELECT * FROM members WHERE room_id=? AND seat=?').get(id,c.seat) as MemberRow|undefined;if(!target||!this.public(id).candidates.includes(c.seat))throw new LobbyError('INVALID_JUDGE',409);
   if(this.manual(id)&&!c.deathSkillsComplete)throw new LobbyError('JUDGE_ATTESTATION_REQUIRED',409);
  }
  if(target)this.endNomineeInterjection(id,target,host);
  this.db.prepare('INSERT INTO room_judges(room_id,member_id,version) VALUES (?,?,?) ON CONFLICT(room_id) DO UPDATE SET member_id=excluded.member_id,version=excluded.version').run(id,target?.id??null,a.version+1);
  if(target)this.db.prepare('INSERT OR IGNORE INTO judge_knowledge VALUES (?,?,?)').run(id,target.id,target.seat);
  this.db.prepare('UPDATE judge_drafts SET active=0 WHERE room_id=?').run(id);this.audit(id,host,'appoint',{seat:c.seat,manualDeathSkillsComplete:!!this.manual(id)&&c.deathSkillsComplete===true,version:a.version+1});this.bump(id);
 }).immediate();}
 private draft(id:string){return this.db.prepare('SELECT * FROM judge_drafts WHERE room_id=? AND active=1').get(id) as Draft|undefined;}
 private expected(id:string,c:JudgeDraftCommand){const m=this.manual(id);if(!m)throw new LobbyError('MANUAL_MODE_REQUIRED',409);if(m.status!=='playing'||m.request)throw new LobbyError('JUDGE_RETURN_BLOCKED',409);if(m.version!==c.manualVersion||this.assignment(id).version!==c.assignmentVersion)throw new LobbyError('STALE_JUDGE',409);return m;}
 private once(id:string,m:MemberRow,c:{requestId:string},payload:unknown){const value=JSON.stringify(payload),prior=this.db.prepare('SELECT * FROM judge_requests WHERE room_id=? AND request_id=?').get(id,c.requestId) as {member_id:string;payload:string}|undefined;if(prior){if(prior.member_id!==m.id||prior.payload!==value)throw new LobbyError('STALE_JUDGE',409);return true;}this.db.prepare('INSERT INTO judge_requests VALUES (?,?,?,?)').run(id,c.requestId,m.id,value);return false;}
 start(token:string,id:string,input:JudgeDraftCommand){const p=judgeDraftSchema.safeParse(input);if(!p.success)throw new LobbyError('INVALID_INPUT');const c=p.data;this.db.transaction(()=>{
  const m=this.assertJudge(token,id);this.expected(id,c);if(this.once(id,m,c,{action:'draft',...c}))return;
  const a=this.active(id),checkpoint=this.db.prepare('SELECT at,state,control FROM judge_manual_checkpoints WHERE room_id=?').get(id) as {at:number;state:string;control:string|null}|undefined;
  const source=JSON.stringify({...a,...(checkpoint?{automaticCheckpoint:{at:checkpoint.at,state:JSON.parse(checkpoint.state),control:checkpoint.control?JSON.parse(checkpoint.control):null}}:{})});let night=a.night;
  if(!night){const roster=this.db.prepare('SELECT m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id WHERE m.room_id=? AND m.seat IS NOT NULL AND i.confirmed=1').all(id) as {seat:number;role:Role}[];if(roster.length!==this.board(id).composition.seatCount)throw new LobbyError('IDENTITY_INCOMPLETE',409);night=createNight(roster,this.now(),undefined,this.board(id));}
  const history=(this.db.prepare('SELECT kind,round,state FROM game_history WHERE room_id=?').all(id) as {kind:'night'|'day';round:number;state:string}[]).map(h=>({...h,state:JSON.parse(h.state)}));
  const runtime:JudgeRuntime={clock:this.now(),night,day:a.day,kind:a.kind,history};const current=runtime.kind==='night'?runtime.night:runtime.day!;const duration=phaseDuration(runtime.kind,current);current.deadline=duration===null?null:runtime.clock+duration;
  this.db.prepare('UPDATE judge_drafts SET active=0 WHERE room_id=?').run(id);this.db.prepare('INSERT INTO judge_drafts(id,room_id,member_id,manual_version,assignment_version,state,source) VALUES (?,?,?,?,?,?,?)').run(randomUUID(),id,m.id,c.manualVersion,c.assignmentVersion,JSON.stringify(runtime),source);this.audit(id,m,'draft',{requestId:c.requestId});
 }).immediate();return this.private(token,id);}
 supplement(token:string,id:string,input:JudgeSupplement){const p=judgeSupplementSchema.safeParse(input);if(!p.success)throw new LobbyError('INVALID_INPUT');const c=p.data;this.db.transaction(()=>{
  const m=this.assertJudge(token,id);this.expected(id,c);if(this.once(id,m,c,{action:'supplement',...c}))return;const d=this.draft(id);if(!d||d.id!==c.draftId||d.version!==c.draftVersion||d.assignment_version!==c.assignmentVersion||d.manual_version!==c.manualVersion)throw new LobbyError('STALE_JUDGE',409);
  const runtime=JSON.parse(d.state) as JudgeRuntime;const host=this.db.prepare('SELECT seat FROM members WHERE room_id=? AND is_host=1').get(id) as {seat:number};supplementRuntime(runtime,c.operation,this.board(id),this.rules,host.seat);
  this.db.prepare('UPDATE judge_drafts SET state=?,version=version+1 WHERE id=?').run(JSON.stringify(runtime),d.id);this.audit(id,m,'supplement',{requestId:c.requestId,draftId:d.id,version:d.version+1,operation:c.operation});
 }).immediate();return this.private(token,id);}
 private frozenRuntime(id:string){const d=this.draft(id);if(d)return JSON.parse(d.state) as JudgeRuntime;const a=this.active(id);return a.night?{clock:this.now(),night:a.night,day:a.day,kind:a.kind,history:[]} satisfies JudgeRuntime:null;}
 private project(id:string,runtime:JudgeRuntime|null){const current=runtime?.kind==='day'?runtime.day:runtime?.night;const roster=current?.players??this.db.prepare('SELECT m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id WHERE m.room_id=? AND m.seat IS NOT NULL ORDER BY m.seat').all(id) as {seat:number;role:Role;alive?:boolean}[];
  const official=this.manual(id);const doc=official?{...JSON.parse(official.official),notes:''}:runtime?runtimeFacts(runtime):emptyRecord();
  return {roles:roster.map(p=>{const e=current?.engine?.players.find(e=>e.seat===p.seat);return {seat:p.seat,role:p.role,...(p.role==='witch'?{inventory:{antidote:runtime?.night.antidote??true,poison:runtime?.night.poison??true}}:p.role==='hunter'?{inventory:{hunterSpent:(runtime?.kind==='day'?runtime.day?.hunterSpent:runtime?.night.hunterSpent)??false}}:{}),alive:p.alive??!doc.deaths.some((d:{seat:number})=>d.seat===p.seat),...(e?{abilities:e.abilities,learning:e.learning,model:e.model}:{})};}),official:doc as RecordDocument};
 }
 private(token:string,id:string):JudgePrivate{
  this.assertJudge(token,id);const d=this.draft(id),runtime=this.frozenRuntime(id),projection=this.project(id,runtime),n=runtime?.night??null,day=runtime?.day??null;const current=runtime?.kind==='day'?day:n;
  const describe=(kind:'night'|'day',round:number,state:NightState|DayState):JudgePrivate['history'][number]=>({kind,round,events:state.events,...(kind==='night'?{nightDetails:{knife:(state as NightState).knife,witchChoice:(state as NightState).witchChoice,seerCheck:(state as NightState).seerCheck,hunterSeen:(state as NightState).hunterSeen,...(state.engine?{actions:state.engine.actions}:{})}}:{})});
  const history=(this.db.prepare('SELECT kind,round,state FROM game_history WHERE room_id=?').all(id) as {kind:'night'|'day';round:number;state:string}[]).map(h=>describe(h.kind,h.round,JSON.parse(h.state)));
  if(runtime){for(const h of runtime.history)if(!history.some(x=>x.kind===h.kind&&x.round===h.round))history.push(describe(h.kind,h.round,h.state));if(n)history.push(describe('night',n.night,n));if(day)history.push(describe('day',day.day,day));}
  return {assignmentVersion:this.assignment(id).version,manualVersion:this.manual(id)?.version??null,...projection,night:n?{...publicNight(n,this.now()),deadline:null}:null,day:day?{...publicDay(day,this.now()),deadline:null}:null,cards:projection.roles.map(p=>({seat:p.seat,night:n?privateNight(n,p.seat):null,day:day?privateDay(day,p.seat):null})),history,draft:d&&runtime&&current?{id:d.id,version:d.version,manualVersion:d.manual_version,assignmentVersion:d.assignment_version,kind:runtime.kind,round:runtime.kind==='night'?n!.night:day!.day,phase:current.phase,turnId:current.turnId}:null,audit:this.db.prepare('SELECT at,operator_seat AS operatorSeat,action FROM judge_audit WHERE room_id=? ORDER BY id').all(id) as JudgePrivate['audit']};
 }
 return(token:string,id:string,input:JudgeReturn){const p=judgeReturnSchema.safeParse(input);if(!p.success)throw new LobbyError('INVALID_INPUT');const c=p.data;this.db.transaction(()=>{
  const m=this.assertJudge(token,id);if(this.assignment(id).version!==c.assignmentVersion)throw new LobbyError('STALE_JUDGE',409);if(this.once(id,m,c,{action:'return',...c}))return;const manual=this.expected(id,c);const d=this.draft(id);if(!d||d.id!==c.draftId||d.version!==c.draftVersion||d.manual_version!==c.manualVersion||d.assignment_version!==c.assignmentVersion)throw new LobbyError('STALE_JUDGE',409);
  const runtime=JSON.parse(d.state) as JudgeRuntime,current=runtime.kind==='night'?runtime.night:runtime.day!;
  const terminal=runtime.kind==='day'&&runtime.day?.phase==='ended'&&runtime.day.winner!==null;
  if(current.phase==='rules_pending'||current.phase==='ended'&&!terminal||current.engine?.victory.status==='unresolved'||current.engine?.victory.status==='ended'&&!terminal&&!(current.engine.victory.winner==='good'&&current.extraNightSeat!=null)||current.engine?.resolution?.status==='blocked'||!current.players.some(p=>isWolfRole(p.role)))throw new LobbyError('JUDGE_RETURN_BLOCKED',409);
  const assignedSeat=m.seat,day=runtime.day;
  if(day&&assignedSeat!==null&&(day.pendingDeaths.some(p=>p.seat===assignedSeat)||day.tasks.some(t=>t.seat===assignedSeat&&t.step==='skill')||day.currentDeath===assignedSeat&&['death_skill','hunter_target','white_wolf_target'].includes(day.phase)))throw new LobbyError('JUDGE_RETURN_BLOCKED',409);
  if((this.db.prepare('SELECT seat FROM judge_knowledge WHERE room_id=?').all(id) as {seat:number}[]).some(known=>current.players.some(p=>p.seat===known.seat&&p.alive!==false)))throw new LobbyError('JUDGE_KNOWLEDGE_CONFLICT',409);
  const canonical=assertOfficialAgreement(runtime,JSON.parse(manual.official));
  const before=this.active(id);for(const state of [before.night,before.day,current])if(state)this.db.prepare('INSERT OR IGNORE INTO judge_stale_turns VALUES (?,?)').run(id,state.turnId);
  const oldTurn=current.turnId,newTurn=randomUUID();current.turnId=newTurn;const duration=phaseDuration(runtime.kind,current);current.deadline=null;
  if(runtime.kind==='night'){const n=runtime.night;for(const field of ['witchTurnId','seerTurnId','seerFinishTurnId','hunterTurnId'] as const)if(n[field]===oldTurn)n[field]=newTurn;for(const lock of Object.values(n.mechanical?.locked??{}))if(lock.turnId===oldTurn)lock.turnId=newTurn;for(const [seat,turn] of Object.entries(n.mechanical?.seen??{}))if(turn===oldTurn)n.mechanical!.seen[Number(seat)]=newTurn;}
  else if(runtime.day?.interjection){runtime.day.interjection.startedAt=this.now();runtime.day.interjection.pausedElapsedMs=0;runtime.day.interjection.remainingSpeechMs=90000;}
  for(const h of runtime.history)this.db.prepare('INSERT INTO game_history(room_id,kind,round,state) VALUES (?,?,?,?) ON CONFLICT(room_id,kind,round) DO UPDATE SET state=excluded.state').run(id,h.kind,h.round,JSON.stringify(h.state));
  this.db.prepare('INSERT INTO night_games VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(runtime.night));if(runtime.day)this.db.prepare('INSERT INTO day_games VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET state=excluded.state').run(id,JSON.stringify(runtime.day));
  // All independent record drafts, versions and manual revisions remain archived.
  this.db.prepare('INSERT OR IGNORE INTO manual_revisions(room_id,version,at,document,outcome) VALUES (?,?,?,?,NULL)').run(id,manual.version,this.now(),JSON.stringify({...JSON.parse(manual.official),notes:''}));
  this.db.prepare("INSERT OR IGNORE INTO manual_revision_sources VALUES (?,?,'computed')").run(id,manual.version);
  this.db.prepare('INSERT INTO manual_revisions(room_id,version,at,document,outcome) VALUES (?,?,?,?,?)').run(id,manual.version+1,this.now(),JSON.stringify(canonical),terminal?runtime.day!.winner:null);
  const priorOfficial=JSON.parse(manual.official) as RecordDocument;
  for(const death of canonical.deaths)if(!priorOfficial.deaths.some(prior=>prior.seat===death.seat&&prior.cause!=='unrecorded'))this.db.prepare('INSERT INTO judge_revision_private_causes VALUES (?,?,?)').run(id,manual.version+1,death.seat);
  if(terminal)this.db.prepare('UPDATE record_rooms SET ended=1 WHERE room_id=?').run(id);
  this.db.prepare("INSERT INTO manual_revision_sources VALUES (?,?,'computed')").run(id,manual.version+1);
  this.audit(id,m,'official-supplement',{manualVersion:manual.version+1,facts:{...canonical,notes:''}});
  this.db.prepare('DELETE FROM manual_games WHERE room_id=?').run(id);this.db.prepare("UPDATE preparations SET game_mode='automatic' WHERE room_id=?").run(id);
  this.db.prepare("INSERT INTO room_controls(room_id,status,remaining_ms,kind,turn_id) VALUES (?,'paused',?,?,?) ON CONFLICT(room_id) DO UPDATE SET status='paused',remaining_ms=excluded.remaining_ms,resume_at=NULL,kind=excluded.kind,turn_id=excluded.turn_id,temp_member=NULL,version=room_controls.version+1").run(id,duration,runtime.kind,newTurn);
  if(terminal)this.db.prepare("UPDATE room_controls SET status='running',remaining_ms=NULL,resume_at=NULL WHERE room_id=?").run(id);
  this.db.prepare('UPDATE judge_drafts SET active=0 WHERE id=?').run(d.id);this.audit(id,m,'return',{requestId:c.requestId,draftId:d.id,version:d.version,manualVersion:c.manualVersion,oldTurn,newTurn});this.bump(id);
 }).immediate();}
}
