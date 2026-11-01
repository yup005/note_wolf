import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {LobbyStore} from '../packages/storage/lobby.js';

test('random treasure deals survive repeated deal, keep secrets private and run first night through actual stores',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now),tokens=Array.from({length:12},()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));
 try{
  const {room}=s.create(tokens[0],'Synthetic treasure'),id=room.id;
  s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'preset',id:'treasure-12',treasureMode:'random'}});
  assert.equal(s.snapshot(id).board.composition.treasureMode,'random');
  for(let i=0;i<12;i++){if(i)s.join(tokens[i],room.code,'Synthetic '+i);s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);}
  s.deal(tokens[0],id);const cards=tokens.map(t=>s.identity(t,id));s.deal(tokens[0],id);assert.deepEqual(tokens.map(t=>s.identity(t,id)),cards);
  assert.equal(s.snapshot(id).preparation.validation,'valid');assert.equal(cards.filter(c=>c.role==='treasureMaster').length,1);
  const t=cards.findIndex(c=>c.role==='treasureMaster');assert.ok(cards[t].treasureCamp);for(let i=0;i<12;i++)if(i!==t)assert.equal(cards[i].treasureCamp,undefined);
  assert.equal(JSON.stringify(s.snapshot(id)).includes('bottoms'),false);
  tokens.forEach(token=>s.confirmIdentity(token,id));s.start(tokens[0],id);s.enterNight(tokens[0],id);assert.equal(s.snapshot(id).night!.phase,'hunter_signal');
  now+=1000000;s.tickNights();assert.equal(s.snapshot(id).night!.phase,'first_night_complete');s.enterDay(tokens[0],id);assert.equal(s.snapshot(id).day!.phase,'sheriff_signup');
  assert.equal(s.daySelf(tokens[t],id).treasureCamp,cards[t].treasureCamp);
 }finally{s.close();}
});
test('complete fixed-wolf game ends, produces final treasure recap and rematches without old bottom state',()=>{
 let now=1000;const s=new LobbyStore(':memory:',undefined,false,()=>now),tokens=Array.from({length:12},()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));
 try{
  const {room}=s.create(tokens[0],'Synthetic treasure full'),id=room.id;
  s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'preset',id:'treasure-12'}});
  for(let i=0;i<12;i++){if(i)s.join(tokens[i],room.code,'Synthetic '+i);s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);}
  s.deal(tokens[0],id);const cards=tokens.map(t=>s.identity(t,id));tokens.forEach(t=>s.confirmIdentity(t,id));s.start(tokens[0],id);
  const t=cards.findIndex(c=>c.role==='treasureMaster'),dreamer=cards.findIndex(c=>c.role==='dreamer'),civs=cards.flatMap((c,i)=>c.role==='villager'?[i+1]:[]),wolves=cards.flatMap((c,i)=>c.role==='wolf'||c.role==='blackWolf'?[i+1]:[]);wolves.push(t+1);
  const day=(body:Record<string,unknown>,seat=1)=>s.dayCommand(tokens[seat-1],id,{...body,turnId:s.snapshot(id).day!.turnId} as import('../packages/contracts/day.js').DayCommand);
  for(let round=1;round<=4;round++){
   s.enterNight(tokens[0],id);
   for(let i=0;i<35&&s.snapshot(id).night!.phase!=='first_night_complete';i++){
    const n=s.snapshot(id).night!;
    if(n.phase==='dreamer'&&dreamer>=0)s.nightCommand(tokens[dreamer],id,{action:'dream',turnId:n.turnId,target:civs[(round-1)%civs.length]});
    else if(n.phase==='treasure')s.nightCommand(tokens[t],id,{action:'treasure_card',turnId:n.turnId,card:round%2?'villager':'wolf'});
    else{now=n.deadline!;s.tickNights();}
   }
   assert.equal(s.snapshot(id).night!.phase,'first_night_complete');s.enterDay(tokens[0],id);
   if(round===1)day({action:'close_signup'});day({action:'continue'});day({action:'continue'});day({action:'speech_mode',mode:'free'});day({action:'end_speech'});day({action:'start_vote',method:'offline',visibility:'individual',seconds:30});day({action:'offline_vote',voter:civs[0],target:wolves[round-1]});day({action:'close_vote'});day({action:'continue'});
   if(round<4){while(['death_skill','last_words'].includes(s.snapshot(id).day!.phase)){if(s.snapshot(id).day!.phase==='last_words')day({action:'end_speech'});else{now=s.snapshot(id).day!.deadline!;s.tickNights();}}assert.equal(s.snapshot(id).day!.phase,'day_complete');}
  }
  assert.equal(s.snapshot(id).day!.winner,'good');const old=s.snapshot(id).gameId,replay=s.gameReplay(tokens[0],old);assert.equal(replay.rounds.length,8);assert.ok(replay.summary!.some(r=>r.lines.some(line=>line.includes('盗宝底牌'))));assert.equal(JSON.stringify(replay).includes('poisonSpent'),false);assert.equal(replay.personalResults!.find(p=>p.seat===t+1)!.won,false);
  s.rematch(tokens[0],id,{requestId:crypto.randomUUID(),expectedGameId:old});assert.deepEqual(s.gameReplay(tokens[0],old),replay);assert.equal(s.snapshot(id).preparation.phase,'lobby');assert.equal(s.snapshot(id).board.composition.treasureMode,'fixed-wolf');
  tokens.forEach(token=>s.setReady(token,id,true,s.snapshot(id).preparation.settingsRevision));s.deal(tokens[0],id);assert.equal(s.snapshot(id).preparation.validation,'valid');
 }finally{s.close();}
});
test('restart preserves dealt camp and chosen bottom without re-randomizing or exposing other identities',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'treasure-restart-')),path=join(dir,'test.db');
 let now=1000,s=new LobbyStore(path,undefined,false,()=>now);const tokens=Array.from({length:12},()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));
 try{
  const {room}=s.create(tokens[0],'Synthetic restart'),id=room.id;s.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'preset',id:'treasure-12',treasureMode:'random'}});
  for(let i=0;i<12;i++){if(i)s.join(tokens[i],room.code,'Synthetic '+i);s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);}s.deal(tokens[0],id);const cards=tokens.map(t=>s.identity(t,id)),t=cards.findIndex(c=>c.role==='treasureMaster');
  s.close();s=new LobbyStore(path,undefined,false,()=>now);assert.deepEqual(tokens.map(token=>s.identity(token,id)),cards);tokens.forEach(token=>s.confirmIdentity(token,id));s.start(tokens[0],id);s.enterNight(tokens[0],id);
  for(let i=0;i<20&&s.snapshot(id).night!.phase!=='treasure';i++){now=s.snapshot(id).night!.deadline!;s.tickNights();}
  const turnId=s.snapshot(id).night!.turnId;const others=tokens.findIndex((_,i)=>i!==t);assert.throws(()=>s.nightCommand(tokens[others],id,{action:'treasure_card',card:'villager',turnId}),/NOT_YOUR_TURN/);
  s.nightCommand(tokens[t],id,{action:'treasure_card',card:'villager',turnId});s.close();s=new LobbyStore(path,undefined,false,()=>now);s.nightCommand(tokens[t],id,{action:'treasure_card',card:'villager',turnId});now+=1000000;s.tickNights();s.enterDay(tokens[0],id);
  assert.equal(s.daySelf(tokens[t],id).treasureCard,'villager');assert.equal(s.daySelf(tokens[t],id).treasureCamp,cards[t].treasureCamp);assert.equal(JSON.stringify(s.snapshot(id)).includes('bottoms'),false);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
