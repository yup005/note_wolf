import {loginTestAdmin} from './helpers/test-admin';
import {test,expect,type Page} from '@playwright/test';
import type {LobbyView,Role} from '../../packages/contracts/index';
import type {NightPrivate,NightPhase} from '../../packages/contracts/night';

async function visibility(page:Page,visible:boolean){await page.evaluate(value=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:value?'visible':'hidden'});document.dispatchEvent(new Event('visibilitychange'));},visible);}

test.beforeEach(async({page})=>{await loginTestAdmin(page);});
test('saved 15-player board deals and privately learns a civilian before spirit-seer inspection',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/');await page.getByLabel('你的昵称').fill('Mechanical browser host');await page.getByRole('button',{name:'创建房间',exact:true}).click();
 await page.getByLabel('选择板子').selectOption('mechanical-12');await page.getByText('自定义调整',{exact:true}).click();
 await page.getByLabel('板子名称').fill('Saved mechanical 15');await page.getByLabel('玩家人数',{exact:true}).fill('15');await page.getByLabel('狼人人数',{exact:true}).fill('4');await page.getByLabel('村民人数',{exact:true}).fill('5');await page.getByLabel('白痴人数',{exact:true}).fill('1');await page.getByRole('button',{name:'另存板子',exact:true}).click();
 await expect(page.getByTestId('seated-count')).toHaveText('0 / 15');
 await page.reload();await expect(page.getByLabel('选择板子')).toContainText('Saved mechanical 15');await expect(page.getByTestId('seated-count')).toHaveText('0 / 15');
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();
 await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();
 const view:LobbyView=await page.evaluate(async()=> (await (await fetch('/api/session')).json()).rooms[0]);const path=`/api/rooms/${view.room.id}`;
 expect(view.room.board.composition.seatCount).toBe(15);
 const roles=new Map<Role,number[]>();
 for(const seat of view.room.seats){const identity:{role:Role}=await (await page.request.get(path+(seat.number===1?'/identity':`/test-players/${seat.memberId}/identity`))).json();roles.set(identity.role,[...(roles.get(identity.role)??[]),seat.number]);}
 const mechanical=roles.get('mechanicalWolf')![0],spirit=roles.get('spiritSeer')![0],civilian=roles.get('villager')![0];
 const actor=async(seat:number)=>{await page.getByLabel('操作的测试玩家').selectOption(view.room.seats.find(s=>s.number===seat)!.memberId!);};
 const privatePath=(seat:number)=>path+(seat===1?'/night':`/test-players/${view.room.seats.find(s=>s.number===seat)!.memberId}/night`);
 const state=async():Promise<LobbyView>=>await (await page.request.get(path)).json();
 const advanceTo=async(phase:NightPhase)=>{
  for(let count=0;count<20;count++){const current=(await state()).room.night!;if(current.phase===phase)return;expect(current.deadline).not.toBeNull();const response=await page.request.post(path+'/night/test-advance',{data:{}});expect(response.ok()).toBe(true);}
  throw new Error(`Night did not reach ${phase}`);
 };
 await page.getByRole('button',{name:'开始首夜',exact:true}).click();await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();
 await advanceTo('mechanical');await expect(page.getByRole('heading',{name:'机械狼行动',exact:true})).toBeVisible();await actor(mechanical);
 await expect(page.getByRole('button',{name:`目标 ${mechanical} 号`,exact:false})).toBeDisabled();
 await expect(page.locator('.night-target')).toHaveCount(15);
 const beyondTwelve=[13,14,15].find(seat=>seat!==mechanical)!;await expect(page.getByRole('button',{name:new RegExp(`^目标 ${beyondTwelve} 号`)})).toBeEnabled();
 await page.getByRole('button',{name:new RegExp(`^目标 ${civilian} 号`)}).click();await page.getByRole('button',{name:`确认学习 · ${civilian} 号`,exact:true}).click();
 await expect(page.getByRole('status',{name:'私人技能反馈'})).toContainText('学习成功：村民');await expect(page.getByRole('status',{name:'私人技能反馈'})).toContainText('你就是个「普通村民」！');
 await expect(page.getByRole('status',{name:'私人技能反馈'}).getByText('普通村民',{exact:true})).toHaveCSS('color','rgb(180, 35, 24)');
 const learned:NightPrivate=await (await page.request.get(privatePath(mechanical)+'/private')).json();expect(learned.learningReceipt?.role).toBe('villager');
 const deadline=(await state()).room.night!.deadline;await page.getByRole('button',{name:'确认结果已查看',exact:true}).click();expect((await state()).room.night).toMatchObject({phase:'mechanical',deadline});
 await visibility(page,false);await expect(page.getByText('学习成功：村民',{exact:true})).toHaveCount(0);await expect(page.getByText('普通村民',{exact:true})).toHaveCount(0);await visibility(page,true);await expect(page.getByText('学习成功：村民',{exact:true})).toBeVisible();
 await actor(civilian);await expect(page.getByRole('status',{name:'私人技能反馈'})).toHaveCount(0);await expect(page.getByText('普通村民',{exact:true})).toHaveCount(0);
 const publicNight=JSON.stringify((await state()).room.night);expect(publicNight).not.toMatch(/learnedRole|learningReceipt|inspectionRole|skills|modelSeat/);
 await advanceTo('spiritSeer');await expect(page.getByRole('heading',{name:'通灵师行动',exact:true})).toBeVisible();await actor(spirit);
 await expect(page.getByRole('button',{name:new RegExp(`^目标 ${spirit} 号`)})).toBeDisabled();await page.getByRole('button',{name:new RegExp(`^目标 ${mechanical} 号`)}).click();await page.getByRole('button',{name:`确认查验 · ${mechanical} 号`,exact:true}).click();
 await expect(page.getByRole('status',{name:'私人技能反馈'})).toContainText(`查验 ${mechanical} 号：村民`);
 const inspected:NightPrivate=await (await page.request.get(privatePath(spirit)+'/private')).json();expect(inspected.inspectionRole).toBe('villager');
 await page.reload();await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();await actor(spirit);await expect(page.getByRole('status',{name:'私人技能反馈'})).toContainText(`查验 ${mechanical} 号：村民`);
 await page.getByRole('button',{name:'确认结果已查看',exact:true}).click();await expect(page.getByRole('heading',{name:'闭眼间隔',exact:true})).toBeVisible();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
});
