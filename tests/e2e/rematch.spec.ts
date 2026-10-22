import {test,expect,type Browser} from '@playwright/test';
import {requestWithBackoff} from './helpers/test-admin';
async function ended(browser:Browser){
 const contexts=await Promise.all(Array.from({length:12},()=>browser.newContext({viewport:{width:390,height:844}})));
 for(const c of contexts)await c.request.get('/api/session');
 const host=contexts[0],roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
 const room=(await (await host.request.post('/api/rooms',{data:{nickname:'再来一局房主',requestId:crypto.randomUUID()}})).json()).room,path=`/api/rooms/${room.id}`;
 await host.request.post(path+'/settings',{data:{dealMethod:'physical',gameMode:'manual'}});
 for(let i=0;i<12;i++){
  if(i)await contexts[i].request.post('/api/rooms/join',{data:{code:room.code,nickname:'合成'+(i+1)}});
  await contexts[i].request.post(path+'/seat',{data:{seat:i+1}});await contexts[i].request.post(path+'/ready',{data:{ready:true,settingsRevision:1}});
 }
 await host.request.post(path+'/deal',{data:{}});for(let i=0;i<12;i++)await contexts[i].request.post(path+'/identity',{data:{role:roles[i]}});
 await host.request.post(path+'/start',{data:{}});await host.request.get(path+'/records');
 await host.request.post(path+'/record',{data:{revision:0,document:{deaths:[1,2,3,4].map(seat=>({seat,round:1,period:'night',cause:'unrecorded'})),badges:[],exiles:[],votes:[],notes:'第一局独立私稿'}}});
 expect((await host.request.post(path+'/manual/commit',{data:{revision:1}})).ok()).toBe(true);
 return {contexts,host,room,path,roles};
}
test('host rematch keeps seats, synchronizes players and independently edits the first game',async({browser})=>{
 const f=await ended(browser);try{
  const page=await f.host.newPage(),other=await f.contexts[1].newPage();
  for(const p of [page,other]){await p.goto('/');await p.locator('.recent-room').click();}
  await expect(page.getByRole('button',{name:'再来一局',exact:true})).toBeVisible();
  await expect(other.getByRole('button',{name:'再来一局',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'再来一局',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'再来一局？',exact:true}),confirmButton=confirmation.getByRole('button',{name:'确认再来一局',exact:true}),backButton=confirmation.getByRole('button',{name:'返回',exact:true});
  await expect(confirmButton).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(backButton).toBeFocused();await page.keyboard.press('Tab');await expect(confirmButton).toBeFocused();
  for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const box=await confirmButton.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);}
  await page.keyboard.press('Escape');await expect(confirmation).toHaveCount(0);await expect(page.getByRole('button',{name:'再来一局',exact:true})).toBeFocused();
  expect((await (await f.host.request.get(f.path)).json()).room.gameId).toBe(f.room.id);
  await page.setViewportSize({width:320,height:568});await page.getByRole('button',{name:'再来一局',exact:true}).click();
  await page.getByRole('dialog',{name:'再来一局？',exact:true}).screenshot({path:'test-results/rematch-confirmation-mobile.png',animations:'disabled'});
  await page.getByRole('button',{name:'确认再来一局',exact:true}).click();
  await expect(page.getByText('第 2 局',{exact:true})).toBeVisible();await expect(other.getByText('第 2 局',{exact:true})).toBeVisible();
  const current=(await (await f.host.request.get(f.path)).json()).room;expect(current.gameId).not.toBe(f.room.id);expect(current.seats.filter((s:{ready:boolean})=>s.ready)).toHaveLength(0);
  const headers={'X-Wolf-Game-Id':current.gameId};
  expect((await f.host.request.get(f.path+'/identity',{headers})).status()).toBe(409);
  await page.getByRole('link',{name:'笔记狼人杀',exact:true}).click();
  const records=page.getByRole('region',{name:'我的记录'});await records.getByRole('button',{name:'我的记录',exact:true}).click();
  await records.getByRole('button',{name:'编辑记录',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'独立对局记录'});await expect(dialog.getByLabel('个人推理与补充')).toHaveValue('第一局独立私稿');
  await dialog.getByLabel('个人推理与补充').fill('第一局修改仍独立');await dialog.getByRole('button',{name:'保存笔记',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('仅你可见');
  for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await (await f.host.request.get(f.path+'/records')).json()).own.document.notes).toBe('第一局修改仍独立');
  for(let i=0;i<12;i++)expect((await f.contexts[i].request.post(f.path+'/ready',{headers,data:{ready:true,settingsRevision:current.preparation.settingsRevision}})).ok()).toBe(true);
  expect((await f.host.request.post(f.path+'/deal',{headers,data:{}})).ok()).toBe(true);
  for(let i=0;i<12;i++)expect((await f.contexts[i].request.post(f.path+'/identity',{headers,data:{role:f.roles[i]}})).ok()).toBe(true);
  expect((await f.host.request.post(f.path+'/start',{headers,data:{}})).ok()).toBe(true);
  const second=(await (await f.host.request.get(`/api/games/${current.gameId}/records`)).json()).own;expect(second.document.notes).toBe('');
 }finally{for(const c of f.contexts)await c.close();}
});
test('late private identity response cannot survive rematch or reopen the old game',async({browser})=>{
 const f=await ended(browser);let release=()=>{};
 try{
  const page=await f.host.newPage();let started!:()=>void;const pending=new Promise<void>(resolve=>started=resolve),gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**'+f.path+'/identity',async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response});});
  await page.goto('/');await page.locator('.recent-room').click();await pending;
  const c={requestId:crypto.randomUUID(),expectedGameId:f.room.id};
  expect((await requestWithBackoff(()=>f.host.request.post(f.path+'/rematch',{headers:{'X-Wolf-Game-Id':f.room.id},data:c}))).ok()).toBe(true);
  await expect(page.getByText('第 2 局',{exact:true})).toBeVisible();release();
  await expect(page.locator('.manual-screen')).toHaveCount(0);await expect(page.getByRole('button',{name:'再来一局',exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByText('第 2 局',{exact:true})).toBeVisible();
  expect((await f.host.request.post(f.path+'/deal',{data:{}})).status()).toBe(409);
 }finally{release();for(const c of f.contexts)await c.close();}
});
