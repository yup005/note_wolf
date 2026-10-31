import {selectBoard} from './helpers/preparation-settings';
import {test,expect,type Page} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';

async function createRoom(page:Page){
 await page.goto('/');await page.getByLabel('你的昵称').fill('规则速查合成房主');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
 return (await (await page.request.get('/api/session')).json()).rooms[0];
}
test('ordinary guests read public rules for the current board without reading identities or changing room state',async({page})=>{
 const view=await createRoom(page),path='/api/rooms/'+view.room.id;const reads:string[]=[],writes:string[]=[];
 page.on('request',request=>{if(request.url().includes('/api/rooms/')){if(request.method()==='GET')reads.push(request.url());else writes.push(request.url());}});
 const before=(await (await page.request.get(path)).json()).room.revision;
 const entry=page.getByRole('button',{name:'规则速查',exact:true});await entry.click();const dialog=page.getByRole('dialog',{name:'本局规则速查',exact:true});
 await expect(dialog).toContainText('预女猎白');await expect(dialog.getByText('女巫 × 1',{exact:true})).toBeVisible();await dialog.getByText('女巫 × 1',{exact:true}).click();await expect(dialog).toContainText('不能自救');await expect(dialog).toContainText('各全局一次');await expect(dialog).not.toContainText('规则速查合成房主');await expect(dialog).not.toContainText('1 号');
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);const close=dialog.getByRole('button',{name:'关闭规则',exact:true});await expect(close).toBeInViewport();expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);}
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(entry).toBeFocused();expect((await (await page.request.get(path)).json()).room.revision).toBe(before);expect(reads.filter(url=>/identity|private|self|test-players/.test(url))).toEqual([]);expect(writes).toEqual([]);
 await selectBoard(page,'mechanical-12');await entry.click();await dialog.getByText('机械狼 × 1',{exact:true}).click();await expect(dialog).toContainText('女巫之后');await expect(dialog).toContainText('弹毒');await expect(dialog).not.toContainText('无敌盾');await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();
 await selectBoard(page,'mechanical-armor-12');await entry.click();await dialog.getByText('机械狼 × 1',{exact:true}).click();await expect(dialog).toContainText('无敌盾');await expect(dialog).toContainText('不弹毒');await dialog.getByText('装甲狼 × 1',{exact:true}).click();await expect(dialog).toContainText('独立完整次数');await page.screenshot({path:'test-results/rule-reference-armor.png'});await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();
});

test('rules stay read-only across night, day and manual mode and personal notes use the authorized self card',async({page})=>{
 await loginTestAdmin(page);await page.goto('/');const r=await page.request.post('/api/rooms',{data:{nickname:'规则合成样本',requestId:crypto.randomUUID()}});expect(r.ok()).toBe(true);const {room}=await r.json(),path='/api/rooms/'+room.id;
 const post=async(part:string,data:object={})=>{const response=await page.request.post(path+'/'+part,{data});expect(response.ok(),part).toBe(true);return response.json();};
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)await post(part,data);
 const state=async()=>(await (await page.request.get(path)).json()).room;await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();await expect(page.locator('.night-nav .live')).toContainText('已连接');const initial=(await state()).night;
 await page.getByRole('button',{name:'规则速查',exact:true}).click();const dialog=page.getByRole('dialog',{name:'本局规则速查',exact:true});await expect(dialog).not.toContainText('剩余 1 次');await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();const after=(await state()).night;expect(after.turnId).toBe(initial.turnId);expect(after.deadline).toBe(initial.deadline);
 while((await state()).night.deadline!==null)await post('night/test-advance');await post('day/enter');await expect(page.getByRole('button',{name:'我的身份与技能',exact:true})).toBeVisible();await page.getByRole('button',{name:'规则速查',exact:true}).click();await expect(dialog).toContainText('本人实际身份与技能');await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();await page.getByRole('button',{name:'我的身份与技能',exact:true}).click();const self=page.getByRole('dialog',{name:'我的身份与技能',exact:true});await self.getByText('角色技能与限制',{exact:true}).click();await expect(self).toContainText('技能余量不等于当前可发动');await self.getByRole('button',{name:'隐藏身份',exact:true}).click();
 await post('manual/switch',{confirmed:true});await expect(page.getByRole('heading',{name:'纯手动记录',exact:true})).toBeVisible();await page.getByRole('button',{name:'规则速查',exact:true}).click();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();
});

test('slow rule loading remains keyboard closable and returning to a previous board does not reopen the guide',async({page})=>{
 const view=await createRoom(page),path='/api/rooms/'+view.room.id;
 let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>arrived=resolve);const module='**/src/RuleReferenceDialog.tsx*';
 await page.route(module,async route=>{arrived();await gate;await route.continue();});
 const entry=page.getByRole('button',{name:'规则速查',exact:true}),dialog=page.getByRole('dialog',{name:'本局规则速查',exact:true});
 try{await entry.click();await started;await expect(dialog).toHaveAttribute('aria-modal','true');const close=dialog.getByRole('button',{name:'关闭规则',exact:true});await expect(close).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(entry).toBeFocused();release();await page.unrouteAll({behavior:'wait'});}
 finally{release();await page.unrouteAll({behavior:'wait'});}
 await entry.click();await expect(dialog.getByRole('heading',{name:'公开角色目录',exact:true})).toBeVisible();
 const change=async(id:string)=>{const current=(await (await page.request.get(path)).json()).room;expect((await page.request.post(path+'/board',{data:{selection:{kind:'preset',id},settingsRevision:current.preparation.settingsRevision}})).ok()).toBe(true);};
 await change('mechanical-12');await expect(dialog).toHaveCount(0);await expect(page.locator('.room-overview')).toContainText('机械狼通灵师');await change('standard-12');await expect(page.locator('.room-overview')).toContainText('预女猎白');await expect(dialog).toHaveCount(0);
});
