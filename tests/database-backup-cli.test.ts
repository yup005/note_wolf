import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {sharingFixture} from './helpers/sharing-fixture.js';

function command(name:string,args:string[]){return new Promise<{code:number;stdout:string;stderr:string}>(resolve=>execFile('npm',['run','--silent','db:'+name,'--',...args],{cwd:process.cwd()},(error,stdout,stderr)=>resolve({code:error?Number(error.code)||1:0,stdout,stderr})));}
function json(text:string):Record<string,any>|undefined{try{return JSON.parse(text.trim());}catch{return undefined;}}

test('operator commands perform a real backup, verification and new-file recovery without printing private contents',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wolf-backup-cli-')),source=join(dir,'live.sqlite'),f=await sharingFixture(source);try{f.publish();f.s.saveRecord(f.token,f.id,1,{...f.document,notes:'NEVER_LOG_THIS_PRIVATE_DRAFT'});const output=join(dir,'private','snapshot.sqlite');
  const backed=await command('backup',['--source',source,'--output',output]);assert.equal(backed.code,0,backed.stderr);const info=json(backed.stdout)!;assert.match(info.sha256,/^[a-f0-9]{64}$/);assert.equal(info.path,output);assert.equal(info.operation,'backup');
  const checked=await command('verify',['--source',output,'--sha256',info.sha256]);assert.equal(checked.code,0,checked.stderr);assert.equal(json(checked.stdout)!.sha256,info.sha256);
  const restored=join(dir,'private','restored.sqlite'),recovered=await command('restore',['--source',output,'--output',restored,'--sha256',info.sha256]);assert.equal(recovered.code,0,recovered.stderr);assert.equal(json(recovered.stdout)!.operation,'restore');assert.deepEqual(await readFile(restored),await readFile(output));
  const blocked=await command('restore',['--source',output,'--output',restored,'--sha256',info.sha256]);assert.equal(blocked.code,1);assert.equal(json(blocked.stderr)!.error,'OUTPUT_EXISTS');
  for(const result of [backed,checked,recovered,blocked])assert.doesNotMatch(result.stdout+result.stderr,/NEVER_LOG_THIS_PRIVATE_DRAFT|correct-password|password_hash|session_hash|Error:|\bat .*\.ts:/);
 }finally{f.s.close();await rm(dir,{recursive:true,force:true});}
});

test('operator arguments are explicit and reject duplicate unknown missing and command-inapplicable options',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wolf-backup-args-'));try{const source=join(dir,'absent.sqlite'),output=join(dir,'output.sqlite');const cases:[string,string[]][]=[
  ['backup',[]],['backup',['--source',source]],['backup',['--source',source,'--source',source,'--output',output]],['backup',['--source',source,'--output',output,'--force','true']],['backup',['--source','','--output',output]],['backup',['--source',source,'--output',output,'--timeout-ms','NaN']],
  ['restore',['--source',source,'--output',output]],['restore',['--source',source,'--output',output,'--sha256','bad']],['verify',['--source',source,'--output',output]],['verify',['--source',source,'--timeout-ms','10']]
 ];for(const [mode,args] of cases){const result=await command(mode,args);assert.equal(result.code,1);assert.equal(json(result.stderr)?.error,'INVALID_INPUT',result.stderr);assert.equal(result.stdout,'');}await assert.rejects(stat(output),{code:'ENOENT'});await assert.rejects(stat(source),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('CLI errors contain a fixed diagnosis and never raw SQLite content or a stack',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wolf-backup-errors-'));try{const source=join(dir,'invalid.sqlite'),output=join(dir,'new.sqlite');await writeFile(source,'PRIVATE_DATABASE_ERROR_CONTENT');
  const result=await command('backup',['--source',source,'--output',output]);assert.equal(result.code,1);assert.equal(json(result.stderr)?.error,'INVALID_DATABASE',result.stderr);assert.doesNotMatch(result.stderr,/PRIVATE_DATABASE_ERROR_CONTENT|SqliteError|Error:|\bat /);assert.equal(result.stdout,'');await assert.rejects(stat(output),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
