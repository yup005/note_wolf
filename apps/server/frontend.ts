import express from 'express';
import {extname,resolve,basename} from 'node:path';

export function mountProductionFrontend(web:express.Express,root:string):void{
 const directory=resolve(root);
 web.use(express.static(directory,{index:false,setHeaders(res,path){
  const name=basename(path);
  if(name==='sw.js'||name==='manifest.webmanifest'||name==='index.html')res.setHeader('Cache-Control','no-store');
  else if(/[\w-]+-[\w-]{8,}\.(js|css)$/.test(name))res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  else res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
  if(name==='sw.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Service-Worker-Allowed','/');}
  if(name==='manifest.webmanifest')res.setHeader('Content-Type','application/manifest+json');
 }}));
 web.get('/{*path}',(req,res,next)=>{
  if(extname(req.path)||/^\/(assets|icons|voice|api|socket\.io)(\/|$)/.test(req.path)||!req.accepts('html')){res.status(404).type('text/plain').send('Not found');return;}
  res.setHeader('Cache-Control','no-store');res.sendFile(resolve(directory,'index.html'),error=>{if(error)next(error);});
 });
}
