import {test,expect,type Page} from '@playwright/test';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';
async function paused(page:Page){
 await page.addInitScript(()=>localStorage.setItem('wolf.voice.enabled','off'));await loginTestAdmin(page);
 const made=await requestWithBackoff(()=>page.request.post('/api/rooms',{data:{nickname:'未来设置样本',requestId:crypto.randomUUID()}}));expect(made.ok()).toBe(true);const {room}=await made.json(),path='/api/rooms/'+room.id;
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)expect((await requestWithBackoff(()=>page.request.post(path+'/'+part,{data}))).ok()).toBe(true);
 const state=async()=>(await (await page.request.get(path)).json()).room;
 const command=async(action:string,extra={})=>expect((await page.request.post(path+'/control',{data:{action,confirmed:true,version:(await state()).control.version,...extra}})).ok()).toBe(true);
 await command('pause');await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();return {path,state,command};
}

// Catch fallback defaults being editable after read failure, or a closed request restoring stale editor values.
test('future settings fail closed, retry explicitly and ignore delayed reads after closing',async({page})=>{
 const f=await paused(page);let fail=true,release=()=>{};
 try{
  await page.route('**/control/defaults',async route=>{if(fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成读取失败'})});}else await route.continue();});
  await page.getByRole('button',{name:'管理',exact:true}).click();await expect(page.getByRole('alert')).toContainText('合成读取失败');await expect(page.getByLabel('未来投票秒数')).toHaveCount(0);await expect(page.getByRole('button',{name:'保存未来设置',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'重试读取设置',exact:true}).click();await expect(page.getByLabel('未来投票秒数')).toHaveValue('30');await page.getByRole('button',{name:'关闭',exact:true}).click();await page.unrouteAll({behavior:'wait'});
  let arrived=false;const held=new Promise<void>(r=>release=r);await page.route('**/control/defaults',async route=>{const response=await route.fetch();arrived=true;await held;await route.fulfill({response});});
  await page.getByRole('button',{name:'管理',exact:true}).click();await expect.poll(()=>arrived).toBe(true);await expect(page.getByLabel('未来投票秒数')).toHaveCount(0);await page.getByRole('button',{name:'关闭',exact:true}).click();release();await page.unrouteAll({behavior:'wait'});
  await expect(page.getByRole('dialog',{name:'对局管理',exact:true})).toHaveCount(0);await f.command('defaults',{voteSeconds:75,voteVisibility:'totals'});await page.getByRole('button',{name:'管理',exact:true}).click();await expect(page.getByLabel('未来投票秒数')).toHaveValue('75');await expect(page.getByLabel('未来票型公开程度')).toHaveValue('totals');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

// Catch a concurrent manager edit reusing the old diff/confirmation, or a late older GET replacing the new baseline.
test('concurrent future changes invalidate confirmation and discard a late older baseline',async({page})=>{
 const f=await paused(page);let release=()=>{};
 try{
  await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByLabel('未来投票秒数').fill('45');await page.getByRole('button',{name:'保存未来设置',exact:true}).click();await expect(page.getByRole('region',{name:'待保存的未来投票设置'})).toContainText('30 秒 → 45 秒');
  await f.command('defaults',{voteSeconds:60,voteVisibility:'totals'});await expect(page.getByRole('button',{name:'确认保存未来投票设置',exact:true})).toHaveCount(0);await expect(page.getByLabel('未来投票秒数')).toHaveValue('60');await expect(page.getByLabel('未来票型公开程度')).toHaveValue('totals');
  await page.getByRole('button',{name:'关闭',exact:true}).click();let arrived=false,intercepted=false;const held=new Promise<void>(r=>release=r);
  await page.route('**/control/defaults',async route=>{if(intercepted){await route.continue();return;}intercepted=true;const response=await route.fetch();arrived=true;await held;await route.fulfill({response});});
  await page.getByRole('button',{name:'管理',exact:true}).click();await expect.poll(()=>arrived).toBe(true);await f.command('defaults',{voteSeconds:75,voteVisibility:'individual'});await expect(page.getByLabel('未来投票秒数')).toHaveValue('75');release();await page.unrouteAll({behavior:'wait'});await expect(page.getByLabel('未来投票秒数')).toHaveValue('75');await expect(page.getByLabel('未来票型公开程度')).toHaveValue('individual');
  const baseline=(await f.state()).control.version;await page.getByLabel('未来投票秒数').fill('90');await page.getByRole('button',{name:'保存未来设置',exact:true}).click();await expect(page.getByRole('region',{name:'待保存的未来投票设置'})).toContainText('75 秒 → 90 秒');await page.getByRole('button',{name:'返回',exact:true}).click();expect((await f.state()).control.version).toBe(baseline);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
