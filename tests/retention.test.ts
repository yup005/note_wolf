import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import {ControlStore} from '../packages/storage/control.js';
import {RetentionStore} from '../packages/storage/retention.js';

const day=86400000;
function retention(db:Database.Database,now:()=>number){return new RetentionStore(db,now);}
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'wolf-retention-'));const file=join(dir,'synthetic.sqlite');
 const lobby=new LobbyStore(file);lobby.close();const db=new Database(file);db.pragma('foreign_keys=ON');
 return {db,close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
function room(db:Database.Database,id:string){const count=db.prepare('SELECT COUNT(*) AS n FROM rooms').get() as {n:number};db.prepare('INSERT INTO rooms(id,code,created_at) VALUES (?,?,?)').run(id,String(count.n).padStart(4,'0'),0);}
function archive(db:Database.Database,id:string){
 db.prepare('INSERT INTO record_rooms(room_id,code,roles,participants,host_owner,ended) VALUES (?,?,?,?,?,1)').run(id,'0000','[]','[]','synthetic-owner');
 db.prepare('INSERT INTO record_drafts(id,room_id,owner,author,official,draft,published_version) VALUES (?,?,?,?,?,?,1)').run('draft:'+id,id,'synthetic-owner','Synthetic',1,'{}');
 db.prepare('INSERT INTO record_versions VALUES (?,1,?,?,0)').run('draft:'+id,'{}',null);
 db.prepare('INSERT INTO manual_revisions VALUES (?,1,0,?,NULL)').run(id,'{}');
}
function account(db:Database.Database,id:string,status='active'){
 db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?,0)').run(id,id,'Synthetic','synthetic-hash','synthetic-salt','user',status);
}

test('legacy migration gives existing rooms one safety window and never resets it on restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-retention-migration-'));const file=join(dir,'legacy.sqlite');let db=new Database(file);let now=1000;
 try{
  db.exec("CREATE TABLE rooms(id TEXT PRIMARY KEY,code TEXT UNIQUE,created_at INTEGER NOT NULL); INSERT INTO rooms VALUES ('legacy','0001',0);");
  const first=await retention(db,()=>now);assert.deepEqual(first.expiredcleanup(),[]);
  assert.equal((db.prepare('SELECT last_activity_at FROM rooms').get() as {last_activity_at:number}).last_activity_at,1000);
  db.close();db=new Database(file);now=1000+day-1;const restarted=await retention(db,()=>now);assert.deepEqual(restarted.expiredcleanup(),[]);
  now++;assert.deepEqual(restarted.expiredcleanup(),['legacy']);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('unprotected rooms expire at the exact 24h boundary including playing and paused games',async()=>{
 const f=fixture();let now=1000;try{
  for(const id of ['idle','playing','paused'])room(f.db,id);const store=await retention(f.db,()=>now);store.touch(['idle','playing','paused']);
  f.db.prepare('INSERT INTO night_games VALUES (?,?)').run('playing','{}');
  f.db.prepare("INSERT INTO room_controls(room_id,status) VALUES (?,'paused')").run('paused');
  now=1000+day-1;assert.deepEqual(store.expiredcleanup(),[]);now++;
  assert.deepEqual(store.expiredcleanup().sort(),['idle','paused','playing']);assert.deepEqual(store.expiredcleanup(),[]);
 }finally{f.close();}
});

test('explicit activity extends only existing selected rooms without resurrecting missing rooms',async()=>{
 const f=fixture();let now=1000;try{
  room(f.db,'active');room(f.db,'idle');const store=await retention(f.db,()=>now);store.touch(['active','idle']);
  now+=day-1;store.touch(['active','missing','active']);now++;
  assert.deepEqual(store.expiredcleanup(),['idle']);assert.equal((f.db.prepare('SELECT COUNT(*) AS n FROM rooms').get() as {n:number}).n,1);
  now+=day-1;assert.deepEqual(store.expiredcleanup(),['active']);
 }finally{f.close();}
});

test('either replay or another user record favorite protects the whole room until removed',async()=>{
 const f=fixture();let now=1000;try{
  room(f.db,'replay');room(f.db,'post');archive(f.db,'post');const store=await retention(f.db,()=>now);store.touch(['replay','post']);
  f.db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run('another-owner','replay','0000','good',0,'{}');
  f.db.prepare('INSERT INTO record_favorites VALUES (?,?,0)').run('another-owner','draft:post');
  now+=day;assert.deepEqual(store.expiredcleanup(),[]);
  f.db.exec('DELETE FROM saved_replays; DELETE FROM record_favorites;');
  assert.deepEqual(store.expiredcleanup().sort(),['post','replay']);
 }finally{f.close();}
});

test('unrevoked renewable shares protect expired VIP, withdrawn and disabled owners without a current readable link',async()=>{
 const f=fixture();let now=1000;try{
  const ids=['active','expired','withdrawn','disabled','revoked'];
  for(const [i,id] of ids.entries()){
   room(f.db,id);archive(f.db,id);account(f.db,id,id==='disabled'?'disabled':'active');
   f.db.prepare('INSERT INTO vip_entitlements VALUES (?,1,?)').run(id,id==='expired'?0:null);
   if(id==='withdrawn')f.db.prepare('UPDATE record_drafts SET withdrawn=1 WHERE id=?').run('draft:'+id);
   f.db.prepare('INSERT INTO record_share_links VALUES (?,?,?,?,1,0)').run('draft:'+id,id,String(i).repeat(64),id==='revoked'?1:0);
  }
  const store=await retention(f.db,()=>now);store.touch(ids);now+=day;
  assert.deepEqual(store.expiredcleanup(),['revoked']);
  f.db.prepare('UPDATE record_share_links SET revoked=1 WHERE record_id=?').run('draft:expired');
  assert.deepEqual(store.expiredcleanup(),['expired']);
 }finally{f.close();}
});

test('expired deletion removes only runtime state and preserves independent records, account session and private templates',async()=>{
 const f=fixture();let now=1000;try{
  room(f.db,'expired');archive(f.db,'expired');account(f.db,'account');
  f.db.prepare('INSERT INTO sessions(session_hash,created_at) VALUES (?,0)').run('session');
  f.db.prepare('INSERT INTO board_templates VALUES (?,?,?,1,?,?)').run('template','account:account','Synthetic','2026-10-10-v1','{}');
  f.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname,is_host,seat) VALUES (?,?,?,?,1,1)').run('member','expired','session','Synthetic');
  f.db.prepare('INSERT INTO create_requests VALUES (?,?,?)').run('session','request','expired');
  f.db.prepare('INSERT INTO preparations(room_id) VALUES (?)').run('expired');
  f.db.prepare("INSERT INTO identities VALUES (?,?,'villager',1)").run('expired','member');
  f.db.prepare('INSERT INTO test_rooms VALUES (?)').run('expired');f.db.prepare('INSERT INTO test_players VALUES (?)').run('member');
  for(const table of ['night_games','day_games','voice_observations'])f.db.prepare(`INSERT INTO ${table} VALUES (?,?)`).run('expired','{}');
  f.db.prepare('INSERT INTO game_history VALUES (?,?,1,?)').run('expired','night','{}');
  f.db.prepare('INSERT INTO room_controls(room_id) VALUES (?)').run('expired');
  f.db.prepare('INSERT INTO member_presence(member_id,room_id) VALUES (?,?)').run('member','expired');
  f.db.prepare('INSERT INTO voice_leases VALUES (?,?,?,?,?)').run('expired','session','client','member',1000000);
  f.db.prepare('INSERT INTO voice_deliveries VALUES (?,?)').run('expired','cue');
  f.db.prepare('INSERT INTO room_boards VALUES (?,?,?,1,?,?)').run('expired','template','Synthetic','2026-10-10-v1','{}');
  f.db.prepare('INSERT INTO manual_games(room_id,official) VALUES (?,?)').run('expired','{}');
  f.db.exec('CREATE TABLE board_engine_states(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,revision INTEGER NOT NULL,state TEXT NOT NULL);');
  f.db.prepare('INSERT INTO board_engine_states VALUES (?,1,?)').run('expired','{}');
  f.db.prepare('INSERT INTO record_share_links VALUES (?,?,?,1,1,0)').run('draft:expired','account','a'.repeat(64));
  const archives=['record_rooms','record_drafts','record_versions','manual_revisions','record_share_links'];
  const before=archives.map(table=>f.db.prepare(`SELECT * FROM ${table}`).all());
  const store=await retention(f.db,()=>now);store.touch(['expired']);now+=day;assert.deepEqual(store.expiredcleanup(),['expired']);
  assert.deepEqual(archives.map(table=>f.db.prepare(`SELECT * FROM ${table}`).all()),before);
  for(const table of ['rooms','members','create_requests','preparations','identities','test_rooms','test_players','night_games','day_games','game_history','room_controls','member_presence','voice_leases','voice_deliveries','voice_observations','room_boards','manual_games','board_engine_states']){
   assert.equal((f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n,0,table);
  }
  for(const table of ['accounts','sessions','board_templates'])assert.equal((f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n,1,table);
  assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
 }finally{f.close();}
});

test('forgetting deleted room connections prevents later disconnect from recreating deleted control rows',async()=>{
 const f=fixture();let now=1000;try{
  for(const id of ['deleted','kept']){
   room(f.db,id);f.db.prepare('INSERT INTO members(id,room_id,session_hash,nickname) VALUES (?,?,?,?)').run('member:'+id,id,id,'Synthetic');
   f.db.prepare('INSERT INTO preparations(room_id) VALUES (?)').run(id);
  }
  const controls=new ControlStore(f.db,()=>now);controls.connect('deleted','member:deleted','socket:a');controls.connect('deleted','member:deleted','socket:b');controls.connect('kept','member:kept','socket:kept');
  const store=await retention(f.db,()=>now);store.touch(['deleted','kept']);now+=day-1;store.touch(['kept']);now++;
  const deleted=store.expiredcleanup();assert.deepEqual(deleted,['deleted']);
  assert.equal(typeof controls.forgetRooms,'function');controls.forgetRooms(deleted);
  assert.deepEqual(controls.disconnect('socket:a'),[]);assert.deepEqual(controls.disconnect('socket:b'),[]);
  assert.deepEqual(controls.disconnect('socket:kept'),['kept']);assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
 }finally{f.close();}
});
