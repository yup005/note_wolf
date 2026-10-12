import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as authContracts from '../packages/contracts/auth.js';
import {LobbyStore} from '../packages/storage/lobby.js';
import {createServer} from '../apps/server/app.js';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import {io,type Socket} from 'socket.io-client';
import {request as httpRequest,type ClientRequest} from 'node:http';
const password='synthetic-profile-password';
const token=()=>randomBytes(32).toString('hex');
const mb=1024*1024;
async function picture(format:'png'|'jpeg'|'webp'='png'){
 return sharp({create:{width:300,height:170,channels:3,background:'#ff3300'}}).toFormat(format).toBuffer();
}
function padded(image:Buffer,size:number){assert.ok(size>=image.length);return Buffer.concat([image,Buffer.alloc(size-image.length)]);}
async function running(dbPath=':memory:'){
 const app=await createServer({dbPath,allowTestPlayers:true,now:()=>1000});
 await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
 const base=`http://127.0.0.1:${address.port}`;
 const request=(cookie:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const upload=(cookie:string,body:Buffer,contentType='image/png',suffix='')=>fetch(base+'/api/auth/avatar'+suffix,{method:'POST',headers:{cookie,'content-type':contentType},body:new Uint8Array(body)});
 const guest=async()=>{const response=await fetch(base+'/api/session');return response.headers.get('set-cookie')!.split(';')[0];};
 const register=async(username:string)=>{const response=await request(await guest(),'/api/auth/register',{username,password,nickname:'Initial'});assert.equal(response.status,200);return {cookie:response.headers.get('set-cookie')!.split(';')[0],account:(await response.json()).account};};
 return {app,base,request,upload,guest,register};
}

test('profile nickname command trims display name and rejects ownership or unrelated fields',()=>{
 const schema=authContracts.profileSchema;
 assert.deepEqual(schema.parse({nickname:'  Updated  '}),{nickname:'Updated'});
 for(const value of [{nickname:''},{nickname:' '.repeat(4)},{nickname:'x'.repeat(25)},{nickname:'Name',accountId:'someone'},{nickname:'Name',avatarUrl:'https://example.test/x'}])assert.equal(schema.safeParse(value).success,false);
});

test('nickname updates every owned membership without changing seats, readiness or private game state',async()=>{
 const store=new LobbyStore(':memory:',undefined,true,()=>1000);try{
  const guest=token();store.issueSession(guest);const session=await store.auth.register(guest,'profile_store',password,'Initial');
  const first=store.create(session.token,'Old room name').room;store.select(session.token,first.id,1);const players=fillRealPlayers(store,session.token,first.id);store.setReady(session.token,first.id,true,0);store.deal(session.token,first.id);confirmRealPlayers(store,first.id,players);store.confirmIdentity(session.token,first.id);store.start(session.token,first.id);store.enterNight(session.token,first.id);
  const before=store.view(session.token,first.id),identity=store.identity(session.token,first.id),secret=store.nightPrivate(session.token,first.id);
  const ids=[first.id];for(let i=0;i<21;i++)ids.push(store.create(session.token,'Other room').room.id);
  const other=token();store.issueSession(other);store.join(other,first.code,'Unrelated');
  const revisions=ids.map(id=>store.snapshot(id).revision);
  const changed=store.updateProfile(session.token,'  New nickname  ');
  assert.equal(changed.account.nickname,'New nickname');assert.equal(changed.rooms.length,22);
  ids.forEach((id,i)=>{const view=store.view(session.token,id);assert.equal(view.me.nickname,'New nickname');assert.equal(view.room.revision,revisions[i]+1);});
  const after=store.view(session.token,first.id);assert.equal(after.me.id,before.me.id);assert.equal(after.me.seat,1);assert.equal(after.room.seats[0].ready,true);
  assert.deepEqual(store.identity(session.token,first.id),identity);assert.deepEqual(store.nightPrivate(session.token,first.id),secret);assert.deepEqual(after.room.night,before.room.night);
  const avatar=await store.uploadAvatar(session.token,await picture(),'image/png');assert.ok(avatar.account.avatarUrl);
  assert.deepEqual(store.identity(session.token,first.id),identity);assert.deepEqual(store.nightPrivate(session.token,first.id),secret);assert.deepEqual(store.snapshot(first.id).night,before.room.night);
  assert.equal(store.view(other,first.id).me.nickname,'Unrelated');
 }finally{store.close();}
});

test('HTTP nickname update broadcasts only public profile and refuses guest, stale, disabled and forged ownership',async()=>{
 const server=await running();let socket:Socket|undefined;try{
  const owner=await server.register('profile_http'),guest=await server.guest();
  const view=await (await server.request(owner.cookie,'/api/rooms',{nickname:'Initial',requestId:randomUUID()})).json();const id=view.room.id;
  await server.request(owner.cookie,`/api/rooms/${id}/seat`,{seat:1});await server.request(guest,'/api/rooms/join',{code:view.room.code,nickname:'Guest'});
  socket=io(server.base,{transports:['websocket'],extraHeaders:{Cookie:guest},reconnection:false});
  await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:id},()=>resolve()));
  const snapshot=new Promise<any>(resolve=>socket!.once('room:snapshot',resolve));
  const response=await server.request(owner.cookie,'/api/auth/profile',{nickname:'Updated'});assert.equal(response.status,200);const changed=await response.json();
  assert.equal(changed.account.nickname,'Updated');assert.equal(changed.rooms[0].me.nickname,'Updated');const publicRoom=await snapshot;assert.equal(publicRoom.seats[0].nickname,'Updated');
  for(const field of ['password_hash','salt','originalRole','poison','skills'])assert.equal(JSON.stringify(changed).includes(`"${field}"`),false);
  assert.equal((await server.request(guest,'/api/auth/profile',{nickname:'Guest edit'})).status,403);
  assert.equal((await server.request(owner.cookie,'/api/auth/profile',{nickname:'Forged',accountId:owner.account.id})).status,400);
  assert.equal((await server.request(owner.cookie,'/api/auth/profile?accountId=other',{nickname:'Forged'})).status,400);
  assert.equal((await fetch(server.base+'/api/auth/profile',{method:'POST',headers:{cookie:owner.cookie,'content-type':'application/json',origin:'https://foreign.example'},body:JSON.stringify({nickname:'Wrong origin'})})).status,403);
  const stale=owner.cookie;const secondGuest=await server.guest();const login=await server.request(secondGuest,'/api/auth/login',{username:'profile_http',password});assert.equal(login.status,200);const fresh=login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await server.request(stale,'/api/auth/profile',{nickname:'Stale'})).status,401);
  assert.equal((await server.upload(stale,await picture())).status,401);
  assert.equal((await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:stale}})).status,401);
  const adminGuest=token();server.app.store.issueSession(adminGuest);await server.app.store.auth.createAccount('profile_admin',password,'Admin','admin');const admin=await server.app.store.auth.login(adminGuest,'profile_admin',password);server.app.store.auth.setStatus(admin.token,owner.account.id,'disabled');
  assert.equal((await server.request(fresh,'/api/auth/profile',{nickname:'Disabled'})).status,401);
  assert.equal((await server.upload(fresh,await picture())).status,401);
  assert.equal((await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:fresh}})).status,401);
 }finally{socket?.disconnect();await server.app.close();}
});

test('JPEG, PNG and WebP avatars normalize to metadata-free 256px JPEG without embedding bytes in public JSON',async()=>{
 const server=await running();try{
  const owner=await server.register('avatar_formats');const room=await (await server.request(owner.cookie,'/api/rooms',{nickname:'Initial',requestId:randomUUID()})).json();await server.request(owner.cookie,`/api/rooms/${room.room.id}/seat`,{seat:1});
  let previousUrl:string|undefined;
  for(const format of ['jpeg','png','webp'] as const){
   const input=await sharp(await picture(format)).withMetadata({exif:{IFD0:{Artist:'synthetic-private-metadata'}}}).toBuffer();
   const response=await server.upload(owner.cookie,input,'image/'+format);assert.equal(response.status,200);const changed=await response.json();const url=changed.account.avatarUrl as string;
   assert.match(url,/^\/api\/avatars\/[a-f0-9-]+\?v=[a-f0-9-]+$/);assert.notEqual(url,previousUrl);assert.equal(changed.rooms[0].room.seats[0].avatarUrl,url);
   const fetched=await fetch(server.base+url);assert.equal(fetched.status,200);assert.equal(fetched.headers.get('content-type'),'image/jpeg');assert.equal(fetched.headers.get('cache-control'),'no-store');
   const image=Buffer.from(await fetched.arrayBuffer()),metadata=await sharp(image).metadata();assert.equal(metadata.width,256);assert.equal(metadata.height,256);assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);assert.equal(image.includes(Buffer.from('synthetic-private-metadata')),false);
   for(const field of ['data','bytes','blob','avatarRevision','password_hash'])assert.equal(JSON.stringify(changed).includes(`"${field}"`),false);
   if(previousUrl)assert.equal((await fetch(server.base+previousUrl)).status,404);previousUrl=url;
  }
 }finally{await server.app.close();}
});

test('original upload quota includes exact ordinary and active VIP boundaries and rejects expired VIP',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-profile-quota-'));const path=join(dir,'db');const server=await running(path);try{
  const owner=await server.register('avatar_quota'),image=await picture();
  assert.equal((await server.upload(owner.cookie,padded(image,mb))).status,200);
  assert.equal((await server.upload(owner.cookie,padded(image,mb+1))).status,413);
  const adminGuest=token();server.app.store.issueSession(adminGuest);await server.app.store.auth.createAccount('quota_admin',password,'Admin','admin');const admin=await server.app.store.auth.login(adminGuest,'quota_admin',password);
  server.app.store.auth.setVip(admin.token,owner.account.id,true,null);assert.equal((await server.upload(owner.cookie,padded(image,2*mb))).status,200);assert.equal((await server.upload(owner.cookie,padded(image,2*mb+1))).status,413);
  server.app.store.auth.setVip(admin.token,owner.account.id,true,Date.now()+60_000);assert.equal((await server.upload(owner.cookie,padded(image,mb+1))).status,200);
  const db=new Database(path);db.prepare('UPDATE vip_entitlements SET expires_at=? WHERE account_id=?').run(Date.now()-1000,owner.account.id);db.close();
  assert.equal((await server.upload(owner.cookie,padded(image,mb+1))).status,413);
 }finally{await server.app.close();rmSync(dir,{recursive:true,force:true});}
});

test('avatar endpoint rejects non-images, MIME mismatch, empty data and oversized decoded pixels without replacing current avatar',async()=>{
 const server=await running();try{
  const owner=await server.register('avatar_invalid'),image=await picture();const initial=await server.upload(owner.cookie,image);assert.equal(initial.status,200);const url=(await initial.json()).account.avatarUrl;
  for(const [bytes,type] of [[Buffer.from('<svg><script>bad</script></svg>'),'image/svg+xml'],[Buffer.from('not an image'),'image/png'],[Buffer.alloc(0),'image/png'],[image,'image/jpeg'],[Buffer.from(JSON.stringify({accountId:'other'})),'application/json']] as const)assert.equal((await server.upload(owner.cookie,bytes,type)).status,415);
  const huge=await sharp({create:{width:5000,height:5000,channels:3,background:'#ff0000'}}).png().toBuffer();assert.ok(huge.length<mb);assert.equal((await server.upload(owner.cookie,huge)).status,415);
  assert.equal((await server.upload(owner.cookie,image,'image/png','?accountId=other')).status,400);
  assert.equal((await server.upload(await server.guest(),image)).status,403);
  assert.equal((await fetch(server.base+'/api/auth/avatar',{method:'POST',headers:{cookie:owner.cookie,'content-type':'image/png',origin:'https://foreign.example'},body:new Uint8Array(image)})).status,403);
  assert.equal((await server.request(owner.cookie,'/api/session')).status,200);assert.equal((await (await server.request(owner.cookie,'/api/session')).json()).account.avatarUrl,url);assert.equal((await fetch(server.base+url)).status,200);
 }finally{await server.app.close();}
});

test('avatar deletion broadcasts removal and makes old URLs unavailable with no-store even after database restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-profile-restart-'));const path=join(dir,'db');let server=await running(path);let socket:Socket|undefined;try{
  const owner=await server.register('avatar_restart');const guest=await server.guest();const room=await (await server.request(owner.cookie,'/api/rooms',{nickname:'Initial',requestId:randomUUID()})).json();await server.request(owner.cookie,`/api/rooms/${room.room.id}/seat`,{seat:1});await server.request(guest,'/api/rooms/join',{code:room.room.code,nickname:'Guest'});
  socket=io(server.base,{transports:['websocket'],extraHeaders:{Cookie:guest},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:room.room.id},()=>resolve()));
  const avatarBroadcast=new Promise<any>(resolve=>socket!.once('room:snapshot',resolve));const upload=await server.upload(owner.cookie,await picture());assert.equal(upload.status,200);const uploaded=await upload.json(),url=uploaded.account.avatarUrl;assert.equal((await avatarBroadcast).seats[0].avatarUrl,url);
  socket.disconnect();socket=undefined;await server.app.close();server=await running(path);
  assert.equal((await (await server.request(owner.cookie,'/api/session')).json()).account.avatarUrl,url);assert.equal((await fetch(server.base+url)).status,200);
  socket=io(server.base,{transports:['websocket'],extraHeaders:{Cookie:guest},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});await new Promise<void>(resolve=>socket!.emit('room:subscribe',{roomId:room.room.id},()=>resolve()));
  assert.equal((await fetch(server.base+'/api/auth/avatar?accountId=other',{method:'DELETE',headers:{cookie:owner.cookie}})).status,400);
  assert.equal((await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:guest}})).status,403);
  const deletionBroadcast=new Promise<any>(resolve=>socket!.once('room:snapshot',resolve));
  const deleted=await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:owner.cookie}});assert.equal(deleted.status,200);const removed=await deleted.json();assert.equal(removed.account.avatarUrl,null);assert.equal(removed.rooms[0].room.seats[0].avatarUrl,null);assert.equal((await deletionBroadcast).seats[0].avatarUrl,null);
  const old=await fetch(server.base+url,{headers:{'if-none-match':'previous'}});assert.equal(old.status,404);assert.equal(old.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:owner.cookie,'content-type':'application/json'},body:JSON.stringify({accountId:'other'})})).status,400);
  socket.disconnect();socket=undefined;
  await server.app.close();server=await running(path);assert.equal((await fetch(server.base+url)).status,404);
 }finally{socket?.disconnect();await server.app.close();rmSync(dir,{recursive:true,force:true});}
});

test('avatar deletion rejects a non-JSON mutation body instead of silently ignoring forged fields',async()=>{
 const server=await running();try{const owner=await server.register('delete_binary');
  const uploaded=await server.upload(owner.cookie,await picture());assert.equal(uploaded.status,200);const url=(await uploaded.json()).account.avatarUrl;
  const deletion=await fetch(server.base+'/api/auth/avatar',{method:'DELETE',headers:{cookie:owner.cookie,'content-type':'text/plain'},body:'accountId=other'});
  assert.equal(deletion.status,400);assert.equal((await fetch(server.base+url)).status,200);
 }finally{await server.app.close();}
});

test('revoking the uploading session during decode prevents writes and leaves avatar data absent',async()=>{
 const store=new LobbyStore(':memory:');try{const guest=token();store.issueSession(guest);const owner=await store.auth.register(guest,'decode_revoke',password,'Initial');
  const upload=store.uploadAvatar(owner.token,await picture(),'image/png');store.auth.logout(owner.token);
  await assert.rejects(upload,/UNAUTHORIZED/);assert.throws(()=>store.avatar(owner.account.id),/NOT_FOUND/);
 }finally{store.close();}
});

test('session takeover during an incomplete raw upload returns unauthorized without an uncaught exception',async()=>{
 const server=await running();let pending:ClientRequest|undefined;const original=server.app.store.auth.requireAccount.bind(server.app.store.auth);try{
  const owner=await server.register('raw_revoke'),image=await picture();let entered!:()=>void;const firstCheck=new Promise<void>(resolve=>{entered=resolve;});
  server.app.store.auth.requireAccount=value=>{const account=original(value);if(account.id===owner.account.id)entered();return account;};
  const response=new Promise<{status:number;body:string}>((resolve,reject)=>{
   pending=httpRequest(server.base+'/api/auth/avatar',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'image/png','Content-Length':image.length},signal:AbortSignal.timeout(3000)},res=>{
    const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode!,body:Buffer.concat(chunks).toString()}));
   });pending.on('error',reject);pending.write(image.subarray(0,8));
  });
  await firstCheck;const nextGuest=token();server.app.store.issueSession(nextGuest);const takeover=await server.app.store.auth.login(nextGuest,'raw_revoke',password);pending!.end(image.subarray(8));
  const result=await response;assert.equal(result.status,401);assert.equal(JSON.parse(result.body).error,'UNAUTHORIZED');assert.equal(server.app.store.auth.account(takeover.token)?.avatarUrl,null);
 }finally{pending?.destroy();server.app.store.auth.requireAccount=original;await server.app.close();}
});
