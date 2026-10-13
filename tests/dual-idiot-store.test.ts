import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {LobbyStore} from '../packages/storage/lobby.js';
import {emptyRecord,type RecordDocument} from '../packages/contracts/records.js';
import type {DayCommand} from '../packages/contracts/day.js';
import type {BoardComposition} from '../packages/contracts/board.js';
const roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','villager','villager','seer','witch','hunter','idiot'] as const;
const dual:BoardComposition={seatCount:14,roles:{wolf:4,villager:6,seer:1,witch:1,hunter:1,idiot:1},idiotPolicy:'dual-category-14'};
function setup(s:LobbyStore,mode:'automatic'|'manual'='manual'){
 const tokens=roles.map((_,i)=>'dual-player-'+i);tokens.forEach(t=>s.issueSession(t));const room=s.create(tokens[0],'Host').room;
 s.configureBoard(tokens[0],room.id,{settingsRevision:0,selection:{kind:'composition',composition:dual}});
 s.configure(tokens[0],room.id,{dealMethod:'physical',gameMode:mode});
 roles.forEach((_,i)=>{if(i)s.join(tokens[i],room.code,'Synthetic '+i);s.select(tokens[i],room.id,i+1);s.setReady(tokens[i],room.id,true,2);});s.deal(tokens[0],room.id);roles.forEach((role,i)=>s.submitIdentity(tokens[i],room.id,role));s.start(tokens[0],room.id);return {id:room.id,tokens};
}
const document=(dead:number[]):RecordDocument=>({...emptyRecord(),exiles:[{round:1,seat:14}],deaths:dead.map(seat=>({seat,round:2,period:'night',cause:'unrecorded'}))});

test('dual saved templates and room snapshots retain explicit policy through restart and standard selection',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-dual-boards-')),file=join(dir,'db');let s=new LobbyStore(file);try{
  s.issueSession('h');const saved=s.saveBoard('h',{id:null,revision:0,name:'Dual',composition:dual});const room=s.create('h','H').room;s.configureBoard('h',room.id,{settingsRevision:0,selection:{kind:'custom',id:saved.id}});
  assert.equal(s.snapshot(room.id).board.composition.idiotPolicy,'dual-category-14');s.close();s=new LobbyStore(file);assert.equal(s.boardLibrary('h').custom[0].composition.idiotPolicy,'dual-category-14');
  s.configureBoard('h',room.id,{settingsRevision:1,selection:{kind:'preset',id:'standard-12'}});assert.equal(s.snapshot(room.id).board.composition.idiotPolicy,undefined);assert.equal(s.boardLibrary('other').custom.length,0);
 }finally{s.close();rmSync(dir,{recursive:true});}
});

for(const dealMethod of ['online','physical'] as const)test(`wolf-free ${dealMethod} preparation rejects automatic then permits manual recording`,()=>{
 const s=new LobbyStore(':memory:');try{
  const room=s.create('h','H').room;s.configureBoard('h',room.id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:2,roles:{villager:1,witch:1}}}});s.configure('h',room.id,{gameMode:'automatic',dealMethod});
  s.join('p',room.code,'P');for(const [i,t] of ['h','p'].entries()){s.select(t,room.id,i+1);s.setReady(t,room.id,true,s.snapshot(room.id).preparation.settingsRevision);}
  assert.throws(()=>s.deal('h',room.id),/WOLF_FREE_MANUAL_ONLY/);assert.equal(s.snapshot(room.id).preparation.phase,'lobby');
  s.configure('h',room.id,{gameMode:'manual',dealMethod});for(const t of ['h','p'])s.setReady(t,room.id,true,s.snapshot(room.id).preparation.settingsRevision);s.deal('h',room.id);
  if(dealMethod==='physical'){s.submitIdentity('h',room.id,'villager');s.submitIdentity('p',room.id,'witch');}else for(const t of ['h','p'])s.confirmIdentity(t,room.id);
  s.start('h',room.id);assert.equal(s.snapshot(room.id).manual!.winner,null);s.recordsList('h',room.id);s.saveRecord('h',room.id,0,{...emptyRecord(),deaths:[{seat:1,round:1,period:'night',cause:'unrecorded'},{seat:2,round:1,period:'night',cause:'unrecorded'}]});s.commitManual('h',room.id,1);assert.equal(s.snapshot(room.id).manual!.winner,null);assert.throws(()=>s.enterNight('h',room.id),/NIGHT_UNAVAILABLE/);
 }finally{s.close();}
});

test('all-wolf configuration cannot deal in either mode',()=>{
 const s=new LobbyStore(':memory:');try{
  const id=s.create('h','H').room.id;s.configureBoard('h',id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:1,roles:{wolf:1}}}});s.select('h',id,1);
  for(const mode of ['automatic','manual'] as const){s.configure('h',id,{gameMode:mode,dealMethod:'online'});s.setReady('h',id,true,s.snapshot(id).preparation.settingsRevision);assert.throws(()=>s.deal('h',id),/INVALID_BOARD_FACTIONS/);assert.equal(s.snapshot(id).preparation.phase,'lobby');}
 }finally{s.close();}
});

test('manual dual official facts distinguish flip from death and archive policy after room deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-dual-record-')),file=join(dir,'db');let s=new LobbyStore(file);try{
  const {id,tokens:t}=setup(s);s.recordsList(t[0],id);s.saveRecord(t[0],id,0,document([5,6,7,8,9,10]));s.commitManual(t[0],id,1);assert.equal(s.snapshot(id).manual!.winner,null);assert.equal(s.snapshot(id).manual!.dead.includes(14),false);
  s.saveRecord(t[0],id,1,document([5,6,7,8,9,10,14]));s.commitManual(t[0],id,2);assert.equal(s.snapshot(id).manual!.winner,'wolves');const post=s.publishRecord(t[0],id,2);assert.equal(s.recordPost(t[0],post.id).outcome,'wolves');
  s.close();const db=new Database(file);db.pragma('foreign_keys=ON');db.prepare('DELETE FROM rooms WHERE id=?').run(id);db.close();s=new LobbyStore(file);
  s.saveRecord(t[0],id,2,document([11,12,13]));s.commitManual(t[0],id,3);s.publishRecord(t[0],id,3);assert.equal(s.recordPost(t[0],post.id).outcome,'wolves');assert.equal(s.recordPost(t[1],post.id,1).document.deaths.length,7);
 }finally{s.close();rmSync(dir,{recursive:true});}
});

test('official dual flip edits must be committed before publishing a different computed outcome',()=>{
 const s=new LobbyStore(':memory:');try{
  const {id,tokens:t}=setup(s);s.recordsList(t[0],id);s.saveRecord(t[0],id,0,document([11,12,13]));s.commitManual(t[0],id,1);const post=s.publishRecord(t[0],id,1);assert.equal(s.recordPost(t[1],post.id).outcome,'wolves');
  s.saveRecord(t[0],id,1,{...document([11,12,13]),exiles:[]});assert.throws(()=>s.publishRecord(t[0],id,2),/OFFICIAL_UNCOMMITTED/);assert.equal(s.recordPost(t[1],post.id).outcome,'wolves');
  s.commitManual(t[0],id,2);s.publishRecord(t[0],id,2);assert.equal(s.recordPost(t[1],post.id).outcome,null);assert.equal(s.recordPost(t[1],post.id,1).outcome,'wolves');
 }finally{s.close();}
});

test('legacy started wolf-free automatic rooms remain readable although new automatic starts are blocked',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-legacy-no-wolf-')),file=join(dir,'db');let s=new LobbyStore(file);try{
  s.issueSession('h');const id=s.create('h','H').room.id;s.configureBoard('h',id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:1,roles:{villager:1}}}});s.select('h',id,1);const member=s.view('h',id).me.id;s.close();
  const db=new Database(file);db.prepare("UPDATE preparations SET phase='started' WHERE room_id=?").run(id);db.prepare("INSERT INTO identities(room_id,member_id,role,confirmed) VALUES (?,?,'villager',1)").run(id,member);db.close();s=new LobbyStore(file);
  assert.equal(s.view('h',id).room.preparation.validation,'valid');assert.equal(s.identity('h',id).role,'villager');
 }finally{s.close();rmSync(dir,{recursive:true});}
});

test('switching to manual imports a public dual flip as exile, never physical death or private role data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-dual-switch-')),file=join(dir,'db');let now=1000,s=new LobbyStore(file,()=>42,false,()=>now);try{
  const {id,tokens:t}=setup(s,'automatic');const n=()=>s.snapshot(id).night!,d=()=>s.snapshot(id).day!;
  function moveNight(){for(let i=0;i<30&&n().phase!=='first_night_complete';i++){now=n().deadline!;s.tickNights();}assert.equal(n().phase,'first_night_complete');}
  type Command<T>=T extends unknown?Omit<T,'turnId'>:never;
  const c=(command:Command<DayCommand>)=>s.dayCommand(t[0],id,{...command,turnId:d().turnId} as DayCommand);
  s.enterNight(t[0],id);moveNight();s.enterDay(t[0],id);c({action:'close_signup'});c({action:'continue'});c({action:'continue'});c({action:'speech_mode',mode:'free'});c({action:'end_speech'});c({action:'start_vote',method:'offline',visibility:'totals',seconds:5});c({action:'offline_results',counts:d().vote!.candidates.map(seat=>({seat,votes:seat===14?1:0}))});c({action:'continue'});
  assert.equal(d().phase,'day_complete');assert.equal(d().alive.includes(14),true);s.close();s=new LobbyStore(file,()=>42,false,()=>now);
  s.switchManual(t[0],id,true);const imported=s.recordsList(t[0],id).own!;assert.deepEqual(imported.document.exiles,[{round:1,seat:14}]);assert.equal(imported.document.deaths.some(x=>x.seat===14),false);assert.equal(JSON.stringify(s.snapshot(id)).includes('originalRole'),false);
  s.saveRecord(t[0],id,imported.revision,{...imported.document,deaths:[11,12,13].map(seat=>({seat,round:2,period:'night',cause:'unrecorded'}))});s.commitManual(t[0],id,imported.revision+1);assert.equal(s.snapshot(id).manual!.winner,'wolves');
 }finally{s.close();rmSync(dir,{recursive:true});}
});
