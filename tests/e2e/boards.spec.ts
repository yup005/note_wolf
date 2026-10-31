import {selectBoard,configureRoom} from './helpers/preparation-settings';
import {setRoleCount} from './helpers/board-tags';
import {test,expect} from '@playwright/test';
test('mobile presets derive saved 13/15/zero-wolf configurations without changing system templates',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();try{
  await page.goto('/');await page.getByLabel('你的昵称').fill('Board host');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  await selectBoard(page,'mechanical-armor-12');
  await expect(page.locator('.room-overview')).toContainText('机械装甲');await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();
  await page.getByText('自定义调整',{exact:true}).click();await page.getByLabel('板子名称').fill('Armor mixer 13');await setRoleCount(page,'混血儿',Number('1'));
  await page.getByRole('button',{name:'另存板子',exact:true}).click();await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');await expect(page.getByRole('button',{name:'准备',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'更换板子',exact:true})).toContainText('Armor mixer 13');await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');
  await selectBoard(page,'mechanical-12');await page.getByText('自定义调整',{exact:true}).click();await page.getByLabel('板子名称').fill('Expanded 15');await setRoleCount(page,'狼人',Number('4'));await setRoleCount(page,'村民',Number('5'));await setRoleCount(page,'白痴',Number('1'));await page.getByRole('button',{name:'另存板子',exact:true}).click();
  await expect(page.getByTestId('seated-count')).toHaveText('1 / 15');
  await selectBoard(page,'mechanical-armor-12');await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
  if(!await page.getByLabel('板子名称').isVisible())await page.getByText('自定义调整',{exact:true}).click();
  await page.getByLabel('板子名称').fill('Zero pack');await setRoleCount(page,'狼人',Number('0'));await page.getByRole('button',{name:'另存板子',exact:true}).click();await expect(page.getByTestId('seated-count')).toHaveText('1 / 10');
  await selectBoard(page,'seer-witch-hunter-idiot-12');await expect(page.locator('.room-overview')).toContainText('预女猎白');await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
  await selectBoard(page,{label:'Armor mixer 13'});await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');
  const fixed=(await (await context.request.get('/api/boards')).json()).presets.find((b:any)=>b.id==='mechanical-armor-12').composition.roles;expect(fixed).toMatchObject({wolf:2,armoredWolf:1});expect(fixed).not.toHaveProperty('mixer');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
 }finally{await context.close();}
});

test('fourteen-player dual idiot is an explicit saved option and standard selection clears it',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();try{
  await page.goto('/');await page.getByLabel('你的昵称').fill('Dual host');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  await page.getByText('自定义调整',{exact:true}).click();await setRoleCount(page,'村民',Number('6'));
  await expect(page.getByLabel('白痴规则')).toBeVisible({timeout:5000});await expect(page.getByLabel('白痴规则')).toHaveValue('standard');await page.getByLabel('白痴规则').selectOption('dual-category-14');await page.getByLabel('板子名称').fill('Dual 14');await page.getByRole('button',{name:'另存板子',exact:true}).click();
  await expect(page.getByTestId('seated-count')).toHaveText('0 / 14');await expect(page.locator('.board-configuration')).toContainText('双边白痴');await page.reload();await page.getByText('自定义调整',{exact:true}).click();await expect(page.getByLabel('白痴规则')).toHaveValue('dual-category-14');
  const library=await(await context.request.get('/api/boards')).json();expect(library.custom.find((b:any)=>b.name==='Dual 14').composition.idiotPolicy).toBe('dual-category-14');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
  await selectBoard(page,'seer-witch-hunter-idiot-12');await expect(page.getByLabel('白痴规则')).toHaveValue('standard');await expect(page.getByTestId('seated-count')).toHaveText('0 / 12');
 }finally{await context.close();}
});

test('mobile configuration explains wolf-free manual mode and blocks all-wolf games in both modes',async({browser})=>{
 const context=await browser.newContext(),page=await context.newPage();try{
  await page.goto('/');await page.getByLabel('你的昵称').fill('Composition host');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();
  await page.getByText('自定义调整',{exact:true}).click();
  for(const label of ['狼人人数','预言家人数','女巫人数','猎人人数','白痴人数'])await setRoleCount(page,label.replace('人数',''),0);await setRoleCount(page,'村民',Number('1'));await page.getByRole('button',{name:'应用本局配置',exact:true}).click();
  await expect(page.locator('.preparation-panel')).toContainText('没有狼人角色，只能选择纯手动记录',{timeout:5000});await page.getByRole('button',{name:'准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
  await configureRoom(page,{gameMode:'manual'});await page.getByRole('button',{name:'准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeEnabled();
  await setRoleCount(page,'狼人',Number('1'));await setRoleCount(page,'村民',Number('0'));await page.getByRole('button',{name:'应用本局配置',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await expect(page.locator('.preparation-panel')).toContainText('只有狼人角色，不能正常开局');await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
  await configureRoom(page,{gameMode:'automatic'});await page.getByRole('button',{name:'准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
 }finally{await context.close();}
});

test('wolf-free host confirms a record-only ending then publishes without a winner',async({browser})=>{
 const context=await browser.newContext(),guest=await browser.newContext(),page=await context.newPage();try{
  await page.goto('/');await page.getByLabel('你的昵称').fill('Record only host');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByText('自定义调整',{exact:true}).click();
  for(const label of ['狼人人数','预言家人数','女巫人数','猎人人数','白痴人数'])await setRoleCount(page,label.replace('人数',''),0);await setRoleCount(page,'村民',Number('1'));await setRoleCount(page,'混血儿',Number('1'));await page.getByRole('button',{name:'应用本局配置',exact:true}).click();await configureRoom(page,{gameMode:'manual'});const initial=(await(await context.request.get('/api/session')).json()).rooms[0];const path='/api/rooms/'+initial.room.id;await guest.request.get('/api/session');expect((await guest.request.post('/api/rooms/join',{data:{code:initial.room.code,nickname:'Record guest'}})).ok()).toBe(true);expect((await guest.request.post(path+'/seat',{data:{seat:2}})).ok()).toBe(true);expect((await guest.request.post(path+'/ready',{data:{ready:true,settingsRevision:initial.room.preparation.settingsRevision}})).ok()).toBe(true);await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();expect((await guest.request.post(path+'/identity/confirm',{data:{}})).ok()).toBe(true);await page.getByRole('button',{name:'开始对局',exact:true}).click();
  await page.getByRole('button',{name:'记录与官方结算',exact:true}).click();await page.getByLabel('个人推理与补充').fill('Record-only notes');await expect(page.getByRole('button',{name:'人工裁定胜负',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'结束记录',exact:true})).toBeVisible({timeout:5000});await page.getByRole('button',{name:'结束记录',exact:true}).click();await expect(page.getByText('确认后结束记录，不判胜负；已保存事实可继续修订并发布。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'确认结束记录',exact:true}).click();await expect(page.getByRole('heading',{name:'记录结束',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'发布当前版本',exact:true}).click();await page.getByRole('button',{name:/官方 · Record only host · 版本 1/}).click();await expect(page.getByRole('dialog').last().locator('.replay-winner')).toHaveText('不判胜负');await page.reload();await expect(page.getByRole('heading',{name:'记录结束',exact:true})).toBeVisible();await expect(page.locator('.manual-winner')).toHaveText('不判胜负');
 }finally{await context.close();await guest.close();}
});
