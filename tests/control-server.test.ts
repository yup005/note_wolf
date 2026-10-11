import {test} from 'node:test';
import assert from 'node:assert/strict';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
const tokens=Array.from({length:12},(_,i)=>(i+1).toString(16).padStart(64,'0'));
const roles=['seer','wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','hunter','idiot'] as const;
test('independent sockets synchronize control; repeated subscription and multi-tab disconnect do not create false offline players',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',now:()=>now});const sockets:Socket[]=[];
 try{const db=app.store;tokens.forEach(t=>db.issueSession(t));const room=db.create(tokens[0],'房主').room;const id=room.id;db.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});roles.forEach((r,i)=>{if(i)db.join(tokens[i],room.code,'玩家'+(i+1));db.select(tokens[i],id,i+1);db.setReady(tokens[i],id,true,1);});db.deal(tokens[0],id);roles.forEach((r,i)=>db.submitIdentity(tokens[i],id,r));db.start(tokens[0],id);db.enterNight(tokens[0],id);
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('addr');const base=`http://127.0.0.1:${address.port}`;
  const req=(seat:number,path:string,body?:unknown)=>fetch(`${base}/api/rooms/${id}${path}`,{method:body?'POST':'GET',headers:{cookie:`wolf_session=${tokens[seat-1]}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const socket=async(seat:number)=>{const s=io(base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${tokens[seat-1]}`},reconnection:false});sockets.push(s);await new Promise<void>((r,j)=>{s.once('connect',r);s.once('connect_error',j);});await new Promise<void>(r=>s.emit('room:subscribe',{roomId:id},()=>r()));return s;};
  const host=await socket(1),witch=await socket(10),witchTab=await socket(10);await new Promise<void>(r=>witchTab.emit('room:subscribe',{roomId:id},()=>r()));witch.disconnect();await new Promise(r=>setTimeout(r,30));assert.equal(db.snapshot(id).control!.reconnecting,false);
  const control=(seat:number,action:string,extra={})=>req(seat,'/control',{action,confirmed:true,version:db.snapshot(id).control!.version,...extra});
  assert.equal((await control(2,'pause')).status,403);assert.equal((await req(1,'/control',{action:'pause',version:0})).status,400);assert.equal((await req(1,'/control',{action:'pause',confirmed:true,version:0,actorId:'fake'})).status,400);
  const changed=new Promise<any>(r=>witchTab.once('room:snapshot',r));assert.equal((await control(1,'pause')).status,200);assert.equal((await changed).control.status,'paused');const turn=db.snapshot(id).night!.turnId;
  assert.equal((await req(2,'/night/command',{action:'vote',target:8,turnId:turn})).status,409);assert.equal((await req(1,'/day/enter',{})).status,409);assert.deepEqual(await (await req(2,'/night/private')).json(),{turnId:turn,kind:'waiting'});
  assert.equal((await control(1,'delegate',{seat:6})).status,200);assert.equal((await control(6,'resume')).status,200);now+=4999;await req(1,'');assert.equal(db.snapshot(id).control!.status,'resuming');now++;await req(1,'');assert.equal(db.snapshot(id).control!.status,'running');assert.equal((await req(6,'/night/command',{action:'vote',target:8,turnId:turn})).status,403);
  const offline=new Promise<any>(r=>host.once('room:snapshot',r));witchTab.disconnect();assert.equal((await offline).control.reconnecting,true);assert.equal(db.snapshot(id).control!.status,'running');
  const wolfDeadline=db.snapshot(id).night!.deadline!;now=wolfDeadline+5000;await req(1,'');const deadline=db.snapshot(id).night!.deadline!;now=deadline;await req(1,'');assert.equal(db.snapshot(id).night!.phase,'witch');assert.equal(db.snapshot(id).night!.deadline,deadline+15000);
  const publicView=await (await req(7,'')).json();assert.equal(publicView.room.control.reconnecting,true);assert.equal('memberId' in publicView.room.control,false);assert.equal('graceUsed' in publicView.room.control,false);
  now+=500000;assert.equal((await req(1,'/day/enter',{})).status,200);const day=(seat:number,action:string,extra={})=>req(seat,'/day/command',{action,turnId:db.snapshot(id).day!.turnId,...extra});
  await day(2,'signup',{join:true});await day(3,'signup',{join:true});await day(1,'close_signup');while(db.snapshot(id).day!.phase==='sheriff_speech')await day(1,'end_speech');await day(1,'close_withdraw');await day(1,'start_vote',{method:'phone',visibility:'individual',seconds:30});assert.equal((await day(4,'vote',{target:2})).status,200);const voteTurn=db.snapshot(id).day!.turnId;assert.equal((await control(6,'pause')).status,200);assert.equal((await day(5,'vote',{target:3})).status,409);assert.equal((await day(6,'close_vote')).status,409);const pausedPrivate=await (await req(4,'/day/private')).json();assert.equal(pausedPrivate.canVote,false);assert.equal(pausedPrivate.myVote,null);now+=100000;await req(1,'');assert.equal(db.snapshot(id).day!.turnId,voteTurn);assert.equal(db.snapshot(id).day!.vote!.submittedCount,1);await control(1,'resume');now+=5000;await req(1,'');assert.equal((await (await req(4,'/day/private')).json()).myVote,2);


 }finally{for(const s of sockets)s.disconnect();await app.close();}
});
