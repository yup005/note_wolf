import {test,expect,type BrowserContext} from '@playwright/test';

test('manual mixed-blood board explicitly adjudicates and publishes with visible provenance',async({browser})=>{
 test.setTimeout(60000);const contexts:BrowserContext[]=[];
 const roles=['wolf','wolf','wolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard','mechanicalWolf','mixer'];
 try{
  for(let i=0;i<roles.length;i++){const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);await context.request.get('/api/session');}
  const host=contexts[0],peer=contexts[12];
  const room=(await (await host.request.post('/api/rooms',{data:{nickname:'Synthetic manual host',requestId:crypto.randomUUID()}})).json()).room,path=`/api/rooms/${room.id}`;
  expect((await host.request.post(path+'/board',{data:{settingsRevision:0,selection:{kind:'composition',composition:{seatCount:13,roles:{wolf:3,villager:4,spiritSeer:1,witch:1,hunter:1,guard:1,mechanicalWolf:1,mixer:1}}}}})).ok()).toBe(true);
  expect((await host.request.post(path+'/settings',{data:{dealMethod:'physical',gameMode:'manual'}})).ok()).toBe(true);
  const revision=(await (await host.request.get(path)).json()).room.preparation.settingsRevision;
  for(let i=0;i<roles.length;i++){const context=contexts[i];if(i)await context.request.post('/api/rooms/join',{data:{nickname:`Synthetic ${i+1}`,code:room.code}});expect((await context.request.post(path+'/seat',{data:{seat:i+1}})).ok()).toBe(true);expect((await context.request.post(path+'/ready',{data:{ready:true,settingsRevision:revision}})).ok()).toBe(true);}
  expect((await host.request.post(path+'/deal',{data:{}})).ok()).toBe(true);for(let i=0;i<roles.length;i++)expect((await contexts[i].request.post(path+'/identity',{data:{role:roles[i]}})).ok()).toBe(true);expect((await host.request.post(path+'/start',{data:{}})).ok()).toBe(true);
  const page=await host.newPage();await page.goto('/');await page.locator('.recent-room').click();await expect(page.getByRole('heading',{name:'纯手动记录',exact:true})).toBeVisible();await expect(page.locator('.manual-screen .eyebrow')).not.toContainText('预女猎白');
  await page.getByRole('button',{name:'记录与官方结算',exact:true}).click();const editor=page.getByRole('dialog',{name:'独立对局记录'});
  for(const seat of [1,2,3,12])await editor.getByRole('button',{name:`记录 ${seat} 号死亡`,exact:true}).click();
  await editor.getByRole('button',{name:'提交官方记录',exact:true}).click();await editor.getByRole('button',{name:'确认提交官方记录',exact:true}).click();
  expect((await (await peer.request.get(path)).json()).room.manual.status).toBe('playing');expect((await (await peer.request.get(path)).json()).room.manual.revealed).toEqual([]);
  await editor.getByRole('button',{name:'人工裁定胜负',exact:true}).click();await editor.getByLabel('人工裁定结果').selectOption('good');await editor.getByRole('button',{name:'确认人工裁定并结束',exact:true}).click();
  await expect(page.getByRole('heading',{name:'对局结束',exact:true})).toBeVisible();await expect(page.locator('.manual-screen')).toContainText('房主人工裁定');
  await editor.getByRole('button',{name:'发布当前版本',exact:true}).click();await expect(editor.getByRole('status')).toContainText('已发布');
  const list=await (await host.request.get(path+'/records')).json(),post=await (await peer.request.get('/api/records/'+list.own.id)).json();expect(post.outcome).toBe('good');expect(post.roles).toHaveLength(13);
  await page.reload();await expect(page.locator('.manual-screen')).toContainText('房主人工裁定');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
 }finally{await Promise.all(contexts.map(context=>context.close()));}
});
