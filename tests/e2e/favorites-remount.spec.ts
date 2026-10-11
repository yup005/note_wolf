import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

test('login and logout keep one favorites panel and never duplicate sibling React keys',async({page})=>{
 const username='favorites_'+randomUUID().slice(0,8),nickname='收藏切换测试';const errors:string[]=[];
 page.on('console',message=>{if(message.type()==='error'&&message.text().includes('same key'))errors.push(message.text());});
 await page.goto('/');await page.getByRole('button',{name:'登录 / 注册',exact:true}).click();await page.getByRole('button',{name:'注册新账号',exact:true}).click();
 await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('昵称',{exact:true}).fill(nickname);await page.getByLabel('密码',{exact:true}).fill('favorites-test-password');await page.getByRole('button',{name:'注册并登录',exact:true}).click();
 for(let round=0;round<3;round++){
  await expect(page.getByRole('button',{name:nickname,exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:nickname,exact:true}).click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'登录 / 注册',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'登录 / 注册',exact:true}).click();await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill('favorites-test-password');await page.getByRole('button',{name:'登录',exact:true}).click();
 }
 await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toHaveCount(1);expect(errors).toEqual([]);
 await page.screenshot({path:'test-results/favorites-remount-mobile.png',fullPage:true});
});
