import {test,expect,type Page} from '@playwright/test';
import {communityFixture} from './helpers/community';
import {prepareOrdinaryRoom} from './helpers/real-players';
async function visibility(page:Page,state:'hidden'|'visible'){
 await page.evaluate(state=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:state});document.dispatchEvent(new Event('visibilitychange'));},state);
}
test('hidden content is removed and late session cannot restore the previous account',async({page})=>{
 await page.goto('/');await expect(page.getByLabel('你的昵称')).toBeVisible();expect((await page.request.post('/api/auth/register',{data:{username:'resume_'+crypto.randomUUID().slice(0,8),password:'synthetic-password',nickname:'原账号恢复测试'}})).ok()).toBe(true);await page.reload();await expect(page.getByRole('button',{name:'原账号恢复测试',exact:true})).toBeVisible();
 await visibility(page,'hidden');await expect(page.getByRole('button',{name:'原账号恢复测试',exact:true})).toHaveCount(0);
 let release=()=>{},started!:()=>void;const startedRead=new Promise<void>(r=>started=r),gate=new Promise<void>(r=>release=r);let held=false;
 await page.route('**/api/session',async route=>{if(held){await route.continue();return;}held=true;const response=await route.fetch();started();await gate;await route.fulfill({response});});
 await visibility(page,'visible');await startedRead;await visibility(page,'hidden');expect((await page.request.post('/api/auth/logout',{data:{}})).ok()).toBe(true);await visibility(page,'visible');
 await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toBeVisible();release();await expect(page.getByRole('button',{name:'原账号恢复测试',exact:true})).toHaveCount(0);
});
test('anonymous_share_rechecks_revocation_without_revealing_cached_text',async({browser})=>{
 const f=await communityFixture(browser);try{
  await f.page.goto('/share/'+f.shareToken);await expect(f.page.getByText('公开评论复盘',{exact:true})).toBeVisible();
  await visibility(f.page,'hidden');await expect(f.page.getByText('公开评论复盘',{exact:true})).toHaveCount(0);
  const status=await (await f.host.request.get(`/api/records/${f.recordId}/share`)).json();
  expect((await f.host.request.post(`/api/records/${f.recordId}/share`,{data:{action:'revoke',revision:status.revision}})).ok()).toBe(true);
  await visibility(f.page,'visible');await expect(f.page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible();await expect(f.page.getByText('公开评论复盘',{exact:true})).toHaveCount(0);
 }finally{await f.close();}
});
test('offline closes unsaved notes and reconnect requires a successful authoritative read',async({page})=>{
 await page.goto('/');await expect(page.getByLabel('你的昵称')).toBeVisible();await page.getByLabel('你的昵称').fill('尚未保存的输入');
 await page.context().setOffline(true);await expect(page.getByLabel('你的昵称')).toHaveCount(0);await expect(page.getByText('目前无法联机',{exact:true})).toBeVisible();
 await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'UNAVAILABLE'}}));await page.context().setOffline(false);await expect(page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible();await expect(page.getByLabel('你的昵称')).toHaveCount(0);
 await page.unroute('**/api/session');await page.getByRole('button',{name:'重新连接',exact:true}).click();await expect(page.getByLabel('你的昵称')).toHaveValue('');
});
test('a login completing after concealment invalidates an older guest recovery',async({page,browser})=>{
 const username='late_'+crypto.randomUUID().slice(0,8),setup=await browser.newContext();try{await setup.request.get('/api/session');expect((await setup.request.post('/api/auth/register',{data:{username,password:'synthetic-password',nickname:'迟到登录的新会话'}})).ok()).toBe(true);}finally{await setup.close();}
 await page.goto('/');await page.getByRole('button',{name:'登录 / 注册',exact:true}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('synthetic-password');
 let loginStarted!:()=>void,loginRelease!:()=>void,readStarted!:()=>void,readRelease!:()=>void;const loginArrived=new Promise<void>(r=>loginStarted=r),loginGate=new Promise<void>(r=>loginRelease=r),readArrived=new Promise<void>(r=>readStarted=r),readGate=new Promise<void>(r=>readRelease=r);let first=true;
 await page.route('**/api/auth/login',async route=>{loginStarted();await loginGate;const response=await route.fetch();await route.fulfill({response});});
 await page.route('**/api/session',async route=>{if(!first){await route.continue();return;}first=false;const response=await route.fetch();readStarted();await readGate;await route.fulfill({response});});
 try{await page.getByRole('button',{name:'登录',exact:true}).click();await loginArrived;await visibility(page,'hidden');await visibility(page,'visible');await readArrived;loginRelease();await expect(page.getByRole('button',{name:'迟到登录的新会话',exact:true})).toBeVisible();readRelease();await expect(page.getByRole('button',{name:'迟到登录的新会话',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toHaveCount(0);}finally{loginRelease();readRelease();}
});
test('late identity from before backgrounding cannot reopen the private card',async({page,browser})=>{
 await page.goto('/');await expect(page.getByLabel('你的昵称',{exact:true})).toBeVisible();const created=await page.request.post('/api/rooms',{data:{nickname:'迟到身份合成玩家',requestId:crypto.randomUUID()}});expect(created.ok(),String(created.status())).toBe(true);const {room}=await created.json();await prepareOrdinaryRoom(browser,page.context(),room);await page.reload();await page.locator('.recent-room').click();
 let release!:()=>void,started!:()=>void,first=true;const gate=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>started=r);await page.route(`**/api/rooms/${room.id}/identity`,async route=>{if(!first){await route.continue();return;}first=false;const response=await route.fetch();started();await gate;await route.fulfill({response});});
 try{await page.getByRole('button',{name:'查看身份',exact:true}).click();await arrived;await visibility(page,'hidden');await expect(page.getByTestId('private-role')).toHaveCount(0);await visibility(page,'visible');await expect(page.getByRole('button',{name:'查看身份',exact:true})).toBeEnabled();release();await expect(page.getByTestId('private-role')).toHaveCount(0);await page.getByRole('button',{name:'查看身份',exact:true}).click();await expect(page.getByTestId('private-role')).toBeVisible();}finally{release();}
});
test('six-second bootstrap timeout stays closed until an explicit retry succeeds',async({page})=>{
 await page.route('**/api/session',()=>{});await page.goto('/');await expect(page.getByText('读取超时，请重试',{exact:true})).toBeVisible({timeout:8000});await expect(page.getByLabel('你的昵称')).toHaveCount(0);await page.unroute('**/api/session');await page.getByRole('button',{name:'重新连接',exact:true}).click();await expect(page.getByLabel('你的昵称')).toBeVisible();
});
test('authentication finishing while still hidden cannot reopen content before fresh foreground authority',async({page,browser})=>{
 const username='hidden_'+crypto.randomUUID().slice(0,8),setup=await browser.newContext();try{await setup.request.get('/api/session');expect((await setup.request.post('/api/auth/register',{data:{username,password:'synthetic-password',nickname:'隐藏时完成登录'}})).ok()).toBe(true);}finally{await setup.close();}
 await page.goto('/');await page.getByRole('button',{name:'登录 / 注册',exact:true}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('synthetic-password');
 let release!:()=>void,started!:()=>void;const gate=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>started=r);let reads=0;
 await page.route('**/api/auth/login',async route=>{started();await gate;const response=await route.fetch();await route.fulfill({response});});
 await page.route('**/api/session',async route=>{reads++;await route.continue();});
 try{await page.getByRole('button',{name:'登录',exact:true}).click();await arrived;await visibility(page,'hidden');const completed=page.waitForResponse('**/api/auth/login');release();await completed;
  // A same-renderer round trip observes auth promise continuations without an arbitrary delay.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(page.locator('[data-recovery-content]')).toBeHidden();expect(reads).toBe(0);await expect(page.getByRole('button',{name:'隐藏时完成登录',exact:true})).toHaveCount(0);
  expect((await page.request.post('/api/auth/logout',{data:{}})).ok()).toBe(true);await visibility(page,'visible');await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toBeVisible();expect(reads).toBe(1);await expect(page.getByRole('button',{name:'隐藏时完成登录',exact:true})).toHaveCount(0);
 }finally{release();}
});
test('real history back and forward recheck a revoked anonymous share',async({browser})=>{
 const f=await communityFixture(browser);try{
  await f.page.goto('/share/'+f.shareToken);await expect(f.page.getByText('公开评论复盘',{exact:true})).toBeVisible();await f.page.goto('/offline.html');await expect(f.page.getByRole('heading',{name:'目前无法联机',exact:true})).toBeVisible();
  const status=await (await f.host.request.get(`/api/records/${f.recordId}/share`)).json();expect((await f.host.request.post(`/api/records/${f.recordId}/share`,{data:{action:'revoke',revision:status.revision}})).ok()).toBe(true);
  await f.page.goBack();await expect(f.page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible();await expect(f.page.getByText('公开评论复盘',{exact:true})).toHaveCount(0);
  await f.page.goForward();await expect(f.page.getByRole('heading',{name:'目前无法联机',exact:true})).toBeVisible();await f.page.goBack();await expect(f.page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible();await expect(f.page.getByText('公开评论复盘',{exact:true})).toHaveCount(0);expect(await f.reader.cookies()).toEqual([]);
 }finally{await f.close();}
});
