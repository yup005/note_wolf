import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
test('Node runtime supports transactional SQLite persistence',()=>{
 assert.ok(Number(process.versions.node.split('.')[0])>=24);
 const db=new Database(':memory:');
 db.exec('CREATE TABLE health(value TEXT)');
 db.transaction(()=>db.prepare('INSERT INTO health VALUES (?)').run('ok'))();
 assert.deepEqual(db.prepare('SELECT value FROM health').get(),{value:'ok'});
 db.close();
});
