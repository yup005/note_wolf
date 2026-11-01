import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {LobbyError} from '../contracts/index.js';
import {boardSaveSchema,boardConfigureSchema,boardRuleVersion,type BoardSave,type BoardConfigure,type BoardTemplate,type BoardLibrary,type RoomBoardSnapshot,type BoardConfiguration} from '../contracts/board.js';
import {boardPreset,createBoardConfiguration} from '../domain/boardConfig.js';

const names={'standard-12':'12 人 · 预女猎白','mechanical-12':'12 人 · 机械狼通灵师','mechanical-armor-12':'12 人 · 机械装甲','wolf-girl-12':'12 人 · 狼女孩','treasure-12':'12 人 · 盗宝大师'} as const;
interface Row {id:string;name:string;revision:number;rule_version:string;composition:string}
function template(row:Row):BoardTemplate{
 if(row.rule_version!==boardRuleVersion)throw new LobbyError('BOARD_VERSION_UNSUPPORTED',409);
 return {id:row.id,name:row.name,revision:row.revision,ruleVersion:boardRuleVersion,composition:createBoardConfiguration(JSON.parse(row.composition))};
}
function preset(id:keyof typeof names):BoardTemplate{return {id,name:names[id],revision:1,ruleVersion:boardRuleVersion,composition:boardPreset(id)};}
const composition=(config:BoardConfiguration)=>({seatCount:config.seatCount,roles:config.roles,...(config.treasureMode?{treasureMode:config.treasureMode}:{}),...(config.idiotPolicy?{idiotPolicy:config.idiotPolicy}:{})});
export class BoardsStore{
 constructor(private db:Database.Database,private owner:(token:string)=>string){
  db.exec(`CREATE TABLE IF NOT EXISTS board_templates(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,rule_version TEXT NOT NULL,composition TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS room_boards(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,id TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,rule_version TEXT NOT NULL,composition TEXT NOT NULL);`);
  const initial=preset('standard-12');db.prepare('INSERT OR IGNORE INTO room_boards SELECT id,?,?,?,?,? FROM rooms').run(initial.id,initial.name,initial.revision,initial.ruleVersion,JSON.stringify(composition(initial.composition)));
 }
 initialize(id:string){const initial=preset('standard-12');this.db.prepare('INSERT OR IGNORE INTO room_boards VALUES (?,?,?,?,?,?)').run(id,initial.id,initial.name,initial.revision,initial.ruleVersion,JSON.stringify(composition(initial.composition)));}
 library(token:string):BoardLibrary{return {presets:Object.keys(names).map(id=>preset(id as keyof typeof names)),custom:(this.db.prepare('SELECT * FROM board_templates WHERE owner=? ORDER BY name,id').all(this.owner(token)) as Row[]).map(template)};}
 save(token:string,input:BoardSave):BoardTemplate{
  const parsed=boardSaveSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const draft=parsed.data;
  return this.db.transaction(()=>{
   const owner=this.owner(token);const old=draft.id?this.db.prepare('SELECT * FROM board_templates WHERE owner=? AND id=?').get(owner,draft.id) as Row|undefined:undefined;
   if(draft.id&&!old)throw new LobbyError('BOARD_NOT_FOUND',404);
   if(draft.revision!==(old?.revision??0))throw new LobbyError('STALE_BOARD',409);
   const config=createBoardConfiguration(draft.composition);const row={id:old?.id??randomUUID(),name:draft.name,revision:draft.revision+1,rule_version:boardRuleVersion,composition:JSON.stringify(composition(config))};
   this.db.prepare('INSERT INTO board_templates(id,owner,name,revision,rule_version,composition) VALUES (@id,@owner,@name,@revision,@rule_version,@composition) ON CONFLICT(id) DO UPDATE SET name=excluded.name,revision=excluded.revision,composition=excluded.composition').run({...row,owner});return template(row);
  }).immediate();
 }
 private row(id:string):Row{
  const row=this.db.prepare('SELECT * FROM room_boards WHERE room_id=?').get(id) as Row|undefined;
  if(!row)throw new LobbyError('ROOM_NOT_FOUND',404);return row;
 }
 configuration(id:string){return template(this.row(id)).composition;}
 snapshot(id:string):RoomBoardSnapshot{const t=template(this.row(id));return {id:t.id,name:t.name,ruleVersion:t.ruleVersion,composition:{seatCount:t.composition.seatCount,roleCounts:t.composition.roles,ruleset:t.composition.ruleset,playable:t.composition.playable,...(t.composition.treasureMode?{treasureMode:t.composition.treasureMode}:{}),...(t.composition.idiotPolicy?{idiotPolicy:t.composition.idiotPolicy}:{})}};}
 configure(token:string,id:string,input:BoardConfigure){
  const parsed=boardConfigureSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const command=parsed.data;
  this.db.transaction(()=>{
   const m=this.db.prepare('SELECT is_host FROM members WHERE room_id=? AND session_hash=?').get(id,this.owner(token)) as {is_host:number}|undefined;
   if(!m)throw new LobbyError('NOT_MEMBER',403);if(!m.is_host)throw new LobbyError('HOST_ONLY',403);
   const p=this.db.prepare('SELECT phase,settings_revision FROM preparations WHERE room_id=?').get(id) as {phase:string;settings_revision:number};
   if(p.phase!=='lobby')throw new LobbyError('PHASE_LOCKED',409);
   if(p.settings_revision!==command.settingsRevision)throw new LobbyError('SETTINGS_CHANGED',409);
   const s=command.selection;let next:BoardTemplate;
   if(s.kind==='preset'){if(s.treasureMode&&s.id!=='treasure-12')throw new LobbyError('INVALID_INPUT');next=preset(s.id);if(s.treasureMode)next.composition=createBoardConfiguration({...composition(next.composition),treasureMode:s.treasureMode});}
   else if(s.kind==='custom'){
    const row=this.db.prepare('SELECT * FROM board_templates WHERE owner=? AND id=?').get(this.owner(token),s.id) as Row|undefined;
    if(!row)throw new LobbyError('BOARD_NOT_FOUND',404);next=template(row);
   }else next={id:'custom',name:'自定义板子',revision:1,ruleVersion:boardRuleVersion,composition:createBoardConfiguration(s.composition)};
   if(this.db.prepare('SELECT 1 FROM members WHERE room_id=? AND seat>?').get(id,next.composition.seatCount))throw new LobbyError('OCCUPIED_SEATS_OUTSIDE_BOARD',409);
   const current=this.snapshot(id),payload=JSON.stringify(composition(next.composition));
   if(current.id===next.id&&JSON.stringify(composition(this.configuration(id)))===payload&&current.name===next.name)return;
   this.db.prepare('INSERT INTO room_boards VALUES (?,?,?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET id=excluded.id,name=excluded.name,revision=excluded.revision,rule_version=excluded.rule_version,composition=excluded.composition').run(id,next.id,next.name,next.revision,next.ruleVersion,payload);
   this.db.prepare('UPDATE preparations SET settings_revision=settings_revision+1 WHERE room_id=?').run(id);
   this.db.prepare('UPDATE members SET ready=0 WHERE room_id=?').run(id);this.db.prepare('UPDATE rooms SET revision=revision+1 WHERE id=?').run(id);
  }).immediate();
 }
}

// SQLite cannot remove a CHECK through ALTER COLUMN. Rebuild only the constrained
// table inside a transaction, keeping primary keys and all dependent rows intact.
export function migrateBoardSeats(db:Database.Database){
 const row=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='members'").get() as {sql:string};
 if(!/seat BETWEEN 1 AND 12/i.test(row.sql))return;
 db.pragma('foreign_keys=OFF');try{
  db.transaction(()=>{
   db.exec(`CREATE TABLE members_board_migration(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,nickname TEXT NOT NULL,is_host INTEGER NOT NULL DEFAULT 0,seat INTEGER CHECK(seat>=1),ready INTEGER NOT NULL DEFAULT 0,UNIQUE(room_id,session_hash),UNIQUE(room_id,seat));
    INSERT INTO members_board_migration(id,room_id,session_hash,nickname,is_host,seat,ready) SELECT id,room_id,session_hash,nickname,is_host,seat,ready FROM members;
    DROP TABLE members; ALTER TABLE members_board_migration RENAME TO members;`);
   if((db.pragma('foreign_key_check') as unknown[]).length)throw new Error('Board seat migration failed foreign key validation');
  }).immediate();
 }finally{db.pragma('foreign_keys=ON');}
}
