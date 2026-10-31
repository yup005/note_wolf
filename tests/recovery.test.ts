import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import type {RecoveryPayload} from '../apps/web/src/sessionTypes.js';
const payload:RecoveryPayload={kind:'lobby',session:{account:null,rooms:[]}};
async function controller(load:(signal:AbortSignal)=>Promise<RecoveryPayload>,conceal:()=>void=()=>{}){
 assert.ok(existsSync('apps/web/src/recovery.ts'),'Authoritative recovery controller is required');return (await import('../apps/web/src/recovery.js')).createRecovery(load,conceal);
}
test('hide_invalidates_late_session_and_share',async()=>{
 const completions:((p:RecoveryPayload)=>void)[]=[],signals:AbortSignal[]=[];let concealed=0;
 const c=await controller(signal=>{signals.push(signal);return new Promise(resolve=>completions.push(resolve));},()=>concealed++);
 const first=c.resume(),beforeHide=concealed;c.hide('hidden');assert.equal(concealed,beforeHide+1);assert.equal(c.getSnapshot().phase,'hidden');assert.ok(signals[0].aborted);const second=c.resume();completions[1](payload);await second;const ready=c.getSnapshot();assert.equal(ready.phase,'ready');completions[0]({kind:'share',token:'old-token',post:{} as never});await first;assert.equal(c.getSnapshot(),ready);c.dispose();
});
test('duplicate_resume_coalesces_and_retry_starts_a_new_epoch',async()=>{
 let reads=0;const done:((p:RecoveryPayload)=>void)[]=[];const c=await controller(()=>{reads++;return new Promise(r=>done.push(r));});
 const one=c.resume(),two=c.resume();assert.equal(reads,1);assert.equal(c.getSnapshot(),c.getSnapshot());const before=c.getSnapshot().epoch;const fresh=c.retry();assert.equal(reads,2);assert.ok(c.getSnapshot().epoch>before);done[1](payload);await fresh;done[0](payload);await Promise.all([one,two]);assert.equal(c.getSnapshot().phase,'ready');c.dispose();
});
test('timeout_stays_concealed_and_dispose_ignores_late_results',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let finish!:(p:RecoveryPayload)=>void;let hidden=0;const c=await controller(()=>new Promise(r=>finish=r),()=>hidden++);
 const request=c.resume();t.mock.timers.tick(5999);assert.equal(c.getSnapshot().phase,'checking');t.mock.timers.tick(1);await request;assert.equal(c.getSnapshot().phase,'failed');assert.ok(hidden>0);assert.ok(!('payload' in c.getSnapshot()));c.dispose();finish(payload);await Promise.resolve();assert.notEqual(c.getSnapshot().phase,'ready');
});
