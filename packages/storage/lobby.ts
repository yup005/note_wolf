import {VoiceStore} from './voice.js';
import {SharingStore} from './sharing.js';
import {BoardsStore,migrateBoardSeats} from './boards.js';
import {assertPlayableBoard} from '../domain/boardConfig.js';
import type {BoardSave,BoardConfigure} from '../contracts/board.js';
import type {ShareCommand} from '../contracts/sharing.js';
import type {VoiceCommand} from '../contracts/voice.js';
import Database from 'better-sqlite3';
import {RecordsStore} from './records.js';
import {AuthStore} from './auth.js';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { LobbyError, nameSchema, codeSchema, seatSchema, type LobbyView, type RoomSnapshot } from '../contracts/index.js';
import {PreparationStore,type MemberRow} from './preparation.js';
import {NightStore} from './night.js';
import {ControlStore} from './control.js';
import type {ControlCommand} from '../contracts/control.js';
import {DayStore} from './day.js';
import {firstDayRules,type FirstDayRules,type DayCommand} from '../contracts/day.js';
import type {NightCommand} from '../contracts/night.js';
import {TestPlayersStore} from './testPlayers.js';
import type {RoomSettings,Role} from '../contracts/index.js';
interface RoomRow {id:string;code:string;revision:number}
const sessionKey=(token:string)=>createHash('sha256').update(token).digest('hex');
export class LobbyStore {
 private db:Database.Database;
 readonly auth:AuthStore;
 private preparation:PreparationStore;
 private testPlayers:TestPlayersStore;
 private night:NightStore;
 private day:DayStore;
 private control:ControlStore;
 private records:RecordsStore;
 private voice:VoiceStore;
 private sharing:SharingStore;
 private boards:BoardsStore;
 constructor(path:string,private codeStart:()=>number=()=>randomInt(10000),private allowTestPlayers=false,private now:()=>number=Date.now,private dayRules:FirstDayRules=firstDayRules){
  this.db=new Database(path);this.db.pragma('journal_mode = WAL');this.db.pragma('foreign_keys = ON');this.db.pragma('busy_timeout = 5000');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE CHECK(length(code)=4),revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,nickname TEXT NOT NULL,is_host INTEGER NOT NULL DEFAULT 0,seat INTEGER CHECK(seat BETWEEN 1 AND 12),UNIQUE(room_id,session_hash),UNIQUE(room_id,seat));
   CREATE TABLE IF NOT EXISTS create_requests(session_hash TEXT NOT NULL,request_id TEXT NOT NULL,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,PRIMARY KEY(session_hash,request_id));
   CREATE TABLE IF NOT EXISTS sessions(session_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL);

  `);
  this.db.transaction(()=>{
   const columns=this.db.prepare('PRAGMA table_info(members)').all() as {name:string}[];
   if(!columns.some(c=>c.name==='ready'))this.db.exec('ALTER TABLE members ADD COLUMN ready INTEGER NOT NULL DEFAULT 0');
   this.db.exec(`CREATE TABLE IF NOT EXISTS preparations(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,phase TEXT NOT NULL DEFAULT 'lobby',deal_method TEXT NOT NULL DEFAULT 'online',game_mode TEXT NOT NULL DEFAULT 'automatic',settings_revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS identities(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('wolf','villager','seer','witch','hunter','idiot')),confirmed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_id,member_id));
    INSERT OR IGNORE INTO preparations(room_id) SELECT id FROM rooms;
    CREATE TABLE IF NOT EXISTS test_rooms(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS test_players(member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS night_games(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS day_games(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,state TEXT NOT NULL);
    UPDATE rooms SET revision=revision+1 WHERE id IN (SELECT room_id FROM night_games WHERE json_extract(state,'$.phase')='phone_ready');
    UPDATE night_games SET state=json_set(state,'$.phase','awaiting_host') WHERE json_extract(state,'$.phase')='phone_ready';
    UPDATE night_games SET state=json_remove(state,'$.readySeats') WHERE json_type(state,'$.readySeats') IS NOT NULL;
    CREATE TABLE IF NOT EXISTS game_history(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,kind TEXT NOT NULL,round INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(room_id,kind,round));
    CREATE TABLE IF NOT EXISTS saved_replays(owner_hash TEXT NOT NULL,room_id TEXT NOT NULL,code TEXT NOT NULL,winner TEXT NOT NULL,saved_at INTEGER NOT NULL,record TEXT NOT NULL,PRIMARY KEY(owner_hash,room_id));
    PRAGMA user_version = 9;`);
   const preparationColumns=this.db.prepare('PRAGMA table_info(preparations)').all() as {name:string}[];
   if(!preparationColumns.some(c=>c.name==='settings_revision'))this.db.exec('ALTER TABLE preparations ADD COLUMN settings_revision INTEGER NOT NULL DEFAULT 0');
  }).immediate();
  migrateBoardSeats(this.db);
  this.auth=new AuthStore(this.db);
  this.boards=new BoardsStore(this.db,token=>this.auth.owner(token));
  this.control=new ControlStore(this.db,this.now);
  this.testPlayers=new TestPlayersStore(this.db,this.allowTestPlayers,(token,id)=>this.member(token,id),id=>this.snapshot(id).seats);
  this.night=new NightStore(this.db,(token,id)=>this.member(token,id),this.now,this.control);
  this.day=new DayStore(this.db,(token,id)=>this.member(token,id),id=>this.night.completedState(id),this.now,this.dayRules,this.control);
  this.records=new RecordsStore(this.db,this.auth,this.now,id=>this.readReplay(id));
  this.voice=new VoiceStore(this.db,this.now,(id,memberId)=>{const m=this.db.prepare('SELECT * FROM members WHERE room_id=? AND id=?').get(id,memberId) as MemberRow|undefined;return !!m&&this.control.canManage(id,m);});
  this.sharing=new SharingStore(this.db,this.auth,this.now);
  this.preparation=new PreparationStore(this.db,(token,id)=>this.member(token,id),id=>this.snapshot(id).seats,id=>this.boards.configuration(id));
 }
 publicVoice(token:string,id:string,command:VoiceCommand){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);const m=this.member(token,id);return this.voice.command(token,m.id,this.snapshot(id),command);}
 private nickname(value:string){const p=nameSchema.safeParse(value);if(!p.success)throw new LobbyError('INVALID_NAME');return p.data;}
 private member(token:string,roomId:string):MemberRow{
  const m=this.db.prepare('SELECT * FROM members WHERE room_id=? AND session_hash=?').get(roomId,this.auth.owner(token)) as MemberRow|undefined;
  if(!m)throw new LobbyError('NOT_MEMBER',403);m.is_manager=this.control.canManage(roomId,m);return m;
 }
 create(token:string,nickname:string,requestId:string=randomUUID()):LobbyView{
  const name=this.nickname(nickname);
  return this.db.transaction(()=>{
   const previous=this.db.prepare('SELECT room_id FROM create_requests WHERE session_hash=? AND request_id=?').get(this.auth.owner(token),requestId) as {room_id:string}|undefined;
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
   this.boards.initialize(roomId);
   this.db.prepare('INSERT INTO preparations(room_id) VALUES (?)').run(roomId);
   this.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname,is_host) VALUES (?,?,?,?,1)').run(randomUUID(),roomId,this.auth.owner(token),name);
   this.db.prepare('INSERT INTO create_requests VALUES (?,?,?)').run(this.auth.owner(token),requestId,roomId);
   return this.view(token,roomId);
  }).immediate();
 }
 join(token:string,code:string,nickname:string):LobbyView{
  const name=this.nickname(nickname);if(!codeSchema.safeParse(code).success)throw new LobbyError('INVALID_CODE');
  return this.db.transaction(()=>{
   const r=this.db.prepare('SELECT * FROM rooms WHERE code=?').get(code) as RoomRow|undefined;
   if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);
   if(!this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND session_hash=?').get(r.id,this.auth.owner(token))){
    this.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run(randomUUID(),r.id,this.auth.owner(token),name);
    this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(r.id);
   }
   return this.view(token,r.id);
  }).immediate();
 }
 select(token:string,roomId:string,seat:number):LobbyView{
  if(!Number.isSafeInteger(seat)||seat<1||seat>this.boards.configuration(roomId).seatCount)throw new LobbyError('INVALID_SEAT');
  return this.db.transaction(()=>{
   const m=this.member(token,roomId);
   this.preparation.assertLobby(roomId);
   if(m.seat===seat)return this.view(token,roomId);
   if(this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND seat=?').get(roomId,seat))throw new LobbyError('SEAT_TAKEN',409);
   this.db.prepare('UPDATE members SET seat=?,ready=0 WHERE id=?').run(seat,m.id);
   this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(roomId);
   return this.view(token,roomId);
  }).immediate();
 }
 view(token:string,roomId:string):LobbyView{
  const m=this.member(token,roomId);
  return {testPlayersEnabled:this.allowTestPlayers,room:this.snapshot(roomId),me:{id:m.id,nickname:m.nickname,isHost:m.is_host===1,seat:m.seat}};
 }
 snapshot(roomId:string):RoomSnapshot{
  const r=this.db.prepare('SELECT * FROM rooms WHERE id=?').get(roomId) as RoomRow|undefined;
  if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);
  const members=this.db.prepare('SELECT id,nickname,is_host,seat,ready FROM members WHERE room_id=? AND seat IS NOT NULL').all(roomId) as MemberRow[];
  const board=this.boards.snapshot(roomId);
  return {board,manual:this.records.public(roomId),...(this.night.snapshot(roomId)&&!this.records.public(roomId)?{control:this.control.snapshot(roomId)}:{}),testRoom:this.testPlayers.isTestRoom(roomId),id:r.id,code:r.code,boardId:board.id==='standard-12'?'seer-witch-hunter-idiot-12':board.id,revision:r.revision,night:this.night.snapshot(roomId),day:this.day.snapshot(roomId),preparation:this.preparation.snapshot(roomId),seats:Array.from({length:board.composition.seatCount},(_,i)=>{
   const m=members.find(m=>m.seat===i+1);return {number:i+1,memberId:m?.id??null,nickname:m?.nickname??null,isHost:m?.is_host===1,isTestPlayer:m?this.testPlayers.isActor(m.id):false,ready:!!m?.ready};
  })};
 }
 unseat(token:string,roomId:string):LobbyView{
  return this.db.transaction(()=>{const m=this.member(token,roomId);this.preparation.assertLobby(roomId);
   if(m.seat!==null){this.db.prepare('UPDATE members SET seat=NULL,ready=0 WHERE id=?').run(m.id);this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(roomId);}
   return this.view(token,roomId);
  }).immediate();
 }
 configure(token:string,id:string,settings:RoomSettings){return this.db.transaction(()=>{this.member(token,id);if(this.testPlayers.isTestRoom(id)&&settings.dealMethod!=='online')throw new LobbyError('TEST_ONLINE_ONLY',409);const oldRevision=this.preparation.snapshot(id).settingsRevision;this.preparation.configure(token,id,settings);if(this.preparation.snapshot(id).settingsRevision!==oldRevision)this.testPlayers.prepareActors(id);return this.view(token,id);}).immediate();}
 boardLibrary(token:string){return this.boards.library(token);}
 saveBoard(token:string,input:BoardSave){return this.boards.save(token,input);}
 configureBoard(token:string,id:string,input:BoardConfigure){return this.db.transaction(()=>{const previous=this.preparation.snapshot(id).settingsRevision;this.boards.configure(token,id,input);if(this.preparation.snapshot(id).settingsRevision!==previous)this.testPlayers.prepareActors(id);return this.view(token,id);}).immediate();}
 setReady(token:string,id:string,ready:boolean,settingsRevision:number){this.preparation.setReady(token,id,ready,settingsRevision);return this.view(token,id);}
 deal(token:string,id:string){return this.db.transaction(()=>{this.preparation.deal(token,id);this.testPlayers.confirmActors(id);return this.view(token,id);}).immediate();}
 start(token:string,id:string){return this.db.transaction(()=>{this.preparation.start(token,id);this.records.start(id);return this.view(token,id);}).immediate();}
 identity(token:string,id:string){return this.preparation.identity(token,id);}
 submitIdentity(token:string,id:string,role:Role){return this.preparation.submitIdentity(token,id,role);}
 confirmIdentity(token:string,id:string){return this.preparation.confirmIdentity(token,id);}
 fillTestPlayers(token:string,id:string){this.member(token,id);assertPlayableBoard(this.boards.configuration(id));this.testPlayers.fill(token,id);return this.view(token,id);}
 testPlayerIdentity(token:string,id:string,actorId:string){return this.testPlayers.identity(token,id,actorId);}
 testPlayerReady(token:string,id:string,actorId:string,ready:boolean,settingsRevision:number){this.testPlayers.ready(token,id,actorId,ready,settingsRevision);return this.view(token,id);}
 testPlayerConfirm(token:string,id:string,actorId:string){return this.testPlayers.confirm(token,id,actorId);}
 enterNight(token:string,id:string){return this.db.transaction(()=>{this.night.enter(token,id);const n=this.night.snapshot(id)!;if(n.phase==='awaiting_host')this.night.begin(token,id,n.turnId);return this.view(token,id);}).immediate();}
 beginNight(token:string,id:string,turnId:string){this.night.begin(token,id,turnId);return this.view(token,id);}
 nightPrivate(token:string,id:string){return this.night.private(token,id);}
 nightCommand(token:string,id:string,c:NightCommand){return this.night.command(token,id,c);}
 tickNights(){const restored=this.control.tick();return [...new Set([...restored,...this.night.tick(),...this.day.tick(),...this.control.tick()])];}
 gameControl(token:string,id:string,c:ControlCommand){this.control.command(id,this.member(token,id),c);return this.view(token,id);}
 connectMember(id:string,memberId:string,connectionId:string){return [...new Set([...this.tickNights(),...this.control.connect(id,memberId,connectionId)])];}
 disconnectMember(connectionId:string){return [...new Set([...this.tickNights(),...this.control.disconnect(connectionId)])];}
 enterDay(token:string,id:string){this.day.enter(token,id);return this.view(token,id);}
 dayPrivate(token:string,id:string){return this.day.private(token,id);}
 dayCommand(token:string,id:string,c:DayCommand){return this.day.command(token,id,c);}
 testDayStore(actorId:string){return new DayStore(this.db,(token,id)=>this.testPlayers.actor(token,id,actorId),id=>this.night.completedState(id),this.now,this.dayRules,this.control);}
 testDayPrivate(token:string,id:string,actorId:string){this.testPlayers.actor(token,id,actorId);return this.testDayStore(actorId).private(token,id);}
 testDayCommand(token:string,id:string,actorId:string,c:DayCommand){this.testPlayers.actor(token,id,actorId);return this.testDayStore(actorId).command(token,id,c);}
 testDayAdvance(token:string,id:string){this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);this.day.testAdvance(id);return this.view(token,id);}
 testDayActor(token:string,id:string){const host=this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);const day=this.day.snapshot(id);if(!day)throw new LobbyError('DAY_UNAVAILABLE',409);const seat=this.day.testActionSeat(id);const actor=this.snapshot(id).seats.find(s=>s.number===seat&&(s.memberId===host.id||s.isTestPlayer));return {turnId:day.turnId,actorId:actor?.memberId??null};}
 testNightStore(actorId:string){return new NightStore(this.db,(token,id)=>this.testPlayers.actor(token,id,actorId),this.now,this.control);}
 testNightPrivate(token:string,id:string,actorId:string){this.testPlayers.actor(token,id,actorId);return this.testNightStore(actorId).private(token,id);}
 testNightActor(token:string,id:string){
  const host=this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);
  const night=this.night.snapshot(id);if(!night)throw new LobbyError('NIGHT_UNAVAILABLE',409);
  const seat=this.night.testActionSeat(id);const actor=this.snapshot(id).seats.find(s=>s.number===seat&&(s.memberId===host.id||s.isTestPlayer));
  return {turnId:night.turnId,actorId:actor?.memberId??null};
 }
 testNightCommand(token:string,id:string,actorId:string,c:NightCommand){this.testPlayers.actor(token,id,actorId);return this.testNightStore(actorId).command(token,id,c);}
 testNightAdvance(token:string,id:string){this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);this.night.testAdvance(id);return this.view(token,id);}
 testRoles(token:string,id:string){
  const host=this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);
  const roles=this.db.prepare('SELECT m.id AS memberId,m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id WHERE m.room_id=? AND m.seat IS NOT NULL AND (m.id=? OR m.id IN (SELECT member_id FROM test_players)) ORDER BY m.seat').all(id,host.id) as {memberId:string;seat:number;role:Role}[];
  return {roles};
 }
 gameReplay(token:string,id:string):import('../contracts/game.js').GameReplay{
  const member=this.member(token,id);if(member.seat===null||!this.db.prepare('SELECT 1 FROM identities WHERE room_id=? AND member_id=?').get(id,member.id))throw new LobbyError('PARTICIPANT_ONLY',403);return this.readReplay(id);
 }
 private readReplay(id:string):import('../contracts/game.js').GameReplay{const day=this.day.snapshot(id);if(day?.phase!=='ended')throw new LobbyError('PHASE_LOCKED',409);
  const saved=this.db.prepare('SELECT kind,round,state FROM game_history WHERE room_id=?').all(id) as {kind:'night'|'day';round:number;state:string}[];
  for(const kind of ['night','day'] as const){const row=this.db.prepare(`SELECT state FROM ${kind}_games WHERE room_id=?`).get(id) as {state:string}|undefined;if(row){const s=JSON.parse(row.state);saved.push({kind,round:s[kind],state:row.state});}}
  return {winner:day.winner!,roles:day.revealed,rounds:saved.sort((a,b)=>a.round-b.round||(a.kind==='night'?-1:1)).map(r=>({kind:r.kind,round:r.round,events:JSON.parse(r.state).events,...(r.kind==='day'?{outcome:{sheriff:JSON.parse(r.state).sheriff,badge:JSON.parse(r.state).badge,result:JSON.parse(r.state).result}}:{})}))};
 }
 isFavorite(token:string,id:string){return !!this.db.prepare('SELECT 1 FROM saved_replays WHERE owner_hash=? AND room_id=?').get(this.auth.owner(token),id);}
 saveFavorite(token:string,id:string){return this.db.transaction(()=>{const record=this.gameReplay(token,id);const room=this.snapshot(id);this.db.prepare('INSERT OR IGNORE INTO saved_replays VALUES (?,?,?,?,?,?)').run(this.auth.owner(token),id,room.code,record.winner,this.now(),JSON.stringify(record));return {saved:true};}).immediate();}
 favorites(token:string):import('../contracts/game.js').FavoriteGame[]{return this.db.prepare('SELECT room_id AS roomId,code,winner,saved_at AS savedAt FROM saved_replays WHERE owner_hash=? ORDER BY saved_at DESC,room_id').all(this.auth.owner(token)) as import('../contracts/game.js').FavoriteGame[];}
 favoriteReplay(token:string,id:string):import('../contracts/game.js').GameReplay{const row=this.db.prepare('SELECT record FROM saved_replays WHERE owner_hash=? AND room_id=?').get(this.auth.owner(token),id) as {record:string}|undefined;if(!row)throw new LobbyError('NOT_FOUND',404);return {...JSON.parse(row.record),saved:true};}
 removeFavorite(token:string,id:string){this.db.prepare('DELETE FROM saved_replays WHERE owner_hash=? AND room_id=?').run(this.auth.owner(token),id);return {saved:false};}
 recordsList(token:string,id:string){return this.records.list(token,id);}
 saveRecord(token:string,id:string,revision:number,document:import('../contracts/records.js').RecordDocument){return this.records.save(token,id,revision,document);}
 importAutomaticRecord(token:string,id:string,revision:number){return this.records.importAutomatic(token,id,revision);}
 publishRecord(token:string,id:string,revision:number){return this.records.publish(token,id,revision);}
 withdrawRecord(token:string,id:string,revision:number){return this.records.withdraw(token,id,revision);}
 adminRecordList(token:string,id:string){return this.records.adminList(token,id);}
 adminRecordPost(token:string,id:string,version?:number){return this.records.post(token,id,version,true);}
 recordPost(token:string,id:string,version?:number){return this.records.post(token,id,version);}
 shareStatus(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.status(token,id);}
 ownShares(token:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.list(token);}
 shareRecord(token:string,id:string,c:ShareCommand){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.command(token,id,c);}
 sharedRecord(token:string){return this.sharing.read(token);}
 saveRecordFavorite(token:string,id:string){return this.records.favorite(token,id);}
 recordFavorites(token:string){return this.records.favorites(token);}
 removeRecordFavorite(token:string,id:string){return this.records.removeFavorite(token,id);}
 switchManual(token:string,id:string,confirmed:boolean){this.records.switch(token,id,confirmed);return this.view(token,id);}
 commitManual(token:string,id:string,revision:number){return this.records.commit(token,id,revision);}
 requestManualEnd(token:string,id:string,revision:number){return this.records.requestEnd(token,id,revision);}
 manualRequest(token:string,id:string){return this.records.request(token,id);}
 resolveManual(token:string,id:string,version:number,hostRevision:number,accept:boolean){return this.records.resolve(token,id,version,hostRevision,accept);}
 manualHistory(token:string,id:string){return this.records.history(token,id);}
 roomsFor(token:string):LobbyView[]{
  const rows=this.db.prepare('SELECT room_id FROM members WHERE session_hash=? ORDER BY rowid DESC LIMIT 20').all(this.auth.owner(token)) as {room_id:string}[];
  return rows.map(r=>this.view(token,r.room_id));
 }
 issueSession(token:string){this.db.prepare('INSERT INTO sessions(session_hash,created_at) VALUES (?,?)').run(sessionKey(token),Date.now());}
 hasSession(token:string){return !!this.db.prepare("SELECT 1 FROM sessions s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.session_hash=? AND (s.account_id IS NULL OR a.status='active')").get(sessionKey(token));}
 isDevelopmentTestHost(token:string){return this.allowTestPlayers&&!!this.db.prepare('SELECT 1 FROM members m JOIN test_rooms t ON t.room_id=m.room_id WHERE m.session_hash=? AND m.is_host=1 LIMIT 1').get(this.auth.owner(token));}
 adminRooms(token:string){this.auth.requireAdmin(token);return (this.db.prepare('SELECT id FROM rooms ORDER BY created_at DESC LIMIT 200').all() as {id:string}[]).map(({id})=>this.snapshot(id));}
 adminReplay(token:string,id:string){this.auth.requireAdmin(token);return this.readReplay(id);}
 close(){this.db.close();}
}
