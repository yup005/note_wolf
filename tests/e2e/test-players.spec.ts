import {test,expect} from '@playwright/test';
test('host can fill a labelled test room and inspect each simulated role',async({page})=>{
 await page.goto('/');await page.getByLabel('你的昵称').fill('测试房主');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();
 await expect(page.getByText('测试房间 · 模拟玩家')).toBeVisible();await expect(page.getByTestId('seated-count')).toHaveText('12 / 12');
 await expect(page.getByRole('button',{name:'准备',exact:true})).toBeEnabled();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/room-seats-mobile.png',fullPage:true});
 await page.locator('.test-console summary').click();
 await page.getByLabel('操作的测试玩家').selectOption({label:'2 号 · 测试玩家 2'});await page.getByRole('button',{name:'取消该玩家准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'该玩家准备',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/room-identity-mobile.png',fullPage:true});
 const seats=await page.locator('.seat-grid').boundingBox();const identity=await page.getByLabel('私人身份',{exact:true}).boundingBox();expect(identity!.y).toBeLessThan(seats!.y);
 const counts:Record<string,number>={};
 for(let seat=1;seat<=12;seat++){
  await page.getByLabel('操作的测试玩家').selectOption({label:seat===1?'1 号 · 你':`${seat} 号 · 测试玩家 ${seat}`});
  await expect(page.getByTestId('test-role')).toHaveCount(0);await page.getByRole('button',{name:'查看该玩家身份',exact:true}).click();
  const role=await page.getByTestId('test-role').innerText();counts[role]=(counts[role]??0)+1;
 }
 expect(counts).toEqual({'狼人':4,'村民':4,'预言家':1,'女巫':1,'猎人':1,'白痴':1});
 await page.reload();await expect(page.getByText('测试房间 · 模拟玩家')).toBeVisible();await expect(page.getByTestId('test-role')).toHaveCount(0);
 await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();
 await expect(page.getByText('身份已锁定',{exact:true})).toBeVisible();await expect(page.getByLabel('发牌方式')).toHaveCount(0);await expect(page.getByText('已准备',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/room-started-mobile.png',fullPage:true});
});
