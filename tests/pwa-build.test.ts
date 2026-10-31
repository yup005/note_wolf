import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'vite';
import sharp from 'sharp';
import {existsSync} from 'node:fs';

// Removing PWA generation breaks assertions on real production output.
test('manifest_and_icons_are_installable',async()=>{
 const out=await mkdtemp(join(tmpdir(),'wolf-pwa-build-')),previousMode=process.env.NODE_ENV;
 try{
  await build({configFile:resolve('vite.config.ts'),logLevel:'silent',build:{outDir:out}});
  const manifest=JSON.parse(await readFile(join(out,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.name,'笔记狼人杀');assert.equal(manifest.theme_color,'#f7f8fa');assert.equal(manifest.background_color,'#f7f8fa');
  for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['maskable-512.png',512],['apple-touch-icon.png',180]] as const){
   const bytes=await readFile(join(out,'icons',file)),metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'png');assert.equal(metadata.width,size);assert.equal(metadata.height,size);
   const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=3;i<data.length;i+=info.channels)assert.equal(data[i],255,'icons have an opaque background');
   if(file.startsWith('maskable')){const corner=Array.from(data.subarray(0,4));for(const [x,y] of [[0,0],[511,0],[0,511],[511,511],[256,32],[32,256],[480,256],[256,480]])assert.deepEqual(Array.from(data.subarray((y*512+x)*4,(y*512+x)*4+4)),corner,'brand stays inside maskable safe region');}
  }
  assert.ok(manifest.icons.some((icon:{purpose?:string})=>icon.purpose==='maskable'));
  const html=await readFile(join(out,'index.html'),'utf8');assert.match(html,/rel="manifest"/);assert.match(html,/apple-touch-icon/);assert.match(html,/apple-mobile-web-app-capable/);assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
  const offline=await readFile(join(out,'offline.html'),'utf8');assert.match(offline,/无法联机/);assert.match(offline,/重新连接/);assert.doesNotMatch(offline,/\/api\/|localStorage|indexedDB/);
  const script=await readFile(join(out,'sw.js'),'utf8'),metadata=JSON.parse(script.match(/^const BUILD=(.*);$/m)![1]);
  for(const file of (await readdir(join(out,'assets'))).filter(name=>/\.(js|css)$/.test(name)))assert.ok(metadata.assets.some((a:{url:string})=>a.url==='/assets/'+file),file+' is available for older lazy-loading windows');
  assert.ok(metadata.assets.every((a:{url:string})=>!a.url.includes('/voice/')&&!a.url.includes('manifest')&&!a.url.includes('index.html')));
 }finally{if(previousMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousMode;await rm(out,{recursive:true,force:true});}
});
test('static_metadata_is_deterministic_and_excludes_dynamic_or_unversioned_paths',async()=>{
 assert.ok(existsSync('apps/web/pwaBuild.ts'),'PWA metadata generator is required');
 const {buildPwaMetadata}=await import('../apps/web/pwaBuild.js');
 const inputs=[{url:'/assets/index-12345678.js',mime:'javascript' as const,sha256:'a'.repeat(64)},{url:'/offline.html',mime:'html' as const,sha256:'b'.repeat(64)},{url:'/api/identity.js',mime:'javascript' as const,sha256:'c'.repeat(64)},{url:'/index.html',mime:'html' as const,sha256:'d'.repeat(64)},{url:'/voice/private.js',mime:'javascript' as const,sha256:'e'.repeat(64)},{url:'/assets/index-12345678.js?account=1',mime:'javascript' as const,sha256:'f'.repeat(64)},{url:'/manifest.webmanifest',mime:'html' as const,sha256:'0'.repeat(64)}];
 const first=buildPwaMetadata(inputs,'policy A');assert.deepEqual(first.assets.map(a=>a.url),['/assets/index-12345678.js','/offline.html']);assert.deepEqual(first,buildPwaMetadata([...inputs].reverse(),'policy A'));assert.notEqual(first.version,buildPwaMetadata(inputs,'policy B').version);assert.notEqual(first.version,buildPwaMetadata([{...inputs[0],sha256:'c'.repeat(64)},...inputs.slice(1)],'policy A').version);
});
