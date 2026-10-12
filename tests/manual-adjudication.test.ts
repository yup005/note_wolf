import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import {emptyRecord} from '../packages/contracts/records.js';
import {manualOutcome} from '../packages/domain/manual.js';
import type {Role} from '../packages/contracts/index.js';
function setup(file=':memory:',roles:Role[]=['villager','mechanicalWolf','idiot','guard','hunter']){
 const s=new LobbyStore(file,()=>42,false,()=>1000),tokens=roles.map((_,i)=>'synthetic-'+i),room=s.create(tokens[0],'参赛房主').room,id=room.id;
 tokens.forEach(t=>s.issueSession(t));
 const counts:Partial<Record<Role,number>>={};for(const role of roles)counts[role]=(counts[role]??0)+1;
 s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:roles.length,roles:counts}}});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'manual'});
 tokens.forEach((t,i)=>{if(i)s.join(t,room.code,'玩家'+i);s.select(t,id,i+1);s.setReady(t,id,true,s.snapshot(id).preparation.settingsRevision);});s.deal(tokens[0],id);tokens.forEach((t,i)=>s.submitIdentity(t,id,roles[i]));s.start(tokens[0],id);s.recordsList(tokens[0],id);return {s,tokens,id};
}
const ruling=(winner:'wolves'|'good'='good',version=0,revision=0)=>({confirmed:true as const,winner,version,revision});
test('guest participant host can explicitly end an unresolved manual board and retain public/audit/published source',()=>{
 const {s,tokens:t,id}=setup();try{
 assert.equal(typeof (s as any).adjudicateManual,'function');
 assert.throws(()=> (s as any).adjudicateManual(t[1],id,ruling()),/HOST_ONLY/);
 assert.throws(()=> (s as any).adjudicateManual(t[0],id,ruling('good',99)),/STALE_RECORD/);
 assert.throws(()=> (s as any).adjudicateManual(t[0],id,ruling('good',0,99)),/STALE_RECORD/);
 const publicBefore=JSON.stringify(s.snapshot(id));assert.doesNotMatch(publicBefore,/learning|modelCamp/);
 (s as any).adjudicateManual(t[0],id,ruling());const state=s.snapshot(id).manual! as any;assert.equal(state.status,'ended');assert.equal(state.winner,'good');assert.equal(state.outcomeSource,'host-adjudicated');assert.equal((s.manualHistory(t[0],id)[0] as any).outcomeSource,'host-adjudicated');
 s.saveRecord(t[0],id,0,{...emptyRecord(),deaths:[{seat:1,round:1,period:'night',cause:'knife'}],notes:'订正'});s.commitManual(t[0],id,1);assert.equal(s.snapshot(id).manual!.winner,'good');
 const published=s.publishRecord(t[0],id,1),post=s.recordPost(t[1],published.id) as any;assert.equal(post.outcome,'good');assert.equal(post.outcomeSource,'host-adjudicated');
 }finally{s.close();}
});
test('manual mixer board can be explicitly adjudicated without revealing or inventing a model',()=>{
 const {s,tokens:t,id}=setup(':memory:',['villager','wolf','mixer','guard']);try{
 assert.equal(typeof (s as any).adjudicateManual,'function');(s as any).adjudicateManual(t[0],id,ruling('wolves'));assert.equal(s.snapshot(id).manual!.winner,'wolves');assert.equal((s.snapshot(id).manual as any).outcomeSource,'host-adjudicated');assert.doesNotMatch(JSON.stringify(s.snapshot(id)),/modelSeat|modelCamp/);
 }finally{s.close();}
});
test('known manual mechanics and standard board cannot override computed results with an adjudication',()=>{
 for(const roles of [['villager','mechanicalWolf','guard'],['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot']] as Role[][]){const {s,tokens:t,id}=setup(':memory:',roles);try{assert.equal(typeof (s as any).adjudicateManual,'function');assert.throws(()=>(s as any).adjudicateManual(t[0],id,ruling()),/INVALID_INPUT/);assert.equal(s.snapshot(id).manual!.status,'playing');}finally{s.close();}}
});
test('pending mechanical idiot extra night cannot become good victory when switched to manual',()=>{
 const roles=[{seat:1,role:'mechanicalWolf' as const},{seat:2,role:'villager' as const},{seat:3,role:'idiot' as const}];
 assert.equal(manualOutcome(roles,[1],[{seat:1,learnedRole:'idiot',extraNightPending:true} as any]),null);
 assert.equal(manualOutcome(roles,[1],[{seat:1,learnedRole:'idiot',learningKnown:true,extraNightPending:false}]),null);
 assert.equal(manualOutcome(roles,[1],[{seat:1,learnedRole:null,learningKnown:true,extraNightPending:false}]),'good');
 assert.equal(manualOutcome(roles,[1,2],[{seat:1,learnedRole:'idiot',extraNightPending:true} as any]),'wolves');
});
test('host ruling survives restart and room cleanup, official corrections and immutable published versions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-manual-ruling-')),file=join(dir,'db');let {s,tokens:t,id}=setup(file);try{
 assert.equal(typeof (s as any).adjudicateManual,'function');(s as any).adjudicateManual(t[0],id,ruling('wolves'));const first=s.publishRecord(t[0],id,0);s.close();s=new LobbyStore(file);assert.equal((s.snapshot(id).manual as any).outcomeSource,'host-adjudicated');
 const db=(s as any).db;(s as any).records.preserveForRoomCleanup(id);db.prepare('DELETE FROM rooms WHERE id=?').run(id);s.close();s=new LobbyStore(file);
 s.saveRecord(t[0],id,0,{...emptyRecord(),notes:'清理后修订'});s.commitManual(t[0],id,1);const second=s.publishRecord(t[0],id,1);assert.equal(second.version,2);assert.equal((s.recordPost(t[1],first.id,1) as any).outcomeSource,'host-adjudicated');assert.equal(s.recordPost(t[1],first.id).outcome,'wolves');assert.equal((s.manualHistory(t[0],id).at(-1) as any).outcomeSource,'host-adjudicated');
 }finally{s.close();rmSync(dir,{recursive:true});}
});
test('adjudication after an unchanged official draft already committed still ends and adds an audited revision',()=>{
 const {s,tokens:t,id}=setup();try{s.commitManual(t[0],id,0);assert.equal(s.snapshot(id).manual!.status,'playing');const version=s.snapshot(id).manual!.version;s.adjudicateManual(t[0],id,ruling('good',version));assert.equal(s.snapshot(id).manual!.status,'ended');assert.equal(s.manualHistory(t[0],id).length,2);assert.equal(s.manualHistory(t[0],id)[0].outcomeSource,'host-adjudicated');}finally{s.close();}
});
test('actual automatic last-idiot exile stays private and pending after manual switch until explicit host ruling',()=>{
 let now=1000;const s=new LobbyStore(':memory:',()=>42,false,()=>now),tokens=['h','w','m','i','hunter','guard'],roles=['villager','wolf','mechanicalWolf','idiot','hunter','guard'] as const;
 try{const room=s.create(tokens[0],'参赛房主').room,id=room.id;s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:6,roles:Object.fromEntries(roles.map(role=>[role,1]))}}});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});tokens.forEach((t,i)=>{if(i)s.join(t,room.code,t);s.select(t,id,i+1);s.setReady(t,id,true,s.snapshot(id).preparation.settingsRevision);});s.deal(tokens[0],id);tokens.forEach((t,i)=>s.submitIdentity(t,id,roles[i]));s.start(tokens[0],id);
 const n=()=>s.snapshot(id).night!,d=()=>s.snapshot(id).day!;
 function moveNight(phase:string){for(let i=0;i<30&&n().phase!==phase;i++){now=n().deadline!;s.tickNights();}assert.equal(n().phase,phase);}
 const command=(action:string,fields={})=>s.dayCommand(tokens[0],id,{action,turnId:d().turnId,...fields} as any);
 function prepareVote(){s.enterDay(tokens[0],id);if(d().phase==='sheriff_signup')command('close_signup');command('continue');if(d().phase==='night_announcement')command('continue');command('speech_mode',{mode:'free'});command('end_speech');command('start_vote',{method:'offline',visibility:'totals',seconds:5});}
 function exile(seat:number){command('offline_results',{counts:d().vote!.candidates.map(candidate=>({seat:candidate,votes:candidate===seat?1:0}))});command('continue');while(d().deadline!==null){now=d().deadline!;s.tickNights();}assert.equal(d().phase,'day_complete');}
 s.enterNight(tokens[0],id);moveNight('mechanical');s.nightCommand(tokens[2],id,{action:'ability',turnId:n().turnId,choice:'learn',target:4});moveNight('first_night_complete');prepareVote();exile(2);s.enterNight(tokens[0],id);moveNight('first_night_complete');prepareVote();exile(3);
 s.switchManual(tokens[0],id,true);const draft=s.recordsList(tokens[0],id).own!;s.commitManual(tokens[0],id,draft.revision);let manual=s.snapshot(id).manual!;assert.equal(manual.status,'playing');assert.equal(manual.winner,null);assert.deepEqual(manual.revealed,[]);assert.doesNotMatch(JSON.stringify(s.snapshot(id)),/learning|extraNight|modelCamp/);
 s.adjudicateManual(tokens[0],id,ruling('good',manual.version,draft.revision));manual=s.snapshot(id).manual!;assert.equal(manual.winner,'good');assert.equal(manual.outcomeSource,'host-adjudicated');
 }finally{s.close();}
});

test('public sharing carries immutable host-ruling provenance and excludes private learning/model facts',async()=>{
 const {s,tokens:t,id}=setup(':memory:',['villager','wolf','mixer','guard']);try{
 const account=await s.auth.register(t[0],'ruling_author','correct-password','作者');const token=account.token;const adminGuest='ruling-admin-guest';s.issueSession(adminGuest);await s.auth.createAccount('ruling_admin','correct-password','管理员','admin');const admin=await s.auth.login(adminGuest,'ruling_admin','correct-password');s.auth.setVip(admin.token,account.account.id,true,null);
 s.adjudicateManual(token,id,ruling('good'));const record=s.publishRecord(token,id,0);const link=s.shareRecord(token,record.id,{action:'create',revision:0});const before=s.sharedRecord(link.token!) as any;assert.equal(before.outcomeSource,'host-adjudicated');assert.equal(before.outcome,'good');assert.doesNotMatch(JSON.stringify(before),/learning|modelCamp|host_owner|victory_facts/);
 s.saveRecord(token,id,0,{...emptyRecord(),notes:'未发布草稿'});assert.equal(s.sharedRecord(link.token!).document.notes,'');assert.equal((s.sharedRecord(link.token!) as any).outcomeSource,'host-adjudicated');s.commitManual(token,id,1);s.publishRecord(token,id,1);assert.equal((s.sharedRecord(link.token!) as any).outcomeSource,'host-adjudicated');assert.equal(s.sharedRecord(link.token!).version,2);
 }finally{s.close();}
});
