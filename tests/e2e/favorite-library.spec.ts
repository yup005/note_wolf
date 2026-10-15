import {requestWithBackoff} from './helpers/test-admin';
import {test,expect,type Page,type Browser} from '@playwright/test';
import {prepareOrdinaryRoom} from './helpers/real-players';
async function fixture(page:Page,browser:Browser){
 await page.goto('/');await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toBeEnabled();
 const username='fav_'+crypto.randomUUID().slice(0,8),password='synthetic-favorite-password';
 const registration=await requestWithBackoff(()=>page.request.post('/api/auth/register',{data:{username,password,nickname:'VIP收藏玩家'}}));expect(registration.ok()).toBe(true);const account=(await registration.json()).account;
 const admin=await browser.newContext();await admin.request.get('/api/session');expect((await requestWithBackoff(()=>admin.request.post('/api/auth/login',{data:{username:'test_admin',password:'test-admin-password'}}))).ok()).toBe(true);expect((await admin.request.post(`/api/admin/users/${account.id}/vip`,{data:{enabled:true,expiresAt:null}})).ok()).toBe(true);
 const room=(await (await page.request.post('/api/rooms',{data:{nickname:'VIP收藏玩家',requestId:crypto.randomUUID()}})).json()).room,path=`/api/rooms/${room.id}`;
 const roles=await prepareOrdinaryRoom(browser,page.context(),room,'manual');const draft=(await (await page.request.get(path+'/records')).json()).own;
 const document={deaths:roles.filter(p=>p.role==='wolf').map(p=>({seat:p.seat,round:1,period:'night',cause:'unrecorded'})),votes:[],badges:[],exiles:[],notes:'Published searchable orchard'};
 for(const [p,body] of [[path+'/record',{revision:0,document}],[path+'/manual/commit',{revision:1}],[path+'/record/publish',{revision:1}],[`/api/records/${draft.id}/favorite`,{}]] as const)expect((await page.request.post(p,{data:body})).ok()).toBe(true);
 await page.reload();return {admin,account,room,path,id:draft.id,document,username,password};
}
test('VIP manages searchable favorites and a private name survives independent account recovery',async({page,browser})=>{
 const f=await fixture(page,browser);try{
  const favorites=page.getByRole('region',{name:'我的收藏'});await expect(favorites.getByLabel('搜索收藏')).toBeVisible();
  await favorites.getByLabel('搜索收藏').fill('orchard');await favorites.getByRole('button',{name:'应用筛选',exact:true}).click();await expect(favorites.locator('.favorite-game')).toHaveCount(1);
  await page.request.post(f.path+'/record',{data:{revision:1,document:{...f.document,notes:'Unpublished secret'}}});
  await favorites.getByLabel('搜索收藏').fill('Unpublished');await favorites.getByRole('button',{name:'应用筛选',exact:true}).click();await expect(favorites).toContainText('没有符合条件的收藏');
  await favorites.getByRole('button',{name:'清除筛选',exact:true}).click();await favorites.getByRole('button',{name:'重命名',exact:true}).click();const dialog=page.getByRole('dialog',{name:'收藏名称'});
  await dialog.getByLabel('自定义名称').fill('我的复盘 🌙');await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await expect(favorites.getByRole('button',{name:'我的复盘 🌙',exact:false})).toBeVisible();
  await favorites.getByRole('button',{name:'重命名',exact:true}).click();await dialog.getByLabel('自定义名称').fill('保留我的输入');expect((await page.request.post(`/api/favorite-library/record/${f.id}/name`,{data:{name:'另一端名称',revision:1}})).ok()).toBe(true);
  await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('收藏名称已更新');await dialog.getByRole('button',{name:'读取最新名称',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('另一端名称');await expect(dialog.getByLabel('自定义名称')).toHaveValue('保留我的输入');await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await expect(favorites).toContainText('保留我的输入');
  await favorites.getByLabel('收藏板子').selectOption('standard-12');await favorites.getByLabel('收藏作者').selectOption('VIP收藏玩家');await favorites.getByLabel('收藏排序').selectOption('saved-asc');await favorites.getByRole('button',{name:'应用筛选',exact:true}).click();await expect(favorites.locator('.favorite-game')).toHaveCount(1);
  await favorites.getByLabel('收藏日期从').fill('2099-01-01');await favorites.getByRole('button',{name:'应用筛选',exact:true}).click();await expect(favorites).toContainText('没有符合条件的收藏');await favorites.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(favorites.locator('.favorite-game')).toHaveCount(1);
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
  await page.screenshot({path:'test-results/favorite-library-mobile.png',fullPage:true});
  const other=await browser.newContext();try{await other.request.get('/api/session');expect((await requestWithBackoff(()=>other.request.post('/api/auth/login',{data:{username:f.username,password:f.password}}))).ok()).toBe(true);const second=await other.newPage();await second.goto('/');await expect(second.getByRole('region',{name:'我的收藏'})).toContainText('保留我的输入');}finally{await other.close();}
 }finally{await f.admin.close();}
});
test('VIP expiry hides advanced controls while keeping owned names and ordinary cancellation',async({page,browser})=>{
 const f=await fixture(page,browser);try{
  expect((await page.request.post(`/api/favorite-library/record/${f.id}/name`,{data:{name:'保留名称',revision:0}})).ok()).toBe(true);
  expect((await f.admin.request.post(`/api/admin/users/${f.account.id}/vip`,{data:{enabled:false,expiresAt:null}})).ok()).toBe(true);await page.reload();
  const favorites=page.getByRole('region',{name:'我的收藏'});await expect(favorites).toContainText('保留名称');await expect(favorites.getByLabel('搜索收藏')).toHaveCount(0);await expect(favorites.getByRole('button',{name:'重命名',exact:true})).toHaveCount(0);
  expect((await page.request.get('/api/favorite-library?q=保留')).status()).toBe(403);await favorites.getByRole('button',{name:'取消收藏版本',exact:true}).click();await expect(favorites).toContainText('暂无收藏');
 }finally{await f.admin.close();}
});
