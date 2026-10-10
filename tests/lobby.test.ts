import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LobbyStore } from '../packages/storage/lobby.js';

test('ROOM-01: leading zero room codes are retained',()=>{
 const db=new LobbyStore(':memory:',()=>42);
 const result=db.create('host','房主');
 assert.equal(result.room.code,'0042');
 assert.equal(db.join('guest','0042','玩家').room.id,result.room.id);
 db.close();
});
test('ROOM-02: collisions search for free code; full code space returns explicit error',()=>{
 let start=42; const db=new LobbyStore(':memory:',()=>start);
 assert.equal(db.create('a','A').room.code,'0042');
 assert.equal(db.create('b','B').room.code,'0043');
 for(let i=0;i<9998;i++){start=44+i;db.create('bulk'+i,'B');}
 assert.throws(()=>db.create('overflow','C'),/ROOM_CODES_FULL/);
 db.close();
});
test('ROOM-03/04: only members read rooms; joining never grants host rights',()=>{
 const db=new LobbyStore(':memory:');
 const created=db.create('host','H');
 assert.throws(()=>db.view('stranger',created.room.id),/NOT_MEMBER/);
 const guest=db.join('guest',created.room.code,'G');
 assert.equal(guest.me.isHost,false);
 assert.equal(created.me.isHost,true);
 assert.equal(guest.me.seat,null);
 assert.equal(JSON.stringify(guest.room).includes('host'),false);
 assert.equal(JSON.stringify(guest.room).includes('guest'),false);
 db.close();
});
test('first seating is unique, idempotent and does not silently change a seat',()=>{
 const db=new LobbyStore(':memory:');
 const {room}=db.create('host','H');
 const guest=db.join('guest',room.code,'G');
 assert.equal(db.join('guest',room.code,'G').me.id,guest.me.id);
 const seated=db.select('host',room.id,3);
 assert.equal(seated.me.seat,3);
 assert.equal(db.select('host',room.id,3).room.revision,seated.room.revision);
 assert.throws(()=>db.select('guest',room.id,3),/SEAT_TAKEN/);
 assert.throws(()=>db.select('host',room.id,4),/RULE_UNRESOLVED/);
 assert.equal(db.view('guest',room.id).room.seats[2].nickname,'H');
 assert.throws(()=>db.select('intruder',room.id,4),/NOT_MEMBER/);
 for(const seat of [0,13,1.5,NaN])assert.throws(()=>db.select('guest',room.id,seat),/INVALID_SEAT/);
 db.close();
});
test('12 seats fill without overwriting, membership survives restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-test-')); const path=join(dir,'lobby.db');
 let db=new LobbyStore(path); const {room}=db.create('host','H');
 for(let i=1;i<=12;i++){db.join('g'+i,room.code,'玩家'+i);db.select('g'+i,room.id,i);}
 assert.equal(db.view('host',room.id).room.seats.filter(s=>s.memberId).length,12);
 db.close(); db=new LobbyStore(path);
 assert.equal(db.view('g12',room.id).me.seat,12);
 assert.equal(db.view('host',room.id).me.isHost,true);
 db.close();rmSync(dir,{recursive:true});
});
test('invalid names/codes and missing rooms produce defined errors',()=>{
 const db=new LobbyStore(':memory:');
 assert.throws(()=>db.create('x','   '),/INVALID_NAME/);
 assert.throws(()=>db.join('x','42','X'),/INVALID_CODE/);
 assert.throws(()=>db.join('x','9999','X'),/ROOM_NOT_FOUND/);
 db.close();
});
