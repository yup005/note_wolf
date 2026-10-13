import {test,expect} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';
import type {LobbyView} from '../../packages/contracts/index';
import type {DayCommand} from '../../packages/contracts/day';
type Command<T>=T extends unknown?Omit<T,'turnId'>:never;

test('dual flip remains a night target after refresh and has no next-day player controls',async({page})=>{
 test.setTimeout(60000);await loginTestAdmin(page);await page.getByLabel('你的昵称').fill('Dual simulation host');await page.getByRole('button',{name:'创建房间',exact:true}).click();
 await page.getByText('自定义调整',{exact:true}).click();await page.getByLabel('玩家人数',{exact:true}).fill('14');await page.getByLabel('村民人数',{exact:true}).fill('6');await page.getByLabel('白痴规则').selectOption('dual-category-14');await page.getByRole('button',{name:'应用本局配置',exact:true}).click();
 await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();
 const session=await(await page.request.get('/api/session')).json();const initial:LobbyView=session.rooms[0];const path=`/api/rooms/${initial.room.id}`;
 const state=async():Promise<LobbyView>=>{const r=await page.request.get(path);expect(r.ok()).toBe(true);return r.json();};
 let idiot=0,wolf=0;for(const seat of initial.room.seats){const response=await page.request.get(path+(seat.number===1?'/identity':`/test-players/${seat.memberId}/identity`));expect(response.ok()).toBe(true);const identity=await response.json();if(identity.role==='idiot')idiot=seat.number;if(identity.role==='wolf')wolf=seat.number;}
 expect(idiot).toBeGreaterThan(0);
 const post=async(endpoint:string,data:unknown={})=>{const r=await page.request.post(path+endpoint,{data});expect(r.ok(),`${endpoint}: ${await r.text()}`).toBe(true);};
 const command=async(c:Command<DayCommand>)=>post('/day/command',{...c,turnId:(await state()).room.day!.turnId});
 const finishNight=async()=>{for(let i=0;i<25&&(await state()).room.night!.phase!=='first_night_complete';i++)await post('/night/test-advance');expect((await state()).room.night!.phase).toBe('first_night_complete');};
 await post('/night/enter');await finishNight();await post('/day/enter');await command({action:'close_signup'});await command({action:'continue'});await command({action:'continue'});await command({action:'speech_mode',mode:'free'});await command({action:'end_speech'});await command({action:'start_vote',method:'offline',visibility:'totals',seconds:30});
 await command({action:'offline_results',counts:(await state()).room.day!.vote!.candidates.map(seat=>({seat,votes:seat===idiot?1:0}))});await command({action:'continue'});expect((await state()).room.day!.alive).toContain(idiot);
 await page.reload();await expect(page.getByRole('heading',{name:'第 1 天结束',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:new RegExp(`^目标 ${idiot} 号`)})).toContainText('民边存活',{timeout:5000});
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);}
 await page.screenshot({path:'/private/tmp/note-wolf-dual-flip-mobile.png',fullPage:false,animations:'disabled'});
 await post('/night/enter');const night=(await state()).room.night!;const wolfPath=path+(wolf===1?'/night':`/test-players/${initial.room.seats[wolf-1].memberId}/night`);
 const privateNight=await(await page.request.get(wolfPath+'/private')).json();expect(privateNight.legalTargets).toContain(idiot);expect(night.alive).toContain(idiot);
 await finishNight();await post('/day/enter');await command({action:'continue'});await command({action:'continue'});await command({action:'speech_mode',mode:'ordered'});await page.reload();await page.getByRole('checkbox',{name:'自动跟随',exact:true}).uncheck();await page.getByLabel('操作的测试玩家').selectOption(initial.room.seats[idiot-1].memberId!);
 await expect(page.getByRole('button',{name:/^插话/})).toHaveCount(0);await expect(page.getByRole('button',{name:'上警',exact:false})).toHaveCount(0);
 while((await state()).room.day!.phase==='day_speech'){expect((await state()).room.day!.speaker).not.toBe(idiot);await command({action:'end_speech'});}
 const vote=(await state()).room.day!.vote!;expect(vote.eligible).not.toContain(idiot);expect(vote.candidates).not.toContain(idiot);
});
