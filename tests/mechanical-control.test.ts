import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {ControlStore} from '../packages/storage/control.js';
import {createDay,dayCommand,privateDay} from '../packages/domain/day.js';
import {createNight} from '../packages/domain/night.js';
import {firstDayRules} from '../packages/contracts/day.js';
test('pause and re-pause preserve interjection budget and the original speaker clock',()=>{
 let now=1000;const db=new Database(':memory:');
 try{
  db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY,revision INTEGER);CREATE TABLE members(id TEXT PRIMARY KEY,room_id TEXT,seat INTEGER);CREATE TABLE preparations(room_id TEXT,game_mode TEXT);CREATE TABLE day_games(room_id TEXT,state TEXT);CREATE TABLE night_games(room_id TEXT,state TEXT);');
  db.exec("INSERT INTO rooms VALUES ('r',1);INSERT INTO members VALUES ('host','r',1);INSERT INTO preparations VALUES ('r','automatic');");
  const n=createNight([{seat:1,role:'wolf'},{seat:2,role:'villager'},{seat:3,role:'idiot'},{seat:4,role:'seer'}],now);n.phase='first_night_complete';
  const day=createDay(n,firstDayRules,now);day.phase='day_speech';day.speaker=2;day.speakers=[4];day.deadline=91000;day.turnId=randomUUID();day.flippedIdiots=[3];day.players[2].alive=false;
  dayCommand(day,{seat:3,isHost:false},{action:'interject',turnId:day.turnId},now);
  db.prepare('INSERT INTO day_games VALUES (?,?)').run('r',JSON.stringify(day));
  const control=new ControlStore(db,()=>now);const host={id:'host',room_id:'r',nickname:'Synthetic',is_host:1,seat:1,ready:0};
  const cmd=(action:'pause'|'resume')=>control.command('r',host,{action,confirmed:true,version:control.snapshot('r').version});
  now=4000;cmd('pause');now=104000;cmd('resume');now+=1000;cmd('pause');now+=100000;cmd('resume');now=control.snapshot('r').resumeAt!;control.tick();
  const restored=JSON.parse((db.prepare('SELECT state FROM day_games').get() as {state:string}).state);
  now+=2000;dayCommand(restored,{seat:3,isHost:false},{action:'end_interjection',turnId:restored.turnId},now);
  assert.equal(privateDay(restored,3).interjectionRemainingMs,10000);assert.equal(restored.deadline,now+90000);
 }finally{db.close();}
});
