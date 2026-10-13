import {test,expect} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';

test('admin fixture honors browser bootstrap Retry-After and keeps its session',async({page})=>{
 let reads=0,limitedAt=0,retryAt=0;
 await page.route('**/api/session',async route=>{reads++;if(reads===2){limitedAt=Date.now();await route.fulfill({status:429,headers:{'retry-after':'1'},contentType:'application/json',body:JSON.stringify({error:'RATE_LIMITED'})});}else{if(reads===3)retryAt=Date.now();await route.continue();}});
 await loginTestAdmin(page);await expect(page.getByRole('button',{name:'后台',exact:true})).toBeVisible();expect(reads).toBe(3);expect(retryAt-limitedAt).toBeGreaterThanOrEqual(1000);
});
