import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import type {DayCommand} from '../packages/contracts/day.js';
type Command<T>=T extends unknown?Omit<T,'turnId'>:never;

for(const scenario of [{target:null,protected:false},{target:1,protected:false},{target:1,protected:true},{target:3,protected:false}] as const)test(`last mechanical idiot completes persisted extra night: target ${scenario.target}, protected ${scenario.protected}`,()=>{
 const {target,protected:protectedTarget}=scenario;
 const dir=mkdtempSync(join(tmpdir(),'wolf-extra-night-')),file=join(dir,'db');let now=1000,store=new LobbyStore(file,()=>42,false,()=>now);
 const tokens=['h','w','m','i','hunter','guard'],roles=['villager','wolf','mechanicalWolf','idiot','hunter','guard'] as const;
 try{
  const initial=store.create(tokens[0],'Synthetic host'),id=initial.room.id;
  store.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:6,roles:Object.fromEntries(roles.map(role=>[role,1]))}}});store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  tokens.forEach((t,i)=>{if(i)store.join(t,initial.room.code,t);store.select(t,id,i+1);store.setReady(t,id,true,store.snapshot(id).preparation.settingsRevision);});store.deal(tokens[0],id);tokens.forEach((t,i)=>store.submitIdentity(t,id,roles[i]));store.start(tokens[0],id);
  const n=()=>store.snapshot(id).night!,d=()=>store.snapshot(id).day!;
  function moveNight(phase:string){for(let i=0;i<30&&n().phase!==phase;i++){assert.notEqual(n().deadline,null);now=n().deadline!;store.tickNights();}assert.equal(n().phase,phase);}
  const command=(c:Command<DayCommand>)=>store.dayCommand(tokens[0],id,{...c,turnId:d().turnId} as DayCommand);
  function prepareVote(){store.enterDay(tokens[0],id);if(d().phase==='sheriff_signup')command({action:'close_signup'});command({action:'continue'});if(d().phase==='night_announcement')command({action:'continue'});assert.equal(d().phase,'day_direction');command({action:'speech_mode',mode:'free'});command({action:'end_speech'});command({action:'start_vote',method:'offline',visibility:'totals',seconds:5});}
  function exile(seat:number){command({action:'offline_results',counts:d().vote!.candidates.map(candidate=>({seat:candidate,votes:candidate===seat?1:0}))});command({action:'continue'});while(d().deadline!==null){now=d().deadline!;store.tickNights();}assert.equal(d().phase,'day_complete');}
  store.enterNight(tokens[0],id);moveNight('mechanical');store.nightCommand(tokens[2],id,{action:'ability',turnId:n().turnId,choice:'learn',target:4});moveNight('first_night_complete');prepareVote();exile(2);
  store.enterNight(tokens[0],id);moveNight('first_night_complete');prepareVote();exile(3);
  assert.equal(d().winner,null);assert.deepEqual(d().revealed,[{seat:3,role:'idiot'}]);assert.equal(JSON.stringify(d()).includes('extraNight'),false);
  store.close();store=new LobbyStore(file,()=>42,false,()=>now);
  store.enterNight(tokens[0],id);
  if(protectedTarget){moveNight('guard');store.nightCommand(tokens[5],id,{action:'ability',turnId:n().turnId,choice:'guard',target:1});}
  moveNight('wolves');assert.deepEqual(store.nightPrivate(tokens[2],id).wolves,[3]);assert.equal(store.nightPrivate(tokens[1],id).kind,'waiting');
  store.nightCommand(tokens[2],id,{action:'vote',turnId:n().turnId,target});store.nightCommand(tokens[2],id,{action:'confirm_wolves',turnId:n().turnId});moveNight('first_night_complete');
  store.enterDay(tokens[0],id);command({action:'continue'});assert.equal(d().phase,'ended');assert.equal(d().winner,target===1&&!protectedTarget?'wolves':'good');assert.equal(d().revealed.find(p=>p.seat===3)?.role,'mechanicalWolf');
 }finally{store.close();rmSync(dir,{recursive:true});}
});
