import {test,expect,type Page} from '@playwright/test';
import type {LobbyView} from '../../packages/contracts/index';
import {loginTestAdmin} from './helpers/test-admin';

async function room(page:Page,admin=false){
 if(admin)await loginTestAdmin(page);else await page.goto('/');
 await page.getByLabel('你的昵称').fill('设置验证房主');
 await page.getByRole('button',{name:'创建房间',exact:true}).click();
 if(!admin)await page.getByRole('button',{name:'以游客身份继续',exact:true}).click();
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();
 const initial=(await(await page.request.get('/api/session')).json()).rooms[0] as LobbyView;
 const path='/api/rooms/'+initial.room.id;
 const state=async():Promise<LobbyView>=>await(await page.request.get(path)).json();
 return {path,state};
}

test('board preview and cancel preserve readiness; a single explicit confirm applies the board',async({page})=>{
 const f=await room(page);await page.getByRole('button',{name:'准备',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消准备',exact:true})).toBeVisible();
 let changes=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname===f.path+'/board')changes++;});
 const open=page.getByRole('button',{name:'更换板子',exact:true});await open.click();
 const dialog=page.getByRole('dialog',{name:'选择板子',exact:true});
 await dialog.getByRole('radio',{name:'12 人 · 狼女孩',exact:true}).check();
 expect((await f.state()).room.board.id).toBe('standard-12');
 expect((await f.state()).room.seats[0].ready).toBe(true);
 await dialog.getByRole('button',{name:'取消',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();expect(changes).toBe(0);
 await open.click();await dialog.getByRole('radio',{name:'12 人 · 狼女孩',exact:true}).check();
 await dialog.getByRole('button',{name:'确认板子',exact:true}).click();
 await expect(page.locator('.room-overview')).toContainText('狼女孩');
 expect((await f.state()).room.seats[0].ready).toBe(false);expect(changes).toBe(1);
 await open.click();await expect(dialog.getByRole('button',{name:'确认板子',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(changes).toBe(1);
});

test('mode cards stage both choices, cancel without resetting players, and confirm once',async({page})=>{
 const f=await room(page);await page.getByRole('button',{name:'准备',exact:true}).click();
 await expect(page.getByRole('button',{name:'取消准备',exact:true})).toBeVisible();
 let changes=0;page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname===f.path+'/settings')changes++;});
 const physical=page.getByRole('radio',{name:'实体牌录入',exact:true}),manual=page.getByRole('radio',{name:'纯手动记录',exact:true});
 const confirm=page.getByRole('button',{name:'确认设置',exact:true});
 await physical.check();await manual.check();
 expect((await f.state()).room.preparation.settings).toEqual({dealMethod:'online',gameMode:'automatic'});
 expect((await f.state()).room.seats[0].ready).toBe(true);expect(changes).toBe(0);
 await page.getByRole('button',{name:'取消修改',exact:true}).click();
 await expect(page.getByRole('radio',{name:'线上随机发牌',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'自动法官',exact:true})).toBeChecked();await expect(confirm).toBeDisabled();
 await physical.check();await manual.check();await confirm.click();
 await expect(page.locator('.host-settings > summary')).toContainText('实体牌 · 手动记录');
 expect((await f.state()).room.preparation.settingsRevision).toBe(1);
 expect((await f.state()).room.seats[0].ready).toBe(false);expect(changes).toBe(1);
 await page.reload();await expect(physical).toBeChecked();await expect(manual).toBeChecked();await expect(confirm).toBeDisabled();
});

test('authoritative settings updates and disconnection discard stale previews',async({page})=>{
 const f=await room(page);
 await page.getByRole('radio',{name:'实体牌录入',exact:true}).check();
 expect((await page.request.post(f.path+'/settings',{data:{dealMethod:'online',gameMode:'manual'}})).ok()).toBe(true);
 await expect(page.getByRole('radio',{name:'纯手动记录',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'线上随机发牌',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'确认设置',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'更换板子',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'选择板子',exact:true});
 await dialog.getByRole('radio',{name:'12 人 · 狼女孩',exact:true}).check();
 expect((await page.request.post(f.path+'/settings',{data:{dealMethod:'online',gameMode:'automatic'}})).ok()).toBe(true);
 await expect(dialog).toHaveCount(0);expect((await f.state()).room.board.id).toBe('standard-12');
 await page.getByRole('radio',{name:'实体牌录入',exact:true}).check();
 await page.getByRole('button',{name:'更换板子',exact:true}).click();
 await dialog.getByRole('radio',{name:'12 人 · 狼女孩',exact:true}).check();
 await page.context().setOffline(true);
 try{await expect(page.getByText('目前无法联机',{exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);}
 finally{await page.context().setOffline(false);}
 const after=await f.state();expect(after.room.board.id).toBe('standard-12');
 expect(after.room.preparation.settings).toEqual({dealMethod:'online',gameMode:'automatic'});
});

test('phone choices and long board names fit; dialog keyboard focus stays contained and returns',async({page})=>{
 const f=await room(page);
 const longName='无空格的超长自定义板子名称用于验证手机布局和按钮不会超出屏幕'.repeat(2).slice(0,60);
 const saved=await page.request.post('/api/boards',{data:{id:null,revision:0,name:longName,composition:{seatCount:12,roles:{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1}}}});expect(saved.ok()).toBe(true);
 await page.reload();
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
  await expect(page.locator('.setting-choice')).toHaveCount(4);
  for(const label of await page.locator('.setting-choice').all())expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  const open=page.getByRole('button',{name:'更换板子',exact:true});expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(open).toHaveCSS('font-size','16px');
  await page.locator('.host-settings').screenshot({path:test.info().outputPath(`settings-${width}.png`)});
  await open.click();const dialog=page.getByRole('dialog',{name:'选择板子',exact:true});
  await dialog.getByRole('radio',{name:longName,exact:true}).check();
  const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.width).toBeLessThanOrEqual(width);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(844);
  const confirm=dialog.getByRole('button',{name:'确认板子',exact:true}),button=await confirm.boundingBox();
  expect(button!.height).toBeGreaterThanOrEqual(48);expect(button!.width).toBeGreaterThanOrEqual(bounds!.width-48);expect(button!.y+button!.height).toBeLessThanOrEqual(844);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`board-picker-${width}.png`)});
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null)).toBe(true);}
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
 }
 expect((await f.state()).room.board.id).toBe('standard-12');
});

test('test-room conversion cancels pending physical dealing and keeps it unavailable',async({page})=>{
 const f=await room(page,true);
 await page.getByRole('radio',{name:'实体牌录入',exact:true}).check();
 await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();
 await expect(page.getByText('测试房间 · 模拟玩家',{exact:true})).toBeVisible();
 await expect(page.getByRole('radio',{name:'实体牌录入',exact:true})).toBeDisabled();
 await expect(page.getByRole('radio',{name:'线上随机发牌',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'确认设置',exact:true})).toBeDisabled();
 expect((await f.state()).room.preparation.settings.dealMethod).toBe('online');
});
