import {test,expect} from './fixtures';
test('production assets and actual Worker install without claiming the initial window',async({page})=>{
 await page.goto('/');const manifest=await page.request.get('/manifest.webmanifest');expect(manifest.headers()['cache-control']).toContain('no-store');expect((await manifest.json()).display).toBe('standalone');
 const before=await page.evaluate(()=>Boolean(navigator.serviceWorker.controller));expect(before).toBe(false);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller===null)).toBe(true);
 await page.reload();await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 for(const path of ['/assets/missing.js','/icons/missing','/missing.webmanifest'])expect((await page.request.get(path)).status()).toBe(404);
 expect((await page.request.get('/sw.js')).headers()['content-type']).toContain('javascript');
});
