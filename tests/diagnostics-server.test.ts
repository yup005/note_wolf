import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {io,type Socket} from 'socket.io-client';
import {createServer,type ServerOptions} from '../apps/server/app.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'wolf-diagnostics-')),file=join(dir,'db.sqlite'),lines:string[]=[];
 const app=await createServer({dbPath:file,diagnosticWrite:(line:string)=>lines.push(line)} as ServerOptions);
 await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();assert.ok(address&&typeof address!=='string');
 const base=`http://127.0.0.1:${address.port}`,token=randomBytes(32).toString('hex');app.store.issueSession(token);const room=app.store.create(token,'private nickname').room;
 const db=new Database(file);let socket:Socket|undefined;
 return {app,db,lines,base,room,token,setSocket(s:Socket){socket=s;},async close(){socket?.disconnect();db.close();await app.close();rmSync(dir,{recursive:true,force:true});}};
}

test('HTTP faults correlate a safe SQLite category and public room context without SQL or submitted secrets',async()=>{
 const f=await fixture();try{
 f.db.exec("CREATE TRIGGER fail_seat BEFORE UPDATE OF seat ON members BEGIN SELECT RAISE(ABORT,'secret password wolf token source-private'); END");
 const res=await fetch(`${f.base}/api/rooms/${f.room.id}/seat?private=hidden-query`,{method:'POST',headers:{cookie:`wolf_session=${f.token}`,'content-type':'application/json','x-request-id':'attacker-correlation'},body:JSON.stringify({seat:1})});
 assert.equal(res.status,500);const body=await res.json();assert.match(body.requestId,uuid);assert.equal(res.headers.get('x-request-id'),body.requestId);assert.equal(body.error,'INTERNAL_ERROR');
 const logs=f.lines.map(line=>JSON.parse(line)),fault=logs.find(log=>log.requestId===body.requestId);assert.ok(fault);assert.equal(fault.operation,'http');assert.equal(fault.code,'SQLITE_CONSTRAINT');assert.equal(fault.gameId,f.room.id);assert.equal(fault.phase,'preparation');
 const text=JSON.stringify([body,f.lines]);for(const secret of ['secret password','source-private',f.token,'hidden-query','attacker-correlation','private nickname','CREATE TRIGGER'])assert.ok(!text.includes(secret),secret);
 f.db.exec('DROP TRIGGER fail_seat');assert.equal((await fetch(f.base+'/api/health')).status,200);
 }finally{await f.close();}
});

test('health reports storage failure and recovery while the HTTP process remains alive',async()=>{
 const f=await fixture();try{
 assert.deepEqual(await (await fetch(f.base+'/api/health')).json(),{status:'ok',storage:'ok'});
 f.db.exec('ALTER TABLE rooms RENAME TO rooms_unavailable');
 const res=await fetch(f.base+'/api/health');assert.equal(res.status,503);const body=await res.json();assert.equal(body.status,'degraded');assert.equal(body.storage,'unavailable');assert.match(body.requestId,uuid);
 assert.ok(f.lines.some(line=>JSON.parse(line).operation==='health'&&JSON.parse(line).requestId===body.requestId));
 f.db.exec('ALTER TABLE rooms_unavailable RENAME TO rooms');assert.deepEqual(await (await fetch(f.base+'/api/health')).json(),{status:'ok',storage:'ok'});
 assert.ok(f.lines.some(line=>JSON.parse(line).event==='recovered'&&JSON.parse(line).operation==='health'));
 }finally{await f.close();}
});

test('a real recurring SQLite fault is bounded, leaves timers alive and records recovery',async()=>{
 const f=await fixture();try{
 // Renaming a runtime table breaks the existing 250ms automatic tick, not a mocked callback.
 f.db.exec('ALTER TABLE night_games RENAME TO night_games_unavailable');
 await new Promise(r=>setTimeout(r,850));
 const faults=f.lines.map(line=>JSON.parse(line)).filter(log=>log.operation==='night-tick'&&log.event==='fault');assert.equal(faults.length,1);assert.equal(faults[0].code,'SQLITE_ERROR');
 f.db.exec('ALTER TABLE night_games_unavailable RENAME TO night_games');await new Promise(r=>setTimeout(r,350));
 const recovered=f.lines.map(line=>JSON.parse(line)).find(log=>log.operation==='night-tick'&&log.event==='recovered');assert.ok(recovered);assert.ok(recovered.suppressed>=1);assert.equal(recovered.faultId,faults[0].requestId);
 assert.equal((await fetch(f.base+'/api/health')).status,200);
 }finally{await f.close();}
});

test('socket subscription faults have safe correlation and leave the connection usable',async()=>{
 const f=await fixture();try{
 const s=io(f.base,{transports:['websocket'],extraHeaders:{cookie:`wolf_session=${f.token}`},reconnection:false});f.setSocket(s);await new Promise<void>((r,j)=>{s.once('connect',r);s.once('connect_error',j);});
 f.db.exec('ALTER TABLE members RENAME TO members_unavailable');
 const reply=await new Promise<any>(r=>s.emit('room:subscribe',{roomId:f.room.id,private:'source-private'},r));assert.equal(reply.error,'INTERNAL_ERROR');assert.match(reply.requestId,uuid);assert.ok(f.lines.some(line=>JSON.parse(line).requestId===reply.requestId&&JSON.parse(line).operation==='socket-subscribe'));
 f.db.exec('ALTER TABLE members_unavailable RENAME TO members');const good=await new Promise<any>(r=>s.emit('room:subscribe',{roomId:f.room.id},r));assert.equal(good.room.id,f.room.id);assert.ok(!f.lines.join('').includes('source-private'));assert.ok(!f.lines.join('').includes(f.token));
 }finally{await f.close();}
});

test('startup database errors produce fixed diagnostics and reject without raw paths or contents',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wolf-diag-start-')),file=join(dir,'secret-path.sqlite'),lines:string[]=[];writeFileSync(file,'private notes invalid SQLite');
 try{await assert.rejects(createServer({dbPath:file,diagnosticWrite:(line:string)=>lines.push(line)} as ServerOptions),/^Error: SERVER_STARTUP_FAILED$/);assert.equal(lines.length,1);const log=JSON.parse(lines[0]);assert.equal(log.operation,'startup');assert.equal(log.code,'SQLITE_NOTADB');assert.match(log.requestId,uuid);assert.ok(!lines.join('').includes(file));assert.ok(!lines.join('').includes('private notes'));}finally{rmSync(dir,{recursive:true,force:true});}
});

test('readiness detects a missing runtime table and repeated failures retain a logged correlation',async()=>{
 const f=await fixture();try{
 f.db.exec('ALTER TABLE night_games RENAME TO night_games_unavailable');
 const first=await fetch(f.base+'/api/health');assert.equal(first.status,503);const a=await first.json();
 const second=await fetch(f.base+'/api/health');assert.equal(second.status,503);const b=await second.json();assert.equal(second.headers.get('x-request-id'),b.requestId);assert.equal(b.requestId,a.requestId);
 assert.equal(f.lines.map(line=>JSON.parse(line)).filter(log=>log.operation==='health').length,1);
 f.db.exec('ALTER TABLE night_games_unavailable RENAME TO night_games');assert.equal((await fetch(f.base+'/api/health')).status,200);
 }finally{await f.close();}
});

test('readiness includes membership and account dependencies required by ordinary room reads',async()=>{
 const f=await fixture();try{for(const table of ['members','accounts']){f.db.exec(`ALTER TABLE ${table} RENAME TO ${table}_unavailable`);assert.equal((await fetch(f.base+'/api/health')).status,503,table);f.db.exec(`ALTER TABLE ${table}_unavailable RENAME TO ${table}`);assert.equal((await fetch(f.base+'/api/health')).status,200);}}finally{await f.close();}
});

test('initial expired-room cleanup failures are safely reported without rejecting or deleting source data',async()=>{
 const {LobbyStore}=await import('../packages/storage/lobby.js');const dir=mkdtempSync(join(tmpdir(),'wolf-diag-retention-')),file=join(dir,'db'),lines:string[]=[];const source=new LobbyStore(file,undefined,false,()=>1000),token=randomBytes(32).toString('hex');source.issueSession(token);const id=source.create(token,'synthetic old room').room.id;source.close();
 const db=new Database(file);db.exec("CREATE TRIGGER fail_retention BEFORE DELETE ON rooms BEGIN SELECT RAISE(ABORT,'source-private startup cleanup'); END");let app:Awaited<ReturnType<typeof createServer>>|undefined;
 try{app=await createServer({dbPath:file,now:()=>86402000,diagnosticWrite:line=>lines.push(line)});assert.ok(db.prepare('SELECT id FROM rooms WHERE id=?').get(id));assert.equal(lines.length,1);assert.equal(JSON.parse(lines[0]).operation,'retention');assert.equal(JSON.parse(lines[0]).code,'SQLITE_CONSTRAINT');assert.ok(!lines.join('').includes('source-private'));db.exec('DROP TRIGGER fail_retention');app.cleanupExpiredRooms();assert.equal(db.prepare('SELECT id FROM rooms WHERE id=?').get(id),undefined);}finally{await app?.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

test('ended manual-game request faults are classified as ended without recording private notes',async()=>{
 const f=await fixture();try{const {sharingFixture}=await import('./helpers/sharing-fixture.js');const game=await sharingFixture(':memory:',f.app.store);game.publish();f.db.exec("CREATE TRIGGER fail_record BEFORE UPDATE ON record_drafts BEGIN SELECT RAISE(ABORT,'source-private notes'); END");
 const response=await fetch(f.base+`/api/rooms/${game.id}/record`,{method:'POST',headers:{cookie:`wolf_session=${game.token}`,'content-type':'application/json'},body:JSON.stringify({revision:1,document:{...game.document,notes:'source-private extra notes'}})});assert.equal(response.status,500);const body=await response.json();assert.equal(f.lines.map(line=>JSON.parse(line)).find(log=>log.requestId===body.requestId)?.phase,'ended');assert.ok(!f.lines.join('').includes('source-private'));}finally{await f.close();}
});
