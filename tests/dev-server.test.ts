import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';

test('development server exits cleanly with an active Vite HMR connection', {timeout:20000}, async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const address=probe.address();assert.ok(address&&typeof address!=='string');const port=address.port;
 await new Promise<void>(resolve=>probe.close(()=>resolve()));
 const child=spawn(process.execPath,['--import','tsx','apps/server/main.ts'],{
  env:{...process.env,NODE_ENV:'development',PORT:String(port),WOLF_DB_PATH:':memory:',WOLF_ADMIN_USERNAME:'',WOLF_ADMIN_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 const exited=once(child,'exit');let socket:WebSocket|undefined;
 try{
  await new Promise<void>((resolve,reject)=>{
   let output='';const timer=setTimeout(()=>reject(Error('Development server did not start')),10000);
   child.stdout.on('data',chunk=>{output+=String(chunk);if(output.includes(`localhost:${port}`)){clearTimeout(timer);resolve();}});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Development server exited before listening'));});
  });
  const client=await (await fetch(`http://127.0.0.1:${port}/@vite/client`)).text();
  const token=client.match(/const wsToken = ("[^"]+")/);assert.ok(token,'Vite websocket token is present');
  socket=new WebSocket(`ws://127.0.0.1:${port}/?token=${JSON.parse(token[1])}`,'vite-hmr');
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('HMR connection did not open')),3000);socket!.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket!.addEventListener('error',()=>{clearTimeout(timer);reject(Error('HMR connection failed'));},{once:true});});
  child.kill('SIGTERM');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const result=await Promise.race([exited,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Server shutdown stalled with active HMR')),3000);})]);assert.equal(result[0],0);}finally{clearTimeout(timer);}
 }finally{socket?.close();if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited;}
});
