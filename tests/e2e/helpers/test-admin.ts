import {expect,type Page} from '@playwright/test';
let adminCookie:string|undefined;
export async function loginTestAdmin(page:Page){
 await page.request.get('/api/session');
 if(adminCookie)await page.context().addCookies([{name:'wolf_session',value:adminCookie,url:'http://127.0.0.1:3100'}]);
 const current=await (await page.request.get('/api/session')).json();
 if(current.account?.role!=='admin'){
  const response=await page.request.post('/api/auth/login',{data:{username:'test_admin',password:'test-admin-password'}});expect(response.ok()).toBe(true);
  adminCookie=(await page.context().cookies()).find(c=>c.name==='wolf_session')!.value;
 }
 await page.goto('/');
 await page.evaluate(()=>{localStorage.removeItem('wolf.room');localStorage.removeItem('wolf.pending-create');});
 await page.reload();await expect(page.getByRole('button',{name:'后台',exact:true})).toBeVisible();
}
