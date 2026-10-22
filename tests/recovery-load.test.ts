import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {api} from '../apps/web/src/api.js';

test('display_recovery_never_reads_a_session_or_sends_cookies',async()=>{
 const {loadRecovery}=await import('../apps/web/src/recoveryLoad.js'),previous=globalThis.fetch,reads:{path:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(input,init)=>{reads.push({path:String(input),init});return Response.json({roomCode:'1234'});};
 try{const token='b'.repeat(64),signal=new AbortController().signal,result=await loadRecovery('/display/'+token,signal);assert.equal(result.kind,'display');assert.equal(reads.length,1);assert.equal(reads[0].path,'/api/displays/'+token);assert.equal(reads[0].init?.credentials,'omit');assert.equal(reads[0].init?.cache,'no-store');assert.equal(reads[0].init?.signal,signal);await assert.rejects(loadRecovery('/display/invalid',signal));assert.equal(reads.length,1);
  let limitedReads=0;globalThis.fetch=async()=>{limitedReads++;return Response.json({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':'17'}});};await assert.rejects(loadRecovery('/display/'+token,signal),(error:unknown)=>error instanceof Error&&'retryAfterMs' in error&&error.retryAfterMs===17000);await assert.rejects(loadRecovery('/display/'+token,signal));assert.equal(limitedReads,1,'manual recovery must respect Retry-After too');
 }finally{globalThis.fetch=previous;}
});

test('recovery_load_uses_current_authority_and_anonymous_share_credentials',async()=>{
 assert.ok(existsSync('apps/web/src/recoveryLoad.ts'),'Authoritative recovery loader is required');const {loadRecovery}=await import('../apps/web/src/recoveryLoad.js');const previous=globalThis.fetch,reads:{path:string;init?:RequestInit}[]=[];
 globalThis.fetch=async(input,init)=>{reads.push({path:String(input),init});return Response.json(String(input)==='/api/session'?{account:null,rooms:[]}:{recordId:'synthetic',version:1,document:{notes:'published'}});};
 try{const signal=new AbortController().signal;assert.equal((await loadRecovery('/',signal)).kind,'lobby');assert.equal(reads[0].init?.cache,'no-store');assert.equal(reads[0].init?.credentials,'same-origin');assert.equal(reads[0].init?.signal,signal);
  const token='a'.repeat(64);assert.equal((await loadRecovery('/share/'+token,signal)).kind,'share');assert.equal(reads[1].init?.credentials,'omit');assert.equal(reads[1].init?.cache,'no-store');assert.ok(reads[1].path.endsWith(token));const count=reads.length;await assert.rejects(loadRecovery('/share/invalid',signal));assert.equal(reads.length,count);
  globalThis.fetch=async()=>Response.json({error:'UNAUTHORIZED',message:'No authority'},{status:401});await assert.rejects(loadRecovery('/',signal),/No authority/);await assert.rejects(loadRecovery('/share/'+token,signal),/No authority/);
 }finally{globalThis.fetch=previous;}
});
test('authentication_completion_notifies_even_when_the_initiating_component_is_gone',async()=>{
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window;let finish!:(r:Response)=>void;const events:string[]=[];
 globalThis.window={dispatchEvent:(e:Event)=>{events.push(e.type);return true;}} as Window&typeof globalThis;
 globalThis.fetch=()=>new Promise(resolve=>finish=resolve);
 try{const request=api('/api/auth/login',{username:'synthetic',password:'synthetic-password'});finish(Response.json({account:null,rooms:[]}));await request;assert.ok(events.includes('wolf:session-changed'));
  events.length=0;globalThis.fetch=async()=>{throw TypeError('lost response');};await assert.rejects(api('/api/auth/logout',{}));assert.ok(events.includes('wolf:session-changed'));
 }finally{globalThis.fetch=previousFetch;globalThis.window=previousWindow;}
});
