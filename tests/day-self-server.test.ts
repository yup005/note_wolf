import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServer} from '../apps/server/app.js';
import {managementFixture} from './helpers/management-fixture.js';

test('HTTP self card enforces own current-day session without host/admin or query-based impersonation',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',now:()=>now});try{const f=managementFixture(app.store),other=managementFixture(app.store);await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const addr=app.http.address();assert.ok(addr&&typeof addr!=='string');const base=`http://127.0.0.1:${addr.port}`,root=`/api/rooms/${f.id}`,path=root+'/day/self',get=(token:string,url=path)=>fetch(base+url,{headers:{cookie:`wolf_session=${token}`}});
 assert.equal((await fetch(base+path)).status,401);assert.equal((await get(f.tokens[0])).status,409);now+=500000;app.store.tickNights();app.store.enterDay(f.tokens[0],f.id);assert.equal((await get(other.tokens[0])).status,403);const seer=await (await get(f.tokens[0])).json();assert.equal(seer.role,'seer');assert.equal(seer.seat,1);assert.deepEqual(Object.keys(seer).sort(),['turnId','seat','role','learnedRole','modelSeat','idiotRevealed','skills'].sort());assert.equal((await get(f.tokens[0],path+'?seat=10')).status,400);assert.equal((await get(f.tokens[0],path+'/10')).status,404);f.command(1,'delegate',{seat:6});assert.equal((await (await get(f.tokens[5])).json()).role,'villager');
 await app.store.auth.createAccount('self_admin','correct-password','管理员','admin');const admin=await app.store.auth.login(f.tokens[11],'self_admin','correct-password');assert.equal((await (await get(admin.token)).json()).role,'idiot');assert.equal((await get(admin.token,path+'?actorId='+f.room.id)).status,400);
 const room=await (await get(f.tokens[0],root)).json();assert.equal('self' in room.room,false);assert.equal('self' in room.room.day,false);assert.ok(room.room.seats.every((s:any)=>!('role' in s)));const witch=await app.store.auth.register(f.tokens[9],'self_witch','correct-password','女巫本人');assert.equal((await get(f.tokens[9])).status,401);assert.equal((await (await get(witch.token)).json()).role,'witch');const fresh=randomBytes(32).toString('hex');app.store.issueSession(fresh);const takeover=await app.store.auth.login(fresh,'self_witch','correct-password');assert.equal((await get(witch.token)).status,401);assert.equal((await (await get(takeover.token)).json()).role,'witch');
 }finally{await app.close();}
});
