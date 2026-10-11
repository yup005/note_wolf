import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {io,type Socket} from 'socket.io-client';
import {createServer} from '../apps/server/app.js';
import {EngineStore} from '../packages/storage/engine.js';
import {createEngineState,copyEngineAbilities} from '../packages/domain/engine.js';

test('durable engine secrets stay outside host/player HTTP, sockets and unimplemented engine endpoints',{timeout:15000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-engine-privacy-'));const file=join(dir,'db.sqlite');
 const app=await createServer({dbPath:file});await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));
 const address=app.http.address()!;if(typeof address==='string')throw Error('address');const base=`http://127.0.0.1:${address.port}`;
 let socket:Socket|undefined;let db:Database.Database|undefined;
 async function session(){return (await fetch(base+'/api/session')).headers.get('set-cookie')!.split(';')[0];}
 async function request(cookie:string,path:string,body?:unknown){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});}
 try{
  const host=await session(),guest=await session();const view=await (await request(host,'/api/rooms',{nickname:'Synthetic host',requestId:randomUUID()})).json();const path='/api/rooms/'+view.room.id;
  await request(guest,'/api/rooms/join',{code:view.room.code,nickname:'Synthetic guest'});
  const selected=await (await request(host,path+'/board',{selection:{kind:'preset',id:'mechanical-armor-12'},settingsRevision:0})).json();const board=selected.room.board;
  const roles=['wolf','wolf','mechanicalWolf','armoredWolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard'] as const;
  const initial=createEngineState(board,roles.map((role,i)=>({seat:i+1,role,knifeGroup:role==='wolf'?'shared':role==='mechanicalWolf'?'mechanical':role==='armoredWolf'?'armor':'none'})));
  initial.players[9].abilities.skills=[{id:'synthetic-private-poison',kind:'poison',capacity:1,remaining:1,availableFromNight:1,parameters:{secret:'synthetic-private-parameter'},copiedFrom:null,uses:[]}];
  const learned=copyEngineAbilities(initial,3,10,{copyId:'synthetic-private-learning',availableFromNight:2,at:100});
  db=new Database(file);new EngineStore(db,()=>board).save(view.room.id,learned,0);
  function noSecrets(value:unknown){const serialized=JSON.stringify(value);for(const secret of ['synthetic-private','sourceSnapshot','mimickedRole','copiedFrom','abilities'])assert.equal(serialized.includes(secret),false);}
  noSecrets(await (await request(host,path)).json());noSecrets(await (await request(guest,path)).json());
  socket=io(base,{transports:['websocket'],extraHeaders:{Cookie:guest},reconnection:false});await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
  const subscribed=await new Promise<unknown>(resolve=>socket!.emit('room:subscribe',{roomId:view.room.id},resolve));noSecrets(subscribed);
  const broadcast=new Promise<unknown>(resolve=>socket!.once('room:snapshot',resolve));await request(host,path+'/settings',{dealMethod:'physical',gameMode:'manual'});noSecrets(await broadcast);
  for(const cookie of [host,guest])assert.equal((await request(cookie,path+'/engine')).status,404);
 }finally{socket?.disconnect();db?.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});
