import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import * as navigation from '../apps/web/src/useRoom.js';
const current={room:{id:'current',revision:5},me:{id:'same-player',nickname:'Current'}};
const other={room:{id:'other',revision:2},me:{id:'same-player',nickname:'Other'}};

test('expired current room leaves home notice while preserving other room memberships',()=>{
 const result=navigation.expireRoomNavigation({view:current,previous:[current,other],rememberedRoom:'current'},'current');
 assert.equal(result.view,undefined);assert.deepEqual(result.previous,[other]);assert.equal(result.rememberedRoom,null);assert.equal(result.wasCurrent,true);
});

test('old expiration never clears a newly entered room or its remembered room id',()=>{
 const result=navigation.expireRoomNavigation({view:other,previous:[current,other],rememberedRoom:'other'},'current');
 assert.equal(result.view,other);assert.deepEqual(result.previous,[other]);assert.equal(result.rememberedRoom,'other');assert.equal(result.wasCurrent,false);
 const onHome=navigation.expireRoomNavigation({view:undefined,previous:[current,other],rememberedRoom:'current'},'current');assert.equal(onHome.view,undefined);assert.equal(onHome.rememberedRoom,null);assert.equal(onHome.wasCurrent,false);
});

test('expired-room wire listener validates room and code, uses safe notice and detaches cleanly',()=>{
 const socket=new EventEmitter();let state={view:current as typeof current|undefined,previous:[current,other],rememberedRoom:'current' as string|null};let message='';
 const dispose=navigation.listenRoomExpiration(socket,'current',event=>{const result=navigation.expireRoomNavigation(state,event.roomId);state=result;message=event.message;});
 socket.emit('room:expired',{roomId:'other',error:'ROOM_NOT_FOUND',message:'wrong room'});assert.equal(state.view,current);
 socket.emit('room:expired',{roomId:'current',error:'FORBIDDEN',message:'wrong error'});assert.equal(state.view,current);
 socket.emit('room:expired',null);assert.equal(state.view,current);
 socket.emit('room:expired',{roomId:'current',error:'ROOM_NOT_FOUND',message:'untrusted private content'});assert.equal(state.view,undefined);assert.deepEqual(state.previous,[other]);assert.equal(message,'房间已清理，请返回首页');
 state={view:current,previous:[current,other],rememberedRoom:'current'};dispose();socket.emit('room:expired',{roomId:'current',error:'ROOM_NOT_FOUND'});assert.equal(state.view,current);
});

test('late roomAction result cannot resurrect expired UI or replace a newly entered room',()=>{
 assert.equal(navigation.acceptRoomActionView(undefined,current),undefined);assert.equal(navigation.acceptRoomActionView(other,current),other);
 const newest={...current,room:{...current.room,revision:6},me:{...current.me,nickname:'Fresh'}};assert.equal(navigation.acceptRoomActionView(current,newest),newest);
 const old={...current,room:{...current.room,revision:4},me:{...current.me,nickname:'Updated player'}};const merged=navigation.acceptRoomActionView(current,old);assert.equal(merged?.room,current.room);assert.equal(merged?.me,old.me);
});
