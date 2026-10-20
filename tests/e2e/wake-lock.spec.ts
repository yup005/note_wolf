import {test,expect,type Page} from '@playwright/test';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';

async function night(page:Page){
 await page.addInitScript(()=>localStorage.setItem('wolf.voice.enabled','off'));await loginTestAdmin(page);
 const made=await requestWithBackoff(()=>page.request.post('/api/rooms',{data:{nickname:'常亮合成样本',requestId:crypto.randomUUID()}}));expect(made.ok()).toBe(true);
 const {room}=await made.json(),path='/api/rooms/'+room.id;
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)expect((await requestWithBackoff(()=>page.request.post(path+'/'+part,{data}))).ok()).toBe(true);
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();await expect(page.getByRole('heading',{name:'狼人行动',exact:true})).toBeVisible();return path;
}
async function fakeWake(page:Page,deferred=false){
 await page.addInitScript(deferred=>{
  const state={locks:[] as (EventTarget&{released:boolean;release:()=>Promise<void>})[],pending:[] as (()=>void)[]};(window as any).__wake=state;
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async(type:string)=>{
   if(type!=='screen')throw new Error('Expected a screen lock');
   const lock=Object.assign(new EventTarget(),{released:false,release:async()=>{if(!lock.released){lock.released=true;lock.dispatchEvent(new Event('release'));}}});state.locks.push(lock);
   if(deferred)await new Promise<void>(resolve=>state.pending.push(resolve));return lock;
  }}});
 },deferred);
}
const activeLocks=(page:Page)=>page.evaluate(()=>(window as any).__wake.locks.filter((lock:any)=>!lock.released).length);

// Catch an unsupported/denied device capability blocking the actual game or disabling navigation.
for(const mode of ['unsupported','denied'] as const)test(`wake lock ${mode} keeps night controls and phase advance usable`,async({page})=>{
 await page.addInitScript(mode=>{Object.defineProperty(navigator,'wakeLock',{configurable:true,value:mode==='unsupported'?undefined:{request:async()=>{throw new DOMException('Synthetic denial','NotAllowedError');}}});},mode);
 await night(page);const toggle=page.getByRole('button',{name:'常亮不可用',exact:true});await expect(toggle).toBeVisible();await expect(toggle).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'查看操作',exact:true})).toHaveCount(0);
 await toggle.click();await expect(page.getByRole('button',{name:'常亮已关',exact:true})).toHaveAttribute('aria-pressed','false');await page.getByRole('button',{name:'常亮已关',exact:true}).click();await expect(toggle).toBeVisible();
 await page.getByRole('button',{name:'推进测试阶段',exact:true}).click();await expect(page.getByRole('heading',{name:'闭眼间隔',exact:true})).toBeVisible();await page.getByRole('button',{name:'推进测试阶段',exact:true}).click();await expect(page.getByRole('heading',{name:'女巫行动',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'查看操作',exact:true})).toHaveCount(0);
});

// Catch duplicate requests, failure to reacquire after browser release, or locks surviving disable/night completion.
test('night wake control reacquires after browser release and releases on disable and completion',async({page})=>{
 await fakeWake(page);const path=await night(page);await expect(page.getByRole('button',{name:'常亮已开',exact:true})).toBeVisible();expect(await activeLocks(page)).toBe(1);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));expect(await activeLocks(page)).toBe(1);expect(await page.evaluate(()=>(window as any).__wake.locks.length)).toBe(1);
 // The platform releases screen locks on background; emulate that capability boundary, not the hook.
 await page.evaluate(async()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));for(const lock of (window as any).__wake.locks)await lock.release();});await expect(page.getByRole('button',{name:'常亮已关',exact:true})).toBeVisible();expect(await activeLocks(page)).toBe(0);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.getByRole('button',{name:'常亮已开',exact:true})).toBeVisible();expect(await activeLocks(page)).toBe(1);
 await page.getByRole('button',{name:'常亮已开',exact:true}).click();await expect(page.getByRole('button',{name:'常亮已关',exact:true})).toHaveAttribute('aria-pressed','false');await expect.poll(()=>activeLocks(page)).toBe(0);
 await page.getByRole('button',{name:'常亮已关',exact:true}).click();await expect(page.getByRole('button',{name:'常亮已开',exact:true})).toBeVisible();
 for(let step=0;step<10;step++){const {room}=await (await page.request.get(path)).json();if(room.night.phase==='first_night_complete')break;expect((await page.request.post(path+'/night/test-advance',{data:{}})).ok()).toBe(true);}
 await expect(page.getByRole('heading',{name:'首夜操作完成',exact:true})).toBeVisible();await expect.poll(()=>activeLocks(page)).toBe(0);
});

// Catch a late platform promise reviving a disabled/unmounted hook and retaining the device lock.
test('late wake requests release after disabling or leaving the room',async({page})=>{
 await fakeWake(page,true);await night(page);const toggle=page.locator('.wake-toggle');await expect(toggle).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.evaluate(()=>(window as any).__wake.pending.length)).toBe(1);
 await toggle.click();await page.evaluate(()=>{(window as any).__wake.pending.shift()();});await expect.poll(()=>activeLocks(page)).toBe(0);await expect(toggle).toHaveAttribute('aria-pressed','false');await expect(toggle).toHaveText('常亮已关');
 await toggle.click();await expect.poll(()=>page.evaluate(()=>(window as any).__wake.pending.length)).toBe(1);await page.getByRole('button',{name:'← 首页',exact:true}).click();await expect(page.getByRole('heading',{name:'狼人行动',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{(window as any).__wake.pending.shift()();});await expect.poll(()=>activeLocks(page)).toBe(0);await expect(page.locator('.wake-toggle')).toHaveCount(0);
});
