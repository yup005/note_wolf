import {test,expect,type Page,type APIResponse} from '@playwright/test';
let adminCookie:string|undefined;
// The synthetic suite shares one admin. Respect real backpressure rather than
// replacing its session or weakening the service's request/auth limits.
export async function requestWithBackoff(request:()=>Promise<APIResponse>){
 let response=await request();
 if(response.status()===429){
  const seconds=Number(response.headers()['retry-after']??'60');
  const wait=Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,60000):60000;
  test.info().setTimeout(test.info().timeout+wait+5000);
  await new Promise(resolve=>setTimeout(resolve,wait));
  response=await request();
 }
 return response;
}
export async function loginTestAdmin(page:Page){
 const initial=await requestWithBackoff(()=>page.request.get('/api/session'));expect(initial.ok()).toBe(true);
 if(adminCookie)await page.context().addCookies([{name:'wolf_session',value:adminCookie,url:'http://127.0.0.1:3100'}]);
 const sessionResponse=await requestWithBackoff(()=>page.request.get('/api/session'));expect(sessionResponse.ok()).toBe(true);const current=await sessionResponse.json();
 if(current.account?.role!=='admin'){
  const response=await requestWithBackoff(()=>page.request.post('/api/auth/login',{data:{username:'test_admin',password:'test-admin-password'}}));expect(response.ok()).toBe(true);
  adminCookie=(await page.context().cookies()).find(c=>c.name==='wolf_session')!.value;
 }
 await page.goto('/');
 await page.evaluate(()=>{localStorage.removeItem('wolf.room');localStorage.removeItem('wolf.pending-create');});
 await page.reload();await expect(page.getByRole('button',{name:'后台',exact:true})).toBeVisible();
}
