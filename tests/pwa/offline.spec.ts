import {test,expect} from './fixtures';
test('installed application shows only an offline page until current authority returns',async({page,context})=>{
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);await page.reload();await expect(page.getByLabel('你的昵称')).toBeVisible();await page.getByLabel('你的昵称').fill('PWA_UNSAVED_SENTINEL');
 await context.setOffline(true);await expect(page.getByLabel('你的昵称')).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'目前无法联机',exact:true})).toBeVisible();await expect(page.locator('body')).not.toContainText('PWA_UNSAVED_SENTINEL');expect(await page.locator('[data-recovery-content]').count()).toBe(0);
 await context.setOffline(false);await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'UNAVAILABLE'}}));await page.getByRole('button',{name:'重新连接',exact:true}).click();await expect(page.getByRole('heading',{name:'暂时无法连接',exact:true})).toBeVisible();await expect(page.getByLabel('你的昵称')).toHaveCount(0);
 await page.unroute('**/api/session');await page.getByRole('button',{name:'重新连接',exact:true}).click();await expect(page.getByLabel('你的昵称')).toHaveValue('');
});
test('evicted fallback and first-ever offline visits never resurrect an application page',async({page,context,browser})=>{
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);await page.reload();await expect(page.getByLabel('你的昵称')).toBeVisible();await page.getByLabel('你的昵称').fill('PWA_EVICTED_SENTINEL');
 await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('note-wolf-static-'))await (await caches.open(name)).delete('/offline.html');});await context.setOffline(true);
 await expect(page.goto('/offline-evicted')).rejects.toThrow();await expect(page.locator('body')).not.toContainText('PWA_EVICTED_SENTINEL');
 const first=await browser.newContext({offline:true});try{await expect((await first.newPage()).goto('/')).rejects.toThrow();}finally{await first.close();}
});
test('a browser without Service Worker support still uses the authoritative online app',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined,configurable:true}));await page.goto('/');await expect(page.getByLabel('你的昵称')).toBeVisible();await expect(page.getByRole('button',{name:'创建房间',exact:true})).toBeVisible();
});
