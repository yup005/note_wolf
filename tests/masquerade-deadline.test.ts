import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {NightStore} from '../packages/storage/night.js';
import {fixture,start} from './masquerade-fixture.js';
test('one transaction timestamp accepts a pre-deadline clear and cannot roll back a second deadline advance',()=>{
 const s=start(fixture());s.masquerade!.danceDraft=[5,6,7];s.engine!.masquerade!.danced.push({night:1,actor:12,target:5,id:'old',source:'manual'});const db=new Database(':memory:');
 db.exec('CREATE TABLE night_games(room_id TEXT PRIMARY KEY,state TEXT);CREATE TABLE rooms(id TEXT PRIMARY KEY,revision INTEGER);CREATE TABLE preparations(room_id TEXT,game_mode TEXT);CREATE TABLE day_games(room_id TEXT,state TEXT);');db.prepare('INSERT INTO night_games VALUES (?,?)').run('r',JSON.stringify(s));db.exec("INSERT INTO rooms VALUES ('r',0);INSERT INTO preparations VALUES ('r','automatic');");let now=59999;const store=new NightStore(db,()=>({seat:12,is_host:1} as never),()=>now++);
 try{assert.doesNotThrow(()=>store.command('actor','r',{action:'dance_draft',targets:[],expectedRevision:0,turnId:s.turnId,requestId:randomUUID()}));const saved=JSON.parse((db.prepare('SELECT state FROM night_games').get() as {state:string}).state);assert.deepEqual(saved.masquerade.danceDraft,[]);assert.equal(saved.masquerade.danceRevision,1);assert.deepEqual(saved.engine.masquerade.penalties,[]);store.tick();const final=JSON.parse((db.prepare('SELECT state FROM night_games').get() as {state:string}).state);assert.deepEqual(final.engine.masquerade.penalties,[]);}finally{db.close();}
});
