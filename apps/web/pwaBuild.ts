import type {Plugin} from 'vite';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import type {PwaAsset,PwaBuild} from './pwaTypes.js';
import {renderWorker,workerTemplate} from './pwaWorker.js';

const iconSizes={'icon-192.png':192,'icon-512.png':512,'maskable-512.png':512,'apple-touch-icon.png':180} as const;
const iconPaths=new Set(Object.keys(iconSizes).map(name=>'/icons/'+name));
const digest=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
export function buildPwaMetadata(assets:PwaAsset[],policyTemplate:string):PwaBuild{
 const safe=assets.filter(a=>a.url==='/offline.html'&&a.mime==='html'||iconPaths.has(a.url)&&a.mime==='png'||/^\/assets\/[\w-]+-[\w-]{8,}\.(js|css)$/.test(a.url)&&(a.url.endsWith('.js')?a.mime==='javascript':a.mime==='css')).sort((a,b)=>a.url.localeCompare(b.url));
 const version=digest(JSON.stringify({assets:safe,policyTemplate}));return {version,cacheName:'note-wolf-static-'+version,assets:safe};
}
const manifest={id:'/',name:'笔记狼人杀',short_name:'笔记狼人杀',lang:'zh-CN',start_url:'/',scope:'/',display:'standalone',theme_color:'#f7f8fa',background_color:'#f7f8fa',icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
async function publicResources(){
 const svg=await readFile(fileURLToPath(new URL('./public/icons/wolf.svg',import.meta.url)));
 const icons=await Promise.all(Object.entries(iconSizes).map(async([file,size])=>({url:'/icons/'+file,mime:'png' as const,bytes:await sharp(svg).resize(size,size).flatten({background:'#f7f8fa'}).png().toBuffer()})));
 return [...icons,{url:'/offline.html',mime:'html' as const,bytes:await readFile(fileURLToPath(new URL('./public/offline.html',import.meta.url)))}];
}
export function pwaBuild():Plugin{
 return {name:'wolf-public-pwa',
  configureServer(server){const resources=publicResources();server.middlewares.use(async(req,res,next)=>{const pathname=req.url?.split('?')[0];if(pathname==='/manifest.webmanifest'){res.setHeader('Content-Type','application/manifest+json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(manifest));return;}if(pathname&&iconPaths.has(pathname)){try{const item=(await resources).find(r=>r.url===pathname)!;res.setHeader('Content-Type','image/png');res.end(item.bytes);}catch{res.statusCode=500;res.end();}return;}next();});},
  async generateBundle(_options,bundle){
   const resources=await publicResources();this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:JSON.stringify(manifest)});
   for(const r of resources)this.emitFile({type:'asset',fileName:r.url.slice(1),source:r.bytes});
   const assets:PwaAsset[]=resources.map(r=>({url:r.url,mime:r.mime,sha256:digest(r.bytes)}));
   for(const file of Object.values(bundle))if(file.fileName.endsWith('.js')||file.fileName.endsWith('.css'))assets.push({url:'/'+file.fileName,mime:file.fileName.endsWith('.js')?'javascript':'css',sha256:digest(file.type==='chunk'?file.code:typeof file.source==='string'?file.source:file.source)});
   const metadata=buildPwaMetadata(assets,workerTemplate());
   this.emitFile({type:'asset',fileName:'sw.js',source:renderWorker(metadata)});
  }};
}
