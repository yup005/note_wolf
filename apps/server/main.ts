import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createServer} from './app.js';
const dbPath=process.env.WOLF_DB_PATH??resolve('.data/lobby.db');
if(dbPath!==':memory:')mkdirSync(dirname(dbPath),{recursive:true});
const app=await createServer({dbPath,secureCookie:process.env.SECURE_COOKIE==='1',allowTestPlayers:process.env.WOLF_TEST_PLAYERS==='1',testPlayerScope:process.env.WOLF_TEST_SCOPE});
let closeFrontend:()=>Promise<void>=async()=>{};
if(process.env.WOLF_ADMIN_USERNAME&&process.env.WOLF_ADMIN_PASSWORD&&!app.store.auth.adminExists()){const {registerSchema}=await import('../../packages/contracts/auth.js');const credentials=registerSchema.parse({username:process.env.WOLF_ADMIN_USERNAME,password:process.env.WOLF_ADMIN_PASSWORD,nickname:'管理员'});await app.store.auth.createAccount(credentials.username,credentials.password,credentials.nickname,'admin');}
if(process.env.NODE_ENV==='production'){
 const {mountProductionFrontend}=await import('./frontend.js');
 mountProductionFrontend(app.web,resolve('dist/web'));
}else{
 const {createServer}=await import('vite');
 const vite=await createServer({server:{middlewareMode:true,hmr:{server:app.http}},appType:'spa'});
 closeFrontend=()=>vite.close();
 app.web.use(vite.middlewares);
}
const port=Number(process.env.PORT??3000);
app.http.listen(port,'0.0.0.0',()=>console.log(`狼人杀大厅 http://localhost:${port} · LAN http://<本机局域网 IP>:${port}`));
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await closeFrontend();await app.close();process.exit(0);});
