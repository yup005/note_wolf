import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {LobbyError,type Role} from '../contracts/index.js';
import {emptyRecord,recordDocumentSchema,manualAdjudicateSchema,manualFinishSchema,type ManualAdjudicate,type ManualFinish,type RecordOutcomeSource,type RecordDocument,type RecordDraft,type RecordList,type RecordPost,type RecordPostSummary,type RecordFavorite,type ManualPublic,type OfficialRevision} from '../contracts/records.js';
import {manualDecision,type ManualVictoryFact} from '../domain/manual.js';
import type {EngineState} from '../contracts/engine.js';
import {type BoardComposition,type IdiotPolicy,isWolfRole} from '../contracts/board.js';
import {summarizeReplay} from '../domain/replay.js';
import type {DayState} from '../domain/day.js';
import type {GameReplay} from '../contracts/game.js';
import type {AuthStore} from './auth.js';
interface Archive {room_id:string;code:string;roles:string;participants:string;host_owner:string;ended:number;victory_facts:string|null;board_metadata:string|null;idiot_policy:IdiotPolicy|null;record_only_ended:number}
interface DraftRow {id:string;room_id:string;owner:string;author:string;official:number;draft:string;revision:number;published_version:number|null;withdrawn:number;published_at:number}
interface ManualRow {room_id:string;status:ManualPublic['status'];version:number;official:string;winner:'wolves'|'good'|null;request:string|null}
export class RecordsStore {
 constructor(private db:Database.Database,private auth:AuthStore,private now:()=>number,private replay:(id:string)=>GameReplay){
  db.exec(`CREATE TABLE IF NOT EXISTS record_rooms(room_id TEXT PRIMARY KEY,code TEXT NOT NULL,roles TEXT NOT NULL,participants TEXT NOT NULL,host_owner TEXT NOT NULL,ended INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS record_official_snapshots(room_id TEXT PRIMARY KEY REFERENCES record_rooms(room_id),document TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS record_drafts(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES record_rooms(room_id),owner TEXT NOT NULL,author TEXT NOT NULL,official INTEGER NOT NULL,draft TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,published_version INTEGER,withdrawn INTEGER NOT NULL DEFAULT 0,published_at INTEGER NOT NULL DEFAULT 0,UNIQUE(room_id,owner));
   CREATE TABLE IF NOT EXISTS record_versions(record_id TEXT NOT NULL REFERENCES record_drafts(id),version INTEGER NOT NULL,document TEXT NOT NULL,outcome TEXT,published_at INTEGER NOT NULL,PRIMARY KEY(record_id,version));
   CREATE TABLE IF NOT EXISTS record_favorites(owner TEXT NOT NULL,record_id TEXT NOT NULL REFERENCES record_drafts(id),saved_at INTEGER NOT NULL,PRIMARY KEY(owner,record_id));
   CREATE TABLE IF NOT EXISTS manual_games(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'playing',version INTEGER NOT NULL DEFAULT 0,official TEXT NOT NULL,winner TEXT,request TEXT);
   CREATE TABLE IF NOT EXISTS manual_revisions(room_id TEXT NOT NULL REFERENCES record_rooms(room_id),version INTEGER NOT NULL,at INTEGER NOT NULL,document TEXT NOT NULL,outcome TEXT,PRIMARY KEY(room_id,version));
   PRAGMA user_version=12;`);
  db.exec(`CREATE TABLE IF NOT EXISTS manual_adjudications(room_id TEXT PRIMARY KEY REFERENCES record_rooms(room_id),winner TEXT NOT NULL,version INTEGER NOT NULL,at INTEGER NOT NULL,host_owner TEXT NOT NULL); CREATE TABLE IF NOT EXISTS manual_revision_sources(room_id TEXT NOT NULL REFERENCES record_rooms(room_id),version INTEGER NOT NULL,source TEXT NOT NULL,PRIMARY KEY(room_id,version)); CREATE TABLE IF NOT EXISTS record_version_sources(record_id TEXT NOT NULL REFERENCES record_drafts(id),version INTEGER NOT NULL,source TEXT NOT NULL,PRIMARY KEY(record_id,version));`);
  if(!(db.prepare('PRAGMA table_info(record_rooms)').all() as {name:string}[]).some(c=>c.name==='victory_facts'))db.exec('ALTER TABLE record_rooms ADD COLUMN victory_facts TEXT');
  if(!(db.prepare('PRAGMA table_info(record_rooms)').all() as {name:string}[]).some(c=>c.name==='board_metadata'))db.exec('ALTER TABLE record_rooms ADD COLUMN board_metadata TEXT');
  if(!(db.prepare('PRAGMA table_info(record_rooms)').all() as {name:string}[]).some(c=>c.name==='idiot_policy'))db.exec('ALTER TABLE record_rooms ADD COLUMN idiot_policy TEXT');
  if(!(db.prepare('PRAGMA table_info(record_rooms)').all() as {name:string}[]).some(c=>c.name==='record_only_ended'))db.exec('ALTER TABLE record_rooms ADD COLUMN record_only_ended INTEGER NOT NULL DEFAULT 0');
  db.exec("UPDATE record_rooms SET idiot_policy=(SELECT json_extract(composition,'$.idiotPolicy') FROM room_boards b WHERE b.room_id=record_rooms.room_id) WHERE idiot_policy IS NULL;");
  db.exec("UPDATE record_rooms SET board_metadata=(SELECT json_object('id',id,'name',name) FROM room_boards b WHERE b.room_id=record_rooms.room_id) WHERE board_metadata IS NULL;");
  db.transaction(()=>{for(const r of db.prepare("SELECT room_id FROM preparations WHERE phase='started' AND game_mode='manual'").all() as {room_id:string}[])this.start(r.room_id);}).immediate();
 }
 capture(id:string):Archive {
  const archived=this.db.prepare('SELECT * FROM record_rooms WHERE room_id=?').get(id) as Archive|undefined;if(archived)return archived;
  const prep=this.db.prepare('SELECT phase FROM preparations WHERE room_id=?').get(id) as {phase:string}|undefined;if(prep?.phase!=='started')throw new LobbyError('PHASE_LOCKED',409);
  const members=this.db.prepare('SELECT m.session_hash AS owner,m.nickname,m.is_host,m.seat,i.role FROM members m JOIN identities i ON i.room_id=m.room_id AND i.member_id=m.id WHERE m.room_id=? ORDER BY m.seat').all(id) as {owner:string;nickname:string;is_host:number;seat:number;role:Role}[];
  const composition=JSON.parse((this.db.prepare('SELECT composition FROM room_boards WHERE room_id=?').get(id) as {composition:string}).composition) as BoardComposition;
  if(members.length!==composition.seatCount||new Set(members.map(m=>m.seat)).size!==composition.seatCount||members.some(m=>!Number.isSafeInteger(m.seat)||m.seat<1||m.seat>composition.seatCount)||Object.entries(composition.roles).some(([role,count])=>members.filter(m=>m.role===role).length!==count)||members.some(m=>!composition.roles[m.role]))throw new LobbyError('IDENTITY_INCOMPLETE',409);
  const room=this.db.prepare('SELECT code FROM rooms WHERE id=?').get(id) as {code:string};
  this.db.prepare('INSERT INTO record_rooms(room_id,code,roles,participants,host_owner,ended) VALUES (?,?,?,?,?,0)').run(id,room.code,JSON.stringify(members.map(({seat,role})=>({seat,role}))),JSON.stringify(members.map(m=>m.owner)),members.find(m=>m.is_host)!.owner);
  this.db.prepare("UPDATE record_rooms SET board_metadata=(SELECT json_object('id',id,'name',name) FROM room_boards WHERE room_id=?) WHERE room_id=?").run(id,id);
  this.db.prepare('UPDATE record_rooms SET idiot_policy=? WHERE room_id=?').run(composition.idiotPolicy??null,id);
  return this.db.prepare('SELECT * FROM record_rooms WHERE room_id=?').get(id) as Archive;
 }
 // Capture authorized record evidence before runtime foreign-key cascades remove it.
 // Keep private drafts and published versions unchanged; ongoing rooms stay locked.
 preserveForRoomCleanup(id:string):void{
  if(!this.db.prepare('SELECT 1 FROM record_rooms WHERE room_id=?').get(id))return;
  this.victoryFacts(id,this.capture(id));
  const ended=this.ended(id),document=this.officialDocument(id);
  this.db.prepare('INSERT INTO record_official_snapshots VALUES (?,?) ON CONFLICT(room_id) DO UPDATE SET document=excluded.document').run(id,JSON.stringify(document));
  if(ended)this.db.prepare('UPDATE record_rooms SET ended=1 WHERE room_id=?').run(id);
 }
 private preservedDocument(id:string):RecordDocument|null{
  const row=this.db.prepare('SELECT document FROM record_official_snapshots WHERE room_id=?').get(id) as {document:string}|undefined;
  return row?JSON.parse(row.document):null;
 }
 private victoryFacts(id:string,archive:Archive):ManualVictoryFact[]{
  const rows=this.db.prepare('SELECT state FROM day_games WHERE room_id=? UNION ALL SELECT state FROM night_games WHERE room_id=?').all(id,id) as {state:string}[];
  const states=rows.map(r=>JSON.parse(r.state) as {engine?:EngineState;extraNightSeat?:number|null}).filter(s=>s.engine).sort((a,b)=>b.engine!.night-a.engine!.night);
  const latest=states[0],engine=latest?.engine;
  if(!engine)return archive.victory_facts?JSON.parse(archive.victory_facts):[];
  const roles=JSON.parse(archive.roles) as {seat:number;role:Role}[];
  if(roles.length!==engine.players.length||roles.some(p=>!engine.players.some(e=>e.seat===p.seat&&e.role===p.role)))throw new LobbyError('INVALID_VICTORY_STATE');
  // Successful learning is frozen; a dead unlearned actor cannot learn later.
  // Alive unlearned actors can learn offline after switching to manual.
  const facts=engine.players.map(p=>({seat:p.seat,learnedRole:p.abilities.mimickedRole,learningKnown:!!p.learning||!p.alive,extraNightPending:latest.extraNightSeat!==undefined&&latest.extraNightSeat!==null,...(p.model?{modelSeat:p.model.seat,modelCamp:p.model.camp}:{})}));
  this.db.prepare('UPDATE record_rooms SET victory_facts=? WHERE room_id=?').run(JSON.stringify(facts),id);return facts;
 }
 private adjudicated(id:string){return this.db.prepare('SELECT winner FROM manual_adjudications WHERE room_id=?').get(id) as {winner:'wolves'|'good'}|undefined;}
 private outcomeSource(id:string):RecordOutcomeSource{if(this.capture(id).record_only_ended)return 'record-only';return this.adjudicated(id)?'host-adjudicated' as const:'computed' as const;}
 private decision(id:string,archive:Archive,document:RecordDocument){
  return manualDecision(JSON.parse(archive.roles),document.deaths.map(d=>d.seat),this.victoryFacts(id,archive),{idiotPolicy:archive.idiot_policy??undefined,flippedIdiots:document.exiles.flatMap(e=>e.seat===null?[]:[e.seat])});
 }
 private outcome(id:string,archive:Archive,document:RecordDocument){return this.adjudicated(id)?.winner??this.decision(id,archive,document).outcome;}
 private validateRoster(document:RecordDocument,archive:Archive){
  const seats=new Set((JSON.parse(archive.roles) as {seat:number}[]).map(p=>p.seat));
  const referenced=[...document.deaths.map(d=>d.seat),...document.badges.map(d=>d.seat),...document.exiles.map(d=>d.seat),...document.votes.flatMap(v=>v.ballots.flatMap(b=>[b.voter,b.target]))];
  if(referenced.some(seat=>seat!==null&&!seats.has(seat)))throw new LobbyError('INVALID_INPUT');
 }
 private participant(token:string,id:string){const a=this.capture(id),owner=this.auth.owner(token);if(!(JSON.parse(a.participants) as string[]).includes(owner))throw new LobbyError('PARTICIPANT_ONLY',403);return {a,owner};}
 private canRecord(token:string,a:Archive){return a.host_owner===this.auth.owner(token)||this.auth.account(token)?.vip?.active===true;}
 private host(token:string,id:string){const p=this.participant(token,id);if(p.a.host_owner!==p.owner)throw new LobbyError('HOST_ONLY',403);return p;}
 private manual(id:string){const r=this.db.prepare('SELECT * FROM manual_games WHERE room_id=?').get(id) as ManualRow|undefined;if(!r)throw new LobbyError('MANUAL_MODE_REQUIRED',409);return r;}
 private ended(id:string){const archive=this.capture(id);if(archive.ended)return true;const manual=this.db.prepare('SELECT status FROM manual_games WHERE room_id=?').get(id) as {status:string}|undefined;const day=this.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(id) as {state:string}|undefined;return manual?manual.status==='ended':!!day&&JSON.parse(day.state).phase==='ended';}
 private row(token:string,id:string,write=false){const {a,owner}=this.participant(token,id);if(write&&!this.canRecord(token,a))throw new LobbyError('RECORDER_ONLY',403);return this.db.prepare('SELECT * FROM record_drafts WHERE room_id=? AND owner=?').get(id,owner) as DraftRow|undefined;}
 private draft(r:DraftRow):RecordDraft{return {id:r.id,revision:r.revision,document:JSON.parse(r.draft),publishedVersion:r.published_version,withdrawn:!!r.withdrawn,official:!!r.official,shareManage:r.owner.startsWith('account:')};}
 private expected(r:DraftRow|undefined,revision:number):DraftRow{if(!r)throw new LobbyError('NOT_FOUND',404);if(r.revision!==revision)throw new LobbyError('STALE_RECORD',409);return r;}
 private summary(r:DraftRow):RecordPostSummary{const a=this.capture(r.room_id);return {id:r.id,code:a.code,author:r.author,official:!!r.official,version:r.published_version!,withdrawn:!!r.withdrawn,publishedAt:r.published_at};}
 list(token:string,id:string):RecordList{return this.db.transaction(()=>{
  const {a,owner}=this.participant(token,id),canRecord=this.canRecord(token,a);let r=this.row(token,id);
  if(canRecord&&!r){const member=this.db.prepare('SELECT nickname FROM members WHERE room_id=? AND session_hash=?').get(id,owner) as {nickname:string}|undefined;let document=emptyRecord();
   if(owner===a.host_owner){const manual=this.db.prepare('SELECT official FROM manual_games WHERE room_id=?').get(id) as {official:string}|undefined;if(manual)document=JSON.parse(manual.official);else if(this.ended(id))document=this.automaticDocument(id);}
   this.db.prepare('INSERT INTO record_drafts(id,room_id,owner,author,official,draft) VALUES (?,?,?,?,?,?)').run(randomUUID(),id,owner,member?.nickname??this.auth.account(token)?.nickname??'记录者',owner===a.host_owner?1:0,JSON.stringify(document));r=this.row(token,id);
  }
  const posts=this.ended(id)?(this.db.prepare('SELECT * FROM record_drafts WHERE room_id=? AND published_version IS NOT NULL ORDER BY official DESC,published_at DESC,id').all(id) as DraftRow[]).map(r=>this.summary(r)):[];
  return {canRecord,own:r?this.draft(r):null,posts};
 }).immediate();}
 save(token:string,id:string,revision:number,document:RecordDocument){const parsed=recordDocumentSchema.safeParse(document);if(!parsed.success)throw new LobbyError('INVALID_INPUT');return this.db.transaction(()=>{const r=this.expected(this.row(token,id,true),revision);this.validateRoster(parsed.data,this.capture(id));this.db.prepare('UPDATE record_drafts SET draft=?,revision=revision+1 WHERE id=?').run(JSON.stringify(parsed.data),r.id);return this.draft(this.row(token,id)!);}).immediate();}
 importAutomatic(token:string,id:string,revision:number){return this.db.transaction(()=>{const r=this.expected(this.row(token,id,true),revision);const document=this.automaticDocument(id);const existing=JSON.parse(r.draft) as RecordDocument;if(existing.notes)document.notes=existing.notes;return this.save(token,id,revision,document);}).immediate();}
 private officialDocument(id:string):RecordDocument{
  const manual=this.db.prepare('SELECT official FROM manual_games WHERE room_id=?').get(id) as {official:string}|undefined;if(manual)return JSON.parse(manual.official);
  const history=this.db.prepare('SELECT document FROM manual_revisions WHERE room_id=? ORDER BY version DESC LIMIT 1').get(id) as {document:string}|undefined;if(history)return JSON.parse(history.document);
  if(this.db.prepare('SELECT 1 FROM rooms WHERE id=?').get(id))return this.automaticDocument(id);
  const preserved=this.preservedDocument(id);if(preserved)return preserved;
  const published=this.db.prepare('SELECT v.document FROM record_drafts d JOIN record_versions v ON v.record_id=d.id AND v.version=d.published_version WHERE d.room_id=? AND d.official=1').get(id) as {document:string}|undefined;
  if(!published)throw new LobbyError('NOT_FOUND',404);return JSON.parse(published.document);
 }
 publish(token:string,id:string,revision:number){return this.db.transaction(()=>{const r=this.expected(this.row(token,id,true),revision);if(r.official&&this.ended(id)){const official=this.officialDocument(id);const dual=this.capture(id).idiot_policy==='dual-category-14';const signature=(d:RecordDocument)=>JSON.stringify({deaths:[...d.deaths].sort((a,b)=>a.seat-b.seat),...(dual?{exiles:[...d.exiles].sort((a,b)=>a.round-b.round||(a.seat??0)-(b.seat??0))}:{})});if(signature(official)!==signature(JSON.parse(r.draft)))throw new LobbyError('OFFICIAL_UNCOMMITTED',409);}
  if(!this.ended(id))throw new LobbyError('PHASE_LOCKED',409);const latest=r.published_version===null?null:this.db.prepare('SELECT document FROM record_versions WHERE record_id=? AND version=?').get(r.id,r.published_version) as {document:string}|undefined;if(latest?.document===r.draft){this.db.prepare('UPDATE record_drafts SET withdrawn=0 WHERE id=?').run(r.id);return this.summary(this.row(token,id)!);}
  const version=(this.db.prepare('SELECT COALESCE(MAX(version),0)+1 AS next FROM record_versions WHERE record_id=?').get(r.id) as {next:number}).next;const a=this.capture(id),document=JSON.parse(r.draft) as RecordDocument,outcome=r.official?this.outcome(id,a,document):this.decision(id,a,document).outcome;
  this.db.prepare('INSERT INTO record_versions VALUES (?,?,?,?,?)').run(r.id,version,r.draft,outcome,this.now());this.db.prepare('INSERT INTO record_version_sources VALUES (?,?,?)').run(r.id,version,r.official||a.record_only_ended?this.outcomeSource(id):'computed');this.db.prepare('UPDATE record_drafts SET published_version=?,withdrawn=0,published_at=? WHERE id=?').run(version,this.now(),r.id);this.db.prepare('UPDATE record_rooms SET ended=1 WHERE room_id=?').run(id);return this.summary(this.row(token,id)!);
 }).immediate();}
 withdraw(token:string,id:string,revision:number){return this.db.transaction(()=>{const r=this.expected(this.row(token,id),revision);if(r.published_version===null)throw new LobbyError('NOT_FOUND',404);this.db.prepare('UPDATE record_drafts SET withdrawn=1 WHERE id=?').run(r.id);return {withdrawn:true};}).immediate();}
 adminList(token:string,id:string){this.auth.requireAdmin(token);if(!this.ended(id))throw new LobbyError('PHASE_LOCKED',409);return (this.db.prepare('SELECT * FROM record_drafts WHERE room_id=? AND published_version IS NOT NULL ORDER BY official DESC,published_at DESC').all(id) as DraftRow[]).map(r=>this.summary(r));}
 post(token:string,recordId:string,version?:number,admin=false):RecordPost{if(admin)this.auth.requireAdmin(token);const r=this.db.prepare('SELECT * FROM record_drafts WHERE id=? AND published_version IS NOT NULL').get(recordId) as DraftRow|undefined;if(!r)throw new LobbyError('NOT_FOUND',404);const {a,owner}=admin?{a:this.capture(r.room_id),owner:this.auth.owner(token)}:this.participant(token,r.room_id);if(r.withdrawn)throw new LobbyError('RECORD_WITHDRAWN',409);if(!this.ended(r.room_id))throw new LobbyError('PHASE_LOCKED',409);const v=this.db.prepare('SELECT * FROM record_versions WHERE record_id=? AND version=?').get(recordId,version??r.published_version) as {document:string;outcome:'wolves'|'good'|null;version:number;published_at:number}|undefined;if(!v)throw new LobbyError('NOT_FOUND',404);
  const account=this.auth.account(token),manage=!admin&&!!account&&r.owner==='account:'+account.id;
  return {...this.summary(r),version:v.version,publishedAt:v.published_at,document:JSON.parse(v.document),outcome:v.outcome,outcomeSource:(this.db.prepare('SELECT source FROM record_version_sources WHERE record_id=? AND version=?').get(recordId,v.version) as {source:RecordOutcomeSource}|undefined)?.source??'computed',roles:JSON.parse(a.roles),versions:(this.db.prepare('SELECT version FROM record_versions WHERE record_id=? ORDER BY version DESC').all(recordId) as {version:number}[]).map(x=>x.version),saved:!!this.db.prepare('SELECT 1 FROM record_favorites WHERE owner=? AND record_id=?').get(owner,recordId),shareAccess:{manage,create:manage&&!!account?.vip?.active}};
 }
 favorite(token:string,recordId:string){this.post(token,recordId);this.db.prepare('INSERT OR IGNORE INTO record_favorites VALUES (?,?,?)').run(this.auth.owner(token),recordId,this.now());return {saved:true};}
 favorites(token:string):RecordFavorite[]{return (this.db.prepare('SELECT d.*,f.saved_at FROM record_drafts d JOIN record_favorites f ON f.record_id=d.id WHERE f.owner=? ORDER BY f.saved_at DESC,d.id').all(this.auth.owner(token)) as (DraftRow&{saved_at:number})[]).map(r=>({...this.summary(r),savedAt:r.saved_at,board:this.capture(r.room_id).board_metadata?JSON.parse(this.capture(r.room_id).board_metadata!):null}));}
 removeFavorite(token:string,id:string){this.db.prepare('DELETE FROM record_favorites WHERE owner=? AND record_id=?').run(this.auth.owner(token),id);return {saved:false};}
 start(id:string){const p=this.db.prepare('SELECT game_mode FROM preparations WHERE room_id=?').get(id) as {game_mode:string};this.capture(id);if(p.game_mode==='manual')this.db.prepare('INSERT OR IGNORE INTO manual_games(room_id,official) VALUES (?,?)').run(id,JSON.stringify(emptyRecord()));}
 private automaticDocument(id:string):RecordDocument{
  if(!this.db.prepare('SELECT 1 FROM rooms WHERE id=?').get(id)){const preserved=this.preservedDocument(id);if(preserved)return preserved;}
  const doc=emptyRecord(),ended=this.ended(id);
  const rows=this.db.prepare("SELECT state FROM game_history WHERE room_id=? AND kind='day' UNION ALL SELECT state FROM day_games WHERE room_id=?").all(id,id) as {state:string}[];
  for(const {state} of rows.sort((a,b)=>JSON.parse(a.state).day-JSON.parse(b.state).day)){
   const day=JSON.parse(state) as DayState;
   for(const event of day.events){
    if(event.type.startsWith('death_')&&event.seat!==undefined&&!doc.deaths.some(d=>d.seat===event.seat)){
     doc.deaths.push({seat:event.seat,round:day.day,period:['death_knife','death_poison'].includes(event.type)?'night':'day',cause:ended?event.type.slice(6) as RecordDocument['deaths'][number]['cause']:'unrecorded'});
    }
    if(event.type==='sheriff_elected')doc.badges.push({round:day.day,seat:event.seat!});
    // Successful commands are retained in existing games; a phase event only names the dead holder.
    if(event.type==='command'&&event.command?.action==='transfer_badge')doc.badges.push({round:day.day,seat:event.command.target as number|null});
    if((event.type==='death_exile'||event.type==='idiot_flip')&&event.seat!==undefined)doc.exiles.push({round:day.day,seat:event.seat});
    if(event.type==='vote_outcome'&&event.result?.ballots)doc.votes.push({round:day.day,kind:event.result.purpose.startsWith('sheriff')?'sheriff':'exile',ballots:event.result.ballots.map(b=>({voter:b.seat,target:b.target}))});
   }
   // Current public badge state also covers zero-candidate loss and legacy missing command events.
   const last=doc.badges.at(-1);if(day.badge==='lost'&&last?.seat!==null)doc.badges.push({round:day.day,seat:null});
   if(day.badge==='elected'&&day.sheriff!==null&&last?.seat!==day.sheriff)doc.badges.push({round:day.day,seat:day.sheriff});
  }
  if(ended&&!this.db.prepare('SELECT 1 FROM manual_games WHERE room_id=?').get(id))doc.notes=summarizeReplay(this.replay(id)).map(s=>s.title+'：'+s.lines.join('；')).join('\n').slice(0,2000);
  return doc;
 }
 switch(token:string,id:string,confirmed:boolean){return this.db.transaction(()=>{this.host(token,id);if(!confirmed)throw new LobbyError('INVALID_INPUT');if(this.ended(id))throw new LobbyError('PHASE_LOCKED',409);if(this.db.prepare('SELECT 1 FROM manual_games WHERE room_id=?').get(id))return;const doc=this.automaticDocument(id);this.db.prepare('INSERT INTO manual_games(room_id,official) VALUES (?,?)').run(id,JSON.stringify(doc));this.db.prepare("UPDATE preparations SET game_mode='manual' WHERE room_id=?").run(id);this.db.prepare("UPDATE room_controls SET status='running',remaining_ms=NULL,resume_at=NULL,kind=NULL,turn_id=NULL,temp_member=NULL,version=version+1 WHERE room_id=?").run(id);this.bump(id);
 }).immediate();}
 public(id:string):ManualPublic|null{const r=this.db.prepare('SELECT * FROM manual_games WHERE room_id=?').get(id) as ManualRow|undefined;return r?{status:r.status,version:r.version,dead:(JSON.parse(r.official) as RecordDocument).deaths.map(d=>d.seat).sort((a,b)=>a-b),winner:r.winner,outcomeSource:this.outcomeSource(id),revealed:r.status==='ended'?JSON.parse(this.capture(id).roles):[]}:null;}
 private bump(id:string){this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);}
 private applyOfficial(id:string,document:RecordDocument){const r=this.manual(id);if(r.status!=='pending'&&r.official===JSON.stringify(document)&&this.db.prepare('SELECT 1 FROM manual_revisions WHERE room_id=?').get(id)&&(!this.adjudicated(id)||r.status==='ended'))return;const a=this.capture(id),outcome=this.outcome(id,a,document);const version=r.version+1,status=r.status==='ended'||outcome?'ended':'playing';
  this.db.prepare('UPDATE manual_games SET official=?,winner=?,version=?,status=?,request=NULL WHERE room_id=?').run(JSON.stringify(document),outcome,version,status,id);this.db.prepare('INSERT INTO manual_revisions VALUES (?,?,?,?,?)').run(id,version,this.now(),JSON.stringify(document),outcome);this.db.prepare('INSERT INTO manual_revision_sources VALUES (?,?,?)').run(id,version,this.outcomeSource(id));if(status==='ended')this.db.prepare('UPDATE record_rooms SET ended=1 WHERE room_id=?').run(id);this.bump(id);
 }
 commit(token:string,id:string,revision:number){return this.db.transaction(()=>{this.host(token,id);const r=this.expected(this.row(token,id,true),revision);
  if(!this.db.prepare('SELECT 1 FROM rooms WHERE id=?').get(id)){const a=this.capture(id);if(!a.ended)throw new LobbyError('PHASE_LOCKED',409);const document=JSON.parse(r.draft) as RecordDocument;const latest=this.db.prepare('SELECT version,document FROM manual_revisions WHERE room_id=? ORDER BY version DESC LIMIT 1').get(id) as {version:number;document:string}|undefined;if(latest?.document!==r.draft){const version=(latest?.version??0)+1,outcome=this.outcome(id,a,document);this.db.prepare('INSERT INTO manual_revisions VALUES (?,?,?,?,?)').run(id,version,this.now(),r.draft,outcome);this.db.prepare('INSERT INTO manual_revision_sources VALUES (?,?,?)').run(id,version,this.outcomeSource(id));}return null;}
  if(!this.db.prepare('SELECT 1 FROM manual_games WHERE room_id=?').get(id)){if(!this.ended(id))throw new LobbyError('MANUAL_MODE_REQUIRED',409);const original=this.automaticDocument(id);this.db.prepare("INSERT INTO manual_games(room_id,status,official) VALUES (?,'ended',?)").run(id,JSON.stringify(original));this.applyOfficial(id,original);this.db.prepare("UPDATE preparations SET game_mode='manual' WHERE room_id=?").run(id);}
  this.applyOfficial(id,JSON.parse(r.draft));return this.public(id)!;}).immediate();}
 adjudicate(token:string,id:string,input:ManualAdjudicate){const parsed=manualAdjudicateSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');return this.db.transaction(()=>{const {a,owner}=this.host(token,id),m=this.manual(id),c=parsed.data;if(m.version!==c.version)throw new LobbyError('STALE_RECORD',409);const draft=this.expected(this.row(token,id,true),c.revision);if(m.status==='ended')throw new LobbyError('PHASE_LOCKED',409);const document=JSON.parse(draft.draft) as RecordDocument;this.validateRoster(document,a);const decision=this.decision(id,a,document);if(!decision.requiresAdjudication)throw new LobbyError('INVALID_INPUT');this.db.prepare('INSERT INTO manual_adjudications VALUES (?,?,?,?,?)').run(id,c.winner,m.version+1,this.now(),owner);this.applyOfficial(id,document);return this.public(id)!;}).immediate();}
 finishRecord(token:string,id:string,input:ManualFinish){
  const parsed=manualFinishSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');
  return this.db.transaction(()=>{
   const {a}=this.host(token,id),m=this.manual(id),c=parsed.data;
   if((JSON.parse(a.roles) as {role:Role}[]).some(p=>isWolfRole(p.role)))throw new LobbyError('INVALID_INPUT');
   if(m.status==='ended')throw new LobbyError('PHASE_LOCKED',409);
   if(m.version!==c.version)throw new LobbyError('STALE_RECORD',409);
   const draft=this.expected(this.row(token,id,true),c.revision),document=JSON.parse(draft.draft) as RecordDocument;this.validateRoster(document,a);
   const version=m.version+1;
   this.db.prepare("UPDATE manual_games SET status='ended',official=?,winner=NULL,version=?,request=NULL WHERE room_id=?").run(draft.draft,version,id);
   this.db.prepare('UPDATE record_rooms SET ended=1,record_only_ended=1 WHERE room_id=?').run(id);
   this.db.prepare('INSERT INTO manual_revisions VALUES (?,?,?,?,NULL)').run(id,version,this.now(),draft.draft);
   this.db.prepare("INSERT INTO manual_revision_sources VALUES (?,?,'record-only')").run(id,version);this.bump(id);return this.public(id)!;
  }).immediate();
 }
 requestEnd(token:string,id:string,revision:number){return this.db.transaction(()=>{const {a,owner}=this.participant(token,id);if(owner===a.host_owner||!this.auth.account(token)?.vip?.active)throw new LobbyError('VIP_ONLY',403);const m=this.manual(id);if(m.status!=='playing')throw new LobbyError('PHASE_LOCKED',409);const d=this.expected(this.row(token,id,true),revision);this.db.prepare("UPDATE manual_games SET status='pending',request=?,version=version+1 WHERE room_id=?").run(JSON.stringify({author:d.author,document:{...JSON.parse(d.draft),notes:''}}),id);this.bump(id);return {requested:true};}).immediate();}
 request(token:string,id:string){this.host(token,id);const r=this.manual(id);return {version:r.version,request:r.request?JSON.parse(r.request) as {author:string;document:RecordDocument}:null};}
 resolve(token:string,id:string,version:number,hostRevision:number,accept:boolean){return this.db.transaction(()=>{this.host(token,id);const m=this.manual(id);if(m.status!=='pending'||m.version!==version||!m.request)throw new LobbyError('STALE_RECORD',409);if(accept){const host=this.expected(this.row(token,id,true),hostRevision),document={...(JSON.parse(m.request) as {document:RecordDocument}).document,notes:(JSON.parse(host.draft) as RecordDocument).notes};this.db.prepare('UPDATE record_drafts SET draft=?,revision=revision+1 WHERE id=?').run(JSON.stringify(document),host.id);this.applyOfficial(id,document);}else{this.db.prepare("UPDATE manual_games SET status='playing',request=NULL,version=version+1 WHERE room_id=?").run(id);this.bump(id);}return this.public(id)!;}).immediate();}
 history(token:string,id:string):OfficialRevision[]{this.host(token,id);return (this.db.prepare('SELECT * FROM manual_revisions WHERE room_id=? ORDER BY version DESC').all(id) as {version:number;at:number;document:string;outcome:'wolves'|'good'|null}[]).map(r=>({...r,document:JSON.parse(r.document),outcomeSource:(this.db.prepare('SELECT source FROM manual_revision_sources WHERE room_id=? AND version=?').get(id,r.version) as {source:RecordOutcomeSource}|undefined)?.source??'computed'}));}
}
