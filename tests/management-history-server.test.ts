import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createServer} from '../apps/server/app.js';
import {managementFixture} from './helpers/management-fixture.js';

test('HTTP management history has room/current-manager isolation, strict query and no write or broadcast projection',async()=>{
 const app=await createServer({dbPath:':memory:'});try{const f=managementFixture(app.store);await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`,path=`/api/rooms/${f.id}/management-history`;
 const req=(token:string,url=path,body?:unknown)=>fetch(base+url,{method:body?'POST':'GET',headers:{cookie:`wolf_session=${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await fetch(base+path)).status,401);assert.deepEqual(await (await req(f.tokens[0])).json(),{items:[],next:null});f.command(1,'delegate',{seat:6});f.command(6,'pause');const result=await (await req(f.tokens[5])).json();assert.equal(result.items.length,2);assert.equal(result.items[0].operator.seat,6);assert.equal(result.items[0].action,'pause');assert.equal((await req(f.tokens[1])).status,403);assert.equal((await req(f.tokens[0],path+'?before[]=2')).status,400);assert.equal((await req(f.tokens[0],path,{action:'erase'})).status,404);
 await app.store.auth.createAccount('history_admin','correct-password','管理员','admin');const admin=await app.store.auth.login(f.tokens[2],'history_admin','correct-password');assert.equal((await req(admin.token)).status,403);
 const publicRoom=await (await req(f.tokens[1],`/api/rooms/${f.id}`)).json();assert.equal('managementHistory' in publicRoom.room,false);assert.equal('history' in publicRoom.room.control,false);f.command(1,'delegate',{seat:null});assert.equal((await req(f.tokens[5])).status,403);assert.equal((await (await req(f.tokens[0])).json()).items.length,3);
 const registered=await app.store.auth.register(f.tokens[0],'history_host','correct-password','已绑定房主');assert.equal((await req(f.tokens[0])).status,401);assert.equal((await req(registered.token)).status,200);const fresh=randomBytes(32).toString('hex');app.store.issueSession(fresh);const takeover=await app.store.auth.login(fresh,'history_host','correct-password');assert.equal((await req(registered.token)).status,401);assert.equal((await (await req(takeover.token)).json()).items.length,3);
 }finally{await app.close();}
});
