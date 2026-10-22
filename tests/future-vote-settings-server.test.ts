import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServer} from '../apps/server/app.js';
import {managementFixture} from './helpers/management-fixture.js';

test('future vote settings read is paused-manager only, current-versioned, strict and absent from public projections',async()=>{
 const app=await createServer({dbPath:':memory:'});try{
  const s=app.store,f=managementFixture(s),other=managementFixture(s);await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const a=app.http.address();assert.ok(a&&typeof a!=='string');const base=`http://127.0.0.1:${a.port}`,path=`/api/rooms/${f.id}/control/defaults`;
  const read=(token:string,url=path)=>fetch(base+url,{headers:{cookie:`wolf_session=${token}`}});
  f.command(1,'pause');const initial=await read(f.tokens[0]);assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');assert.deepEqual(await initial.json(),{version:1,seconds:30,visibility:'individual'});
  assert.equal((await fetch(base+path)).status,401);assert.equal((await read(f.tokens[1])).status,403);assert.equal((await read(other.tokens[0])).status,403);assert.equal((await read(f.tokens[0],path+'?seat=1')).status,400);assert.equal((await fetch(base+path,{method:'POST',headers:{cookie:`wolf_session=${f.tokens[0]}`,'Content-Type':'application/json'},body:'{}'})).status,404);
  const before=s.snapshot(f.id);await read(f.tokens[0]);assert.equal(s.snapshot(f.id).revision,before.revision);assert.equal(s.snapshot(f.id).control!.version,before.control!.version);
  f.command(1,'defaults',{voteSeconds:45,voteVisibility:'totals'});assert.deepEqual(await (await read(f.tokens[0])).json(),{version:2,seconds:45,visibility:'totals'});assert.equal(s.snapshot(f.id).control!.voteDefaults,undefined);
  f.command(1,'delegate',{seat:6});assert.deepEqual(await (await read(f.tokens[5])).json(),{version:3,seconds:45,visibility:'totals'});f.command(1,'delegate',{seat:null});assert.equal((await read(f.tokens[5])).status,403);
  await s.auth.createAccount('settings_admin','correct-password','普通运营管理员','admin');const admin=await s.auth.login(f.tokens[2],'settings_admin','correct-password');assert.equal((await read(admin.token)).status,403);
  const registered=await s.auth.register(f.tokens[0],'settings_host','correct-password','绑定房主');assert.equal((await read(f.tokens[0])).status,401);assert.equal((await read(registered.token)).status,200);const fresh=randomBytes(32).toString('hex');s.issueSession(fresh);const login=await s.auth.login(fresh,'settings_host','correct-password');assert.equal((await read(registered.token)).status,401);assert.equal((await read(login.token)).status,200);
  const publicRoom=await (await read(f.tokens[1],`/api/rooms/${f.id}`)).json();assert.equal('defaults' in publicRoom.room.control,false);assert.equal('seconds' in publicRoom.room.control,false);assert.equal('futureVoteSettings' in publicRoom.room.control,false);
  s.gameControl(login.token,f.id,{action:'resume',confirmed:true,version:s.snapshot(f.id).control!.version});assert.equal((await read(login.token)).status,409);
 }finally{await app.close();}
});
