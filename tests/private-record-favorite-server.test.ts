import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../apps/server/app.js';
import {sharingFixture} from './helpers/sharing-fixture.js';

test('unpublished favorite HTTP is strict, own-only, no-store, and cannot open a public post or share',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});
 try{
  const f=await sharingFixture(':memory:',app.store);const s=app.store;s.auth.setVip(f.admin,f.account.id,false,null);s.saveRecord(f.token,f.id,0,f.document);s.commitManual(f.token,f.id,1);
  await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
  const base=`http://127.0.0.1:${address.port}`,privatePath=`/api/record-favorites/${f.recordId}/private`;
  const req=(token:string,path:string,body?:unknown)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:token?`wolf_session=${token}`:'',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await req('',privatePath)).status,401);assert.equal((await req(f.token,privatePath)).status,404);
  assert.equal((await req(f.token,`/api/records/${f.recordId}/favorite`,{})).status,200);
  const read=await req(f.token,privatePath);assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');const body=await read.json();assert.equal(body.document.notes,f.document.notes);assert.deepEqual(Object.keys(body).sort(),['author','code','document','id','revision']);
  for(const token of [f.admin,f.players[1]])assert.equal((await req(token,privatePath)).status,404);
  assert.equal((await req(f.token,privatePath+'?owner=fake')).status,400);assert.equal((await req(f.token,`/api/records/${f.recordId}`)).status,404);assert.equal((await req(f.admin,`/api/admin/records/${f.recordId}`)).status,404);
  assert.equal((await req(f.token,`/api/records/${f.recordId}/share`,{action:'create',revision:0})).status,403);assert.equal(JSON.stringify(await (await req(f.players[1],`/api/rooms/${f.id}`)).json()).includes(f.document.notes),false);
  assert.equal((await req(f.token,`/api/record-favorites/${f.recordId}/remove`,{})).status,200);assert.equal((await req(f.token,privatePath)).status,404);
 }finally{await app.close();}
});
