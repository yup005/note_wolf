import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import type Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../apps/server/app.js';
import {sharingFixture} from './helpers/sharing-fixture.js';

async function fixture(dbPath=':memory:'){
 const app=await createServer({dbPath});const f=await sharingFixture(dbPath,app.store);f.publish();app.store.saveRecordFavorite(f.token,f.recordId);
 await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();if(!a||typeof a==='string')throw Error('address');const base=`http://127.0.0.1:${a.port}`;
 const request=(path:string,body?:unknown,token=f.token)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:`wolf_session=${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 return {app,f,request};
}
test('VIP searches only published readable content, never private draft or withdrawn body',async()=>{
 const {app,f,request}=await fixture();try{
  const list=await request('/api/favorite-library');assert.equal(list.status,200);const library=await list.json();assert.equal(library.advanced,true);assert.equal(library.items.length,1);assert.equal(library.items[0].kind,'record');assert.equal(library.items[0].board.name,'12 人 · 预女猎白');
  app.store.saveRecord(f.token,f.id,1,{...f.document,notes:'Private secret draft'});
  assert.equal((await (await request('/api/favorite-library?q=Private')).json()).items.length,0);
  assert.equal((await (await request('/api/favorite-library?q='+encodeURIComponent('已发布复盘'))).json()).items.length,1);
  app.store.withdrawRecord(f.token,f.id,2);
  assert.equal((await (await request('/api/favorite-library?q='+encodeURIComponent('已发布复盘'))).json()).items.length,0);
  const hidden=await (await request('/api/favorite-library')).json();assert.equal(hidden.items[0].available,false);assert.equal(JSON.stringify(hidden).includes('Private secret'),false);
 }finally{await app.close();}
});
test('rename is private, persistent, version-checked and cannot alter the source post',async()=>{
 const {app,f,request}=await fixture();try{
  const path=`/api/favorite-library/record/${f.recordId}/name`;
  assert.equal((await request(path,{name:'  My review  ',revision:0})).status,200);
  const list=await (await request('/api/favorite-library?q=My')).json();assert.equal(list.items[0].title,'My review');assert.equal(list.items[0].nameRevision,1);
  assert.equal((await (await request('/api/favorite-library?q='+encodeURIComponent('官方'))).json()).items.length,1);
  assert.equal(app.store.recordPost(f.token,f.recordId).author,'分享房主');
  const guest=randomBytes(32).toString('hex');app.store.issueSession(guest);const user=await app.store.auth.register(guest,'other_collector','synthetic-password','Other');app.store.auth.setVip(f.admin,user.account.id,true,null);
  assert.equal((await request(path,{name:'Hijack',revision:1},user.token)).status,404);
  assert.equal((await request(path,{name:'Stale',revision:0})).status,409);
  assert.equal((await request(path,{name:'',revision:1})).status,200);
  assert.equal((await (await request('/api/favorite-library')).json()).items[0].customName,null);
 }finally{await app.close();}
});
test('expired VIP keeps basic collection and names but cannot query advanced filters or rename',async()=>{
 const {app,f,request}=await fixture();try{
  const path=`/api/favorite-library/record/${f.recordId}/name`;assert.equal((await request(path,{name:'Saved name',revision:0})).status,200);
  app.store.auth.setVip(f.admin,f.account.id,false,null);
  const basic=await (await request('/api/favorite-library')).json();assert.equal(basic.advanced,false);assert.equal(basic.items[0].title,'Saved name');
  for(const suffix of ['?q=Saved','?board=standard-12','?sort=saved-asc','?author=Other','?from=1'])assert.equal((await request('/api/favorite-library'+suffix)).status,403);
  assert.equal((await request(path,{name:'Changed',revision:1})).status,403);
 }finally{await app.close();}
});
test('combined metadata filters and stable sort include both existing favorite types and reject forged inputs',async()=>{
 const {app,f,request}=await fixture();try{
  const db=(app.store as unknown as {db:Database.Database}).db;
  db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run('account:'+f.account.id,'archived-game','9999','good',5,JSON.stringify({winner:'good',roles:[],rounds:[],author:'Whole-game host',board:{id:'mechanical-12',name:'机械狼'}}));
  db.prepare('UPDATE record_favorites SET saved_at=10 WHERE owner=?').run('account:'+f.account.id);
  const all=await (await request('/api/favorite-library')).json();assert.deepEqual(all.items.map((x:{kind:string})=>x.kind),['record','game']);
  const combined=await (await request('/api/favorite-library?board=mechanical-12&from=5&to=5&sort=saved-asc')).json();assert.deepEqual(combined.items.map((x:{code:string})=>x.code),['9999']);
  assert.equal((await (await request('/api/favorite-library?author='+encodeURIComponent('分享房主'))).json()).items.length,1);
  assert.equal((await (await request('/api/favorite-library?author='+encodeURIComponent('Whole-game host'))).json()).items.length,1);
  for(const suffix of ['?owner=forged','?from=no','?from=20&to=10','?sort=unknown'])assert.equal((await request('/api/favorite-library'+suffix)).status,400);
  assert.equal((await request(`/api/favorite-library/game/archived-game/name`,{name:'Custom game',revision:0,owner:'forged'})).status,400);
 }finally{await app.close();}
});
test('names and captured board metadata survive runtime room deletion and database restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-favorite-library-')),path=join(dir,'synthetic.sqlite');const {app,f,request}=await fixture(path);let restarted:Awaited<ReturnType<typeof createServer>>|undefined;
 try{
  assert.equal((await request(`/api/favorite-library/record/${f.recordId}/name`,{name:'Persistent label',revision:0})).status,200);
  const db=(app.store as unknown as {db:Database.Database}).db;db.prepare('DELETE FROM rooms WHERE id=?').run(f.id);
  await app.close();restarted=await createServer({dbPath:path});const result=restarted.store.favoriteLibrary(f.token);
  assert.equal(result.items[0].title,'Persistent label');assert.equal(result.items[0].board?.id,'standard-12');assert.equal(result.items[0].available,true);
  assert.equal(restarted.store.recordPost(f.token,f.recordId).document.notes,'已发布复盘');
 }finally{if(restarted)await restarted.close();else await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('two VIP participants can name one post independently and removal rejects stale editors after re-add',async()=>{
 const {app,f,request}=await fixture();try{
  const peer=await app.store.auth.register(f.players[1],'peer_collector','synthetic-password','Peer');app.store.auth.setVip(f.admin,peer.account.id,true,null);app.store.saveRecordFavorite(peer.token,f.recordId);
  const path=`/api/favorite-library/record/${f.recordId}/name`;
  assert.equal((await request(path,{name:'Host label',revision:0})).status,200);assert.equal((await request(path,{name:'Peer label',revision:0},peer.token)).status,200);
  assert.equal((await (await request('/api/favorite-library',undefined,peer.token)).json()).items[0].title,'Peer label');assert.equal((await (await request('/api/favorite-library')).json()).items[0].title,'Host label');
  app.store.removeRecordFavorite(f.token,f.recordId);app.store.saveRecordFavorite(f.token,f.recordId);
  assert.equal((await request(path,{name:'Stale label',revision:1})).status,409);assert.equal((await (await request('/api/favorite-library')).json()).items[0].customName,null);
 }finally{await app.close();}
});
test('legacy snapshots without board metadata stay marked unknown and same-time sort is deterministic',async()=>{
 const {app,f,request}=await fixture();try{
  const db=(app.store as unknown as {db:Database.Database}).db;app.store.removeRecordFavorite(f.token,f.recordId);
  for(const id of ['z-game','a-game'])db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run('account:'+f.account.id,id,'0001','good',5,JSON.stringify({winner:'good',roles:[],rounds:[]}));
  const result=await (await request('/api/favorite-library?board=unknown')).json();assert.deepEqual(result.items.map((x:{id:string})=>x.id),['a-game','z-game']);assert.ok(result.items.every((x:{board:unknown})=>x.board===null));
  assert.deepEqual((await (await request('/api/favorite-library?sort=saved-asc')).json()).items.map((x:{id:string})=>x.id),['a-game','z-game']);
 }finally{await app.close();}
});
test('removing never-renamed favorites invalidates revision zero for both favorite kinds',async()=>{
 const {app,f,request}=await fixture();try{
  const db=(app.store as unknown as {db:Database.Database}).db;
  for(const kind of ['record','game'] as const){
   const id=kind==='record'?f.recordId:'unnamed-game';const insertGame=()=>db.prepare('INSERT INTO saved_replays VALUES (?,?,?,?,?,?)').run('account:'+f.account.id,id,'9999','good',5,JSON.stringify({winner:'good',roles:[],rounds:[]}));
   if(kind==='game')insertGame();
   assert.equal((await request(`/api/${kind==='game'?'favorites':'record-favorites'}/${id}/remove`,{})).status,200);
   if(kind==='game')insertGame();else app.store.saveRecordFavorite(f.token,id);
   assert.equal((await request(`/api/favorite-library/${kind}/${id}/name`,{name:'Stale overwrite',revision:0})).status,409);
  }
 }finally{await app.close();}
});
