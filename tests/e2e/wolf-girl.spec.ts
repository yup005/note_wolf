import {test,expect} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';
import type {LobbyView,Role} from '../../packages/contracts/index';
import type {NightPhase} from '../../packages/contracts/night';
test('wolf girl mobile first night, private refusal, poisoner and post-vote retaliation',async({page})=>{
 test.setTimeout(90000);await loginTestAdmin(page);await page.getByLabel('你的昵称').fill('女孩测试');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByLabel('选择板子').selectOption('wolf-girl-12');await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();
 const view:LobbyView=await page.evaluate(async()=>(await(await fetch('/api/session')).json()).rooms[0]);const path='/api/rooms/'+view.room.id;
 const roles=new Map<Role,number>();for(const s of view.room.seats){const identity=await(await page.request.get(path+(s.number===1?'/identity':`/test-players/${s.memberId}/identity`))).json();roles.set(identity.role,s.number);}
 const girl=roles.get('wolfGirl')!,target=roles.get('hunter')!,poisoner=roles.get('poisoner')!,wolf=roles.get('wolf')!;
 const actor=async(seat:number)=>page.getByLabel('操作的测试玩家').selectOption(view.room.seats.find(s=>s.number===seat)!.memberId!);
 const privatePath=(seat:number,kind='night')=>path+(seat===1?`/${kind}`:`/test-players/${view.room.seats.find(s=>s.number===seat)!.memberId}/${kind}`);
 const state=async():Promise<LobbyView>=>await(await page.request.get(path)).json();
 const move=async(phase:NightPhase)=>{for(let i=0;i<30;i++){if((await state()).room.night!.phase===phase)return;expect((await page.request.post(path+'/night/test-advance',{data:{}})).ok()).toBe(true);}throw Error(phase);};
 await page.getByRole('button',{name:'开始首夜',exact:true}).click();await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();await move('confession');await actor(girl);
 await expect(page.getByRole('heading',{name:'狼女孩表白',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:new RegExp(`^目标 ${wolf} 号`)})).toBeDisabled();await page.getByRole('button',{name:new RegExp(`^目标 ${target} 号`)}).click();await page.getByRole('button',{name:`确认表白 · ${target} 号`,exact:true}).click();
 await move('wolves');await actor(wolf);await expect(page.getByText('首夜仅相认，不能刀人。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'提交刀口',exact:false})).toHaveCount(0);
 await move('poisoner');await actor(poisoner);await expect(page.getByRole('heading',{name:'毒师行动',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'救人',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'本夜不用毒',exact:true}).click();
 await move('confession_notice');await actor(target);await expect(page.getByText('你被表白了；身份、阵营与技能不变。',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'查看私密信息',exact:true}).click();await expect(page.getByText('你被表白了；身份、阵营与技能不变。',{exact:true})).toBeVisible();await page.reload();await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();await actor(target);await page.getByRole('button',{name:'查看私密信息',exact:true}).click();await expect(page.getByText('你被表白了；身份、阵营与技能不变。',{exact:true})).toBeVisible();
 await move('first_night_complete');await page.getByRole('button',{name:'开始第一天',exact:true}).click();
 const command=async(action:Record<string,unknown>,seat=1)=>{const d=(await state()).room.day!;const r=await page.request.post(privatePath(seat,'day')+'/command',{data:{...action,turnId:d.turnId}});expect(r.ok(),await r.text()).toBe(true);};
 await command({action:'close_signup'});for(let i=0;i<8&&(await state()).room.day!.phase!=='day_direction';i++)await command({action:'continue'});
 await command({action:'speech_mode',mode:'free'});await command({action:'end_speech'});await command({action:'start_vote',method:'offline',visibility:'totals',seconds:30});const d=(await state()).room.day!;await command({action:'offline_results',counts:d.vote!.candidates.map(seat=>({seat,votes:seat===poisoner?8:0}))});
 await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();await actor(girl);await page.getByRole('button',{name:'自爆',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();const after=(await state()).room.day!;expect(after.dead).toContain(girl);expect(after.dead).toContain(target);expect(after.dead).not.toContain(poisoner);expect(after.phase).not.toBe('hunter_target');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
});
