import {setRoleCount} from './helpers/board-tags';
import {test,expect} from '@playwright/test';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';
import type {LobbyView} from '../../packages/contracts/index';

test('13–15 seats confirm the host and keep every night/day card equal across viewports',async({page})=>{
 test.setTimeout(90000);await loginTestAdmin(page);
 await page.addInitScript(()=>{class Utterance {text:string;lang='';voice=null;rate=1;onstart?:()=>void;onend?:()=>void;constructor(text:string){this.text=text;}}Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{},speak:(u:Utterance)=>queueMicrotask(()=>{u.onstart?.();u.onend?.();})},configurable:true});});
 for(const count of [13,14,15]){
  await page.goto('/');await page.evaluate(()=>localStorage.removeItem('wolf.room'));await page.reload();await page.getByLabel('你的昵称').fill('Expanded simulation');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByLabel('选择板子').selectOption('mechanical-12');await page.getByText('自定义调整',{exact:true}).click();await setRoleCount(page,'村民',Number(String(count-8)));await page.getByRole('button',{name:'应用本局配置',exact:true}).click();
  await page.getByRole('button',{name:'1 号座位，空位',exact:true}).click();await page.getByRole('button',{name:'补满测试玩家',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始发牌',exact:true}).click();await expect(page.getByText(`已确认 ${count-1} / ${count}`,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'开始对局',exact:true})).toBeDisabled();await page.getByRole('button',{name:'查看身份',exact:true}).click();await page.getByRole('button',{name:'确认身份',exact:true}).click();await expect(page.getByText(`已确认 ${count} / ${count}`,{exact:true})).toBeVisible();await page.getByRole('button',{name:'开始对局',exact:true}).click();await page.getByRole('button',{name:'开始首夜',exact:true}).click();
  const session=await(await requestWithBackoff(()=>page.request.get('/api/session'))).json(),initial:LobbyView=session.rooms.find((v:LobbyView)=>v.room.board.composition.seatCount===count),path='/api/rooms/'+initial.room.id;
  const checkCards=async()=>{await expect(page.locator('.night-target')).toHaveCount(count);for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1040,height:900}]){await page.setViewportSize(size);const boxes=await page.locator('.night-target').evaluateAll(nodes=>nodes.map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})));expect(boxes).toHaveLength(count);expect(Math.max(...boxes.map(b=>b.height))-Math.min(...boxes.map(b=>b.height)),`equal rows for ${count} at ${size.width}x${size.height}`).toBeLessThanOrEqual(1);for(const b of boxes)expect(b.height).toBeGreaterThanOrEqual(44);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}};
  await checkCards();await page.getByRole('button',{name:'开启播报',exact:true}).click();await expect(page.getByRole('button',{name:'关闭播报',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭播报',exact:true}).click();
  if(count===13)await page.screenshot({path:'/private/tmp/note-wolf-13-seats-night.png',fullPage:false,animations:'disabled'});
  const post=async(endpoint:string,data:unknown={})=>{const r=await requestWithBackoff(()=>page.request.post(path+endpoint,{data}));expect(r.ok(),await r.text()).toBe(true);};
  const read=async()=>{const r=await requestWithBackoff(()=>page.request.get(path));expect(r.ok(),await r.text()).toBe(true);return r;};const state=async():Promise<LobbyView>=>(await read()).json();
  const advance=async()=>{let complete=false;const r=await requestWithBackoff(async()=>{
   // Backpressure can outlast the remaining night; recheck before every attempt.
   const fresh=await read(),current:LobbyView=await fresh.json();complete=current.room.night?.phase==='first_night_complete';return complete?fresh:page.request.post(path+'/night/test-advance',{data:{}});
  });if(r.status()===409&&(await r.json()).error==='PHASE_LOCKED'){
   // The timer may also finish between the fresh read and this one write.
   expect((await state()).room.night?.phase,'phase-locked advance must have actually completed the night').toBe('first_night_complete');return true;
  }expect(r.ok(),await r.text()).toBe(true);return complete;};
  for(let i=0;i<30;i++)if(await advance())break;expect((await state()).room.night?.phase).toBe('first_night_complete');await post('/day/enter');await expect(page.getByRole('heading',{name:'警长报名',exact:true})).toBeVisible();await checkCards();await expect(page.getByRole('button',{name:'开启播报',exact:true})).toHaveCount(0);
 }
});
