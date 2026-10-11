import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
test('local admin initialization supports custom database paths, private credentials and one administrator only',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-bootstrap-'));try{const script=resolve('apps/server/create-admin.ts'),dbPath=join(dir,'custom','accounts.db');const args=['--import','tsx','--eval',`process.chdir(${JSON.stringify(dir)});await import(${JSON.stringify(script)});`];const run=()=>spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,WOLF_DB_PATH:dbPath,WOLF_ADMIN_USERNAME:'bootstrap_admin',WOLF_ADMIN_PASSWORD:'bootstrap-test-password'}});const first=run();assert.equal(first.status,0,first.stderr);const file=join(dir,'.data/admin-credentials.txt');assert.equal(existsSync(file),true);assert.equal(statSync(file).mode&0o777,0o600);const second=run();assert.equal(second.status,1);const db=new Database(dbPath,{readonly:true});try{assert.equal((db.prepare("SELECT count(*) AS n FROM accounts WHERE role='admin'").get() as {n:number}).n,1);}finally{db.close();}}finally{rmSync(dir,{recursive:true,force:true});}
});
