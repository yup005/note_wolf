import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {DayCommand} from '../packages/contracts/day.js';
import {manualGame,prepareManual} from './helpers/rematch.js';
test('two complete automatic games retain independent final replay and favorites',()=>{
 let now=1000;const {s,tokens:t,id}=manualGame(':memory:',()=>now,'automatic');
 const play=()=>{
  const d=(body:Record<string,unknown>)=>s.dayCommand(t[0],id,{...body,turnId:s.snapshot(id).day!.turnId} as DayCommand);
  for(let wolf=1;wolf<=4;wolf++){
   s.enterNight(t[0],id);now+=500000;s.tickNights();s.enterDay(t[0],id);
   if(s.snapshot(id).day!.phase==='sheriff_signup')d({action:'close_signup'});
   d({action:'continue'});d({action:'continue'});d({action:'speech_mode',mode:'free'});d({action:'end_speech'});
   d({action:'start_vote',method:'offline',visibility:'individual',seconds:30});d({action:'offline_vote',voter:5,target:wolf});d({action:'close_vote'});d({action:'continue'});
   while(['death_skill','last_words'].includes(s.snapshot(id).day!.phase)){
    if(s.snapshot(id).day!.phase==='last_words')d({action:'end_speech'});else {now=s.snapshot(id).day!.deadline!;s.tickNights();}
   }
  }
  assert.equal(s.snapshot(id).day!.phase,'ended');
 };
 try{
  play();const first=s.gameReplay(t[0],id);assert.equal(first.rounds.length,8);
  const draft=s.recordsList(t[0],id).own!;s.commitManual(t[0],id,draft.revision);
  const next=s.rematch(t[0],id,{requestId:randomUUID(),expectedGameId:id});assert.deepEqual(s.gameReplay(t[0],id),first);
  s.saveFavorite(t[0],id);s.configure(t[0],id,{dealMethod:'physical',gameMode:'automatic'});prepareManual(s,id,t);play();const second=s.gameReplay(t[0],next.game.gameId);s.saveFavorite(t[0],next.game.gameId);
  assert.equal(second.rounds.length,8);assert.equal(s.favorites(t[0]).length,2);assert.deepEqual(s.favoriteReplay(t[0],id),{...first,saved:true});
  s.rematch(t[0],id,{requestId:randomUUID(),expectedGameId:next.game.gameId});assert.deepEqual(s.gameReplay(t[0],next.game.gameId),second);
 }finally{s.close();}
});
