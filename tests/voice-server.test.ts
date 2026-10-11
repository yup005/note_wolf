import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createServer} from '../apps/server/app.js';
import {voiceFixture} from './helpers/voice-fixture.js';
test('wire voice authenticates the manager and lease, rejects speech injection, and invalidates old sessions on takeover',async()=>{
 let f:ReturnType<typeof voiceFixture>|undefined;const app=await createServer({dbPath:':memory:',now:()=>f?.getNow()??1000});try{f=voiceFixture(':memory:',app.store);const {store:s,tokens:t,id}=f;await new Promise<void>(r=>app.http.listen(0,'127.0.0.1',r));const address=app.http.address();if(!address||typeof address==='string')throw Error('address');const root=`http://127.0.0.1:${address.port}`,path=root+`/api/rooms/${id}/voice`,clientId=randomUUID();
 const req=(token:string,url=path,data:unknown={action:'claim',clientId})=>fetch(url,{method:'POST',headers:{cookie:`wolf_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await req('')).status,401);assert.equal((await req(t[1])).status,403);assert.equal((await req(t[0],path+'?role=witch')).status,400);assert.equal((await req(t[0],path,{action:'claim',clientId,text:'10号女巫'})).status,400);
 const a=await s.auth.register(t[0],'speaker_user','correct-password','房主');const claim=await req(a.token);assert.equal(claim.status,200);const first=await claim.json();assert.deepEqual(Object.keys(first).sort(),['cues','current','leaseUntil','revision','scope','serverNow']);assert.match(first.cues[0].text,/狼人.*睁眼/);assert.equal((await req(a.token,path,{action:'claim',clientId:randomUUID()})).status,409);
 const fresh=randomBytes(32).toString('hex');s.issueSession(fresh);const login=await req(fresh,root+'/api/auth/login',{username:'speaker_user',password:'correct-password'});assert.equal(login.status,200);const token=/wolf_session=([a-f0-9]{64})/.exec(login.headers.get('set-cookie')!)![1];assert.equal((await req(a.token,path,{action:'poll',clientId})).status,401);const next=await req(token,path,{action:'claim',clientId:randomUUID()});assert.equal(next.status,200);assert.equal((await next.json()).cues.length,0);
 }finally{await app.close();}
});
