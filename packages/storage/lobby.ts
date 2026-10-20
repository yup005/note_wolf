import {finalReplay} from '../domain/replay.js';
import {ManagementHistoryStore} from './managementHistory.js';
import type {ManagementState} from '../contracts/management.js';
import {AdminOversightStore} from './adminOversight.js';
import {NotificationsStore} from './notifications.js';
import {CommunityStore} from './community.js';
import type {CommunityScope} from '../contracts/community.js';
import {JudgeStore} from './judge.js';
import type {JudgeAppoint,JudgeDraftCommand,JudgeSupplement,JudgeReturn} from '../contracts/judge.js';
import {VoiceStore} from './voice.js';
import {RetentionStore} from './retention.js';
import {SharingStore} from './sharing.js';
import {BoardsStore,migrateBoardSeats} from './boards.js';
import {migrateIdentityRoles} from './identityMigration.js';
import {assertPlayableBoard} from '../domain/boardConfig.js';
import type {BoardSave,BoardConfigure} from '../contracts/board.js';
import type {ShareCommand} from '../contracts/sharing.js';
import type {VoiceCommand} from '../contracts/voice.js';
import Database from 'better-sqlite3';
import {RecordsStore} from './records.js';
import {AuthStore} from './auth.js';
import {avatarUrl} from './avatars.js';
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
import {SharedFavoritesStore} from './sharedFavorites.js';
import {FavoriteLibraryStore,type FavoriteSource} from './favorites.js';
import type {FavoriteQuery,FavoriteName,FavoriteKind} from '../contracts/favorites.js';
import type {RoomSettings,Role} from '../contracts/index.js';
interface RoomRow {id:string;code:string;revision:number}
const sessionKey=(token:string)=>createHash('sha256').update(token).digest('hex');
export class LobbyStore {
 private db:Database.Database;
 readonly auth:AuthStore;
 private preparation:PreparationStore;
 private testPlayers:TestPlayersStore;
 private favoriteLibraryStore:FavoriteLibraryStore;
 private sharedFavoritesStore:SharedFavoritesStore;
 private night:NightStore;
 private day:DayStore;
 private control:ControlStore;
 private managementAudit:ManagementHistoryStore;
 private judge:JudgeStore;
 private records:RecordsStore;
 private voice:VoiceStore;
 private sharing:SharingStore;
 private boards:BoardsStore;
 private retention:RetentionStore;
 private community:CommunityStore;
 private notifications:NotificationsStore;
 private oversight:AdminOversightStore;
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
  migrateIdentityRoles(this.db);
  this.auth=new AuthStore(this.db,(id,body)=>this.notifications?.account(id,body),change=>this.oversight.accountChange(change));
  this.boards=new BoardsStore(this.db,token=>this.auth.owner(token));
  this.judge=new JudgeStore(this.db,(token,id)=>this.member(token,id),token=>this.hasSession(token),id=>this.boards.snapshot(id),this.dayRules,this.now);
  this.control=new ControlStore(this.db,this.now,(id,m)=>this.judge.isJudge(id,m));
  this.managementAudit=new ManagementHistoryStore(this.db,this.now);
  this.testPlayers=new TestPlayersStore(this.db,this.allowTestPlayers,token=>{if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);this.auth.requireAdmin(token);},(token,id)=>this.member(token,id),id=>this.snapshot(id).seats);
  this.night=new NightStore(this.db,(token,id)=>this.member(token,id),this.now,this.control,id=>this.boards.snapshot(id));
  this.day=new DayStore(this.db,(token,id)=>this.member(token,id),id=>this.night.completedState(id),this.now,this.dayRules,this.control);
  this.records=new RecordsStore(this.db,this.auth,this.now,id=>this.readReplay(id));
  this.voice=new VoiceStore(this.db,this.now,(id,memberId)=>{const m=this.db.prepare('SELECT * FROM members WHERE room_id=? AND id=?').get(id,memberId) as MemberRow|undefined;return !!m&&this.control.canManage(id,m);});
  this.sharing=new SharingStore(this.db,this.auth,this.now);
  this.sharedFavoritesStore=new SharedFavoritesStore(this.db,this.auth,this.sharing,this.now);
  this.community=new CommunityStore(this.db,this.auth,this.now,(token,scope)=>this.communityRoom(token,scope),{comment:(id,account,scope)=>this.notifications.comment(id,account,scope),like:(id,actor)=>this.notifications.like(id,actor),moderation:()=>this.notifications.moderation()});
  this.notifications=new NotificationsStore(this.db,this.auth,this.now,(owner,scope)=>this.validateNotificationSource(owner,scope));
  this.oversight=new AdminOversightStore(this.db,this.auth,this.now,(id,body)=>this.notifications.account(id,body));
  this.favoriteLibraryStore=new FavoriteLibraryStore(this.db,this.auth,token=>this.favoriteSources(token));
  this.preparation=new PreparationStore(this.db,(token,id)=>this.member(token,id),id=>this.snapshot(id).seats,id=>this.boards.configuration(id));
  this.retention=new RetentionStore(this.db,this.now,id=>this.records.preserveForRoomCleanup(id));
 }
 private validateNotificationSource(owner:string,scope:CommunityScope){
  if(scope.kind==='share'){this.sharing.read(scope.token);return;}
  if(scope.kind==='shared-favorite'){const f=this.db.prepare('SELECT share_token FROM shared_record_favorites WHERE owner=? AND id=?').get(owner,scope.id) as {share_token:string}|undefined;if(!f)throw new LobbyError('NOT_FOUND',404);this.sharing.read(f.share_token);return;}
  const row=this.db.prepare('SELECT d.published_version,d.withdrawn,d.deleted,r.ended,r.participants FROM record_drafts d JOIN record_rooms r ON r.room_id=d.room_id WHERE d.id=?').get(scope.id) as {published_version:number|null;withdrawn:number;deleted:number;ended:number;participants:string}|undefined;
  if(!row||row.deleted||row.published_version===null)throw new LobbyError('NOT_FOUND',404);
  if(!(JSON.parse(row.participants) as string[]).includes(owner))throw new LobbyError('PARTICIPANT_ONLY',403);
  if(row.withdrawn)throw new LobbyError('RECORD_WITHDRAWN',409);if(!row.ended)throw new LobbyError('PHASE_LOCKED',409);
 }
 adminReportGroups(token:string,query:unknown={}){return this.oversight.reports(token,query);}
 adminAuditList(token:string,query:unknown={}){return this.oversight.audit(token,query);}
 adminShares(token:string,query:unknown={}){return this.oversight.shares(token,query);}
 adminExport(token:string,input:unknown){return this.oversight.export(token,input);}
 adminRevokeShare(token:string,input:unknown){return this.oversight.revoke(token,input);}
 notificationsList(token:string,query:unknown={}){return this.notifications.list(token,query);}
 notificationSettings(token:string,input:unknown){return this.notifications.setSettings(token,input);}
 notificationCommand(token:string,input:unknown){return this.notifications.command(token,input);}
 notificationOpen(token:string,id:string){return this.notifications.open(token,id);}
 cleanupNotifications(){return this.notifications.cleanup();}
 communityFocus(token:string|undefined,input:unknown){if(token&&!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.community.focus(token,input);}
 private communityRoom(token:string|undefined,scope:CommunityScope){
  let recordId:string;
  if(scope.kind==='share'){this.sharing.read(scope.token);recordId=(this.db.prepare('SELECT record_id FROM record_share_links WHERE token=?').get(scope.token) as {record_id:string}).record_id;}
  else {if(!token||!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);if(scope.kind==='record'){this.records.post(token,scope.id);recordId=scope.id;}else{this.sharedFavoritesStore.read(token,scope.id);recordId=(this.db.prepare('SELECT record_id FROM shared_record_favorites WHERE id=? AND owner=?').get(scope.id,this.auth.owner(token)) as {record_id:string}).record_id;}}
  return (this.db.prepare('SELECT room_id FROM record_drafts WHERE id=?').get(recordId) as {room_id:string}).room_id;
 }
 communityRead(token:string|undefined,input:unknown){if(token&&!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.community.read(token,input);}
 private communitySession(token:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);}
 communityComment(token:string,input:unknown){this.communitySession(token);return this.community.post(token,input);}
 communityLike(token:string,input:unknown){this.communitySession(token);return this.community.like(token,input);}
 communityGameLike(token:string,input:unknown){this.communitySession(token);return this.community.gameLike(token,input);}
 communityReport(token:string,input:unknown){this.communitySession(token);return this.community.report(token,input);}
 communityMe(token:string){this.communitySession(token);return this.community.me(token);}
 communityUser(token:string,id:string){this.communitySession(token);return this.community.user(token,id);}
 communityReports(token:string,input:unknown){this.communitySession(token);return this.community.reports(token,input);}
 communityAudit(token:string,input:unknown){this.communitySession(token);return this.community.audit(token,input);}
 communityModerate(token:string,input:unknown){this.communitySession(token);return this.community.moderate(token,input);}
 // Internal lifecycle hooks; neither reads nor background game/voice work renew rooms.
 touchRooms(ids:readonly string[]){this.retention.touch(ids);}
 touchRecordRoom(recordId:string){const row=this.db.prepare('SELECT room_id FROM record_drafts WHERE id=?').get(recordId) as {room_id:string}|undefined;if(row)this.retention.touch([row.room_id]);}
 cleanupExpiredRooms(){const ids=this.retention.expiredcleanup();this.control.forgetRooms(ids);return ids;}
 publicVoice(token:string,id:string,command:VoiceCommand){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);const m=this.member(token,id);return this.voice.command(token,m.id,this.snapshot(id),command);}
 private nickname(value:string){const p=nameSchema.safeParse(value);if(!p.success)throw new LobbyError('INVALID_NAME');return p.data;}
 private member(token:string,roomId:string):MemberRow{
  const m=this.db.prepare('SELECT * FROM members WHERE room_id=? AND session_hash=?').get(roomId,this.auth.owner(token)) as MemberRow|undefined;
  if(!m){
   if(!this.db.prepare('SELECT 1 FROM rooms WHERE id=?').get(roomId))throw new LobbyError('ROOM_NOT_FOUND',404);
   throw new LobbyError('NOT_MEMBER',403);
  }
  if(this.testPlayers.isTestRoom(roomId)&&(m.is_host!==1||this.auth.account(token)?.role!=='admin'))throw new LobbyError('TEST_ROOM_PRIVATE',403);
  m.is_manager=this.control.canManage(roomId,m);return m;
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
   this.retention.touch([roomId]);
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
   if(this.testPlayers.isTestRoom(r.id)){
    const host=this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND session_hash=? AND is_host=1').get(r.id,this.auth.owner(token));
    if(!host||this.auth.account(token)?.role!=='admin')throw new LobbyError('TEST_ROOM_PRIVATE',403);
   }
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
  return {testPlayersEnabled:this.allowTestPlayers&&this.auth.account(token)?.role==='admin'&&m.is_host===1&&this.testPlayers.isolated(roomId),room:this.snapshot(roomId),me:{id:m.id,nickname:m.nickname,isHost:m.is_host===1,seat:m.seat}};
 }
 snapshot(roomId:string):RoomSnapshot{
  const r=this.db.prepare('SELECT * FROM rooms WHERE id=?').get(roomId) as RoomRow|undefined;
  if(!r)throw new LobbyError('ROOM_NOT_FOUND',404);
  const members=this.db.prepare("SELECT m.id,m.nickname,m.is_host,m.seat,m.ready,v.account_id AS avatar_account_id,v.revision AS avatar_revision FROM members m LEFT JOIN accounts a ON m.session_hash='account:'||a.id AND a.status='active' LEFT JOIN account_avatars v ON v.account_id=a.id WHERE m.room_id=? AND m.seat IS NOT NULL").all(roomId) as (MemberRow&{avatar_account_id:string|null;avatar_revision:string|null})[];
  const board=this.boards.snapshot(roomId);
  return {board,judge:this.judge.public(roomId),manual:this.records.public(roomId),...(this.night.snapshot(roomId)&&!this.records.public(roomId)?{control:this.control.snapshot(roomId)}:{}),testRoom:this.testPlayers.isTestRoom(roomId),id:r.id,code:r.code,boardId:board.id==='standard-12'?'seer-witch-hunter-idiot-12':board.id,revision:r.revision,night:this.night.snapshot(roomId),day:this.day.snapshot(roomId),preparation:this.preparation.snapshot(roomId),seats:Array.from({length:board.composition.seatCount},(_,i)=>{
   const m=members.find(m=>m.seat===i+1);return {number:i+1,memberId:m?.id??null,nickname:m?.nickname??null,avatarUrl:m?.avatar_account_id&&m.avatar_revision?avatarUrl(m.avatar_account_id,m.avatar_revision):null,isHost:m?.is_host===1,isTestPlayer:m?this.testPlayers.isActor(m.id):false,ready:!!m?.ready};
  })};
 }
 unseat(token:string,roomId:string):LobbyView{
  return this.db.transaction(()=>{const m=this.member(token,roomId);this.preparation.assertLobby(roomId);
   if(m.seat!==null){this.db.prepare('UPDATE members SET seat=NULL,ready=0 WHERE id=?').run(m.id);this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(roomId);}
   return this.view(token,roomId);
  }).immediate();
 }
 configure(token:string,id:string,settings:RoomSettings){return this.db.transaction(()=>{this.member(token,id);if(this.testPlayers.isTestRoom(id)&&settings.dealMethod!=='online')throw new LobbyError('TEST_ONLINE_ONLY',409);const oldRevision=this.preparation.snapshot(id).settingsRevision;this.preparation.configure(token,id,settings);if(this.preparation.snapshot(id).settingsRevision!==oldRevision)this.testPlayers.prepareActors(token,id);return this.view(token,id);}).immediate();}
 boardLibrary(token:string){return this.boards.library(token);}
 saveBoard(token:string,input:BoardSave){return this.boards.save(token,input);}
 configureBoard(token:string,id:string,input:BoardConfigure){return this.db.transaction(()=>{const previous=this.preparation.snapshot(id).settingsRevision;this.boards.configure(token,id,input);if(this.preparation.snapshot(id).settingsRevision!==previous)this.testPlayers.prepareActors(token,id);return this.view(token,id);}).immediate();}
 setReady(token:string,id:string,ready:boolean,settingsRevision:number){this.preparation.setReady(token,id,ready,settingsRevision);return this.view(token,id);}
 deal(token:string,id:string){return this.db.transaction(()=>{this.preparation.deal(token,id);this.testPlayers.confirmActors(token,id);return this.view(token,id);}).immediate();}
 start(token:string,id:string){return this.db.transaction(()=>{this.preparation.start(token,id);this.records.start(id);return this.view(token,id);}).immediate();}
 identity(token:string,id:string){return this.preparation.identity(token,id);}
 submitIdentity(token:string,id:string,role:Role){return this.preparation.submitIdentity(token,id,role);}
 confirmIdentity(token:string,id:string){return this.preparation.confirmIdentity(token,id);}
 fillTestPlayers(token:string,id:string){this.member(token,id);assertPlayableBoard(this.boards.configuration(id),this.preparation.snapshot(id).settings.gameMode);this.testPlayers.fill(token,id);return this.view(token,id);}
 testPlayerIdentity(token:string,id:string,actorId:string){return this.testPlayers.identity(token,id,actorId);}
 testPlayerReady(token:string,id:string,actorId:string,ready:boolean,settingsRevision:number){this.testPlayers.ready(token,id,actorId,ready,settingsRevision);return this.view(token,id);}
 testPlayerConfirm(token:string,id:string,actorId:string){return this.testPlayers.confirm(token,id,actorId);}
 private management<T>(token:string,id:string,action:string,detail:unknown,apply:()=>T){return this.db.transaction(()=>{const m=this.member(token,id);const result=apply();if(this.judge.isJudge(id,m))this.judge.audit(id,m,action,detail);return result;}).immediate();}
 enterNight(token:string,id:string){return this.management(token,id,'enter-night',{},()=>{this.night.enter(token,id);const n=this.night.snapshot(id)!;if(n.phase==='awaiting_host')this.night.begin(token,id,n.turnId);return this.view(token,id);});}
 beginNight(token:string,id:string,turnId:string){return this.management(token,id,'begin-night',{turnId},()=>{this.night.begin(token,id,turnId);return this.view(token,id);});}
 nightPrivate(token:string,id:string){const m=this.member(token,id);if(this.judge.isJudge(id,m))return {turnId:this.night.snapshot(id)?.turnId??'',kind:'waiting' as const};return this.night.private(token,id);}
 nightCommand(token:string,id:string,c:NightCommand){const m=this.member(token,id);this.judge.assertPlayer(id,m);this.judge.assertFreshTurn(id,c.turnId);return this.night.command(token,id,c);}
 tickNights(){const restored=this.control.tick();return [...new Set([...restored,...this.night.tick(),...this.day.tick(),...this.control.tick()])];}
 private managementState(id:string):ManagementState{const control=this.control.snapshot(id),defaults=this.control.defaults(id),day=this.day.snapshot(id),night=this.night.snapshot(id),manual=this.records.public(id);const currentDay=day&&(!night||day.day>=night.night);return {phase:manual?.status==='ended'||currentDay&&day.phase==='ended'?'ended':manual?'manual':currentDay?'day':night?'night':'preparation',round:currentDay?day.day:night?.night??null,version:control.version,status:control.status,tempSeat:control.tempSeat,voteSeconds:defaults.seconds,voteVisibility:defaults.visibility,sheriff:day?.sheriff??null,badge:day?.badge??null};}
 managementHistory(token:string,id:string,query:unknown={}){return this.db.transaction(()=>{if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);const m=this.member(token,id);if(!this.control.canManage(id,m))throw new LobbyError('HOST_ONLY',403);return this.managementAudit.page(id,query);}).immediate();}
 futureVoteDefaults(token:string,id:string){return this.db.transaction(()=>{if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);const m=this.member(token,id);if(!this.control.canManage(id,m))throw new LobbyError('HOST_ONLY',403);return {version:this.control.snapshot(id).version,...this.control.defaults(id)};}).immediate();}
 gameControl(token:string,id:string,c:ControlCommand){return this.management(token,id,'control',c,()=>{const m=this.member(token,id),before=this.managementState(id);this.control.command(id,m,c);this.managementAudit.append(id,m,c.action,before,this.managementState(id));return this.view(token,id);});}
 connectMember(id:string,memberId:string,connectionId:string){return [...new Set([...this.tickNights(),...this.control.connect(id,memberId,connectionId)])];}
 disconnectMember(connectionId:string){return [...new Set([...this.tickNights(),...this.control.disconnect(connectionId)])];}
 enterDay(token:string,id:string){return this.management(token,id,'enter-day',{},()=>{this.day.enter(token,id);return this.view(token,id);});}
 daySelf(token:string,id:string){return this.db.transaction(()=>{if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.day.self(token,id);}).immediate();}
 dayPrivate(token:string,id:string){const m=this.member(token,id),result=this.day.private(token,id);if(this.judge.isJudge(id,m))return {...result,canSignup:false,canWithdraw:false,canVote:false,canShoot:false,canExplode:false,canTransfer:false,canInterject:false,canEndInterjection:false};return result;}
 dayCommand(token:string,id:string,c:DayCommand){return this.db.transaction(()=>{const m=this.member(token,id);this.judge.assertFreshTurn(id,c.turnId);const takeover=c.action==='transfer_badge'&&c.takeover===true&&!!m.is_manager&&this.day.snapshot(id)?.currentDeath!==m.seat;const before=takeover?this.managementState(id):null;let result;if(this.judge.isJudge(id,m)){if(['signup','withdraw','vote','shoot','explode','interject'].includes(c.action)||c.action==='transfer_badge'&&!c.takeover)this.judge.assertPlayer(id,m);result=this.management(token,id,'day-control',c,()=>this.day.command(token,id,c));}else result=this.day.command(token,id,c);if(before)this.managementAudit.append(id,m,'badge-takeover',before,this.managementState(id));return result;}).immediate();}
 testDayStore(actorId:string){return new DayStore(this.db,(token,id)=>this.testPlayers.actor(token,id,actorId),id=>this.night.completedState(id),this.now,this.dayRules,this.control);}
 testDayPrivate(token:string,id:string,actorId:string){this.testPlayers.actor(token,id,actorId);return this.testDayStore(actorId).private(token,id);}
 testDayCommand(token:string,id:string,actorId:string,c:DayCommand){this.testPlayers.actor(token,id,actorId);return this.testDayStore(actorId).command(token,id,c);}
 testDayAdvance(token:string,id:string){this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);this.day.testAdvance(id);return this.view(token,id);}
 testDayActor(token:string,id:string){const host=this.testPlayers.authorize(token,id);if(!this.testPlayers.isTestRoom(id))throw new LobbyError('NOT_TEST_PLAYER',403);const day=this.day.snapshot(id);if(!day)throw new LobbyError('DAY_UNAVAILABLE',409);const seat=this.day.testActionSeat(id);const actor=this.snapshot(id).seats.find(s=>s.number===seat&&(s.memberId===host.id||s.isTestPlayer));return {turnId:day.turnId,actorId:actor?.memberId??null};}
 testNightStore(actorId:string){return new NightStore(this.db,(token,id)=>this.testPlayers.actor(token,id,actorId),this.now,this.control,id=>this.boards.snapshot(id));}
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
  this.testPlayers.authorize(token,id);
  const roles=this.db.prepare('SELECT m.id AS memberId,m.seat,i.role FROM members m JOIN identities i ON i.member_id=m.id AND i.room_id=m.room_id JOIN test_players t ON t.member_id=m.id WHERE m.room_id=? AND m.seat IS NOT NULL ORDER BY m.seat').all(id) as {memberId:string;seat:number;role:Role}[];
  return {roles};
 }
 gameReplay(token:string,id:string):import('../contracts/game.js').GameReplay{
  const member=this.member(token,id);if(member.seat===null||!this.db.prepare('SELECT 1 FROM identities WHERE room_id=? AND member_id=?').get(id,member.id))throw new LobbyError('PARTICIPANT_ONLY',403);return this.readReplay(id);
 }
 private readReplay(id:string):import('../contracts/game.js').GameReplay{const day=this.day.snapshot(id);if(day?.phase!=='ended')throw new LobbyError('PHASE_LOCKED',409);
  const saved=this.db.prepare('SELECT kind,round,state FROM game_history WHERE room_id=?').all(id) as {kind:'night'|'day';round:number;state:string}[];
  for(const kind of ['night','day'] as const){const row=this.db.prepare(`SELECT state FROM ${kind}_games WHERE room_id=?`).get(id) as {state:string}|undefined;if(row){const s=JSON.parse(row.state);saved.push({kind,round:s[kind],state:row.state});}}
  const board=this.boards.snapshot(id);const host=this.db.prepare('SELECT nickname FROM members WHERE room_id=? AND is_host=1').get(id) as {nickname:string}|undefined;
  return finalReplay({board:{id:board.id,name:board.name},author:host?.nickname,winner:day.winner!,roles:day.revealed,rounds:saved.sort((a,b)=>a.round-b.round||(a.kind==='night'?-1:1)).map(r=>({kind:r.kind,round:r.round,events:JSON.parse(r.state).events,...(JSON.parse(r.state).engine?{engine:JSON.parse(r.state).engine}:{}),...(r.kind==='day'?{outcome:{sheriff:JSON.parse(r.state).sheriff,badge:JSON.parse(r.state).badge,result:JSON.parse(r.state).result}}:{})}))});
 }
 isFavorite(token:string,id:string){return !!this.db.prepare('SELECT 1 FROM saved_replays WHERE owner_hash=? AND room_id=?').get(this.auth.owner(token),id);}
 saveFavorite(token:string,id:string){return this.db.transaction(()=>{const record=this.gameReplay(token,id);const room=this.snapshot(id);this.db.prepare('INSERT OR IGNORE INTO saved_replays VALUES (?,?,?,?,?,?)').run(this.auth.owner(token),id,room.code,record.winner,this.now(),JSON.stringify({...record,board:{id:room.board.id,name:room.board.name}}));return {saved:true};}).immediate();}
 favorites(token:string):import('../contracts/game.js').FavoriteGame[]{return this.db.prepare('SELECT room_id AS roomId,code,winner,saved_at AS savedAt FROM saved_replays WHERE owner_hash=? ORDER BY saved_at DESC,room_id').all(this.auth.owner(token)) as import('../contracts/game.js').FavoriteGame[];}
 favoriteReplay(token:string,id:string):import('../contracts/game.js').GameReplay{const row=this.db.prepare('SELECT record FROM saved_replays WHERE owner_hash=? AND room_id=?').get(this.auth.owner(token),id) as {record:string}|undefined;if(!row)throw new LobbyError('NOT_FOUND',404);return finalReplay({...JSON.parse(row.record),saved:true});}
 removeFavorite(token:string,id:string){return this.db.transaction(()=>{const result=this.db.prepare('DELETE FROM saved_replays WHERE owner_hash=? AND room_id=?').run(this.auth.owner(token),id);if(result.changes){this.favoriteLibraryStore.clearName(token,'game',id);this.retention.touch([id]);}return {saved:false};}).immediate();}
 private favoriteSources(token:string):FavoriteSource[]{
  const games=this.favorites(token).map(item=>{
   const replay=this.favoriteReplay(token,item.roomId);
   const board=replay.board??(this.db.prepare('SELECT id,name FROM room_boards WHERE room_id=?').get(item.roomId) as {id:string;name:string}|undefined)??null;
   return {kind:'game' as const,id:item.roomId,code:item.code,author:replay.author??'',title:`房间 ${item.code}`,savedAt:item.savedAt,board,available:true,detail:item.winner==='wolves'?'狼人获胜':'好人获胜',searchText:JSON.stringify(replay)};
  });
  const records=this.recordFavorites(token).map(item=>{
   let available=true,searchText='';try{if(!item.privateRecord)searchText=JSON.stringify(this.records.post(token,item.id).document);}catch(error){if(!(error instanceof LobbyError&&['RECORD_WITHDRAWN','PARTICIPANT_ONLY','NOT_FOUND','PHASE_LOCKED'].includes(error.code)))throw error;available=false;}
   return {kind:'record' as const,id:item.id,code:item.code,author:item.author,title:`房间 ${item.code} · ${item.official?'官方':item.author}`,savedAt:item.savedAt,board:item.board??null,available,...(item.privateRecord?{privateRecord:true}:{}),hasUpdate:!item.privateRecord&&available&&this.notifications.hasUpdate(this.auth.owner(token),'record',item.id,item.version),detail:item.privateRecord?'未发布 · 仅本人可见':`版本 ${item.version} · ${available?'已发布':item.deleted?'已永久删除':item.withdrawn?'作者已撤回，暂不可读':'暂不可读'}`,searchText};
  });
  const shares=this.sharedFavoritesStore.sources(token).map(item=>{let hasUpdate=false;if(item.available){const post=this.sharedFavoritesStore.read(token,item.id);hasUpdate=this.notifications.hasUpdate(this.auth.owner(token),'share',item.id,post.version);}return {...item,hasUpdate};});
  return [...games,...records,...shares];
 }
 favoriteLibrary(token:string,query:Partial<FavoriteQuery>={}){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.favoriteLibraryStore.view(token,query);}
 renameFavorite(token:string,kind:FavoriteKind,id:string,input:FavoriteName){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.favoriteLibraryStore.rename(token,kind,id,input);}
 myRecords(token:string){return this.records.myRecords(token);}
 deleteRecord(token:string,id:string,input:import('../contracts/records.js').RecordDelete){return this.records.delete(token,id,input);}
 createRecord(token:string,id:string,input:import('../contracts/records.js').RecordCreate){return this.records.create(token,id,input);}
 recordsList(token:string,id:string){return this.records.list(token,id);}
 saveRecord(token:string,id:string,revision:number,document:import('../contracts/records.js').RecordDocument){return this.records.save(token,id,revision,document);}
 importAutomaticRecord(token:string,id:string,revision:number){return this.records.importAutomatic(token,id,revision);}
 publishRecord(token:string,id:string,revision:number){return this.db.transaction(()=>{const result=this.records.publish(token,id,revision);this.notifications.publication(result.id,result.version);return result;}).immediate();}
 withdrawRecord(token:string,id:string,revision:number){return this.records.withdraw(token,id,revision);}
 adminRecordList(token:string,id:string){return this.records.adminList(token,id);}
 adminRecordPost(token:string,id:string,version?:number){return this.records.post(token,id,version,true);}
 recordPost(token:string,id:string,version?:number){const post=this.records.post(token,id,version);if(post.saved)this.notifications.seen(this.auth.owner(token),'record',id,post.version);return post;}
 shareStatus(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.status(token,id);}
 ownShares(token:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.list(token);}
 shareRecord(token:string,id:string,c:ShareCommand){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.sharing.command(token,id,c);}
 sharedRecord(token:string,viewerToken?:string){
  const post=this.sharing.read(token);
  if(viewerToken&&this.hasSession(viewerToken)&&this.auth.account(viewerToken)){
   const owner=this.auth.owner(viewerToken),favorite=this.db.prepare('SELECT id FROM shared_record_favorites WHERE owner=? AND share_token=?').get(owner,token) as {id:string}|undefined;
   if(favorite)this.notifications.seen(owner,'share',favorite.id,post.version);
  }
  return post;
 }
 sharedFavoriteStatus(token:string|undefined,share:string){return this.sharedFavoritesStore.status(token&&this.hasSession(token)?token:undefined,share);}
 saveSharedFavorite(token:string,share:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.db.transaction(()=>{const existing=this.sharedFavoritesStore.status(token,share).saved,result=this.sharedFavoritesStore.save(token,share);const row=this.db.prepare('SELECT record_id FROM shared_record_favorites WHERE id=?').get(result.id) as {record_id:string};if(!existing)this.notifications.seen(this.auth.owner(token),'share',result.id,this.sharedFavoritesStore.read(token,result.id).version);this.touchRecordRoom(row.record_id);return result;}).immediate();}
 sharedFavorite(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);const post=this.sharedFavoritesStore.read(token,id);this.notifications.seen(this.auth.owner(token),'share',id,post.version);return post;}
 removeSharedFavorite(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.db.transaction(()=>{const row=this.db.prepare('SELECT record_id FROM shared_record_favorites WHERE owner=? AND id=?').get(this.auth.owner(token),id) as {record_id:string}|undefined;const result=this.sharedFavoritesStore.remove(token,id);if(result.removed){this.favoriteLibraryStore.clearName(token,'share',id);this.notifications.forgetSeen(this.auth.owner(token),'share',id);if(row)this.touchRecordRoom(row.record_id);}return {saved:false};}).immediate();}
 saveRecordFavorite(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.db.transaction(()=>{const owner=this.auth.owner(token),existed=this.db.prepare('SELECT 1 FROM record_favorites WHERE owner=? AND record_id=?').get(owner,id);const result=this.records.favorite(token,id);if(!existed){const row=this.db.prepare('SELECT published_version FROM record_drafts WHERE id=?').get(id) as {published_version:number|null};this.notifications.seen(owner,'record',id,row.published_version??0);}return result;}).immediate();}
 privateRecordFavorite(token:string,id:string){if(!this.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return this.records.privateFavorite(token,id);}
 recordFavorites(token:string){return this.records.favorites(token);}
 removeRecordFavorite(token:string,id:string){return this.db.transaction(()=>{const exists=this.db.prepare('SELECT 1 FROM record_favorites WHERE owner=? AND record_id=?').get(this.auth.owner(token),id);const result=this.records.removeFavorite(token,id);if(exists){this.favoriteLibraryStore.clearName(token,'record',id);this.notifications.forgetSeen(this.auth.owner(token),'record',id);this.touchRecordRoom(id);}return result;}).immediate();}
 appointJudge(token:string,id:string,c:JudgeAppoint){this.judge.appoint(token,id,c);return this.view(token,id);}
 judgePrivate(token:string,id:string){return this.judge.private(token,id);}
 startJudgeDraft(token:string,id:string,c:JudgeDraftCommand){return this.judge.start(token,id,c);}
 supplementJudge(token:string,id:string,c:JudgeSupplement){return this.judge.supplement(token,id,c);}
 returnJudge(token:string,id:string,c:JudgeReturn){this.judge.return(token,id,c);return this.view(token,id);}
 switchManual(token:string,id:string,confirmed:boolean){return this.db.transaction(()=>{this.judge.captureManualCheckpoint(token,id);this.records.switch(token,id,confirmed);return this.view(token,id);}).immediate();}
 finishManualRecord(token:string,id:string,input:import('../contracts/records.js').ManualFinish){return this.records.finishRecord(token,id,input);}
 adjudicateManual(token:string,id:string,input:import('../contracts/records.js').ManualAdjudicate){return this.records.adjudicate(token,id,input);}
 commitManual(token:string,id:string,revision:number){return this.records.commit(token,id,revision);}
 requestManualEnd(token:string,id:string,revision:number){return this.records.requestEnd(token,id,revision);}
 manualRequest(token:string,id:string){return this.records.request(token,id);}
 resolveManual(token:string,id:string,version:number,hostRevision:number,accept:boolean){return this.records.resolve(token,id,version,hostRevision,accept);}
 manualHistory(token:string,id:string){return this.records.history(token,id);}
 roomsFor(token:string):LobbyView[]{
  const rows=this.db.prepare('SELECT room_id,is_host FROM members WHERE session_hash=? ORDER BY rowid DESC').all(this.auth.owner(token)) as {room_id:string;is_host:number}[];
  return rows.filter(r=>!this.testPlayers.isTestRoom(r.room_id)||r.is_host===1&&this.auth.account(token)?.role==='admin').slice(0,20).map(r=>this.view(token,r.room_id));
 }
 private profileResult(token:string){
  const account=this.auth.requireAccount(token);
  const rooms=(this.db.prepare('SELECT room_id,is_host FROM members WHERE session_hash=? ORDER BY rowid DESC').all('account:'+account.id) as {room_id:string;is_host:number}[]).filter(r=>!this.testPlayers.isTestRoom(r.room_id)||r.is_host===1&&account.role==='admin').map(({room_id})=>this.view(token,room_id));
  this.retention.touch(rooms.map(room=>room.room.id));
  return {account,rooms};
 }
 updateProfile(token:string,nickname:string){this.auth.updateProfile(token,nickname);return this.profileResult(token);}
 async uploadAvatar(token:string,bytes:Buffer,contentType:string){await this.auth.uploadAvatar(token,bytes,contentType);return this.profileResult(token);}
 deleteAvatar(token:string){this.auth.deleteAvatar(token);return this.profileResult(token);}
 avatar(accountId:string,revision?:string){return this.auth.avatar(accountId,revision);}
 issueSession(token:string){this.db.prepare('INSERT INTO sessions(session_hash,created_at) VALUES (?,?)').run(sessionKey(token),Date.now());}
 hasSession(token:string){return !!this.db.prepare("SELECT 1 FROM sessions s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.session_hash=? AND (s.account_id IS NULL OR a.status='active')").get(sessionKey(token));}
 isDevelopmentTestHost(token:string){return this.allowTestPlayers&&this.auth.account(token)?.role==='admin'&&(this.db.prepare('SELECT m.room_id FROM members m JOIN test_rooms t ON t.room_id=m.room_id WHERE m.session_hash=? AND m.is_host=1').all(this.auth.owner(token)) as {room_id:string}[]).some(r=>this.testPlayers.isolated(r.room_id));}
 adminRooms(token:string){this.auth.requireAdmin(token);return (this.db.prepare('SELECT id FROM rooms ORDER BY created_at DESC LIMIT 200').all() as {id:string}[]).map(({id})=>this.snapshot(id));}
 adminReplay(token:string,id:string){this.auth.requireAdmin(token);return this.readReplay(id);}
 checkStorage(){for(const query of ['SELECT id FROM rooms LIMIT 1','SELECT session_hash FROM sessions LIMIT 1','SELECT id FROM members LIMIT 1','SELECT id FROM accounts LIMIT 1','SELECT room_id FROM preparations LIMIT 1','SELECT room_id FROM night_games LIMIT 1','SELECT room_id FROM day_games LIMIT 1'])this.db.prepare(query).get();}
 close(){this.db.close();}
}
