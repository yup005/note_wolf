import {test,expect} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';

test('tutorial can be dismissed persistently and reopened without changing room inputs',async({page})=>{
 await page.goto('/');await page.getByLabel('你的昵称',{exact:true}).fill('待输入保留');
 await expect(page.getByRole('heading',{name:'第一次玩？',exact:true})).toBeVisible();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);const intro=await page.locator('.tutorial-entry').boundingBox(),heading=await page.getByRole('heading',{name:'第一次玩？',exact:true}).boundingBox();expect(heading!.x-intro!.x).toBeGreaterThanOrEqual(16);}
 await page.getByRole('heading',{name:'第一次玩？',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/help-tutorial-mobile.png'});
 await page.getByRole('button',{name:'不再提示新手教学',exact:true}).click();
 await expect(page.getByRole('heading',{name:'第一次玩？',exact:true})).toHaveCount(0);
 await expect(page.getByLabel('你的昵称',{exact:true})).toHaveValue('待输入保留');
 await page.reload();await expect(page.getByRole('heading',{name:'第一次玩？',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'新手教学',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'新手教学',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'新手教学',exact:true})).toBeFocused();
});

test('single guest can wait in a room, with room metadata separated and dealing still blocked',async({page})=>{
 await page.goto('/');await page.getByLabel('你的昵称',{exact:true}).fill('单人候场');
 await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续',exact:true}).click();
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();
 await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
 await expect(page.getByText(/可单人或少于.*人候场/)).toBeVisible();
 await page.getByRole('button',{name:'准备',exact:true}).click();await expect(page.getByRole('button',{name:'开始发牌',exact:true})).toBeDisabled();
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:568});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  const copy=await page.getByRole('button',{name:'复制房间号',exact:true}).boundingBox(),rules=await page.getByRole('button',{name:'规则速查',exact:true}).boundingBox();
  expect(rules!.y).toBeGreaterThanOrEqual(copy!.y+copy!.height);
 }
 await page.getByText('房间详情',{exact:false}).first().click();await expect(page.getByText(/同一房间的第 1 场游戏/)).toBeVisible();
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/help-lobby-320.png'});
 await page.reload();await expect(page.getByTestId('seated-count')).toHaveText('1 / 12');
});

test('wolf instructions persist when dismissed, can reopen, and remain private to wolf actors',async({page})=>{
 await loginTestAdmin(page);
 const post=async(url:string,data:unknown={})=>{const response=await page.request.post(url,{data});expect(response.ok()).toBe(true);return response.json();};
 const {room}=await post('/api/rooms',{nickname:'合成引导验证',requestId:crypto.randomUUID()}),path='/api/rooms/'+room.id;
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)await post(path+'/'+part,data);
 const view=await(await page.request.get(path)).json(),roles:Record<string,string[]>={};
 for(const seat of view.room.seats){const card=await(await page.request.get(path+(seat.number===1?'/identity':`/test-players/${seat.memberId}/identity`))).json();(roles[card.role]??=[]).push(seat.memberId);}
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();
 await page.getByLabel('自动跟随',{exact:true}).uncheck();await page.getByLabel('操作的测试玩家').selectOption(roles.wolf[0]);
 const guide=page.getByRole('region',{name:'狼人操作说明',exact:true});await expect(guide).toBeVisible();await expect(guide).toContainText('提交刀口');
 const target=view.room.seats.find((seat:{memberId:string})=>seat.memberId===roles.villager[0]).number;
 await page.getByRole('button',{name:new RegExp(`^目标 ${target} 号`)}).click();
 const commands:string[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/night/command'))commands.push(request.url());});
 for(const width of [320,390,430]){await page.setViewportSize({width,height:568});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await expect(page.getByRole('button',{name:'不再显示狼人说明',exact:true})).toBeVisible();const actions=await page.locator('.night-actions').boundingBox();expect(actions!.y+actions!.height).toBeLessThanOrEqual(568);}
 await page.getByRole('button',{name:'不再显示狼人说明',exact:true}).click();await expect(guide).toHaveCount(0);
 await page.getByRole('button',{name:'狼人操作说明',exact:true}).click();await expect(guide).toBeVisible();
 await expect(page.getByRole('button',{name:new RegExp(`^目标 ${target} 号`)})).toHaveAttribute('aria-pressed','true');expect(commands).toEqual([]);
 await page.setViewportSize({width:390,height:844});await page.locator('.night-operation-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'test-results/help-wolves-mobile.png'});
 await page.getByRole('button',{name:'不再显示狼人说明',exact:true}).click();
 await page.reload();await page.getByLabel('自动跟随',{exact:true}).uncheck();await page.getByLabel('操作的测试玩家').selectOption(roles.wolf[0]);
 await expect(page.getByRole('button',{name:'狼人操作说明',exact:true})).toBeVisible();await expect(guide).toHaveCount(0);
 await page.getByLabel('操作的测试玩家').selectOption(roles.villager[0]);await expect(page.locator('.night-note')).toContainText('等待自己的行动阶段');
 await expect(page.getByRole('button',{name:'狼人操作说明',exact:true})).toHaveCount(0);await expect(guide).toHaveCount(0);
});

test('blocked preference storage leaves tutorial dismissal usable',async({page})=>{
 await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key.startsWith('wolf.help.'))throw new DOMException('blocked','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key.startsWith('wolf.help.'))throw new DOMException('blocked','QuotaExceededError');return set.call(this,key,value);};});
 await page.goto('/');await page.getByRole('button',{name:'不再提示新手教学',exact:true}).click();await page.getByRole('button',{name:'新手教学',exact:true}).click();await expect(page.getByRole('dialog',{name:'新手教学',exact:true})).toBeVisible();
});
