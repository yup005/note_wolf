import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
const token=()=>randomBytes(32).toString('hex');
test('new login revokes old HTTP secrets, commands and connected socket while preserving the exact game and player',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true,now:()=>1000});const sockets:Socket[]=[];
 try{const first=token(),second=token();app.store.issueSession(first);app.store.issueSession(second);const registered=await app.store.auth.register(first,'takeover_user','correct-password','房主');const old=registered.token;const room=app.store.create(old,'房主').room;const id=room.id;app.store.select(old,id,1);app.store.fillTestPlayers(old,id);app.store.setReady(old,id,true,0);app.store.deal(old,id);app.store.confirmIdentity(old,id);app.store.start(old,id);app.store.enterNight(old,id);
 await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const addr=app.http.address();if(!addr||typeof addr==='string')throw Error('addr');const base=`http://127.0.0.1:${addr.port}`;
 const req=(t:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:`wolf_session=${t}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const socket=io(base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${old}`},reconnection:false});sockets.push(socket);await new Promise<void>((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});await new Promise<void>(r=>socket.emit('room:subscribe',{roomId:id},()=>r()));
 assert.equal((await req(second,'/api/auth/login',{username:'takeover_user',password:'wrong-password'})).status,401);assert.equal(socket.connected,true);assert.equal((await req(old,`/api/rooms/${id}/identity`)).status,200);
 const before=app.store.view(old,id),identity=app.store.identity(old,id),privateRole=app.store.nightPrivate(old,id);const disconnected=new Promise<string>(r=>socket.once('disconnect',r));const login=await req(second,'/api/auth/login',{username:'takeover_user',password:'correct-password'});assert.equal(login.status,200);const next=login.headers.get('set-cookie')!.split(';')[0].split('=')[1];assert.equal(await disconnected,'io server disconnect');
 for(const path of ['', '/identity','/night/private','/day/private','/records'])assert.equal((await req(old,`/api/rooms/${id}${path}`)).status,401);
 for(const path of ['/night/command','/day/command','/manual/commit'])assert.equal((await req(old,`/api/rooms/${id}${path}`,path==='/manual/commit'?{revision:0}:{action:'vote',target:8,turnId:before.room.night!.turnId})).status,401);
 assert.equal(app.store.view(next,id).me.id,before.me.id);assert.deepEqual(app.store.identity(next,id),identity);assert.deepEqual(app.store.nightPrivate(next,id),privateRole);assert.equal(app.store.snapshot(id).night!.deadline,before.room.night!.deadline);assert.equal(app.store.snapshot(id).seats.filter(s=>s.memberId===before.me.id).length,1);
 const stale=io(base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${old}`},reconnection:false});sockets.push(stale);assert.equal(await new Promise<string>(r=>stale.once('connect_error',e=>r(e.message))),'UNAUTHORIZED');
 const a=token(),b=token();app.store.issueSession(a);app.store.issueSession(b);const takeovers=await Promise.all([app.store.auth.login(a,'takeover_user','correct-password'),app.store.auth.login(b,'takeover_user','correct-password')]);const valid=takeovers.filter(s=>app.store.hasSession(s.token));assert.equal(valid.length,1);assert.equal(app.store.hasSession(next),false);assert.equal(app.store.view(valid[0].token,id).me.id,before.me.id);
 }finally{for(const s of sockets)s.disconnect();await app.close();}
});
