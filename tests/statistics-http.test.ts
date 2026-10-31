import {test} from 'node:test';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareManual} from './helpers/rematch.js';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServer} from '../apps/server/app.js';
test('statistics HTTP is current-account-only, no-store and refuses selectors or revoked authority',async()=>{
 const app=await createServer({dbPath:':memory:'}),s=app.store,guest=randomBytes(32).toString('hex');s.issueSession(guest);
 try{await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port,path=base+'/api/my-stats';
  assert.equal((await fetch(path)).status,401);assert.equal((await fetch(path,{headers:{cookie:'wolf_session='+guest}})).status,403);const account=await s.auth.register(guest,'stats_http','synthetic-password','合成统计玩家'),headers={cookie:'wolf_session='+account.token};const response=await fetch(path,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);assert.equal((await response.json()).played,0);
  for(const query of ['?owner=another','?accountId=another','?gameId=another'])assert.equal((await fetch(path+query,{headers})).status,400);assert.equal((await fetch(path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'})).status,404);
  const stranger=randomBytes(32).toString('hex');s.issueSession(stranger);const other=await s.auth.register(stranger,'stats_http_other','synthetic-password','合成其他玩家');assert.equal((await (await fetch(path,{headers:{cookie:'wolf_session='+other.token}})).json()).played,0);
  s.auth.logout(account.token);assert.equal((await fetch(path,{headers})).status,401);const adminGuest=randomBytes(32).toString('hex');s.issueSession(adminGuest);await s.auth.createAccount('stats_http_admin','synthetic-password','合成管理员','admin');const admin=await s.auth.login(adminGuest,'stats_http_admin','synthetic-password');s.auth.setStatus(admin.token,other.account.id,'disabled');assert.equal((await fetch(path,{headers:{cookie:'wolf_session='+other.token}})).status,401);
 }finally{await app.close();}
});

test('statistics HTTP does not tick an active night or require the writer lock',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-stats-http-')),file=join(dir,'db');const app=await createServer({dbPath:file,now:()=>1000}),s=app.store,peer=new Database(file),tokens=Array.from({length:12},()=>randomBytes(32).toString('hex'));
 try{tokens.forEach(t=>s.issueSession(t));tokens[0]=(await s.auth.register(tokens[0],'stats_http_reader','synthetic-password','合成只读账号')).token;const room=s.create(tokens[0],'合成普通房').room;s.configure(tokens[0],room.id,{gameMode:'automatic',dealMethod:'physical'});prepareManual(s,room.id,tokens,room.code);s.enterNight(tokens[0],room.id);const before=s.snapshot(room.id).night;
  // Fail immediately on accidental writes instead of spending the production retry window.
  (s as unknown as {db:Database.Database}).db.pragma('busy_timeout = 0');
  await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();assert.ok(address&&typeof address!=='string');peer.exec('BEGIN IMMEDIATE');
  for(const method of ['GET','HEAD'])for(const route of ['/api/my-stats','/api/my-stats/','/API/MY-STATS']){const response:Response=await fetch('http://127.0.0.1:'+address.port+route,{method,headers:{cookie:'wolf_session='+tokens[0]}});assert.equal(response.status,200,method+' '+route);assert.equal(response.headers.get('cache-control'),'no-store',method+' '+route);if(method==='GET')assert.equal((await response.json()).played,0);else assert.equal(await response.text(),'');}
  peer.exec('ROLLBACK');assert.deepEqual(s.snapshot(room.id).night,before);
 }finally{if(peer.inTransaction)peer.exec('ROLLBACK');peer.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
