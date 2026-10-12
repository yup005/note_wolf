import {test,expect} from '@playwright/test';
test('mobile presets derive saved 13/15/zero-wolf configurations without changing system templates',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();try{
  await page.goto('/');await page.getByLabel('你的昵称').fill('Board host');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
  await page.getByLabel('选择板子').selectOption('mechanical-armor-12');
  await expect(page.locator('.room-overview')).toContainText('机械装甲');await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();
  await page.getByText('自定义调整',{exact:true}).click();await page.getByLabel('板子名称').fill('Armor mixer 13');await page.getByLabel('玩家人数',{exact:true}).fill('13');await page.getByLabel('混血儿人数',{exact:true}).fill('1');
  await page.getByRole('button',{name:'另存板子',exact:true}).click();await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');await expect(page.getByRole('button',{name:'准备',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel('选择板子')).toContainText('Armor mixer 13');await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');
  await page.getByLabel('选择板子').selectOption('mechanical-12');await page.getByText('自定义调整',{exact:true}).click();await page.getByLabel('板子名称').fill('Expanded 15');await page.getByLabel('玩家人数',{exact:true}).fill('15');await page.getByLabel('狼人人数',{exact:true}).fill('4');await page.getByLabel('村民人数',{exact:true}).fill('5');await page.getByLabel('白痴人数',{exact:true}).fill('1');await page.getByRole('button',{name:'另存板子',exact:true}).click();
  await expect(page.getByTestId('seated-count')).toHaveText('1 / 15');
  await page.getByLabel('选择板子').selectOption('mechanical-armor-12');await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
  if(!await page.getByLabel('板子名称').isVisible())await page.getByText('自定义调整',{exact:true}).click();
  await page.getByLabel('板子名称').fill('Zero pack');await page.getByLabel('玩家人数',{exact:true}).fill('10');await page.getByLabel('狼人人数',{exact:true}).fill('0');await page.getByRole('button',{name:'另存板子',exact:true}).click();await expect(page.getByTestId('seated-count')).toHaveText('1 / 10');
  await page.getByLabel('选择板子').selectOption('seer-witch-hunter-idiot-12');await expect(page.locator('.room-overview')).toContainText('预女猎白');await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
  await page.getByLabel('选择板子').selectOption({label:'Armor mixer 13'});await expect(page.getByTestId('seated-count')).toHaveText('1 / 13');
  const fixed=(await (await context.request.get('/api/boards')).json()).presets.find((b:any)=>b.id==='mechanical-armor-12').composition.roles;expect(fixed).toMatchObject({wolf:2,armoredWolf:1});expect(fixed).not.toHaveProperty('mixer');
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
 }finally{await context.close();}
});
