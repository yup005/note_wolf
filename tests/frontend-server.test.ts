import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import express from 'express';
import {createServer} from '../apps/server/app.js';

test('production_files_have_explicit_cache_boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wolf-static-')),app=await createServer({dbPath:':memory:'});
 try{
  await mkdir(join(root,'assets'));await mkdir(join(root,'icons'));
  for(const [name,content] of [['index.html','<!doctype html><title>Public shell</title>'],['sw.js','/* worker */'],['manifest.webmanifest','{}'],['offline.html','<!doctype html>offline'],['assets/index-12345678.js','/* bundle */'],['icons/icon-192.png','synthetic public icon']])await writeFile(join(root,name),content);
  if(existsSync('apps/server/frontend.ts'))(await import('../apps/server/frontend.js')).mountProductionFrontend(app.web,root);
  else {app.web.use(express.static(root));app.web.get('/{*path}',(_req,res)=>res.sendFile(join(root,'index.html')));}
  app.http.listen(0,'127.0.0.1');await once(app.http,'listening');const address=app.http.address();assert.ok(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
  for(const path of ['/','/share/synthetic-token','/sw.js','/manifest.webmanifest']){const r=await fetch(base+path,{headers:{Accept:'text/html'}});assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control')??'',/no-store/,path+' always revalidates with network');}
  assert.match((await fetch(base+'/sw.js')).headers.get('Content-Type')??'',/javascript/);
  assert.match((await fetch(base+'/manifest.webmanifest')).headers.get('Content-Type')??'',/manifest\+json/);
  assert.match((await fetch(base+'/assets/index-12345678.js')).headers.get('Cache-Control')??'',/immutable/);
  assert.doesNotMatch((await fetch(base+'/offline.html')).headers.get('Cache-Control')??'',/no-store/);
  for(const path of ['/assets/missing.js','/icons/missing','/manifest-missing.webmanifest','/missing.js','/icons/unknown.png']){const r=await fetch(base+path,{headers:{Accept:'text/html'}});assert.equal(r.status,404,path);assert.doesNotMatch(await r.text(),/Public shell/);}
  for(const path of ['/api/health','/api/nonexistent','/api/shared-records/bad'])assert.match((await fetch(base+path)).headers.get('Cache-Control')??'',/no-store/);
  const other=await mkdtemp(join(tmpdir(),'wolf-empty-static-'));try{const empty=express();if(existsSync('apps/server/frontend.ts'))(await import('../apps/server/frontend.js')).mountProductionFrontend(empty,other);const http=(await import('node:http')).createServer(empty);http.listen(0,'127.0.0.1');await once(http,'listening');try{const a=http.address();assert.ok(a&&typeof a!=='string');for(const path of ['/sw.js','/manifest.webmanifest'])assert.equal((await fetch('http://127.0.0.1:'+a.port+path)).status,404);}finally{await new Promise<void>(r=>http.close(()=>r()));}}finally{await rm(other,{recursive:true,force:true});}
 }finally{await app.close();await rm(root,{recursive:true,force:true});}
});
