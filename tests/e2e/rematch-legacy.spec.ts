import {test,expect} from '@playwright/test';
import {communityFixture} from './helpers/community';
test('legacy archive without board metadata edits notes and publishes without altering facts',async({browser})=>{
 const f=await communityFixture(browser);try{
  expect((await f.host.request.post(f.path+'/rematch',{headers:{'X-Wolf-Game-Id':f.room.id},data:{requestId:crypto.randomUUID(),expectedGameId:f.room.id}})).ok()).toBe(true);
  const original=(await (await f.host.request.get(`/api/games/${f.room.id}/records`)).json()).own;
  const page=await f.host.newPage();await page.route(`**/api/games/${f.room.id}/record-context`,async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,board:null}});});
  await page.goto('/');const records=page.getByRole('region',{name:'我的记录'});await records.getByRole('button',{name:'我的记录',exact:true}).click();await records.getByRole('button',{name:'编辑记录',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'独立对局记录'});await expect(dialog).toContainText('旧归档未保留完整板子配置');await dialog.getByLabel('个人推理与补充').fill('旧归档独立笔记');await dialog.getByRole('button',{name:'发布当前版本',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('已发布当前版本');
  const result=(await (await f.host.request.get(`/api/games/${f.room.id}/records`)).json()).own;expect(result.document.deaths).toEqual(original.document.deaths);expect(result.document.notes).toBe('旧归档独立笔记');
 }finally{await f.close();}
});
