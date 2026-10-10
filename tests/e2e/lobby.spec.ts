import {test,expect,type Browser,type Page} from '@playwright/test';
async function guest(browser:Browser,name:string){const ctx=await browser.newContext({viewport:{width:390,height:844}});const page=await ctx.newPage();await page.goto('/');await page.getByLabel('你的昵称').fill(name);return {ctx,page};}
async function join(page:Page,code:string){await page.getByLabel('房间号第 1 位').fill(code);await expect(page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();}
test('three independent browsers create, join, see seats, race and refresh',async({browser})=>{
 const [host,a,b]=await Promise.all([guest(browser,'房主'),guest(browser,'小雨'),guest(browser,'阿木')]);
 try{
  const pageErrors:string[]=[];for(const p of [host.page,a.page,b.page])p.on('pageerror',e=>pageErrors.push(e.message));
  await host.page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  await host.page.getByRole('button',{name:'创建房间',exact:true}).click();
  await expect(host.page.getByText('未绑定账号无法跨设备恢复管理权限')).toBeVisible();
  await host.page.getByRole('button',{name:'以游客身份继续'}).click();
  await expect(host.page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();
  const code=(await host.page.getByTestId('room-code').innerText()).replace(/\s/g,'');expect(code).toMatch(/^\d{4}$/);
  await Promise.all([join(a.page,code),join(b.page,code)]);
  await host.page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();
  for(const p of [host.page,a.page,b.page])await expect(p.getByRole('button',{name:/1 号座位，房主/})).toBeVisible();
  await Promise.all([a.page.getByRole('button',{name:'2 号座位，空位',exact:true}).click(),b.page.getByRole('button',{name:'2 号座位，空位',exact:true}).click()]);
  await expect(a.page.getByTestId('seated-count')).toHaveText('2 / 12');
  await expect(b.page.getByTestId('seated-count')).toHaveText('2 / 12');
  const state=await host.page.evaluate(async()=>{const r=await fetch('/api/session');return (await r.json()).rooms[0];});
  const winner=state.room.seats[1].nickname;expect(['小雨','阿木']).toContain(winner);
  const loser=winner==='小雨'?b.page:a.page;
  await loser.getByRole('button',{name:'3 号座位，空位',exact:true}).click();
  for(const p of [host.page,a.page,b.page])await expect(p.getByTestId('seated-count')).toHaveText('3 / 12');
  await a.page.reload();await expect(a.page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();await expect(a.page.getByRole('button',{name:/，你的座位$/})).toBeDisabled();
  await b.ctx.setOffline(true);await expect(b.page.getByRole('status')).toContainText('重新连接');
  await b.ctx.setOffline(false);await expect(b.page.getByRole('status')).toContainText('实时同步');
  await expect(b.page.getByTestId('seated-count')).toHaveText('3 / 12');
  await expect(host.page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await host.page.screenshot({path:'test-results/lobby-mobile.png',fullPage:true});
  await host.page.setViewportSize({width:1280,height:900});await host.page.screenshot({path:'test-results/lobby-desktop.png',fullPage:true});
  expect(pageErrors).toEqual([]);
 }finally{await Promise.all([host.ctx.close(),a.ctx.close(),b.ctx.close()]);}
});
test('OTP supports deletion, paste with leading zero, missing room errors and single guest warning',async({browser})=>{
 const {ctx,page}=await guest(browser,'玩家');
 try{
  await page.getByLabel('房间号第 1 位').fill('00');
  await page.getByLabel('房间号第 3 位').press('Backspace');
  await expect(page.getByLabel('房间号第 2 位')).toHaveValue('');
  const reserved=await page.evaluate(async()=>{
   const res=await fetch('/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nickname:'玩家',requestId:crypto.randomUUID()})});return (await res.json()).room.code;
  });
  // Pick a four-digit code that is not the newly created room, then exercise full clipboard paste.
  const missing=reserved==='0000'?'0001':'0000';
  await page.getByLabel('房间号第 1 位').evaluate((el,code)=>{const d=new DataTransfer();d.setData('text/plain',code);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));},missing);
  await expect(page.getByRole('alert')).toContainText('未找到该房间');
  for(let i=0;i<4;i++)await expect(page.getByLabel(`房间号第 ${i+1} 位`)).toHaveValue(missing[i]);
  await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  await expect(page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();
  await page.getByRole('button',{name:'返回首页'}).click();await page.getByRole('button',{name:'创建房间',exact:true}).click();
  await expect(page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();
 }finally{await ctx.close();}
});
test('12 independent members can fill the lobby',async({browser})=>{
 const {ctx,page}=await guest(browser,'主持人');const contexts=[];
 try{
  await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  const code=(await page.getByTestId('room-code').innerText()).replace(/\s/g,'');
  for(let n=1;n<=12;n++){
   const c=await browser.newContext();contexts.push(c);await c.request.get('/api/session');
   const view=await (await c.request.post('/api/rooms/join',{data:{nickname:`玩家${n}`,code}})).json();
   const res=await c.request.post(`/api/rooms/${view.room.id}/seat`,{data:{seat:n}});expect(res.ok()).toBeTruthy();
  }
  await expect(page.getByTestId('seated-count')).toHaveText('12 / 12');
  await expect(page.getByText('座位已满', {exact:true})).toBeVisible();
 }finally{await Promise.all(contexts.map(c=>c.close()));await ctx.close();}
});
test('reload after a lost create response retries the committed room instead of duplicating it',async({browser})=>{
 const {ctx,page}=await guest(browser,'房主');
 try{
  await page.route('**/api/rooms',async route=>{await route.fetch();await route.abort('failed');});
  await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const committed=await page.evaluate(async()=> (await (await fetch('/api/session')).json()).rooms[0].room.id);
  await page.unroute('**/api/rooms');await page.reload();
  await page.getByLabel('你的昵称').fill('房主');
  await page.getByRole('button',{name:'创建房间',exact:true}).click();
  await expect(page.getByRole('heading',{name:'选择你的座位'})).toBeVisible();
  const current=await page.evaluate(async()=> (await (await fetch('/api/session')).json()).rooms);
  expect(current).toHaveLength(1);expect(current[0].room.id).toBe(committed);
 }finally{await ctx.close();}
});
