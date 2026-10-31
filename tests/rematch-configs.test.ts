import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';
import {emptyRecord} from '../packages/contracts/records.js';
import {isWolfRole} from '../packages/contracts/board.js';
import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';
for(const preset of ['mechanical-12','mechanical-armor-12'] as const)test(`${preset} rematch retains full board and allows mode change before dealing`,()=>{
 const s=new LobbyStore(':memory:');const token=randomBytes(32).toString('hex');s.issueSession(token);
 try{
  const id=s.create(token,'合成房主').room.id;s.configure(token,id,{dealMethod:'online',gameMode:'manual'});
  s.configureBoard(token,id,{settingsRevision:s.snapshot(id).preparation.settingsRevision,selection:{kind:'preset',id:preset}});s.select(token,id,1);
  const players=fillRealPlayers(s,token,id);s.setReady(token,id,true,s.snapshot(id).preparation.settingsRevision);s.deal(token,id);confirmRealPlayers(s,id,players);s.confirmIdentity(token,id);s.start(token,id);
  const draft=s.recordsList(token,id).own!,deaths=players.flatMap((t,i)=>isWolfRole(s.identity(t,id).role!)?[{seat:i+1,round:1,period:'night' as const,cause:'unrecorded' as const}]:[]);
  const saved=s.saveRecord(token,id,draft.revision,{...emptyRecord(),deaths});s.commitManual(token,id,saved.revision);assert.equal(s.snapshot(id).manual!.status,'ended');
  const board=s.snapshot(id).board,next=s.rematch(token,id,{requestId:randomUUID(),expectedGameId:id});assert.deepEqual(next.view.room.board,board);
  s.configure(token,id,{dealMethod:'physical',gameMode:'automatic'});assert.equal(s.snapshot(id).preparation.settings.gameMode,'automatic');assert.ok(s.snapshot(id).seats.every(seat=>!seat.ready));
  assert.throws(()=>s.deal(token,id),/NOT_ALL_READY/);assert.deepEqual(s.recordContext(token,id).board,board);
 }finally{s.close();}
});
test('wolf-free manual record-only ending rematches without inventing a winner',()=>{
 const s=new LobbyStore(':memory:'),token=randomBytes(32).toString('hex');s.issueSession(token);
 try{
  const id=s.create(token,'合成房主').room.id;s.configure(token,id,{dealMethod:'online',gameMode:'manual'});
  s.configureBoard(token,id,{settingsRevision:s.snapshot(id).preparation.settingsRevision,selection:{kind:'composition',composition:{seatCount:1,roles:{villager:1}}}});
  s.select(token,id,1);s.setReady(token,id,true,s.snapshot(id).preparation.settingsRevision);s.deal(token,id);s.confirmIdentity(token,id);s.start(token,id);const draft=s.recordsList(token,id).own!;
  s.finishManualRecord(token,id,{version:0,revision:draft.revision,confirmed:true});const p=s.publishRecord(token,id,draft.revision);
  s.rematch(token,id,{requestId:randomUUID(),expectedGameId:id});const old=s.recordPost(token,p.id);assert.equal(old.outcome,null);assert.equal(old.outcomeSource,'record-only');assert.equal(s.snapshot(id).manual,null);
 }finally{s.close();}
});
