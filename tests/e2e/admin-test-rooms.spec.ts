import {test,expect} from '@playwright/test';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';
test('guest and ordinary hosts see no test entry and forged test requests are refused',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toBeEnabled();
 for(const registered of [false,true]){
  if(registered){const r=await requestWithBackoff(()=>page.request.post('/api/auth/register',{data:{username:'test_gate_'+crypto.randomUUID().slice(0,8),password:'synthetic-password',nickname:'Ordinary'}}));expect(r.ok()).toBe(true);}
  const created=await (await page.request.post('/api/rooms',{data:{nickname:'Host',requestId:crypto.randomUUID()}})).json();const path=`/api/rooms/${created.room.id}`;
  expect(created.testPlayersEnabled).toBe(false);await page.request.post(path+'/seat',{data:{seat:1}});
  await page.evaluate(id=>localStorage.setItem('wolf.room',id),created.room.id);await page.reload();
  await expect(page.getByRole('button',{name:'补满测试玩家',exact:true})).toHaveCount(0);await expect(page.locator('.test-console')).toHaveCount(0);
  const before=await (await page.request.get(path)).json();const denied=await page.request.post(path+'/test-players',{data:{}});expect(denied.status()).toBe(403);expect((await denied.json()).error).toBe('ADMIN_ONLY');
  expect((await (await page.request.get(path)).json()).room).toEqual(before.room);
 }
});
test('admin creates an isolated labelled room while an independent guest cannot join or read the room',async({page,browser})=>{
 await loginTestAdmin(page);await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();
 await expect(page.getByText('测试房间 · 模拟玩家')).toBeVisible();const view=(await (await page.request.get('/api/session')).json()).rooms[0];
 const other=await browser.newContext();try{
  await other.request.get('/api/session');const r=await other.request.post('/api/rooms/join',{data:{code:view.room.code,nickname:'Outsider'}});expect(r.status()).toBe(403);expect((await r.json()).error).toBe('TEST_ROOM_PRIVATE');
  expect((await other.request.get(`/api/rooms/${view.room.id}`)).status()).toBe(403);expect((await other.request.get(`/api/rooms/${view.room.id}/test-roles`)).status()).toBe(403);
  expect((await (await other.request.get('/api/session')).json()).rooms).toEqual([]);
 }finally{await other.close();}
 await page.reload();await expect(page.getByText('测试房间 · 模拟玩家')).toBeVisible();await expect(page.locator('.test-console')).toBeVisible();
});
