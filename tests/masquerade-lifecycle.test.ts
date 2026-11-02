import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';
import type Database from 'better-sqlite3';
import {emptyRecord} from '../packages/contracts/records.js';
import {roles} from './masquerade-fixture.js';
test('same-room rematch retains masquerade board and archive while resetting all private histories',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now),tokens=roles.map(()=>randomUUID());tokens.forEach(t=>s.issueSession(t));const room=s.create(tokens[0],'合成舞会').room,id=room.id;
 const prepare=()=>{const revision=s.snapshot(id).preparation.settingsRevision;roles.forEach((role,i)=>{s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,revision);});s.deal(tokens[0],id);roles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);};
 const db=(s as unknown as {db:Database.Database}).db;const engine=()=>JSON.parse((db.prepare('SELECT state FROM night_games WHERE room_id=?').get(id) as {state:string}).state).engine;
 try{s.configureBoard(tokens[0],id,{selection:{kind:'preset',id:'masquerade-12'},settingsRevision:0});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});for(let i=1;i<12;i++)s.join(tokens[i],room.code,'合成'+i);prepare();s.enterNight(tokens[0],id);now+=500000;s.tickNights();s.enterDay(tokens[0],id);
 const day=(body:Record<string,unknown>)=>s.dayCommand(tokens[0],id,{turnId:s.snapshot(id).day!.turnId,...body} as never);day({action:'close_signup'});while(s.snapshot(id).day!.phase!=='day_direction')day({action:'continue'});day({action:'speech_mode',mode:'free'});day({action:'end_speech'});day({action:'start_vote',method:'offline',visibility:'totals',seconds:30});day({action:'offline_results',counts:s.snapshot(id).day!.vote!.candidates.map(seat=>({seat,votes:0}))});day({action:'continue'});s.enterNight(tokens[0],id);
 const command=(seat:number,body:Record<string,unknown>)=>s.nightCommand(tokens[seat-1],id,{turnId:s.snapshot(id).night!.turnId,requestId:randomUUID(),...body} as never);command(12,{action:'dance_confirm',targets:[5,6,7],expectedRevision:0});now=s.snapshot(id).night!.deadline!;s.tickNights();command(4,{action:'mask_confirm',step:'inspect',target:8,expectedRevision:0});command(4,{action:'mask_confirm',step:'mask',target:9,expectedRevision:1});assert.equal(engine().masquerade.danced.length,3);assert.equal(engine().masquerade.inspected.length,1);assert.equal(engine().masquerade.masked.length,1);
 s.switchManual(tokens[0],id,true);const draft=s.recordsList(tokens[0],id).own!;const saved=s.saveRecord(tokens[0],id,draft.revision,{...emptyRecord(),deaths:[1,2,3,4].map(seat=>({seat,round:2,period:'night',cause:'unrecorded'}))});s.commitManual(tokens[0],id,saved.revision);const next=s.rematch(tokens[0],id,{requestId:randomUUID(),expectedGameId:id});assert.equal(next.view.room.board.id,'masquerade-12');s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});prepare();s.enterNight(tokens[0],id);assert.equal(engine().night,1);for(const key of ['danced','inspected','masked'])assert.deepEqual(engine().masquerade[key],[]);assert.equal(s.recordContext(tokens[0],id).board!.id,'masquerade-12');
 }finally{s.close();}
});
