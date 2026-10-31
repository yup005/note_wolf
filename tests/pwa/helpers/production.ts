import {build} from 'vite';
import express from 'express';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../../../apps/server/app.js';
import {mountProductionFrontend} from '../../../apps/server/frontend.js';

export async function buildPwa(outputRoot:string,banner?:string){
 const previous=process.env.NODE_ENV;
 try{await build({configFile:resolve('vite.config.ts'),logLevel:'silent',build:{outDir:outputRoot,...(banner?{rollupOptions:{output:{banner}}}:{})}});return outputRoot;}
 finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
}
export async function startPwaServer(root:string,port:number){
 const app=await createServer({dbPath:':memory:',allowTestPlayers:false});
 await app.store.auth.createAccount('test_admin','test-admin-password','合成测试管理员','admin');
 let frontend=express();mountProductionFrontend(frontend,root);
 app.web.use((req,res,next)=>frontend(req,res,next));
 app.http.listen(port,'127.0.0.1');await once(app.http,'listening');
 return {setRoot(root:string){const next=express();mountProductionFrontend(next,root);frontend=next;},close:()=>app.close()};
}
