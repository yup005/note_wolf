import Database from 'better-sqlite3';
import {constants,createReadStream} from 'node:fs';
import {chmod,copyFile,link,lstat,mkdir,mkdtemp,open,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

export interface BackupInfo {path:string;sha256:string;bytes:number;schemaVersion:number}
export class DatabaseBackupError extends Error {
 constructor(public code:string){super(code);this.name='DatabaseBackupError';}
}
function fail(code:string):never{throw new DatabaseBackupError(code);}
const sidecars=['-wal','-shm','-journal'];
// Minimum core shapes used by the application, not merely recognizable table names.
const coreShapes:Record<string,{fields:string;key:string[];unique?:string[][]}>={
 rooms:{fields:'id:TEXT code:TEXT revision:INTEGER created_at:INTEGER',key:['id'],unique:[['code']]},
 members:{fields:'id:TEXT room_id:TEXT session_hash:TEXT nickname:TEXT is_host:INTEGER seat:INTEGER ready:INTEGER',key:['id'],unique:[['room_id','session_hash'],['room_id','seat']]},
 sessions:{fields:'session_hash:TEXT created_at:INTEGER account_id:TEXT',key:['session_hash']},
 accounts:{fields:'id:TEXT username:TEXT nickname:TEXT password_hash:TEXT salt:TEXT role:TEXT status:TEXT created_at:INTEGER',key:['id'],unique:[['username']]},
 record_rooms:{fields:'room_id:TEXT code:TEXT roles:TEXT participants:TEXT host_owner:TEXT ended:INTEGER',key:['room_id']},
 record_drafts:{fields:'id:TEXT room_id:TEXT owner:TEXT author:TEXT official:INTEGER draft:TEXT revision:INTEGER published_version:INTEGER withdrawn:INTEGER published_at:INTEGER deleted:INTEGER',key:['id'],unique:[['room_id','owner']]},
 record_versions:{fields:'record_id:TEXT version:INTEGER document:TEXT outcome:TEXT published_at:INTEGER',key:['record_id','version']},
 record_favorites:{fields:'owner:TEXT record_id:TEXT saved_at:INTEGER',key:['owner','record_id']}
};
function pathValue(value:string){if(typeof value!=='string'||!value||value.trim()!==value||value===':memory:'||value.includes('\0'))fail('INVALID_INPUT');return resolve(value);}
function checksum(value:string|undefined,required=false){if(value===undefined&&!required)return undefined;if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))fail('INVALID_INPUT');return value.toLowerCase();}
async function exists(path:string){try{await lstat(path);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function inputFile(path:string){try{const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())fail('SOURCE_INVALID');}catch(e){if(e instanceof DatabaseBackupError)throw e;fail('SOURCE_INVALID');}}
async function outputFree(path:string){for(const name of [path,...sidecars.map(s=>path+s)])if(await exists(name))fail('OUTPUT_EXISTS');}
async function privateParent(path:string){
 if(process.platform==='win32')fail('UNSUPPORTED_PLATFORM');
 const parent=dirname(path);await mkdir(parent,{recursive:true,mode:0o700});const s=await lstat(parent);
 if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o077)!==0)fail('INSECURE_DIRECTORY');
 return parent;
}
async function sha256(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
function application(db:Database.Database){
 const names=new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(row=>row.name));
 if(names.has('room_games')){
  if(!names.has('room_game_heads')||!names.has('rematch_receipts'))fail('INVALID_DATABASE');
  if(db.prepare('SELECT 1 FROM room_game_heads h LEFT JOIN room_games g ON g.id=h.game_id WHERE g.id IS NULL OR g.room_id<>h.room_id LIMIT 1').get())fail('INVALID_DATABASE');
  if(db.prepare('SELECT 1 FROM rooms r LEFT JOIN room_game_heads h ON h.room_id=r.id WHERE h.room_id IS NULL LIMIT 1').get())fail('INVALID_DATABASE');
  if(db.prepare('SELECT 1 FROM rematch_receipts r LEFT JOIN room_games g ON g.id=r.result_id WHERE g.id IS NULL OR g.room_id<>r.room_id LIMIT 1').get())fail('INVALID_DATABASE');
 }
 const quoted=(name:string)=>'"'+name.replaceAll('"','""')+'"';
 for(const [name,shape] of Object.entries(coreShapes)){
  if(!names.has(name))fail('INVALID_DATABASE');
  const columns=db.pragma('table_info('+quoted(name)+')') as {name:string;type:string;pk:number}[];
  for(const field of shape.fields.split(' ')){const [column,type]=field.split(':');if(!columns.some(c=>c.name===column&&c.type.toUpperCase()===type))fail('INVALID_DATABASE');}
  const key=columns.filter(c=>c.pk>0).sort((a,b)=>a.pk-b.pk).map(c=>c.name);if(JSON.stringify(key)!==JSON.stringify(shape.key))fail('INVALID_DATABASE');
  if(shape.unique){
   const indexes=db.pragma('index_list('+quoted(name)+')') as {name:string;unique:number;partial:number}[];
   const unique=indexes.filter(index=>index.unique===1&&index.partial===0).map(index=>(db.pragma('index_info('+quoted(index.name)+')') as {seqno:number;name:string|null}[]).sort((a,b)=>a.seqno-b.seqno).map(c=>c.name));
   if(shape.unique.some(required=>!unique.some(actual=>JSON.stringify(actual)===JSON.stringify(required))))fail('INVALID_DATABASE');
  }
 }
}
async function standalone(path:string){
 await inputFile(path);for(const suffix of sidecars)if(await exists(path+suffix))fail('NOT_STANDALONE');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const header=Buffer.alloc(100),{bytesRead}=await file.read(header,0,100,0);
  if(bytesRead<100||header.subarray(0,16).toString()!=='SQLite format 3\0')fail('INVALID_DATABASE');
  if(header[18]!==1||header[19]!==1)fail('NOT_STANDALONE');
 }finally{await file.close();}
}
async function validated(path:string,expected?:string):Promise<BackupInfo>{
 await standalone(path);const hash=await sha256(path);if(expected!==undefined&&hash!==expected)fail('CHECKSUM_MISMATCH');
 let db:Database.Database|undefined;
 try{db=new Database(path,{readonly:true,fileMustExist:true,timeout:1000});db.pragma('trusted_schema=OFF');application(db);
  if(db.pragma('integrity_check',{simple:true})!=='ok'||(db.pragma('foreign_key_check') as unknown[]).length!==0)fail('INVALID_DATABASE');
  const schemaVersion=db.pragma('user_version',{simple:true}) as number;
  return {path,sha256:hash,bytes:(await lstat(path)).size,schemaVersion};
 }catch(e){if(e instanceof DatabaseBackupError)throw e;throw new DatabaseBackupError('INVALID_DATABASE');}finally{db?.close();}
}
async function flush(path:string){const file=await open(path,constants.O_RDWR|constants.O_NOFOLLOW);try{await file.sync();}finally{await file.close();}}
async function publish(staged:string,output:string,info:BackupInfo){
 await flush(staged);await outputFree(output);
 try{await link(staged,output);}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')fail('OUTPUT_EXISTS');throw e;}
 // The validated file is already published if directory durability cannot be confirmed.
 let directory:Awaited<ReturnType<typeof open>>|undefined;
 try{directory=await open(dirname(output),constants.O_RDONLY);await directory.sync();}catch{fail('PUBLISH_UNCERTAIN');}finally{await directory?.close();}
 return {...info,path:output};
}
function operationError(e:unknown):never{if(e instanceof DatabaseBackupError)throw e;fail('OPERATION_FAILED');}

/** A filesystem-operator snapshot, never an application-admin export. */
export async function backupDatabase(options:{source:string;output:string;timeoutMs?:number}):Promise<BackupInfo>{
 const source=pathValue(options.source),output=pathValue(options.output),timeout=options.timeoutMs??30000,started=Date.now();
 if(!Number.isSafeInteger(timeout)||timeout<1||timeout>300000)fail('INVALID_INPUT');
 const deadline=()=>{if(Date.now()-started>=timeout)fail('BACKUP_TIMEOUT');};
 let stage:string|undefined,db:Database.Database|undefined;
 try{await inputFile(source);await outputFree(output);const parent=await privateParent(output);stage=await mkdtemp(join(parent,'.wolf-snapshot-'));await chmod(stage,0o700);deadline();
  const file=join(stage,'snapshot.sqlite'),reserved=await open(file,'wx',0o600);await reserved.close();
  try{db=new Database(source,{readonly:true,fileMustExist:true,timeout:1000});db.pragma('trusted_schema=OFF');application(db);}catch(e){if(e instanceof DatabaseBackupError)throw e;fail('INVALID_DATABASE');}
  await db.backup(file,{progress:()=>{deadline();return 100;}});db.close();db=undefined;deadline();
  // Change only our closed snapshot: it must travel without live WAL sidecars.
  const copy=new Database(file);try{copy.pragma('journal_mode=DELETE');}finally{copy.close();}
  await chmod(file,0o600);const info=await validated(file);deadline();return await publish(file,output,info);
 }catch(e){return operationError(e);}finally{db?.close();if(stage)await rm(stage,{recursive:true,force:true});}
}

/** Inspect a private copy so validation never opens or migrates the caller's archive. */
export async function inspectBackup(options:{source:string;sha256?:string}):Promise<BackupInfo>{
 const source=pathValue(options.source),expected=checksum(options.sha256);let stage:string|undefined;
 if(process.platform==='win32')fail('UNSUPPORTED_PLATFORM');
 try{await standalone(source);stage=await mkdtemp(join(tmpdir(),'wolf-inspect-'));await chmod(stage,0o700);const file=join(stage,'snapshot.sqlite');await copyFile(source,file,constants.COPYFILE_EXCL);await chmod(file,0o600);
  return {...await validated(file,expected),path:source};
 }catch(e){return operationError(e);}finally{if(stage)await rm(stage,{recursive:true,force:true});}
}

/** Restore only to a new path, using the separately recorded snapshot checksum. */
export async function restoreDatabase(options:{source:string;output:string;sha256:string}):Promise<BackupInfo>{
 const source=pathValue(options.source),output=pathValue(options.output),expected=checksum(options.sha256,true);let stage:string|undefined;
 try{await standalone(source);await outputFree(output);const parent=await privateParent(output);stage=await mkdtemp(join(parent,'.wolf-snapshot-'));await chmod(stage,0o700);const file=join(stage,'snapshot.sqlite');
  await copyFile(source,file,constants.COPYFILE_EXCL);await chmod(file,0o600);const info=await validated(file,expected);return await publish(file,output,info);
 }catch(e){return operationError(e);}finally{if(stage)await rm(stage,{recursive:true,force:true});}
}
