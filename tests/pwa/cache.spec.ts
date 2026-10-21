import {test,expect} from './fixtures';
import {prepareOrdinaryRoom} from '../e2e/helpers/real-players';
export async function controlled(page:import('@playwright/test').Page){
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
}
test('actual Worker caches only build assets after private and shared API usage',async({page,browser})=>{
 await controlled(page);
 const account=await (await page.request.post('/api/auth/register',{data:{username:'cache_'+crypto.randomUUID().slice(0,8),password:'synthetic-password',nickname:'缓存测试合成玩家'}})).json();
 const icon=await (await page.request.get('/icons/apple-touch-icon.png')).body();expect((await page.request.post('/api/auth/avatar',{headers:{'Content-Type':'image/png'},data:icon})).ok()).toBe(true);
 const room=(await (await page.request.post('/api/rooms',{data:{nickname:'缓存测试',requestId:crypto.randomUUID()}})).json()).room,path=`/api/rooms/${room.id}`;
 const roles=await prepareOrdinaryRoom(browser,page.context(),room,'manual'),own=(await (await page.request.get(path+'/records')).json()).own;
 const document={...own.document,deaths:roles.filter(r=>r.role==='wolf').map(r=>({seat:r.seat,round:1,period:'night',cause:'unrecorded'})),notes:'PWA_PUBLIC_SENTINEL'};
 expect((await page.request.post(path+'/record',{data:{revision:0,document}})).ok()).toBe(true);expect((await page.request.post(path+'/manual/commit',{data:{revision:1}})).ok()).toBe(true);expect((await page.request.post(path+'/record/publish',{data:{revision:1}})).ok()).toBe(true);
 expect((await page.request.post(path+'/record',{data:{revision:1,document:{...document,notes:'PWA_PRIVATE_SENTINEL'}}})).ok()).toBe(true);
 const admin=await browser.newContext();let token:string;
 try{expect((await admin.request.get('/api/session')).ok()).toBe(true);expect((await admin.request.post('/api/auth/login',{data:{username:'test_admin',password:'test-admin-password'}})).ok()).toBe(true);expect((await admin.request.post(`/api/admin/users/${account.account.id}/vip`,{data:{enabled:true,expiresAt:null}})).ok()).toBe(true);const share=await page.request.post(`/api/records/${own.id}/share`,{data:{action:'create',revision:0}});expect(share.ok()).toBe(true);token=(await share.json()).token;}finally{await admin.close();}
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();await expect(page.locator('.live').first()).toContainText('已连接');
 const display=await page.request.post(path+'/display',{data:{action:'create',revision:0,confirmed:true},headers:{'X-Wolf-Game-Id':room.gameId}});expect(display.ok()).toBe(true);const displayToken=(await display.json()).token,screen=await page.context().newPage();await screen.goto('/display/'+displayToken);await expect(screen.getByRole('heading',{name:'记录已结束',exact:true})).toBeVisible();await screen.close();
 const result=await page.evaluate(async({path,avatar,token,displayToken})=>{
  for(const url of ['/api/session',path+'/identity',path+'/records',avatar,`/api/shared-records/${token}`,`/api/displays/${displayToken}`,`/display/${displayToken}`,'/api/unknown.js'])await (await fetch(url)).text();
  await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const worker=await (await fetch('/sw.js')).text(),build=JSON.parse(worker.match(/^const BUILD=(.*);$/m)![1]);await fetch(build.assets.find((a:{mime:string})=>a.mime==='javascript').url+'?account=PWA_QUERY_SENTINEL');
  const names=(await caches.keys()).filter(n=>n.startsWith('note-wolf-static-')),entries=[];
  for(const name of names){const cache=await caches.open(name);for(const request of await cache.keys())entries.push({path:new URL(request.url).pathname,query:new URL(request.url).search,body:await (await cache.match(request))!.text()});}
  return {expected:build.assets.map((a:{url:string})=>a.url).sort(),entries};
 },{path,avatar:account.account.avatarUrl??`/api/avatars/${account.account.id}`,token,displayToken});
 expect(result.entries.map(e=>e.path).sort()).toEqual(result.expected);for(const entry of result.entries){expect(entry.query).toBe('');expect(entry.body).not.toContain('PWA_PRIVATE_SENTINEL');expect(entry.body).not.toContain('PWA_PUBLIC_SENTINEL');expect(entry.path).not.toContain(token);expect(entry.path).not.toContain(displayToken);expect(entry.body).not.toContain(displayToken);}
});
