import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtemp,readFile,writeFile,stat,readdir,symlink,link,chmod,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {sharingFixture} from './helpers/sharing-fixture.js';
import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';
import {LobbyStore} from '../packages/storage/lobby.js';

const modulePath='../packages/storage/databaseBackup.js';
const implementation:Record<string,any>=await import(modulePath).catch(()=>({}));
function methods(){for(const name of ['backupDatabase','inspectBackup','restoreDatabase'])assert.equal(typeof implementation[name],'function',`${name} must implement the local backup contract`);return implementation;}
const digest=async(path:string)=>createHash('sha256').update(await readFile(path)).digest('hex');
function rows(db:Database.Database){return (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(row=>JSON.stringify(row)).sort()]);}
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'wolf-backup-')),source=join(dir,'source.sqlite');const f=await sharingFixture(source);f.publish();f.s.saveRecordFavorite(f.token,f.recordId);f.s.saveRecord(f.token,f.id,1,{...f.document,notes:'已发布第二版'});f.s.publishRecord(f.token,f.id,2);f.s.saveRecord(f.token,f.id,2,{...f.document,notes:'synthetic unpublished backup secret'});return {...f,dir,source,close:async()=>{f.s.close();await rm(dir,{recursive:true,force:true});}};}

test('online snapshot includes committed WAL facts, excludes an uncommitted writer and leaves source rows unchanged',async()=>{
 const m=methods(),f=await fixture();const observer=new Database(f.source);observer.pragma('wal_autocheckpoint=0');observer.exec('CREATE TABLE backup_probe(id INTEGER PRIMARY KEY,value TEXT)');observer.prepare('INSERT INTO backup_probe VALUES (?,?)').run(1,'committed WAL fact');const before=rows(observer);observer.exec('BEGIN IMMEDIATE');observer.prepare('INSERT INTO backup_probe VALUES (?,?)').run(2,'not committed');
 try{assert.ok((await stat(f.source+'-wal')).size>0);const output=join(f.dir,'private','snapshot.sqlite'),info=await m.backupDatabase({source:f.source,output});assert.equal(info.path,output);assert.equal(info.sha256,await digest(output));assert.equal(info.bytes,(await stat(output)).size);assert.equal((await stat(output)).mode&0o777,0o600);assert.equal((await stat(join(f.dir,'private'))).mode&0o777,0o700);
  const copy=new Database(output,{readonly:true});try{assert.deepEqual(copy.prepare('SELECT * FROM backup_probe').all(),[{id:1,value:'committed WAL fact'}]);assert.deepEqual(rows(copy),before);assert.equal(copy.pragma('journal_mode',{simple:true}),'delete');assert.equal(copy.pragma('integrity_check',{simple:true}),'ok');}finally{copy.close();}
  observer.exec('ROLLBACK');assert.deepEqual(rows(observer),before);assert.deepEqual(await readdir(join(f.dir,'private')),['snapshot.sqlite']);
 }finally{if(observer.inTransaction)observer.exec('ROLLBACK');observer.close();await f.close();}
});

test('isolated restore retains accounts, active private phase, official versions, unpublished draft and original favorites',async()=>{
 const m=methods(),f=await fixture();let restored:LobbyStore|undefined;try{
  const active=f.s.create(f.token,'synthetic active room').room;f.s.select(f.token,active.id,1);const players=fillRealPlayers(f.s,f.token,active.id);f.s.setReady(f.token,active.id,true,0);f.s.deal(f.token,active.id);confirmRealPlayers(f.s,active.id,players);f.s.confirmIdentity(f.token,active.id);f.s.start(f.token,active.id);f.s.enterNight(f.token,active.id);
  const phase=f.s.snapshot(active.id).night!.phase,identity=f.s.identity(f.token,active.id).role,output=join(f.dir,'backup.sqlite');const info=await m.backupDatabase({source:f.source,output});assert.deepEqual(await m.inspectBackup({source:output,sha256:info.sha256}),info);
  const target=join(f.dir,'restored.sqlite');const result=await m.restoreDatabase({source:output,output:target,sha256:info.sha256});assert.equal(result.sha256,info.sha256);assert.equal(await digest(target),info.sha256);restored=new LobbyStore(target,undefined,true);
  assert.equal(restored.auth.account(f.token)!.id,f.account.id);assert.equal(restored.snapshot(active.id).night!.phase,phase);assert.equal(restored.identity(f.token,active.id).role,identity);assert.equal(restored.snapshot(active.id).seats.filter(seat=>seat.memberId).length,12);
  assert.equal(restored.recordPost(f.token,f.recordId).document.notes,'已发布第二版');assert.equal(restored.recordPost(f.token,f.recordId,1).document.notes,'已发布复盘');assert.equal(restored.snapshot(f.id).manual!.status,'ended');assert.deepEqual(restored.recordPost(f.token,f.recordId).document.deaths,f.document.deaths);assert.equal(restored.recordsList(f.token,f.id).own!.document.notes,'synthetic unpublished backup secret');assert.equal(restored.recordFavorites(f.token)[0].id,f.recordId);
  const extra=randomBytes(32).toString('hex');restored.issueSession(extra);restored.create(extra,'restored-only room');assert.equal(f.s.roomsFor(extra).length,0);assert.equal(f.s.recordsList(f.token,f.id).own!.document.notes,'synthetic unpublished backup secret');
 }finally{restored?.close();await f.close();}
});

test('existing files, hard links, dangling symlinks and sidecars are never overwritten',async()=>{
 const m=methods(),f=await fixture();try{const backup=await m.backupDatabase({source:f.source,output:join(f.dir,'backup.sqlite')});for(const kind of ['file','hard','symlink','sidecar']){
  const output=join(f.dir,kind+'.sqlite');if(kind==='file')await writeFile(output,'keep existing bytes');if(kind==='hard')await link(f.source,output);if(kind==='symlink')await symlink(join(f.dir,'missing'),output);if(kind==='sidecar')await writeFile(output+'-wal','keep sidecar');
  const sourceBefore=await digest(f.source);await assert.rejects(m.backupDatabase({source:f.source,output}),{code:'OUTPUT_EXISTS'});await assert.rejects(m.restoreDatabase({source:backup.path,output,sha256:backup.sha256}),{code:'OUTPUT_EXISTS'});assert.equal(await digest(f.source),sourceBefore);if(kind==='file')assert.equal(await readFile(output,'utf8'),'keep existing bytes');if(kind==='sidecar')assert.equal(await readFile(output+'-wal','utf8'),'keep sidecar');
 }await assert.rejects(m.backupDatabase({source:f.source,output:f.source}),{code:'OUTPUT_EXISTS'});
 }finally{await f.close();}
});

test('wrong digests, corrupt or unrelated databases and foreign key violations cannot publish a restore',async()=>{
 const m=methods(),f=await fixture();try{const backup=await m.backupDatabase({source:f.source,output:join(f.dir,'backup.sqlite')}),target=join(f.dir,'never-published.sqlite');await assert.rejects(m.restoreDatabase({source:backup.path,output:target,sha256:'0'.repeat(64)}),{code:'CHECKSUM_MISMATCH'});await assert.rejects(stat(target),{code:'ENOENT'});
  const corrupt=join(f.dir,'corrupt.sqlite');await writeFile(corrupt,'not SQLite / synthetic private content');await assert.rejects(m.inspectBackup({source:corrupt}),{code:'INVALID_DATABASE'});await assert.rejects(m.restoreDatabase({source:corrupt,output:target,sha256:await digest(corrupt)}),{code:'INVALID_DATABASE'});
  const unrelated=join(f.dir,'unrelated.sqlite'),other=new Database(unrelated);other.exec('CREATE TABLE other(id INTEGER)');other.close();await assert.rejects(m.inspectBackup({source:unrelated}),{code:'INVALID_DATABASE'});
  const broken=new Database(backup.path);broken.pragma('foreign_keys=OFF');broken.prepare('UPDATE record_versions SET record_id=?').run('missing-parent');broken.close();await assert.rejects(m.inspectBackup({source:backup.path}),{code:'INVALID_DATABASE'});await assert.rejects(m.restoreDatabase({source:backup.path,output:target,sha256:await digest(backup.path)}),{code:'INVALID_DATABASE'});assert.equal((await readdir(f.dir)).some(name=>name.startsWith('.wolf-snapshot-')),false);
 }finally{await f.close();}
});

test('live WAL archives, missing sources, insecure output parents and invalid options fail without source mutation',async()=>{
 const m=methods(),f=await fixture();try{await assert.rejects(m.inspectBackup({source:f.source}),{code:'NOT_STANDALONE'});await assert.rejects(m.restoreDatabase({source:f.source,output:join(f.dir,'restored.sqlite'),sha256:await digest(f.source)}),{code:'NOT_STANDALONE'});
  await assert.rejects(m.backupDatabase({source:join(f.dir,'missing'),output:join(f.dir,'new.sqlite')}),{code:'SOURCE_INVALID'});await assert.rejects(stat(join(f.dir,'missing')),{code:'ENOENT'});const alias=join(f.dir,'source-alias.sqlite');await symlink(f.source,alias);await assert.rejects(m.backupDatabase({source:alias,output:join(f.dir,'new.sqlite')}),{code:'SOURCE_INVALID'});
  await chmod(f.dir,0o755);try{await assert.rejects(m.backupDatabase({source:f.source,output:join(f.dir,'new.sqlite')}),{code:'INSECURE_DIRECTORY'});}finally{await chmod(f.dir,0o700);}
  for(const source of ['',':memory:',' x '])await assert.rejects(m.backupDatabase({source,output:join(f.dir,'new.sqlite')}),{code:'INVALID_INPUT'});await assert.rejects(m.restoreDatabase({source:f.source,output:join(f.dir,'new.sqlite'),sha256:'wrong'}),{code:'INVALID_INPUT'});await assert.rejects(m.backupDatabase({source:f.source,output:join(f.dir,'new.sqlite'),timeoutMs:0}),{code:'INVALID_INPUT'});
 }finally{await f.close();}
});

test('concurrent exports publish exactly one complete private snapshot and remove owned staging files',async()=>{
 const m=methods(),f=await fixture();try{const output=join(f.dir,'winner.sqlite'),results=await Promise.allSettled([m.backupDatabase({source:f.source,output}),m.backupDatabase({source:f.source,output})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='OUTPUT_EXISTS').length,1);assert.equal((await m.inspectBackup({source:output})).sha256,await digest(output));assert.equal((await readdir(f.dir)).some(name=>name.startsWith('.wolf-snapshot-')),false);
 }finally{await f.close();}
});

test('an expired backup deadline leaves no final or staging file and preserves its source',async()=>{
 const m=methods(),f=await fixture();try{const output=join(f.dir,'expired.sqlite'),pending=m.backupDatabase({source:f.source,output,timeoutMs:1});const until=Date.now()+20;while(Date.now()<until){}await assert.rejects(pending,{code:'BACKUP_TIMEOUT'});await assert.rejects(stat(output),{code:'ENOENT'});assert.equal((await readdir(f.dir)).some(name=>name.startsWith('.wolf-snapshot-')),false);assert.equal(f.s.recordPost(f.token,f.recordId).document.notes,'已发布第二版');
 }finally{await f.close();}
});

const invalidSchemas=[
 {name:'renamed account password field',sql:'ALTER TABLE accounts RENAME COLUMN password_hash TO unavailable_password'},
 {name:'renamed published record document',sql:'ALTER TABLE record_versions RENAME COLUMN document TO unavailable_document'},
 {name:'missing favorite primary key',sql:'ALTER TABLE record_favorites RENAME TO saved_favorites; CREATE TABLE record_favorites(owner TEXT NOT NULL,record_id TEXT NOT NULL REFERENCES record_drafts(id),saved_at INTEGER NOT NULL); INSERT INTO record_favorites SELECT * FROM saved_favorites; DROP TABLE saved_favorites'},
 {name:'missing username uniqueness',sql:'CREATE TABLE replacement_accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL,nickname TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL); INSERT INTO replacement_accounts SELECT * FROM accounts; DROP TABLE accounts; ALTER TABLE replacement_accounts RENAME TO accounts'}
];
for(const mutation of invalidSchemas)test(mutation.name+' cannot pass backup inspection or recovery',async()=>{
 const m=methods(),f=await fixture();try{
  const path=join(f.dir,'incompatible.sqlite');await m.backupDatabase({source:f.source,output:path});const altered=new Database(path);altered.pragma('foreign_keys=OFF');altered.exec(mutation.sql);assert.equal(altered.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(altered.pragma('foreign_key_check'),[]);altered.close();
  await assert.rejects(m.inspectBackup({source:path}),{code:'INVALID_DATABASE'});const output=path+'.restored';await assert.rejects(m.restoreDatabase({source:path,output,sha256:await digest(path)}),{code:'INVALID_DATABASE'});await assert.rejects(m.backupDatabase({source:path,output}),{code:'INVALID_DATABASE'});await assert.rejects(stat(output),{code:'ENOENT'});
 }finally{await f.close();}
});
