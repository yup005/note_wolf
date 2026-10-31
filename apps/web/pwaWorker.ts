import type {PwaBuild} from './pwaTypes.js';
/** A classic Worker: only public build inputs, never application/session data. */
export function workerTemplate(){return `
const BUILD=__WOLF_BUILD__;
const paths=new Set(BUILD.assets.map(asset=>asset.url));
const types={javascript:/^(application|text)\\/javascript$/,css:/^text\\/css$/,png:/^image\\/png$/,html:/^text\\/html$/};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{
  const cache=await caches.open(BUILD.cacheName);
  for(const asset of BUILD.assets){
   const response=await fetch(asset.url,{credentials:'omit',cache:'no-store',redirect:'error'});
   const mime=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
   if(!response.ok||response.redirected||!types[asset.mime].test(mime)||/no-store/i.test(response.headers.get('Cache-Control')||''))throw Error('Public resource unavailable');
   await cache.put(asset.url,response);
  }
 }catch(error){await caches.delete(BUILD.cacheName);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('note-wolf-static-')&&name!==BUILD.cacheName)await caches.delete(name);
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{return await fetch(request,{cache:'no-store'});}catch(error){const fallback=await (await caches.open(BUILD.cacheName)).match('/offline.html');if(fallback)return fallback;throw error;}})());return;
 }
 if(url.search||!paths.has(url.pathname))return;
 event.respondWith((async()=>{const cached=await (await caches.open(BUILD.cacheName)).match(request);return cached||fetch(request);})());
});
`;}
export function renderWorker(build:PwaBuild){return workerTemplate().replace('__WOLF_BUILD__',JSON.stringify(build));}
