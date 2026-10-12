import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LobbyStore} from '../packages/storage/lobby.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import type {Role} from '../packages/contracts/index.js';
for(const dealMethod of ['online','physical'] as const)for(const gameMode of ['automatic','manual'] as const)test(`15 seats ${dealMethod}/${gameMode} deal, identity privacy, roster and restart`,()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-mechanical-'));const path=join(dir,'db');let store=new LobbyStore(path);
 try{
  const id=store.create('h','Host').room.id;
  const config=boardPreset('mechanical-expanded-15');store.configureBoard('h',id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:config.seatCount,roles:config.roles}}});
  store.configure('h',id,{dealMethod,gameMode});const room=store.snapshot(id);const tokens=['h',...Array.from({length:14},(_,i)=>`p${i}`)];
  tokens.forEach((t,i)=>{if(i)store.join(t,room.code,t);store.select(t,id,i+1);store.setReady(t,id,true,store.snapshot(id).preparation.settingsRevision);});
  store.deal('h',id);const roles=Object.entries(boardPreset('mechanical-expanded-15').roles).flatMap(([role,count])=>Array<Role>(count!).fill(role as Role));
  if(dealMethod==='physical')tokens.forEach((t,i)=>store.submitIdentity(t,id,roles[i]));else tokens.forEach(t=>store.confirmIdentity(t,id));
  store.start('h',id);assert.equal(store.snapshot(id).preparation.phase,'started');assert.equal(store.snapshot(id).seats.length,15);
  const identities=tokens.map(t=>store.identity(t,id).role);assert.equal(identities.includes('mechanicalWolf'),true);assert.equal(identities.includes('spiritSeer'),true);
  assert.equal(JSON.stringify(store.snapshot(id)).includes('"role"'),false);
  store.close();store=new LobbyStore(path);assert.deepEqual(tokens.map(t=>store.identity(t,id).role),identities);
  if(gameMode==='automatic'){store.enterNight('h',id);assert.equal(store.snapshot(id).night?.phase,'guard');}
 }finally{store.close();rmSync(dir,{recursive:true});}
});
