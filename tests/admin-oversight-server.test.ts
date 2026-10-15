import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type Database from 'better-sqlite3';
import {createServer} from '../apps/server/app.js';
import {sharingFixture} from './helpers/sharing-fixture.js';
test('oversight wire requires current admin and rejects unknown keys, irrelevant filters, unsafe numeric shapes and incomplete mutations',async()=>{
 const app=await createServer({dbPath:':memory:',allowTestPlayers:true});try{
 const f=await sharingFixture(':memory:',app.store);f.publish();const share=f.s.shareRecord(f.token,f.recordId,{action:'create',revision:0});
 await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
 const request=(token:string,path:string,body?:unknown)=>fetch(`http://127.0.0.1:${address.port}`+path,{method:body===undefined?'GET':'POST',headers:{cookie:`wolf_session=${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await request(f.admin,'/api/admin/oversight/audit')).status,200,'missing oversight wire route');
 for(const path of ['reports','audit','shares'])assert.equal((await request(f.token,'/api/admin/oversight/'+path)).status,403);
 for(const query of ['status=open','accountId=x','q=a&q=b','limit=0','limit=51','from=NaN','from=1e2','from=1&to=1','from=9007199254740992','cursor=bad'])assert.equal((await request(f.admin,'/api/admin/oversight/audit?'+query)).status,400,query);
 assert.equal((await request(f.admin,'/api/admin/oversight/shares?action=vip')).status,400);assert.equal((await request(f.admin,'/api/admin/oversight/reports?status=paused')).status,400);
 assert.equal((await request(f.admin,'/api/admin/oversight/export',{kind:'shares',filter:{},limit:50})).status,400);assert.equal((await request(f.admin,'/api/admin/oversight/export?extra=1',{kind:'shares',filter:{}})).status,400);
 const exp=await (await request(f.admin,'/api/admin/oversight/export',{kind:'shares',filter:{status:'active'}})).json();assert.equal(exp.count,1);assert(!JSON.stringify(exp).includes(share.token!));assert(!JSON.stringify(exp).includes('已发布复盘'));
 const cmd={requestId:randomUUID(),expectedAdminId:f.s.auth.account(f.admin)!.id,recordId:f.recordId,revision:share.revision,confirmed:true,reason:'wire reason'};
 for(const body of [{...cmd,ownerId:f.account.id},{...cmd,confirmed:false},{...cmd,reason:''},{...cmd,reason:'x'.repeat(501)},{...cmd,revision:-1},{...cmd,requestId:'bad'}])assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',body)).status,400);
 assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',{...cmd,expectedAdminId:randomUUID()})).status,401);
 assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',cmd)).status,200);assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',cmd)).status,200);
 assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',{...cmd,reason:'altered'})).status,400);assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',{...cmd,requestId:randomUUID()})).status,409);
 const db=(f.s as unknown as {db:Database.Database}).db,insert=db.prepare('INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)');db.transaction(()=>{for(let i=0;i<5001;i++)insert.run(randomUUID(),i,f.account.id,'actor',f.account.id,'subject','warn','safe',null,null);})();const tooLarge=await request(f.admin,'/api/admin/oversight/export',{kind:'audit',filter:{action:'warn'}});assert.equal(tooLarge.status,409);assert.equal((await tooLarge.json()).error,'EXPORT_TOO_LARGE');
 await f.s.auth.login(f.players[3],'share_admin','correct-password');assert.equal((await request(f.admin,'/api/admin/oversight/share-revoke',cmd)).status,401);assert.equal((await request(f.admin,'/api/admin/oversight/export',{kind:'audit',filter:{}})).status,401);
 }finally{await app.close();}
});
