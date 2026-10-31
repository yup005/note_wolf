import {test,expect} from '@playwright/test';
test('installation_help_is_optional_and_accessible',async({page})=>{
 await page.goto('/');await expect(page.getByRole('dialog')).toHaveCount(0);const button=page.getByRole('button',{name:'添加到主屏幕',exact:true});await button.click();const dialog=page.getByRole('dialog',{name:'添加到主屏幕',exact:true});await expect(dialog).toContainText('Safari');await expect(dialog).toContainText('分享');await expect(dialog).toContainText('保存');
 const close=dialog.getByRole('button',{name:'关闭',exact:true});await expect(close).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
 await dialog.screenshot({path:'test-results/pwa-installation-mobile.png'});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();expect(await page.evaluate(()=>navigator.serviceWorker.controller)).toBeNull();
});
test('standalone installation does not offer a duplicate install action',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));await page.goto('/');await expect(page.getByLabel('你的昵称')).toBeVisible();await expect(page.getByRole('button',{name:'添加到主屏幕',exact:true})).toHaveCount(0);
});
