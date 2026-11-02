import {expect,type Page} from '@playwright/test';
const boardNames:Record<string,string>={'masquerade-12':'12 人 · 假面舞会','puppet-12':'12 人 · 唯邻是从·傀儡','standard-12':'12 人 · 预女猎白','seer-witch-hunter-idiot-12':'12 人 · 预女猎白','mechanical-12':'12 人 · 机械狼通灵师','mechanical-armor-12':'12 人 · 机械装甲','wolf-girl-12':'12 人 · 狼女孩'};
export async function selectBoard(page:Page,selection:string|{label:string}){
 const name=typeof selection==='string'?boardNames[selection]??selection:selection.label;
 await page.getByRole('button',{name:'更换板子',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'选择板子',exact:true});
 await dialog.getByRole('radio',{name,exact:true}).check();
 const confirm=dialog.getByRole('button',{name:'确认板子',exact:true});
 if(await confirm.isEnabled()){
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/board'));
  await confirm.click();expect((await response).ok()).toBe(true);
 }else await dialog.getByRole('button',{name:'取消',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'更换板子',exact:true})).toContainText(name);
}
export async function configureRoom(page:Page,settings:{dealMethod?:'online'|'physical';gameMode?:'automatic'|'manual'}){
 if(settings.dealMethod)await page.getByRole('radio',{name:settings.dealMethod==='online'?'线上随机发牌':'实体牌录入',exact:true}).check();
 if(settings.gameMode)await page.getByRole('radio',{name:settings.gameMode==='automatic'?'自动法官':'纯手动记录',exact:true}).check();
 const confirm=page.getByRole('button',{name:'确认设置',exact:true});
 if(await confirm.isEnabled()){
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/settings'));
  await confirm.click();expect((await response).ok()).toBe(true);
 }
 await expect(confirm).toBeDisabled();
}
