import {configureRoom} from './helpers/preparation-settings';
import {test,expect,type Browser,type BrowserContext,type Page} from '@playwright/test';
const roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
async function room(browser:Browser,physical=false){
 const host=await browser.newContext({viewport:{width:390,height:844}});const page=await host.newPage();const guests:BrowserContext[]=[];
 await page.goto('/');await page.getByLabel('你的昵称').fill('房主');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();
 if(physical)await configureRoom(page,{dealMethod:'physical',gameMode:'manual'});
 const view=await page.evaluate(async()=> (await (await fetch('/api/session')).json()).rooms[0]);const path=`/api/rooms/${view.room.id}`;
 for(let i=1;i<12;i++){
  const c=await browser.newContext();guests.push(c);await c.request.get('/api/session');await c.request.post('/api/rooms/join',{data:{nickname:'玩家'+i,code:view.room.code}});
  await c.request.post(path+'/seat',{data:{seat:i+1}});await c.request.post(path+'/ready',{data:{ready:true,settingsRevision:view.room.preparation.settingsRevision}});
 }
 return {host,page,guests,path,code:view.room.code,async close(){await Promise.all([host,...guests].map(c=>c.close()));}};
}
test('mobile host participates, online cards stay private through refresh and start',async({browser})=>{
 const f=await room(browser);try{
  await expect(f.page.getByText('12 人 · 预女猎白',{exact:true}).first()).toBeVisible();
  await expect(f.page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
  const readyButton=f.page.getByRole('button',{name:'准备',exact:true});
  const bounds=await readyButton.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.y+bounds!.height).toBeLessThan(844);
  await readyButton.click();await f.page.getByRole('button',{name:'开始发牌',exact:true}).click();
  await expect(f.page.getByRole('button',{name:'查看身份',exact:true})).toBeVisible();
  await f.page.getByRole('button',{name:'查看身份',exact:true}).click();await expect(f.page.getByTestId('private-role')).toBeVisible();
  const role=await f.page.getByTestId('private-role').innerText();
  await f.page.getByRole('button',{name:'隐藏身份',exact:true}).click();await expect(f.page.getByTestId('private-role')).toHaveCount(0);
  await f.page.reload();await f.page.getByRole('button',{name:'查看身份',exact:true}).click();await expect(f.page.getByTestId('private-role')).toHaveText(role);
  await f.page.getByRole('button',{name:'确认身份',exact:true}).click();
  for(const c of f.guests)expect((await c.request.post(f.path+'/identity/confirm',{data:{}})).ok()).toBeTruthy();
  await f.page.getByRole('button',{name:'开始对局',exact:true}).click();await expect(f.page.getByRole('heading',{name:'身份已锁定',exact:true})).toBeVisible();
  await f.page.reload();await expect(f.page.getByRole('heading',{name:'身份已锁定',exact:true})).toBeVisible();
  const guest=await f.guests[0].newPage();await guest.goto('/');await guest.locator('.recent-room').click();
  await expect(guest.getByRole('group',{name:'发牌方式',exact:true})).toHaveCount(0);await expect(guest.getByRole('button',{name:'开始对局',exact:true})).toHaveCount(0);
  await guest.getByRole('button',{name:'查看身份',exact:true}).click();await expect(guest.getByTestId('private-role')).toBeVisible();
  await guest.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(guest.getByTestId('private-role')).toHaveCount(0);
  await expect(f.page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await f.page.screenshot({path:'test-results/preparation-mobile.png',fullPage:true});
  await f.page.getByRole('button',{name:'开始首夜',exact:true}).click();await expect(guest.getByRole('heading',{name:'狼人行动',exact:true})).toBeVisible();
  for(const name of ['准备','确认手机已就绪','开始夜晚','开始首夜'])await expect(guest.getByRole('button',{name,exact:true})).toHaveCount(0);await expect(guest.getByRole('button',{name:'查看操作',exact:true})).toHaveCount(0);const nightCard=await (await f.guests[0].request.get(f.path+'/night/private')).json();if(nightCard.kind==='waiting'){await expect(guest.locator('.night-note')).toContainText('等待自己的行动阶段');await expect(guest.getByRole('button',{name:/^提交刀口/})).toHaveCount(0);}else await expect(guest.getByRole('button',{name:/^提交刀口/})).toBeVisible();
 }finally{await f.close();}
});
test('physical roles can be corrected privately with one uniform mismatch warning',async({browser})=>{
 const f=await room(browser,true);try{
  await f.page.getByRole('button',{name:'准备',exact:true}).click();await f.page.getByRole('button',{name:'开始发牌',exact:true}).click();
  await f.page.getByRole('button',{name:'查看身份',exact:true}).click();await f.page.getByLabel('你的实体身份').selectOption('wolf');await f.page.getByRole('button',{name:'提交身份',exact:true}).click();
  for(const c of f.guests)await c.request.post(f.path+'/identity',{data:{role:'wolf'}});
  await expect(f.page.getByText('角色数量不匹配，请各自检查身份')).toBeVisible();await expect(f.page.getByRole('button',{name:'开始对局',exact:true})).toBeDisabled();
  const other=await f.guests[0].newPage();await other.goto('/');await other.locator('.recent-room').click();await expect(other.getByText('角色数量不匹配，请各自检查身份')).toBeVisible();
  for(let i=0;i<11;i++)await f.guests[i].request.post(f.path+'/identity',{data:{role:roles[i+1]}});
  await expect(f.page.getByText('角色数量不匹配，请各自检查身份')).toHaveCount(0);
  await f.page.getByRole('button',{name:'开始对局',exact:true}).click();await expect(f.page.getByRole('heading',{name:'纯手动记录',exact:true})).toBeVisible();
  expect((await f.guests[0].request.post(f.path+'/identity',{data:{role:'seer'}})).status()).toBe(409);
 }finally{await f.close();}
});
test('mobile seat correction clears preparation and dealing response loss does not redraw',async({browser})=>{
 const f=await room(browser);try{
  await f.page.getByRole('button',{name:'取消入座',exact:true}).click();await f.guests[10].request.post(f.path+'/unseat',{data:{}});
  await f.page.getByRole('button',{name:'12 号座位，空位',exact:true}).click();
  await f.guests[10].request.post(f.path+'/seat',{data:{seat:1}});await f.guests[10].request.post(f.path+'/ready',{data:{ready:true,settingsRevision:0}});
  await f.page.getByRole('button',{name:'准备',exact:true}).click();
  let original:string|null=null,handled!:()=>void;const dropped=new Promise<void>(resolve=>handled=resolve);await f.page.route('**/deal',async r=>{await r.fetch();original=(await (await f.host.request.get(f.path+'/identity')).json()).role;await r.abort('failed');handled();});
  await f.page.getByRole('button',{name:'开始发牌',exact:true}).click();await dropped;await expect(f.page.getByRole('button',{name:'查看身份',exact:true})).toBeVisible();
  await f.page.unroute('**/deal');await f.page.reload();expect((await f.host.request.post(f.path+'/deal',{data:{}})).ok()).toBeTruthy();
  expect((await (await f.host.request.get(f.path+'/identity')).json()).role).toBe(original);
 }finally{await f.close();}
});

test('phone controls fit narrow screens and essential text has readable contrast',async({browser})=>{
 const f=await room(browser);try{
  for(const width of [320,390,430]){
   await f.page.setViewportSize({width,height:844});await expect(f.page.locator('body')).toHaveJSProperty('scrollWidth',width);
   const seatGrid=await f.page.locator('.seat-grid').boundingBox();
   const ready=await f.page.getByRole('button',{name:'准备',exact:true}).boundingBox();
   expect(seatGrid!.y+seatGrid!.height).toBeLessThan(ready!.y);
   expect(ready!.y+ready!.height).toBeLessThan(844);
   await expect(f.page.locator('.room-details')).not.toHaveAttribute('open','');
  }
  if(!await f.page.getByRole('group',{name:'发牌方式',exact:true}).isVisible())await f.page.locator('.host-settings summary').click();
  await f.page.locator('.room-details summary').click();
  await expect(f.page.getByRole('button',{name:'更换板子',exact:true})).toHaveCSS('font-size','16px');
  for(const button of [f.page.getByRole('button',{name:'准备',exact:true}),f.page.getByRole('button',{name:'复制房间号',exact:true})]){
   const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const colors=await f.page.evaluate(()=>['.helper','.role-chips span:first-child','.subtle','.seat.yours .seat-name'].map(selector=>{
   const element=document.querySelector(selector)!;const fg=getComputedStyle(element).color;let current:Element|null=element;let bg='rgb(255, 255, 255)';
   while(current){const c=getComputedStyle(current).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'){bg=c;break;}current=current.parentElement;}
   return {selector,fg,bg};
  }));
  const luminance=(color:string)=>{
   const c=color.match(/[\d.]+/g)!.slice(0,3).map(v=>Number(v)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
   return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
  };
  for(const {selector,fg,bg} of colors){const a=luminance(fg),b=luminance(bg);expect((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),selector).toBeGreaterThanOrEqual(4.5);}
 }finally{await f.close();}
});
