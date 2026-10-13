import {testRoomRoles} from './helpers/test-roles';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';
import {test,expect,type Page} from '@playwright/test';
// Race cases depend on the real five-second client timeout. Let one existing
// server rate window expire before reusing the suite's admin, rather than retry
// a held/aborted browser claim and change the race's request ordering.
test.beforeAll(async()=>{test.setTimeout(65000);await new Promise(resolve=>setTimeout(resolve,60000));});
async function speechBoundary(page:Page,fail=false){await page.addInitScript(({fail})=>{
 const w=window as any;w.voiceSpoken=[];w.voiceCancelled=0;
 class Utterance {text:string;lang='';voice=null;rate=1;onstart:any;onend:any;onerror:any;constructor(text:string){this.text=text;}}
 Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});
 Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{w.voiceCancelled++;},speak:(u:any)=>{w.voiceSpoken.push(u.text);queueMicrotask(()=>{if(fail)u.onerror?.({error:'not-allowed'});else{u.onstart?.();u.onend?.();}});}},configurable:true});
 },{fail});}
async function setup(page:Page){await loginTestAdmin(page);await page.goto('/');await requestWithBackoff(()=>page.request.get('/api/session'));const createBody={nickname:'语音房主',requestId:crypto.randomUUID()},created=await requestWithBackoff(()=>page.request.post('/api/rooms',{data:createBody}));expect(created.ok()).toBe(true);const r=await created.json();const room=r.room,path=`/api/rooms/${room.id}`;for(const [a,b] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)expect((await requestWithBackoff(()=>page.request.post(path+'/'+a,{data:b}))).ok()).toBe(true);await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();return {room,path};}
const spoken=(page:Page)=>page.evaluate(()=>(window as any).voiceSpoken as string[]);
test('one manager tab speaks public night stages, skips duplicates after refresh, cancels hidden audio and preserves phone layout',async({page,context,browser})=>{
 await speechBoundary(page);const {room,path}=await setup(page);await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect.poll(()=>spoken(page)).toContain('第1夜，天黑请闭眼。狼人请睁眼，选择目标。');await expect(page.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 const twin=await context.newPage();await speechBoundary(twin);await twin.goto('/');await expect(twin.getByRole('heading',{name:'狼人行动',exact:true})).toBeVisible();await twin.getByRole('button',{name:'管理',exact:true}).click();await twin.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(twin.getByRole('alert')).toContainText('另一台设备播报');expect((await spoken(twin)).join('')).not.toContain('狼人请睁眼');
 const outsider=await browser.newContext();try{await outsider.request.get('/api/session');expect((await outsider.request.post('/api/rooms/join',{data:{nickname:'普通玩家',code:room.code}})).status()).toBe(403);const other=await outsider.newPage();await speechBoundary(other);await other.goto('/');await expect(other.locator('.recent-room')).toHaveCount(0);await expect(other.getByRole('button',{name:'管理',exact:true})).toHaveCount(0);expect(await spoken(other)).toEqual([]);
 // The isolated test room refuses the outsider before they can subscribe.

 await requestWithBackoff(()=>page.request.post(path+'/night/test-advance',{data:{}}));await expect.poll(()=>spoken(page)).toContain('请闭眼，等待下一阶段。');await requestWithBackoff(()=>page.request.post(path+'/night/test-advance',{data:{}}));await expect.poll(()=>spoken(page)).toContain('女巫请睁眼，请进行操作。');expect((await spoken(page)).join('')).not.toMatch(/刀口|解药|毒药|查验结果|确认者/);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){await page.setViewportSize(size);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.reload();await expect(page.getByRole('heading',{name:'女巫行动',exact:true})).toBeVisible();await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();expect((await spoken(page)).filter(t=>t==='女巫请睁眼，请进行操作。')).toHaveLength(0);await page.getByRole('button',{name:'重播当前提示',exact:true}).click();await expect.poll(()=>spoken(page)).toContain('女巫请睁眼，请进行操作。');await page.screenshot({path:'test-results/public-voice-mobile.png',animations:'disabled'});
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.getByRole('button',{name:'开启公共播报',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).voiceCancelled)).toBeGreaterThan(0);
 await twin.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(twin.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();await twin.close();
 }finally{await outsider.close();}
});
test('speech failure is visible, releases the speaker and never pauses or advances the game',async({page,context})=>{
 await speechBoundary(page,true);const {path}=await setup(page);const before=(await (await requestWithBackoff(()=>page.request.get(path))).json()).room.night;await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(page.getByRole('alert')).toContainText('浏览器未能播放');const after=(await (await requestWithBackoff(()=>page.request.get(path))).json()).room;expect(after.night.turnId).toBe(before.turnId);expect(after.night.deadline).toBe(before.deadline);expect(after.control.status).toBe('running');
 const another=await context.newPage();await speechBoundary(another);await another.goto('/');await expect(another.getByRole('heading',{name:'狼人行动',exact:true})).toBeVisible();await another.getByRole('button',{name:'管理',exact:true}).click();await another.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(another.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();await another.close();
});
test('public daytime narration follows voting, uniform no-skill and a complete four-wolf exile victory',async({page})=>{
 test.setTimeout(60000);await speechBoundary(page);const {path}=await setup(page);const roles=(await testRoomRoles(page.request,path)).roles as {seat:number;role:string}[];const wolves=roles.filter(r=>r.role==='wolf').map(r=>r.seat);
 await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(page.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 const state=async()=>(await (await requestWithBackoff(()=>page.request.get(path))).json()).room;
 const day=async(action:string,extra={})=>expect((await requestWithBackoff(async()=>page.request.post(path+'/day/command',{data:{action,turnId:(await state()).day.turnId,...extra}}))).ok()).toBe(true);
 const night=async()=>{while((await state()).night.phase!=='first_night_complete')expect((await requestWithBackoff(()=>page.request.post(path+'/night/test-advance',{data:{}}))).ok()).toBe(true);expect((await requestWithBackoff(()=>page.request.post(path+'/day/enter',{data:{}}))).ok()).toBe(true);};
 for(let i=0;i<4;i++){
  await night();if(i===0){await expect.poll(()=>spoken(page)).toContain('第1天，警长竞选开始，请报名。');await day('close_signup');await expect.poll(()=>spoken(page)).toContain('第1天。警徽流失。请房主公布夜间死讯。');}
  while((await state()).day.phase!=='day_direction')await day('continue');await day('speech_mode',{mode:'free'});await expect.poll(()=>spoken(page)).toContain('自由发言开始，结束后由房主开启投票。');await day('end_speech');await day('start_vote',{method:'offline',visibility:'individual',seconds:30});await expect.poll(()=>spoken(page)).toContain('放逐投票开始。请线下举手，由房主录入结果。');const voter=(await state()).day.alive[0];await day('offline_vote',{voter,target:wolves[i]});await day('close_vote');await expect.poll(async()=>(await spoken(page)).join(' ')).toContain(`${wolves[i]}号1票`);await day('continue');
  if(i===3)break;
  await expect.poll(()=>spoken(page)).toContain(`${wolves[i]}号玩家是否发动技能？`);expect((await requestWithBackoff(()=>page.request.post(path+'/day/test-advance',{data:{}}))).ok()).toBe(true);await expect.poll(async()=>(await spoken(page)).join(' ')).toContain(`${wolves[i]}号玩家未发动技能。`);
  while((await state()).day.phase!=='day_complete'){const d=(await state()).day;if(d.deadline!==null)expect((await requestWithBackoff(()=>page.request.post(path+'/day/test-advance',{data:{}}))).ok()).toBe(true);else await day('continue');}expect((await requestWithBackoff(()=>page.request.post(path+'/night/enter',{data:{}}))).ok()).toBe(true);
 }
 await expect.poll(()=>spoken(page)).toContain('游戏结束，好人获胜。');await expect(page.getByRole('heading',{name:'游戏结束',exact:true})).toBeVisible();expect((await spoken(page)).join(' ')).not.toMatch(/狼刀|毒药|解药|查验结果|吞毒/);
});
test('hiding during a delayed enable cancels activation and releases its lease without playing stale stages',async({page})=>{
 await speechBoundary(page);await setup(page);let unblock!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>{unblock=r;}),seen=new Promise<void>(r=>{arrived=r;});let held=false;
 await page.route('**/voice',async route=>{if(route.request().postDataJSON().action==='claim'&&!held){held=true;const response=await route.fetch();arrived();await gate;await route.fulfill({response});}else await route.continue();});
 try{await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await seen;await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.getByRole('button',{name:'开启公共播报',exact:true})).toBeVisible({timeout:1000});unblock();await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(page.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();}
 finally{unblock();}
});
test('a delayed public prompt survives another player updating the same signup phase',async({page})=>{
 await speechBoundary(page);const {path}=await setup(page);let room=(await (await requestWithBackoff(()=>page.request.get(path))).json()).room;while(room.night.phase!=='first_night_complete'){await requestWithBackoff(()=>page.request.post(path+'/night/test-advance',{data:{}}));room=(await (await requestWithBackoff(()=>page.request.get(path))).json()).room;}await requestWithBackoff(()=>page.request.post(path+'/day/enter',{data:{}}));await expect(page.getByRole('heading',{name:'警长报名',exact:true})).toBeVisible();
 let arrived!:()=>void,unblock!:()=>void;const seen=new Promise<void>(r=>{arrived=r;}),gate=new Promise<void>(r=>{unblock=r;});let held=false;
 await page.route('**/voice',async route=>{if(route.request().postDataJSON().action==='claim'&&!held){held=true;const response=await route.fetch();arrived();await gate;await route.fulfill({response});}else await route.continue();});
 try{await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await seen;room=(await (await requestWithBackoff(()=>page.request.get(path))).json()).room;await requestWithBackoff(()=>page.request.post(path+'/day/command',{data:{action:'signup',join:true,turnId:room.day.turnId}}));await expect(page.locator('.night-note')).toContainText('已选择 1 / 12');unblock();await expect.poll(()=>spoken(page)).toContain('第1天，警长竞选开始，请报名。');}
 finally{unblock();}
});
test('a timed out claim releases server ownership and never plays a late response',async({page,context})=>{
 await speechBoundary(page);await setup(page);await page.clock.install();let arrived!:()=>void,unblock!:()=>void;const seen=new Promise<void>(r=>{arrived=r;}),gate=new Promise<void>(r=>{unblock=r;});let held=false;
 await page.route('**/voice',async route=>{if(route.request().postDataJSON().action==='claim'&&!held){held=true;const response=await route.fetch();arrived();await gate;await route.fulfill({response});}else await route.continue();});
 try{await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await seen;await page.clock.fastForward(6000);await expect(page.getByRole('alert')).toContainText('播报连接超时');unblock();expect((await spoken(page)).join('')).not.toContain('狼人请睁眼');const second=await context.newPage();await speechBoundary(second);await second.goto('/');await second.getByRole('button',{name:'管理',exact:true}).click();await second.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(second.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();await second.close();}
 finally{unblock();}
});
test('phase changes while enabling still accept the new server stage and initialize the lease',async({page})=>{
 await speechBoundary(page);const {path}=await setup(page);let arrived!:()=>void,unblock!:()=>void;const seen=new Promise<void>(r=>{arrived=r;}),gate=new Promise<void>(r=>{unblock=r;});let held=false;
 await page.route('**/voice',async route=>{if(route.request().postDataJSON().action==='claim'&&!held){held=true;arrived();await gate;await route.continue();}else await route.continue();});
 try{await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await seen;await requestWithBackoff(()=>page.request.post(path+'/night/test-advance',{data:{}}));await expect(page.getByRole('heading',{name:'闭眼间隔',exact:true})).toBeVisible();unblock();await expect.poll(()=>spoken(page)).toContain('请闭眼，等待下一阶段。');await expect(page.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();}
 finally{unblock();}
});
test('a synchronous speech startup failure can be retried on the same page',async({page})=>{
 await speechBoundary(page);await setup(page);
 await page.evaluate(()=>{(window as any).workingSpeech=speechSynthesis.speak;speechSynthesis.speak=()=>{throw Error('device speech unavailable');};});
 await page.getByRole('button',{name:'管理',exact:true}).click();await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(page.getByRole('alert')).toContainText('浏览器未能播放');
 await page.evaluate(()=>{speechSynthesis.speak=(window as any).workingSpeech;});await page.getByRole('button',{name:'开启公共播报',exact:true}).click();await expect(page.getByRole('button',{name:'关闭公共播报',exact:true})).toBeVisible();
});
