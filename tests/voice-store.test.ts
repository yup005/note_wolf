import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {voiceFixture} from './helpers/voice-fixture.js';
const client=randomUUID();
test('only managers claim the one room speaker, second tabs cannot poll or release it, and emissions do not repeat',()=>{
 const {store:s,tokens:t,id,setNow}=voiceFixture();try{
 assert.throws(()=>s.publicVoice(t[1],id,{action:'claim',clientId:client}),/HOST_ONLY/);
 const first=s.publicVoice(t[0],id,{action:'claim',clientId:client});assert.match(first.cues[0].text,/狼人/);assert.equal(s.publicVoice(t[0],id,{action:'poll',clientId:client}).cues.length,0);
 const other=randomUUID();assert.throws(()=>s.publicVoice(t[0],id,{action:'claim',clientId:other}),/VOICE_BUSY/);assert.throws(()=>s.publicVoice(t[0],id,{action:'release',clientId:other}),/VOICE_LEASE_LOST/);
 const deadline=s.snapshot(id).night!.deadline!;setNow(deadline-30000);assert.throws(()=>s.publicVoice(t[0],id,{action:'poll',clientId:client}),/VOICE_LEASE_LOST/);const near=s.publicVoice(t[0],id,{action:'claim',clientId:other});assert.equal(near.cues.length,1);assert.match(near.cues[0].text,/最后30秒/);assert.equal(s.publicVoice(t[0],id,{action:'poll',clientId:other}).cues.length,0);assert.match(s.publicVoice(t[0],id,{action:'replay',clientId:other}).cues[0].text,/狼人/);
 }finally{s.close();}
});
test('lease disappears on session revocation, and a new login keeps already dispatched cues deduplicated',async()=>{
 const {store:s,tokens:t,id}=voiceFixture();try{const a=await s.auth.register(t[0],'voice_host','correct-password','房主');t[0]=a.token;s.publicVoice(a.token,id,{action:'claim',clientId:client});const fresh=randomBytes(32).toString('hex');s.issueSession(fresh);const b=await s.auth.login(fresh,'voice_host','correct-password');assert.throws(()=>s.publicVoice(a.token,id,{action:'poll',clientId:client}),/UNAUTHORIZED/);assert.equal(s.publicVoice(b.token,id,{action:'claim',clientId:randomUUID()}).cues.length,0);
 }finally{s.close();}
});
test('pause, resume and delegation are public cues, revoked temporary managers cannot continue',()=>{
 const {store:s,tokens:t,id,setNow}=voiceFixture();try{s.publicVoice(t[0],id,{action:'claim',clientId:client});const control=(action:'pause'|'resume'|'delegate',extra={})=>s.gameControl(t[0],id,{action,confirmed:true,version:s.snapshot(id).control!.version,...extra} as any);
 control('pause');assert.match(s.publicVoice(t[0],id,{action:'poll',clientId:client}).cues[0].text,/暂停/);control('resume');assert.match(s.publicVoice(t[0],id,{action:'poll',clientId:client}).cues[0].text,/五秒/);setNow(6000);s.tickNights();assert.equal(s.publicVoice(t[0],id,{action:'poll',clientId:client}).cues.length,0);
 s.publicVoice(t[0],id,{action:'release',clientId:client});control('delegate',{seat:5});s.publicVoice(t[4],id,{action:'claim',clientId:client});control('delegate',{seat:null});assert.throws(()=>s.publicVoice(t[4],id,{action:'poll',clientId:client}),/HOST_ONLY/);assert.equal(s.publicVoice(t[0],id,{action:'claim',clientId:randomUUID()}).cues.length,0);
 s.switchManual(t[0],id,true);assert.throws(()=>s.publicVoice(t[0],id,{action:'claim',clientId:client}),/MANUAL_MODE/);
 }finally{s.close();}
});
test('voice delivery cursor survives restart and rejects attempts to inject speech text',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {LobbyStore}=await import('../packages/storage/lobby.js');const dir=mkdtempSync(join(tmpdir(),'wolf-voice-'));const file=join(dir,'db');const f=voiceFixture(file);let s=f.store;try{s.publicVoice(f.tokens[0],f.id,{action:'claim',clientId:client});s.publicVoice(f.tokens[0],f.id,{action:'release',clientId:client});s.close();s=new LobbyStore(file,undefined,false,f.getNow);assert.equal(s.publicVoice(f.tokens[0],f.id,{action:'claim',clientId:randomUUID()}).cues.length,0);assert.throws(()=>s.publicVoice(f.tokens[0],f.id,{action:'poll',clientId:client,text:'10号女巫'} as any),/INVALID_INPUT/);}finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('daytime death inquiries and completed no-skill outcomes cannot claim or poll speech',()=>{
 const {store:s,tokens:t,id,setNow}=voiceFixture();try{
 let n=s.snapshot(id).night!;for(let i=0;i<4;i++)s.nightCommand(t[i],id,{action:'vote',target:5,turnId:n.turnId});const wolf=s.nightPrivate(t[0],id).confirmer!;s.nightCommand(t[wolf-1],id,{action:'confirm_wolves',turnId:n.turnId});setNow(1000000);s.tickNights();s.enterDay(t[0],id);
 const cmd=(action:string)=>s.dayCommand(t[0],id,{action,turnId:s.snapshot(id).day!.turnId} as any);
 cmd('close_signup');cmd('continue');cmd('continue');assert.equal(s.snapshot(id).day!.phase,'death_skill');
 assert.throws(()=>s.publicVoice(t[0],id,{action:'claim',clientId:client}),/PHASE_LOCKED/);setNow(s.snapshot(id).day!.deadline!);s.tickNights();assert.equal(s.snapshot(id).day!.phase,'last_words');assert.throws(()=>s.publicVoice(t[0],id,{action:'poll',clientId:client}),/VOICE_LEASE_LOST|PHASE_LOCKED/);
 }finally{s.close();}
});
test('daytime hunter shooting remains playable while public voice is unavailable',()=>{
 const {store:s,tokens:t,id,setNow}=voiceFixture();try{const n=s.snapshot(id).night!;for(let i=0;i<4;i++)s.nightCommand(t[i],id,{action:'vote',target:11,turnId:n.turnId});const confirmer=s.nightPrivate(t[0],id).confirmer!;s.nightCommand(t[confirmer-1],id,{action:'confirm_wolves',turnId:n.turnId});setNow(1000000);s.tickNights();s.enterDay(t[0],id);
 const d=(seat:number,action:string,extra={})=>s.dayCommand(t[seat-1],id,{action,turnId:s.snapshot(id).day!.turnId,...extra} as any);d(1,'close_signup');d(1,'continue');d(1,'continue');assert.equal(s.snapshot(id).day!.currentDeath,11);assert.throws(()=>s.publicVoice(t[0],id,{action:'claim',clientId:client}),/PHASE_LOCKED/);d(11,'shoot');d(1,'record_shot',{target:5});assert.equal(s.snapshot(id).day!.currentDeath,5);assert.throws(()=>s.publicVoice(t[0],id,{action:'replay',clientId:client}),/VOICE_LEASE_LOST|PHASE_LOCKED/);
 }finally{s.close();}
});
