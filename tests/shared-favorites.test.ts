import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type Database from 'better-sqlite3';
import {createServer} from '../apps/server/app.js';
import {sharingFixture} from './helpers/sharing-fixture.js';
import {RetentionStore} from '../packages/storage/retention.js';
async function fixture(dbPath=':memory:'){
 const app=await createServer({dbPath}),f=await sharingFixture(dbPath,app.store);f.publish();const link=app.store.shareRecord(f.token,f.recordId,{action:'create',revision:0});
 const guest=randomBytes(32).toString('hex');app.store.issueSession(guest);const reader=await app.store.auth.register(guest,'external_reader','synthetic-password','外部读者');
 await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');const base=`http://127.0.0.1:${address.port}`;
 const req=(path:string,body?:unknown,token=reader.token,origin?:string)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:token?`wolf_session=${token}`:'','content-type':'application/json',...(origin?{origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const save=async()=>{const r=await req(`/api/shared-records/${link.token}/favorite`,{});assert.equal(r.status,200);return (await r.json()).id as string;};
 return {app,f,link,reader,guest,req,save};
}
test('ordinary nonparticipant can collect an accessible share without gaining participant or historical access',async()=>{
 const {app,f,link,req,save}=await fixture();try{
  const id=await save();assert.ok(id);assert.equal(await save(),id);
  const library=await (await req('/api/favorite-library')).json();assert.equal(library.items.length,1);assert.equal(library.items[0].kind,'share');assert.equal(library.items[0].id,id);assert.equal(library.items[0].available,true);assert.equal(library.items[0].board.id,'standard-12');assert.equal(library.advanced,false);assert.equal(JSON.stringify(library).includes(link.token!),false);
  const body=await req('/api/shared-favorites/'+id);assert.equal(body.status,200);assert.equal((await body.json()).document.notes,'已发布复盘');
  for(const path of [`/api/records/${f.recordId}`,`/api/records/${f.recordId}?version=1`,`/api/rooms/${f.id}/records`,`/api/records/${f.recordId}/favorite`])assert.equal((await req(path,path.endsWith('favorite')?{}:undefined)).status,403);
  assert.equal((await req('/api/shared-favorites/'+id+'?version=1')).status,400);assert.equal((await req('/api/shared-favorites/'+id,undefined,f.admin)).status,404);assert.equal((await req('/api/shared-favorites/'+id+'/remove',{},f.admin)).status,200);assert.equal((await req('/api/shared-favorites/'+id)).status,200);
 }finally{await app.close();}
});
test('share favorites never read drafts and recheck expiry, withdrawal, account disable and revocation',async()=>{
 const {app,f,reader,req,save}=await fixture();try{
  const id=await save();app.store.auth.setVip(f.admin,reader.account.id,true,null);app.store.saveRecord(f.token,f.id,1,{...f.document,notes:'Unpublished private secret'});
  assert.equal((await (await req('/api/favorite-library?q=Unpublished')).json()).items.length,0);
  for(const [disable,restore] of [
   [async()=>{app.store.auth.setVip(f.admin,f.account.id,true,Date.now()+25);await new Promise(r=>setTimeout(r,35));},()=>app.store.auth.setVip(f.admin,f.account.id,true,null)],
   [()=>app.store.withdrawRecord(f.token,f.id,2),()=>app.store.publishRecord(f.token,f.id,2)],
   [()=>app.store.auth.setStatus(f.admin,f.account.id,'disabled'),()=>app.store.auth.setStatus(f.admin,f.account.id,'active')]
  ]){
   await disable();assert.equal((await req('/api/shared-favorites/'+id)).status,404);const list=await (await req('/api/favorite-library')).json();assert.equal(list.items[0].available,false);assert.equal(JSON.stringify(list).includes('Unpublished private secret'),false);assert.equal((await (await req('/api/favorite-library?q='+encodeURIComponent('已发布复盘'))).json()).items.length,0);
   restore();assert.equal((await req('/api/shared-favorites/'+id)).status,200);
  }
  // Disabling author sessions requires a new author login, not a permission bypass.
  const authorGuest=randomBytes(32).toString('hex');app.store.issueSession(authorGuest);const author=await app.store.auth.login(authorGuest,'share_author','correct-password');const current=app.store.shareStatus(author.token,f.recordId);app.store.shareRecord(author.token,f.recordId,{action:'revoke',revision:current.revision});assert.equal((await req('/api/shared-favorites/'+id)).status,404);
  assert.equal((await req('/api/shared-favorites/'+id+'/remove',{})).status,200);assert.equal((await (await req('/api/favorite-library')).json()).items.length,0);
 }finally{await app.close();}
});
test('regeneration leaves old collection unavailable and a new link creates a separate unnamed collection',async()=>{
 const {app,f,reader,link,req,save}=await fixture();try{
  app.store.auth.setVip(f.admin,reader.account.id,true,null);const id=await save();assert.equal((await req(`/api/favorite-library/share/${id}/name`,{name:'Old name',revision:0})).status,200);
  const next=app.store.shareRecord(f.token,f.recordId,{action:'regenerate',revision:link.revision});assert.equal((await req('/api/shared-favorites/'+id)).status,404);assert.equal((await req(`/api/shared-records/${link.token}/favorite`,{})).status,404);
  const response=await req(`/api/shared-records/${next.token}/favorite`,{});assert.equal(response.status,200);const fresh=(await response.json()).id;assert.notEqual(fresh,id);
  const list=await (await req('/api/favorite-library')).json();assert.equal(list.items.length,2);assert.equal(list.items.find((x:{id:string})=>x.id===id).title,'Old name');assert.equal(list.items.find((x:{id:string})=>x.id===fresh).customName,null);assert.equal(JSON.stringify(list).includes(next.token!),false);assert.equal((await req('/api/shared-favorites/'+fresh)).status,200);
  // Participant authorization remains independent of a collected old link.
  app.store.saveRecordFavorite(f.token,f.recordId);assert.equal(app.store.recordPost(f.token,f.recordId).version,1);
 }finally{await app.close();}
});
test('anonymous reading and collection status set no cookie; collection writes require a valid logged-in owner',async()=>{
 const {app,link,reader,req,save}=await fixture();try{
  const path=`/api/shared-records/${link.token}/favorite`,status=await req(path,undefined,'');assert.equal(status.status,200);assert.equal(status.headers.get('set-cookie'),null);assert.deepEqual(await status.json(),{account:null,saved:false,id:null});
  assert.equal((await req(path,{},'')).status,401);const guest=randomBytes(32).toString('hex');app.store.issueSession(guest);assert.equal((await req(path,{},guest)).status,403);
  for(const suffix of ['?version=1','?owner=forged'])assert.equal((await req(path+suffix,{})).status,400);
  assert.equal((await req(path,{},reader.token,'https://other.example')).status,403);assert.equal((await req(path,{recordId:'forged'})).status,400);const id=await save();assert.equal((await req('/api/shared-favorites/'+id+'/remove',{},guest)).status,403);
  const fresh=randomBytes(32).toString('hex');app.store.issueSession(fresh);const takeover=await app.store.auth.login(fresh,'external_reader','synthetic-password');assert.equal((await req('/api/shared-favorites/'+id,undefined,reader.token)).status,401);assert.equal((await req('/api/shared-favorites/'+id,undefined,takeover.token)).status,200);assert.equal((await (await req('/api/favorite-library',undefined,takeover.token)).json()).items[0].id,id);
 }finally{await app.close();}
});
test('external collection survives restart and protects runtime room even after revocation until cancelled',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-shared-favorite-')),path=join(dir,'synthetic.sqlite');const {app,f,reader,link,save}=await fixture(path);let restarted:Awaited<ReturnType<typeof createServer>>|undefined;try{
  const id=await save();app.store.shareRecord(f.token,f.recordId,{action:'revoke',revision:link.revision});const db=(app.store as unknown as {db:Database.Database}).db;db.prepare('UPDATE rooms SET last_activity_at=0 WHERE id=?').run(f.id);const retention=new RetentionStore(db,()=>86400001);assert.deepEqual(retention.expiredcleanup(),[]);
  await app.close();restarted=await createServer({dbPath:path});assert.equal(restarted.store.favoriteLibrary(reader.token).items[0].id,id);const response=restarted.store.favoriteLibrary(reader.token).items[0];assert.equal(response.available,false);
  const db2=(restarted.store as unknown as {db:Database.Database}).db;assert.equal(restarted.store.favoriteLibrary(reader.token).items[0].board?.id,'standard-12');
  restarted.store.removeSharedFavorite(reader.token,id);assert.equal(restarted.store.favoriteLibrary(reader.token).items.length,0);const afterCancel=new RetentionStore(db2,()=>Date.now()+86400001);assert.deepEqual(afterCancel.expiredcleanup(),[f.id]);assert.equal(restarted.store.recordPost(f.token,f.recordId).roles.length,12);
 }finally{if(restarted)await restarted.close();else await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('new favorite kind migration preserves existing private names and revision tombstones',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-favorite-name-migration-')),path=join(dir,'synthetic.sqlite');const {app,f,reader,save}=await fixture(path);let restarted:Awaited<ReturnType<typeof createServer>>|undefined;try{
  const id=await save();app.store.saveRecordFavorite(f.token,f.recordId);app.store.renameFavorite(f.token,'record',f.recordId,{name:'Existing private name',revision:0});const db=(app.store as unknown as {db:Database.Database}).db;
  db.exec("ALTER TABLE favorite_names RENAME TO newer_names; CREATE TABLE favorite_names(owner TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('game','record')),target_id TEXT NOT NULL,name TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(owner,kind,target_id)); INSERT INTO favorite_names SELECT * FROM newer_names WHERE kind!='share'; DROP TABLE newer_names;");
  db.prepare('INSERT INTO favorite_names VALUES (?,\'game\',\'old-removed\',\'\',7)').run('account:'+f.account.id);await app.close();restarted=await createServer({dbPath:path});
  assert.equal(restarted.store.favoriteLibrary(f.token).items[0].title,'Existing private name');assert.equal(restarted.store.favoriteLibrary(f.token).items[0].nameRevision,1);const db2=(restarted.store as unknown as {db:Database.Database}).db;assert.equal((db2.prepare('SELECT revision FROM favorite_names WHERE target_id=?').get('old-removed') as {revision:number}).revision,7);
  restarted.store.auth.setVip(f.admin,reader.account.id,true,null);restarted.store.renameFavorite(reader.token,'share',id,{name:'New share name',revision:0});assert.equal(restarted.store.favoriteLibrary(reader.token).items[0].title,'New share name');
 }finally{if(restarted)await restarted.close();else await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('original share authorization and public archive projection survive runtime deletion and restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-share-favorite-archive-')),path=join(dir,'synthetic.sqlite');const {app,f,reader,link,save}=await fixture(path);let restarted:Awaited<ReturnType<typeof createServer>>|undefined;try{
  const id=await save();const db=(app.store as unknown as {db:Database.Database}).db;db.prepare('DELETE FROM rooms WHERE id=?').run(f.id);await app.close();restarted=await createServer({dbPath:path});
  const post=restarted.store.sharedFavorite(reader.token,id);assert.equal(post.document.notes,'已发布复盘');assert.equal(post.roles.length,12);assert.equal('versions' in post,false);assert.equal('shareAccess' in post,false);assert.equal(restarted.store.favoriteLibrary(reader.token).items[0].board?.id,'standard-12');restarted.store.shareRecord(f.token,f.recordId,{action:'revoke',revision:link.revision});assert.throws(()=>restarted!.store.sharedFavorite(reader.token,id),/SHARE_UNAVAILABLE/);
 }finally{if(restarted)await restarted.close();else await app.close();rmSync(dir,{recursive:true,force:true});}
});
