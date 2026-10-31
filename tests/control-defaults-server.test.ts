import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../apps/server/app.js';
import {managementFixture} from './helpers/management-fixture.js';

test('future vote defaults are versioned manager-only reads, separate from the current vote and public snapshot',async()=>{
 let now=1000;const app=await createServer({dbPath:':memory:',now:()=>now});
 try{
  const f=managementFixture(app.store),s=app.store;
  await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
  const read=(seat:number,suffix='')=>fetch(`http://127.0.0.1:${address.port}/api/rooms/${f.id}/control/defaults${suffix}`,{headers:{cookie:`wolf_session=${f.tokens[seat-1]}`}});
  assert.equal((await read(2)).status,403);f.command(1,'delegate',{seat:6});f.command(6,'pause');
  const initial=await read(6);assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');assert.deepEqual(await initial.json(),{version:s.snapshot(f.id).control!.version,seconds:30,visibility:'individual'});
  assert.equal((await read(1,'?actor=2')).status,400);f.command(6,'defaults',{voteSeconds:45,voteVisibility:'totals'});
  assert.deepEqual(await (await read(1)).json(),{version:s.snapshot(f.id).control!.version,seconds:45,visibility:'totals'});
  assert.equal('futureVoteDefaults' in s.snapshot(f.id).control!,false);assert.equal(s.snapshot(f.id).control!.voteDefaults,undefined);
  f.command(1,'delegate',{seat:null});assert.equal((await read(6)).status,403);f.command(1,'resume');now+=505000;s.tickNights();s.enterDay(f.tokens[0],f.id);
  const day=(action:string)=>s.dayCommand(f.tokens[0],f.id,{action,turnId:s.snapshot(f.id).day!.turnId} as never);
  day('close_signup');day('continue');day('continue');s.dayCommand(f.tokens[0],f.id,{action:'speech_mode',mode:'free',turnId:s.snapshot(f.id).day!.turnId});day('end_speech');
  assert.deepEqual(s.snapshot(f.id).control!.voteDefaults,{seconds:45,visibility:'totals'});f.command(1,'pause');const version=s.snapshot(f.id).control!.version;f.command(1,'defaults',{voteSeconds:60,voteVisibility:'individual'});
  assert.deepEqual(s.snapshot(f.id).control!.voteDefaults,{seconds:45,visibility:'totals'});assert.deepEqual(await (await read(1)).json(),{version:version+1,seconds:60,visibility:'individual'});
  assert.throws(()=>s.gameControl(f.tokens[0],f.id,{action:'defaults',confirmed:true,version,voteSeconds:90,voteVisibility:'totals'}),/STALE_CONTROL/);
 }finally{await app.close();}
});
