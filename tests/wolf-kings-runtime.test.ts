import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import {LobbyStore} from '../packages/storage/lobby.js';
import type {BoardRole} from '../packages/contracts/board.js';
import type {DayCommand} from '../packages/contracts/day.js';
import {summarizeReplay} from '../packages/domain/replay.js';
const roles:BoardRole[]=['villager','whiteWolf','blackWolf','mechanicalWolf','armoredWolf','wolf','guard','witch','seer','hunter','villager','villager'];
function prepare(store:LobbyStore,tokens:string[]){
 const initial=store.create(tokens[0],'Synthetic king host'),id=initial.room.id;
 store.configureBoard(tokens[0],id,{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:roles.length,roles:Object.fromEntries([...new Set(roles)].map(role=>[role,roles.filter(r=>r===role).length]))}}});store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
 tokens.forEach((token,i)=>{if(i)store.join(token,initial.room.code,`Synthetic ${i}`);store.select(token,id,i+1);store.setReady(token,id,true,store.snapshot(id).preparation.settingsRevision);});store.deal(tokens[0],id);tokens.forEach((token,i)=>store.submitIdentity(token,id,roles[i]));store.start(tokens[0],id);return id;
}
const noSecrets=(value:unknown)=>{const serialized=JSON.stringify(value);for(const key of ['engine','learning','abilities','mimickedRole','copiedFrom','sourceSnapshot'])assert.equal(serialized.includes('"'+key+'"'),false,key);};
type Command<T>=T extends unknown?Omit<T,'turnId'>:never;

test('copied kings persist public targets through pause/restart and isolate HTTP/socket privileges',{timeout:20000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-kings-http-')),file=join(dir,'db');let now=1000,app=await createServer({dbPath:file,now:()=>now}),socket:Socket|undefined;
 const listen=async()=>{await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));const address=app.http.address();assert.ok(address&&typeof address!=='string');return `http://127.0.0.1:${address.port}`;};let base=await listen();
 const request=(cookie:string,path:string,data?:unknown)=>fetch(base+path,{method:data===undefined?'GET':'POST',headers:{cookie,...(data===undefined?{}:{'content-type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});
 const json=async(cookie:string,path:string,data?:unknown)=>{const r=await request(cookie,path,data);assert.equal(r.status,200,await r.clone().text());return r.json();};
 try{
  const cookies:string[]=[];for(let i=0;i<=roles.length;i++)cookies.push((await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0]);const tokens=cookies.map(c=>c.split('=')[1]),host=cookies[0],id=prepare(app.store,tokens.slice(0,roles.length)),path='/api/rooms/'+id;
  const n=()=>app.store.snapshot(id).night!,d=()=>app.store.snapshot(id).day!;
  async function move(phase:string){for(let i=0;i<30&&n().phase!==phase;i++){assert.notEqual(n().deadline,null);now=n().deadline!;noSecrets(await json(host,path));}assert.equal(n().phase,phase);}
  await json(host,path+'/night/enter',{});await json(cookies[6],path+'/night/command',{action:'ability',choice:'guard',target:5,turnId:n().turnId});await move('mechanical');await json(cookies[3],path+'/night/command',{action:'ability',choice:'learn',target:2,turnId:n().turnId});await move('armor');await json(cookies[4],path+'/night/command',{action:'ability',choice:'learn',target:3,turnId:n().turnId});await move('first_night_complete');await json(host,path+'/day/enter',{});
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:host},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});noSecrets(await new Promise(resolve=>socket!.emit('room:subscribe',{roomId:id},resolve)));socket.on('room:snapshot',noSecrets);
  assert.equal((await request(host,path+'/day/command',{action:'explode',confirmed:true,turnId:d().turnId})).status,403);
  await json(cookies[3],path+'/day/command',{action:'explode',confirmed:true,turnId:d().turnId});assert.equal(d().phase,'white_wolf_target');assert.equal(d().revealed.find(p=>p.seat===4)?.role,'whiteWolf');noSecrets(d());const carryTurn=d().turnId;
  assert.equal((await request(cookies[4],path+'/day/command',{action:'record_take',target:5,turnId:carryTurn})).status,403);assert.equal((await request(cookies[12],path+'/day/private')).status,403);assert.equal((await request(host,path+'/day/private?seat=4')).status,400);assert.equal((await request(host,path+'/replay')).status,409);
  app.store.gameControl(tokens[0],id,{action:'pause',confirmed:true,version:app.store.snapshot(id).control!.version});assert.equal((await request(host,path+'/day/command',{action:'record_take',target:5,turnId:carryTurn})).status,409);assert.equal(app.store.dayPrivate(tokens[3],id).canExplode,false);
  socket.disconnect();socket=undefined;await app.close();app=await createServer({dbPath:file,now:()=>now});base=await listen();assert.equal(d().phase,'white_wolf_target');assert.equal(d().turnId,carryTurn);assert.equal(app.store.snapshot(id).control!.status,'paused');app.store.gameControl(tokens[0],id,{action:'resume',confirmed:true,version:app.store.snapshot(id).control!.version});now=app.store.snapshot(id).control!.resumeAt!;app.store.tickNights();
  await json(host,path+'/day/command',{action:'record_take',target:5,turnId:carryTurn});assert.equal(d().phase,'death_skill');assert.equal(d().alive.includes(5),false);assert.equal(app.store.dayPrivate(tokens[4],id).canShoot,true);assert.equal((await request(host,path+'/day/command',{action:'record_take',target:9,turnId:carryTurn})).status,409);
  await json(cookies[4],path+'/day/command',{action:'shoot',turnId:d().turnId});assert.equal(d().revealed.find(p=>p.seat===5)?.role,'blackWolf');await json(host,path+'/day/command',{action:'record_shot',target:9,turnId:d().turnId});while(d().deadline!==null){now=d().deadline!;app.store.tickNights();}assert.equal(d().phase,'day_complete');assert.equal(d().alive.includes(9),false);noSecrets(await json(host,path));
  app.store.enterNight(tokens[0],id);await move('first_night_complete');app.store.enterDay(tokens[0],id);if(d().phase==='sheriff_signup')app.store.dayCommand(tokens[0],id,{action:'close_signup',turnId:d().turnId});app.store.dayCommand(tokens[0],id,{action:'continue',turnId:d().turnId});app.store.dayCommand(tokens[0],id,{action:'continue',turnId:d().turnId});assert.equal(d().phase,'day_direction');
  const draft=app.store.recordsList(tokens[0],id).own!;const imported=app.store.importAutomaticRecord(tokens[0],id,draft.revision);assert.deepEqual(imported.document.deaths.map(d=>d.cause),['unrecorded','unrecorded','unrecorded']);assert.throws(()=>app.store.gameReplay(tokens[0],id),/PHASE_LOCKED/);
 }finally{socket?.disconnect();await app.close();rmSync(dir,{recursive:true});}
});

test('settled invincible armor guard never protects a daytime king carry',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-kings-shield-'));let now=1000;const store=new LobbyStore(join(dir,'db'),()=>42,false,()=>now),tokens=roles.map((_,i)=>'t'+i);
 try{const id=prepare(store,tokens),n=()=>store.snapshot(id).night!,d=()=>store.snapshot(id).day!;const move=(phase:string)=>{for(let i=0;i<30&&n().phase!==phase;i++){now=n().deadline!;store.tickNights();}assert.equal(n().phase,phase);};const cmd=(c:Command<DayCommand>)=>store.dayCommand(tokens[0],id,{...c,turnId:d().turnId} as DayCommand);
 store.enterNight(tokens[0],id);move('mechanical');store.nightCommand(tokens[3],id,{action:'ability',choice:'learn',target:7,turnId:n().turnId});move('first_night_complete');store.enterDay(tokens[0],id);cmd({action:'close_signup'});cmd({action:'continue'});cmd({action:'continue'});cmd({action:'speech_mode',mode:'free'});store.dayCommand(tokens[5],id,{action:'explode',confirmed:true,turnId:d().turnId});cmd({action:'continue'});while(d().deadline!==null){now=d().deadline!;store.tickNights();}assert.equal(d().phase,'day_complete');
 store.enterNight(tokens[0],id);move('guard');store.nightCommand(tokens[6],id,{action:'ability',choice:'guard',target:1,turnId:n().turnId});move('mechanical');store.nightCommand(tokens[3],id,{action:'ability',choice:'guard',target:3,turnId:n().turnId});move('first_night_complete');store.enterDay(tokens[0],id);cmd({action:'continue'});cmd({action:'continue'});cmd({action:'speech_mode',mode:'free'});store.dayCommand(tokens[1],id,{action:'explode',confirmed:true,turnId:d().turnId});cmd({action:'record_take',target:3});assert.equal(d().alive.includes(3),false);assert.equal(store.dayPrivate(tokens[2],id).canShoot,true);store.dayCommand(tokens[2],id,{action:'shoot',turnId:d().turnId});cmd({action:'record_shot',target:1});assert.equal(d().alive.includes(1),false);
 while(d().deadline!==null){now=d().deadline!;store.tickNights();}assert.equal(d().phase,'day_complete');
 for(const target of [11,12]){store.enterNight(tokens[0],id);move('first_night_complete');store.enterDay(tokens[0],id);cmd({action:'continue'});cmd({action:'continue'});cmd({action:'speech_mode',mode:'free'});cmd({action:'end_speech'});cmd({action:'start_vote',method:'offline',visibility:'totals',seconds:5});cmd({action:'offline_results',counts:d().vote!.candidates.map(seat=>({seat,votes:seat===target?1:0}))});cmd({action:'continue'});while(d().deadline!==null){now=d().deadline!;store.tickNights();}}
 assert.equal(d().phase,'ended');assert.equal(d().winner,'wolves');const replay=store.gameReplay(tokens[0],id),lines=summarizeReplay(replay).flatMap(r=>r.lines);assert.ok(lines.includes('2 号白狼王自爆，带走 3 号'));assert.ok(lines.includes('3 号黑狼王开枪，带走 1 号'));
 const draft=store.recordsList(tokens[0],id).own!,record=store.importAutomaticRecord(tokens[0],id,draft.revision);assert.equal(record.document.deaths.find(d=>d.seat===3)?.cause,'white-wolf');assert.equal(record.document.deaths.find(d=>d.seat===1)?.cause,'shot');
 }finally{store.close();rmSync(dir,{recursive:true});}
});

test('ended king replay and record cause represent carry once',()=>{
 const replay={winner:'wolves' as const,roles:[{seat:1,role:'whiteWolf' as const},{seat:2,role:'blackWolf' as const},{seat:3,role:'villager' as const}],rounds:[{kind:'day' as const,round:1,events:[{type:'death_white-wolf',seat:2,at:1},{type:'white_wolf_take',seat:1,target:2,at:1},{type:'death_shot',seat:3,at:2},{type:'hunter_shot',seat:2,target:3,at:2}]}]};const lines=summarizeReplay(replay).flatMap(r=>r.lines);assert.deepEqual(lines,['1 号白狼王自爆，带走 2 号','2 号黑狼王开枪，带走 3 号']);
});
