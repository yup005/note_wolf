import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';
import type {DayCommand} from '../packages/contracts/day.js';
import {roles} from './wolf-girl-fixture.js';

test('complete wolf-girl automatic game archives personal defeat and rematches without carrying confession',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now),tokens=roles.map(()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));
 try{
  const room=s.create(tokens[0],'Synthetic complete').room,id=room.id;s.configureBoard(tokens[0],id,{selection:{kind:'preset',id:'wolf-girl-12'},settingsRevision:0});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  for(let i=0;i<12;i++){if(i)s.join(tokens[i],room.code,'Synthetic '+i);s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);}s.deal(tokens[0],id);roles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);
  const day=(body:Record<string,unknown>,seat=1)=>s.dayCommand(tokens[seat-1],id,{...body,turnId:s.snapshot(id).day!.turnId} as DayCommand);
  for(let round=1;round<=4;round++){
   s.enterNight(tokens[0],id);
   if(round===1){while(s.snapshot(id).night!.phase!=='confession'){now=s.snapshot(id).night!.deadline!;s.tickNights();}s.nightCommand(tokens[3],id,{action:'confess',target:5,turnId:s.snapshot(id).night!.turnId});}
   now+=1000000;s.tickNights();assert.equal(s.snapshot(id).night!.phase,'first_night_complete');s.enterDay(tokens[0],id);if(round===1)day({action:'close_signup'});day({action:'continue'});day({action:'continue'});day({action:'speech_mode',mode:'free'});
   if(round===4){day({action:'explode',confirmed:true},4);break;}
   day({action:'end_speech'});day({action:'start_vote',method:'offline',visibility:'individual',seconds:30});day({action:'offline_vote',voter:5,target:round});day({action:'close_vote'});day({action:'continue'});
   while(['death_skill','last_words'].includes(s.snapshot(id).day!.phase)){if(s.snapshot(id).day!.phase==='last_words')day({action:'end_speech'});else{now=s.snapshot(id).day!.deadline!;s.tickNights();}}
   assert.equal(s.snapshot(id).day!.phase,'day_complete');
  }
  const old=s.snapshot(id).gameId;assert.equal(s.snapshot(id).day!.winner,'good');const replay=s.gameReplay(tokens[0],old);assert.equal(replay.rounds.length,8);assert.equal(replay.personalResults!.find(p=>p.seat===5)!.won,false);
  s.saveFavorite(tokens[0],old);assert.deepEqual(s.favoriteReplay(tokens[0],old).rounds,replay.rounds);
  const next=s.rematch(tokens[0],id,{requestId:randomUUID(),expectedGameId:old});assert.notEqual(next.game.gameId,old);assert.equal(s.snapshot(id).board.composition.ruleset,'wolf-girl');assert.deepEqual(s.gameReplay(tokens[0],old),replay);
  for(let i=0;i<12;i++)s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);s.deal(tokens[0],id);roles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);s.enterNight(tokens[0],id);while(s.snapshot(id).night!.phase!=='confession'){now=s.snapshot(id).night!.deadline!;s.tickNights();}assert.equal(s.nightPrivate(tokens[3],id).kind,'confession');assert.equal(s.nightPrivate(tokens[3],id).committed,undefined);assert.deepEqual(s.gameReplay(tokens[0],old),replay);
 }finally{s.close();}
});
