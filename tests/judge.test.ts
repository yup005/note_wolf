import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';
import {emptyRecord} from '../packages/contracts/records.js';

function setup(mode:'manual'|'automatic'='manual',store=new LobbyStore(':memory:')){
 const host=randomUUID();store.issueSession(host);const id=store.create(host,'Host').room.id;store.select(host,id,1);store.configure(host,id,{dealMethod:'online',gameMode:mode});const players=fillRealPlayers(store,host,id);store.setReady(host,id,true,store.snapshot(id).preparation.settingsRevision);store.deal(host,id);confirmRealPlayers(store,id,players);store.confirmIdentity(host,id);store.start(host,id);
 const db=(store as unknown as {db:Database.Database}).db;
 // Synthetic roster deliberately controls seats; no fixture secrets enter an external service.
 for(const [index,role] of ['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'].entries())db.prepare('UPDATE identities SET role=? WHERE room_id=? AND member_id=(SELECT id FROM members WHERE room_id=? AND seat=?)').run(role,id,id,index+1);
 db.prepare('UPDATE record_rooms SET roles=? WHERE room_id=?').run(JSON.stringify(['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'].map((role,i)=>({seat:i+1,role}))),id);
 return {store,host,id,players,db};
}
function death(f:ReturnType<typeof setup>,seat=5){const own=f.store.recordsList(f.host,f.id).own!;f.store.saveRecord(f.host,f.id,own.revision,{...emptyRecord(),deaths:[{seat,round:1,period:'night',cause:'knife'}],notes:'private host note'});f.store.commitManual(f.host,f.id,own.revision+1);}

test('explicit judge appointment requires completed public death, denies other members and revokes immediately',()=>{const f=setup();try{
 assert.ok(f.store.snapshot(f.id).judge,'public judge metadata is available');
 assert.throws(()=>f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true}),/INVALID_JUDGE/);
 death(f);assert.equal(f.store.manualHistory(f.host,f.id)[0].document.deaths[0].cause,'knife','explicit host-entered manual cause stays readable');assert.throws(()=>f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5}),/JUDGE_ATTESTATION_REQUIRED/);
 f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true});
 assert.equal(f.store.snapshot(f.id).judge!.seat,5);assert.throws(()=>f.store.judgePrivate(f.host,f.id),/JUDGE_ONLY/);
 const view=f.store.judgePrivate(f.players[4],f.id);assert.equal(view.roles.length,12);assert.equal(view.official.notes,'');assert.equal(JSON.stringify(view).includes('private host note'),false);
 f.store.appointJudge(f.host,f.id,{confirmed:true,version:1,seat:null});assert.throws(()=>f.store.judgePrivate(f.players[4],f.id),/JUDGE_ONLY/);
 }finally{f.store.close();}});

test('pure manual judge uses validated frozen replay and checked return, with stale versions atomic',()=>{const f=setup();try{
 death(f);f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true});const judge=f.players[4];const v=f.store.judgePrivate(judge,f.id);let draft=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});
 assert.equal(draft.night!.phase,'awaiting_host');assert.equal(draft.night!.deadline,null);
 const supplement=(operation:any)=>{const d=draft.draft!;draft=f.store.supplementJudge(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),operation});};
 supplement({kind:'advance'});assert.equal(draft.night!.phase,'wolves');const oldTurn=draft.night!.turnId;
 for(const actorSeat of [1,2,3,4])supplement({kind:'night',actorSeat,command:{action:'vote',turnId:oldTurn,target:5}});
 supplement({kind:'advance'});supplement({kind:'advance'});assert.equal(draft.night!.phase,'witch');supplement({kind:'night',actorSeat:10,command:{action:'witch',turnId:draft.night!.turnId,choice:'skip',target:null}});
 while(draft.night!.phase!=='first_night_complete')supplement({kind:'advance'});
 supplement({kind:'enter-day'});supplement({kind:'day',actorSeat:1,command:{action:'close_signup',turnId:draft.day!.turnId}});supplement({kind:'day',actorSeat:1,command:{action:'continue',turnId:draft.day!.turnId}});supplement({kind:'day',actorSeat:1,command:{action:'continue',turnId:draft.day!.turnId}});
 while(draft.day!.phase==='death_skill'||draft.day!.phase==='last_words')supplement({kind:'advance'});
 const d=draft.draft!,request={assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),confirmed:true as const};
 assert.throws(()=>f.store.returnJudge(judge,f.id,{...request,draftVersion:d.version-1}),/STALE_JUDGE/);assert.equal(f.store.snapshot(f.id).preparation.settings.gameMode,'manual');
 const result=f.store.returnJudge(judge,f.id,request);assert.equal(result.room.preparation.settings.gameMode,'automatic');assert.equal(result.room.control!.status,'paused');assert.equal(result.room.manual,null);assert.equal(result.room.day!.deadline,null);assert.notEqual(result.room.day!.turnId,draft.day!.turnId);
 assert.throws(()=>f.store.dayCommand(judge,f.id,{action:'interject',turnId:result.room.day!.turnId}),/JUDGE_PLAYER_ACTION/);
 assert.equal(f.store.recordsList(f.host,f.id).own!.document.notes,'private host note');assert.ok(f.db.prepare('SELECT 1 FROM manual_revisions WHERE room_id=?').get(f.id));const archived=JSON.parse((f.db.prepare('SELECT document FROM manual_revisions WHERE room_id=? ORDER BY version DESC LIMIT 1').get(f.id) as {document:string}).document);assert.deepEqual(archived.badges,[{round:1,seat:null}]);assert.equal(archived.notes,'');assert.equal(f.store.manualHistory(f.host,f.id)[0].document.deaths[0].cause,'knife','return preserves explicit public manual cause');
 }finally{f.store.close();}});

function automaticDeaths(target=5){
 const clock={now:1000};const f=setup('automatic',new LobbyStore(':memory:',undefined,false,()=>clock.now));f.store.enterNight(f.host,f.id);
 const turn=f.store.snapshot(f.id).night!.turnId;for(const seat of [1,2,3,4])f.store.nightCommand(f.players[seat-1],f.id,{action:'vote',turnId:turn,target});
 const confirmer=f.store.nightPrivate(f.players[0],f.id).confirmer!;f.store.nightCommand(f.players[confirmer-1],f.id,{action:'confirm_wolves',turnId:turn});
 clock.now=f.store.snapshot(f.id).night!.deadline!;f.store.tickNights();
 f.store.nightCommand(f.players[9],f.id,{action:'witch',turnId:f.store.snapshot(f.id).night!.turnId,choice:'poison',target:6});
 clock.now+=500000;f.store.tickNights();f.store.enterDay(f.host,f.id);
 return {...f,clock};
}
function dayHost(f:ReturnType<typeof setup>,action:string,extra={}){return f.store.dayCommand(f.host,f.id,{action,turnId:f.store.snapshot(f.id).day!.turnId,...extra} as never);}

test('unannounced deaths and live hunter queues cannot appoint; manual attestation covers frozen offline completion',()=>{
 const f=automaticDeaths(11);try{
 assert.equal(f.store.snapshot(f.id).judge!.candidates.includes(11),false);
 assert.throws(()=>f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:11,deathSkillsComplete:true}),/INVALID_JUDGE/);
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');assert.equal(f.store.snapshot(f.id).day!.phase,'death_skill');
 assert.equal(f.store.snapshot(f.id).judge!.candidates.includes(f.store.snapshot(f.id).day!.currentDeath!),false);
 const active=f.store.snapshot(f.id).day!.currentDeath!;f.store.switchManual(f.host,f.id,true);
 f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:active,deathSkillsComplete:true});const judge=f.players[active-1],v=f.store.judgePrivate(judge,f.id);const draft=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});const request={assignmentVersion:1,manualVersion:v.manualVersion!,draftId:draft.draft!.id,draftVersion:0,requestId:randomUUID(),confirmed:true as const};assert.throws(()=>f.store.returnJudge(judge,f.id,request),/JUDGE_RETURN_BLOCKED/);const advanced=f.store.supplementJudge(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,draftId:draft.draft!.id,draftVersion:0,requestId:randomUUID(),operation:{kind:'advance'}});assert.equal(advanced.day!.phase,'last_words');
 }finally{f.store.close();}
});

test('automatic checkpoint return retains spent potion and full phase progress, rejects old turns and resumes in five seconds',()=>{
 const f=automaticDeaths();try{
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');while(f.store.snapshot(f.id).day!.phase==='death_skill'){f.clock.now=f.store.snapshot(f.id).day!.deadline!;f.store.tickNights();}
 const judgeSeat=f.store.snapshot(f.id).day!.currentDeath!,judge=f.players[judgeSeat-1];f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:judgeSeat});
 assert.equal(f.store.judgePrivate(judge,f.id).roles.find(r=>r.seat===10)!.inventory!.poison,false);
 f.store.gameControl(judge,f.id,{action:'pause',confirmed:true,version:f.store.snapshot(f.id).control!.version});const oldTurn=f.store.snapshot(f.id).day!.turnId;
 f.store.switchManual(f.host,f.id,true);const sourceState=(f.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(f.id) as {state:string}).state;const v=f.store.judgePrivate(judge,f.id);const draft=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});
 const source=JSON.parse((f.db.prepare('SELECT source FROM judge_drafts WHERE id=?').get(draft.draft!.id) as {source:string}).source);assert.deepEqual(source.day,JSON.parse(sourceState),'original paused checkpoint is retained byte-equivalently in parsed form');
 const request={assignmentVersion:1,manualVersion:v.manualVersion!,draftId:draft.draft!.id,draftVersion:0,requestId:randomUUID(),confirmed:true as const};
 const restored=f.store.returnJudge(judge,f.id,request);assert.equal(restored.room.control!.remainingMs,90000);assert.ok(f.store.manualHistory(f.host,f.id).every(revision=>revision.document.deaths.every(death=>death.cause==='unrecorded')),'ongoing ordinary host history does not expose canonical knife/poison causes');assert.notEqual(restored.room.day!.turnId,oldTurn);
 assert.equal(f.store.returnJudge(judge,f.id,request).room.revision,restored.room.revision,'lost response retry does not apply return twice');
 assert.throws(()=>f.store.dayCommand(f.host,f.id,{action:'end_speech',turnId:oldTurn}),/STALE_TURN/);
 f.store.gameControl(judge,f.id,{action:'resume',confirmed:true,version:restored.room.control!.version});f.clock.now+=4999;f.store.tickNights();assert.equal(f.store.snapshot(f.id).control!.status,'resuming');f.clock.now++;f.store.tickNights();assert.equal(f.store.snapshot(f.id).day!.deadline,f.clock.now+90000);
 assert.equal(f.store.judgePrivate(judge,f.id).roles.find(r=>r.seat===10)!.inventory!.poison,false);
 f.store.switchManual(f.host,f.id,true);const own=f.store.recordsList(f.host,f.id).own!;f.store.saveRecord(f.host,f.id,own.revision,{...own.document,notes:'later note'});f.store.commitManual(f.host,f.id,own.revision+1);assert.ok(f.store.snapshot(f.id).manual!.version>v.manualVersion!,'later manual commits do not reuse archive versions');
 }finally{f.store.close();}
});

test('supplementation is versioned and request-idempotent, raw states and mismatched official facts are atomic',()=>{
 const f=automaticDeaths();try{
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');f.clock.now=f.store.snapshot(f.id).day!.deadline!;f.store.tickNights();const seat=f.store.snapshot(f.id).day!.currentDeath!,judge=f.players[seat-1];f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat});f.store.switchManual(f.host,f.id,true);
 const v=f.store.judgePrivate(judge,f.id),draft=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});const d=draft.draft!;
 const request={assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.id,draftVersion:0,requestId:randomUUID(),operation:{kind:'advance' as const}};const advanced=f.store.supplementJudge(judge,f.id,request);assert.equal(advanced.draft!.version,1);assert.equal(f.store.supplementJudge(judge,f.id,request).draft!.version,1);assert.throws(()=>f.store.supplementJudge(judge,f.id,{...request,requestId:randomUUID()}),/STALE_JUDGE/);assert.throws(()=>f.store.supplementJudge(judge,f.id,{...request,state:{}} as never),/INVALID_INPUT/);
 const official=JSON.parse((f.db.prepare('SELECT official FROM manual_games WHERE room_id=?').get(f.id) as {official:string}).official);official.badges=[{round:1,seat:2}];f.db.prepare('UPDATE manual_games SET official=? WHERE room_id=?').run(JSON.stringify(official),f.id);
 const returnRequest={assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.id,draftVersion:1,requestId:randomUUID(),confirmed:true as const};const before=f.store.snapshot(f.id).revision;
 assert.throws(()=>f.store.returnJudge(judge,f.id,returnRequest),/JUDGE_FACT_MISMATCH/);assert.equal(f.store.snapshot(f.id).revision,before);assert.equal(f.store.snapshot(f.id).preparation.settings.gameMode,'manual');assert.equal(f.store.judgePrivate(judge,f.id).draft!.version,1);
 official.badges=[{round:1,seat:null}];official.deaths[0].seat=8;f.db.prepare('UPDATE manual_games SET official=? WHERE room_id=?').run(JSON.stringify(official),f.id);assert.throws(()=>f.store.returnJudge(judge,f.id,returnRequest),/JUDGE_FACT_MISMATCH/);
 }finally{f.store.close();}
});

test('new terminal reconstruction applies computed victory while an already-ended official game cannot reopen',()=>{
 const f=automaticDeaths();try{
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');while(['death_skill','last_words'].includes(f.store.snapshot(f.id).day!.phase)){f.clock.now=f.store.snapshot(f.id).day!.deadline!;f.store.tickNights();}dayHost(f,'speech_mode',{mode:'free'});const seat=5,judge=f.players[seat-1];
 // Synthetic earlier official exiles leave one live wolf; the next legal
 // player command must use real victory-first processing in the shadow.
 const row=f.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(f.id) as {state:string};const day=JSON.parse(row.state);for(const wolf of [1,2,3]){day.players.find((p:{seat:number})=>p.seat===wolf).alive=false;day.deaths.push({seat:wolf,reason:'exile'});day.events.push({type:'death_exile',seat:wolf,at:f.clock.now});}
 f.db.prepare('UPDATE day_games SET state=? WHERE room_id=?').run(JSON.stringify(day),f.id);
 f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat});f.store.switchManual(f.host,f.id,true);const v=f.store.judgePrivate(judge,f.id);const d=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});
 const terminal=f.store.supplementJudge(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.draft!.id,draftVersion:0,requestId:randomUUID(),operation:{kind:'day',actorSeat:4,command:{action:'explode',turnId:d.day!.turnId,confirmed:true}}});assert.equal(terminal.day!.phase,'ended');
 const result=f.store.returnJudge(judge,f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.draft!.id,draftVersion:1,requestId:randomUUID(),confirmed:true});assert.equal(result.room.day!.phase,'ended');assert.equal(result.room.day!.winner,'good');assert.equal(result.room.control!.status,'running');assert.equal(f.store.gameReplay(f.host,f.id).winner,'good');
 assert.throws(()=>f.store.switchManual(f.host,f.id,true),/PHASE_LOCKED/);
 }finally{f.store.close();}
});

test('judge draft and audit survive restart, replacement and expired sessions lose private authority',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'wolf-judge-')),path=join(dir,'game.db');let store=new LobbyStore(path);
 const f=setup('manual',store);try{
 death(f);store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true});const guest=f.players[4];const registered=await store.auth.register(guest,'judge_user','test-password-safe','Judge');const judge=registered.token;
 assert.throws(()=>store.judgePrivate(guest,f.id),/UNAUTHORIZED/);const v=store.judgePrivate(judge,f.id);const request={assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()};const draft=store.startJudgeDraft(judge,f.id,request);store.close();store=new LobbyStore(path);
 assert.equal(store.judgePrivate(judge,f.id).draft!.id,draft.draft!.id);assert.equal(store.judgePrivate(judge,f.id).draft!.version,0);assert.ok(store.judgePrivate(judge,f.id).audit.some(a=>a.action==='draft'));assert.equal(store.judgePrivate(judge,f.id).official.notes,'');
 const client=randomUUID();store.issueSession(client);const login=await store.auth.login(client,'judge_user','test-password-safe');assert.throws(()=>store.judgePrivate(judge,f.id),/UNAUTHORIZED/);assert.equal(store.judgePrivate(login.token,f.id).roles.length,12);
 store.appointJudge(f.host,f.id,{confirmed:true,version:1,seat:null});assert.throws(()=>store.startJudgeDraft(login.token,f.id,{...request,requestId:randomUUID()}),/JUDGE_ONLY/);assert.equal(store.snapshot(f.id).judge!.seat,null);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('mechanical and armor supplementation freezes copied stock; restored completed ability keeps its receipt and never spends twice',()=>{
 let now=1000;const store=new LobbyStore(':memory:',undefined,false,()=>now);const roles=['wolf','wolf','mechanicalWolf','armoredWolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard'] as const;const tokens=roles.map(()=>randomUUID());tokens.forEach(t=>store.issueSession(t));const host=tokens[0],judge=tokens[4];
 try{
  const id=store.create(host,'Host').room.id;store.configureBoard(host,id,{settingsRevision:0,selection:{kind:'preset',id:'mechanical-armor-12'}});store.configure(host,id,{dealMethod:'physical',gameMode:'manual'});const room=store.snapshot(id);tokens.forEach((t,i)=>{if(i)store.join(t,room.code,'Synthetic '+(i+1));store.select(t,id,i+1);store.setReady(t,id,true,room.preparation.settingsRevision);});store.deal(host,id);tokens.forEach((t,i)=>store.submitIdentity(t,id,roles[i]));store.start(host,id);
  const own=store.recordsList(host,id).own!;store.saveRecord(host,id,0,{...emptyRecord(),deaths:[{seat:5,round:1,period:'night',cause:'knife'}]});store.commitManual(host,id,1);store.appointJudge(host,id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true});let view=store.startJudgeDraft(judge,id,{assignmentVersion:1,manualVersion:1,requestId:randomUUID()});
  const supplement=(operation:any)=>{const d=view.draft!;view=store.supplementJudge(judge,id,{assignmentVersion:1,manualVersion:1,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),operation});};
  const night=(actorSeat:number,action:string,extra={})=>supplement({kind:'night',actorSeat,command:{action,turnId:view.night!.turnId,...extra}});
  const day=(action:string,extra={})=>supplement({kind:'day',actorSeat:1,command:{action,turnId:view.day!.turnId,...extra}});
  const move=(phase:string)=>{for(let i=0;i<40&&view.night!.phase!==phase;i++)supplement({kind:'advance'});assert.equal(view.night!.phase,phase);};
  supplement({kind:'advance'});move('wolves');night(1,'vote',{target:5});night(2,'vote',{target:5});supplement({kind:'advance'});move('witch');night(10,'witch',{choice:'skip',target:null});move('mechanical');night(3,'ability',{choice:'learn',target:10});night(3,'ability_finish');move('armor');night(4,'ability',{choice:'learn',target:3});night(4,'ability_finish');move('first_night_complete');supplement({kind:'enter-day'});day('close_signup');day('continue');day('continue');while(['death_skill','last_words'].includes(view.day!.phase))supplement({kind:'advance'});day('speech_mode',{mode:'free'});day('end_speech');day('start_vote',{method:'offline',visibility:'individual',seconds:30});day('close_vote');day('continue');supplement({kind:'enter-night'});move('mechanical');
  night(3,'ability',{choice:'poison',target:6});const oldTurn=view.night!.turnId,d=view.draft!;const before=view.roles.find(r=>r.seat===3)!.abilities!.skills.find(s=>s.kind==='poison')!;assert.equal(before.remaining,0);assert.equal(before.uses.length,1);assert.equal(view.roles.find(r=>r.seat===4)!.abilities!.skills.find(s=>s.kind==='poison')!.remaining,1);
  const returned=store.returnJudge(judge,id,{assignmentVersion:1,manualVersion:1,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),confirmed:true});const turn=returned.room.night!.turnId;assert.notEqual(turn,oldTurn);assert.equal(returned.room.control!.remainingMs,30000);assert.equal(store.nightPrivate(tokens[2],id).kind,'waiting');store.gameControl(judge,id,{action:'resume',confirmed:true,version:returned.room.control!.version});now+=5000;store.tickNights();
  assert.throws(()=>store.nightCommand(tokens[2],id,{action:'ability',turnId:oldTurn,choice:'poison',target:6}),/STALE_TURN/);assert.equal(store.nightPrivate(tokens[2],id).committed,true);store.nightCommand(tokens[2],id,{action:'ability',turnId:turn,choice:'poison',target:6});assert.throws(()=>store.nightCommand(tokens[2],id,{action:'ability',turnId:turn,choice:'poison',target:7}),/ALREADY_COMMITTED/);const inventory=store.judgePrivate(judge,id).roles.find(r=>r.seat===3)!.abilities!.skills.find(s=>s.kind==='poison')!;assert.equal(inventory.remaining,0);assert.equal(inventory.uses.length,1);store.nightCommand(tokens[2],id,{action:'ability_finish',turnId:turn});assert.equal(store.snapshot(id).night!.phase,'mechanical');assert.equal(store.nightPrivate(tokens[2],id).seen,true);now=store.snapshot(id).night!.deadline!;store.tickNights();assert.equal(store.snapshot(id).night!.phase,'eyes_closed');
 }finally{store.close();}
});

for(const method of ['offline','phone'] as const)test(`return preserves ${method} voting submissions and its actual default timer`,()=>{
 const f=automaticDeaths();try{
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');while(['death_skill','last_words'].includes(f.store.snapshot(f.id).day!.phase)){f.clock.now=f.store.snapshot(f.id).day!.deadline!;f.store.tickNights();}dayHost(f,'speech_mode',{mode:'free'});dayHost(f,'end_speech');dayHost(f,'start_vote',{method,visibility:'individual',seconds:45});if(method==='offline')dayHost(f,'offline_vote',{voter:1,target:2});else dayHost(f,'vote',{target:2});const original=f.store.snapshot(f.id).day!.turnId;f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5});f.store.switchManual(f.host,f.id,true);const v=f.store.judgePrivate(f.players[4],f.id),d=f.store.startJudgeDraft(f.players[4],f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,requestId:randomUUID()});
 const result=f.store.returnJudge(f.players[4],f.id,{assignmentVersion:1,manualVersion:v.manualVersion!,draftId:d.draft!.id,draftVersion:0,requestId:randomUUID(),confirmed:true});assert.equal(result.room.control!.remainingMs,method==='phone'?45000:null);assert.equal(result.room.day!.vote!.submittedCount,1);const turn=result.room.day!.turnId;
 f.store.gameControl(f.players[4],f.id,{action:'resume',confirmed:true,version:result.room.control!.version});f.clock.now+=5000;f.store.tickNights();assert.equal(f.store.snapshot(f.id).day!.deadline,method==='phone'?f.clock.now+45000:null);assert.equal(f.store.dayPrivate(f.host,f.id).myVote,2);assert.throws(()=>f.store.dayCommand(f.host,f.id,{action:'vote',turnId:original,target:2}),/STALE_TURN/);
 if(method==='phone'){assert.throws(()=>f.store.dayCommand(f.host,f.id,{action:'vote',turnId:turn,target:3}),/ALREADY_COMMITTED/);f.store.dayCommand(f.host,f.id,{action:'vote',turnId:turn,target:2});assert.equal(f.store.snapshot(f.id).day!.vote!.submittedCount,1);}
 }finally{f.store.close();}
});

for(const mode of ['running','paused','resuming','manual'] as const)test(`appointment ends nominee's ongoing player interjection while ${mode}, preserving speaker time and used budget`,()=>{
 const paused=mode!=='running';
 const f=automaticDeaths();try{
 dayHost(f,'close_signup');dayHost(f,'continue');dayHost(f,'continue');while(['death_skill','last_words'].includes(f.store.snapshot(f.id).day!.phase)){f.clock.now=f.store.snapshot(f.id).day!.deadline!;f.store.tickNights();}
 const row=f.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(f.id) as {state:string};const state=JSON.parse(row.state);state.players.find((p:{seat:number})=>p.seat===12).alive=false;state.deaths.push({seat:12,reason:'exile'});state.flippedIdiots=[12];state.revealed.push({seat:12,role:'idiot'});state.events.push({type:'death_exile',seat:12,at:f.clock.now});f.db.prepare('UPDATE day_games SET state=? WHERE room_id=?').run(JSON.stringify(state),f.id);
 dayHost(f,'speech_mode',{mode:'phone'});const original=f.store.snapshot(f.id).day!,remaining=original.deadline!-f.clock.now;f.store.dayCommand(f.players[11],f.id,{action:'interject',turnId:original.turnId});f.clock.now+=3000;
 if(mode==='manual'){f.store.switchManual(f.host,f.id,true);f.clock.now+=100000;}else if(paused){f.store.gameControl(f.host,f.id,{action:'pause',confirmed:true,version:f.store.snapshot(f.id).control!.version});if(mode==='resuming'){f.store.gameControl(f.host,f.id,{action:'resume',confirmed:true,version:f.store.snapshot(f.id).control!.version});f.clock.now+=2000;}else f.clock.now+=100000;}
 f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:12,...(mode==='manual'?{deathSkillsComplete:true as const}:{})});const result=f.store.snapshot(f.id);assert.equal(result.day!.interjection,null);assert.equal(result.day!.speaker,original.speaker);const saved=JSON.parse((f.db.prepare('SELECT state FROM day_games WHERE room_id=?').get(f.id) as {state:string}).state);assert.equal(saved.interjectionUsed[12],3000);assert.equal(result.day!.deadline,paused?null:f.clock.now+remaining);if(paused&&mode!=='manual'){assert.equal(result.control!.remainingMs,remaining);assert.equal(result.control!.status,mode);assert.equal((f.db.prepare('SELECT turn_id FROM room_controls WHERE room_id=?').get(f.id) as {turn_id:string}).turn_id,result.day!.turnId);}
 assert.ok(f.store.judgePrivate(f.players[11],f.id).audit.some(a=>a.action==='interjection-ended-for-appointment'));assert.throws(()=>f.store.dayCommand(f.players[11],f.id,{action:'interject',turnId:result.day!.turnId}),/JUDGE_PLAYER_ACTION/);
 }finally{f.store.close();}
});

test('retired judge knowledge cannot be converted into live player rights by a later manual death correction',()=>{
 const f=setup();try{
 death(f);f.store.appointJudge(f.host,f.id,{confirmed:true,version:0,seat:5,deathSkillsComplete:true});f.store.judgePrivate(f.players[4],f.id);
 const own=f.store.recordsList(f.host,f.id).own!;f.store.saveRecord(f.host,f.id,own.revision,{...emptyRecord(),deaths:[{seat:6,round:1,period:'night',cause:'knife'}]});f.store.commitManual(f.host,f.id,own.revision+1);f.store.appointJudge(f.host,f.id,{confirmed:true,version:1,seat:6,deathSkillsComplete:true});assert.throws(()=>f.store.judgePrivate(f.players[4],f.id),/JUDGE_ONLY/);const judge=f.players[5],version=f.store.snapshot(f.id).manual!.version;let view=f.store.startJudgeDraft(judge,f.id,{assignmentVersion:2,manualVersion:version,requestId:randomUUID()});
 const supplement=(operation:any)=>{const d=view.draft!;view=f.store.supplementJudge(judge,f.id,{assignmentVersion:2,manualVersion:version,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),operation});};supplement({kind:'advance'});for(const actorSeat of [1,2,3,4])supplement({kind:'night',actorSeat,command:{action:'vote',turnId:view.night!.turnId,target:6}});while(view.night!.phase!=='first_night_complete')supplement({kind:'advance'});supplement({kind:'enter-day'});for(const action of ['close_signup','continue','continue'])supplement({kind:'day',actorSeat:1,command:{action,turnId:view.day!.turnId}});while(['death_skill','last_words'].includes(view.day!.phase))supplement({kind:'advance'});
 const d=view.draft!;assert.equal(view.roles.find(r=>r.seat===5)!.alive,true);assert.throws(()=>f.store.returnJudge(judge,f.id,{assignmentVersion:2,manualVersion:version,draftId:d.id,draftVersion:d.version,requestId:randomUUID(),confirmed:true}),/JUDGE_KNOWLEDGE_CONFLICT/);assert.equal(f.store.snapshot(f.id).preparation.settings.gameMode,'manual');
 }finally{f.store.close();}
});
