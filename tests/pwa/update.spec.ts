import {test,expect} from './fixtures';
import {buildPwa} from './helpers/production';
import {join} from 'node:path';
import {readFile,rm} from 'node:fs/promises';
test('new build waits for all old windows and keeps their cached lazy assets',async({browser,production})=>{
 test.setTimeout(60000);const context=await browser.newContext(),one=await context.newPage(),two=await context.newPage();
 try{
  await one.goto('/');await expect.poll(()=>one.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);await one.reload();await two.goto('/');await expect(one.getByLabel('你的昵称')).toBeVisible();await expect(two.getByLabel('你的昵称')).toBeVisible();
  const old=await one.evaluate(async()=>{const names=await caches.keys();const owned=names.find(n=>n.startsWith('note-wolf-static-'))!;const requests=await (await caches.open(owned)).keys();const lazy=requests.find(r=>r.url.includes('FavoritesPanel'))!;await caches.open('unrelated-application');return {owned,lazy:lazy.url};});
  const next=await buildPwa(join(production.temporary,'b'),'globalThis.__pwaSyntheticVersion="B";');production.server.setRoot(next);await one.getByLabel('你的昵称').fill('still editing');await one.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});
  await expect.poll(()=>one.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);await expect(one.getByText('新版本已准备，请先保存笔记，关闭本站所有窗口后重新打开',{exact:true})).toBeVisible();await expect(one.getByLabel('你的昵称')).toHaveValue('still editing');
  expect(await one.evaluate(async old=>(await caches.keys()).includes(old),old.owned)).toBe(true);expect(await one.evaluate(async url=>(await fetch(url)).ok,old.lazy)).toBe(true);
  await one.close();expect(await two.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);await two.close();
  const fresh=await context.newPage();await fresh.goto('/');await expect.poll(()=>fresh.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active)&&!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  await expect.poll(()=>fresh.evaluate(async old=>!(await caches.keys()).includes(old),old.owned)).toBe(true);expect(await fresh.evaluate(async()=>(await caches.keys()).includes('unrelated-application'))).toBe(true);
 }finally{production.server.setRoot(production.root);await context.close();}
});
test('failed real update discards its partial cache and preserves the active build',async({page,context,production})=>{
 await page.goto('/');await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active))).toBe(true);await page.reload();await expect(page.getByLabel('你的昵称')).toBeVisible();
 const current=await page.evaluate(async()=>(await caches.keys()).filter(n=>n.startsWith('note-wolf-static-')));
 const broken=await buildPwa(join(production.temporary,'broken'),'globalThis.__pwaSyntheticVersion="broken";'),script=await readFile(join(broken,'sw.js'),'utf8'),metadata=JSON.parse(script.match(/^const BUILD=(.*);$/m)![1]);const missing=metadata.assets.find((a:{url:string})=>a.url.includes('JudgePanel')).url;await rm(join(broken,missing.slice(1)));
 try{production.server.setRoot(broken);await page.getByLabel('你的昵称').fill('editing survives');const response=context.waitForEvent('response',{predicate:r=>new URL(r.url()).pathname===missing});await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration())!.update();});expect((await response).status()).toBe(404);
  await expect.poll(()=>page.evaluate(async()=>(await caches.keys()).filter(n=>n.startsWith('note-wolf-static-')))).toEqual(current);await expect.poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return Boolean(r?.active)&&!r?.installing&&!r?.waiting;})).toBe(true);await expect(page.getByLabel('你的昵称')).toHaveValue('editing survives');
 }finally{production.server.setRoot(production.root);}
});
