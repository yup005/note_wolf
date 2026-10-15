import {test,expect,type Browser,type BrowserContext} from '@playwright/test';
import {requestWithBackoff} from './helpers/test-admin';
import {emptyRecord} from '../../packages/contracts/records';

async function fixture(browser:Browser){
 const contexts:BrowserContext[]=[],roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'];
 for(let i=0;i<12;i++){const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);await requestWithBackoff(()=>context.request.get('/api/session'));}
 const host=contexts[0];const created=await requestWithBackoff(()=>host.request.post('/api/rooms',{data:{nickname:'Judge host',requestId:crypto.randomUUID()}}));expect(created.ok()).toBe(true);const {room}=await created.json(),path=`/api/rooms/${room.id}`;
 const post=async(context:BrowserContext,endpoint:string,data:unknown={})=>{const response=await requestWithBackoff(()=>context.request.post(path+endpoint,{data}));expect(response.ok(),await response.text()).toBe(true);return response.json();};
 await post(host,'/settings',{dealMethod:'physical',gameMode:'manual'});
 for(let i=0;i<12;i++){if(i){const response=await requestWithBackoff(()=>contexts[i].request.post('/api/rooms/join',{data:{nickname:'Player '+(i+1),code:room.code}}));expect(response.ok()).toBe(true);}await post(contexts[i],'/seat',{seat:i+1});await post(contexts[i],'/ready',{ready:true,settingsRevision:1});}
 await post(host,'/deal');for(let i=0;i<12;i++)await post(contexts[i],'/identity',{role:roles[i]});await post(host,'/start');await host.request.get(path+'/records');await post(host,'/record',{revision:0,document:{...emptyRecord(),deaths:[{seat:5,round:1,period:'night',cause:'unrecorded'}],notes:'HOST_PRIVATE_NOTE'}});await post(host,'/manual/commit',{revision:1});
 const hostPage=await host.newPage();await hostPage.goto('/');await hostPage.locator('.recent-room').click();
 return {contexts,host,hostPage,path,post};
}

test('host appoints a completed dead player, only the judge reads secrets, and revocation conceals the panel',async({browser})=>{
 test.setTimeout(90000);const f=await fixture(browser);try{
  await f.hostPage.getByRole('button',{name:'法官设置',exact:true}).click();await f.hostPage.getByLabel('临时法官',{exact:true}).selectOption('5');await f.hostPage.getByLabel('死亡技能已处理完毕').check();await f.hostPage.getByRole('button',{name:'确认法官设置',exact:true}).click();
  const judgePage=await f.contexts[4].newPage();await judgePage.goto('/');await judgePage.locator('.recent-room').click();await judgePage.getByRole('button',{name:'法官面板',exact:true}).click();
  const panel=judgePage.getByRole('dialog',{name:'临时法官',exact:true});await expect(panel).toContainText('预言家');await expect(panel).toContainText('狼人');await expect(panel).not.toContainText('HOST_PRIVATE_NOTE');
  expect((await f.host.request.get(f.path+'/judge/private')).status()).toBe(403);expect((await f.contexts[2].request.get(f.path+'/judge/private')).status()).toBe(403);
  await judgePage.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await expect(panel).not.toContainText('预言家');await judgePage.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));await expect(panel).not.toContainText('预言家');await panel.getByRole('button',{name:'查看法官内容',exact:true}).click();await expect(panel).toContainText('预言家');
  await panel.getByRole('button',{name:'开始补录',exact:true}).click();await expect(panel).toContainText('补录进度');
  const own=(await (await f.host.request.get(f.path+'/records')).json()).own,manualVersion=(await (await f.host.request.get(f.path)).json()).room.manual.version;await f.post(f.host,'/record',{revision:own.revision,document:{...own.document,notes:'HOST_PRIVATE_NOTE_UPDATED'}});await f.post(f.host,'/manual/commit',{revision:own.revision+1});expect((await (await f.host.request.get(f.path)).json()).room.manual.version).toBe(manualVersion);await expect(panel.getByRole('button',{name:'重新开始补录',exact:true})).toHaveCount(0);
  // Private inference does not revise canonical facts; a factual badge correction does.
  const corrected=(await (await f.host.request.get(f.path+'/records')).json()).own;await f.post(f.host,'/record',{revision:corrected.revision,document:{...corrected.document,badges:[{round:1,seat:6}]}});await f.post(f.host,'/manual/commit',{revision:corrected.revision+1});await expect(panel.getByRole('button',{name:'重新开始补录',exact:true})).toBeVisible();await panel.getByRole('button',{name:'重新开始补录',exact:true}).click();await expect(panel).toContainText('补录进度');await expect(panel).not.toContainText('HOST_PRIVATE_NOTE_UPDATED');
  for(const width of [320,390,430]){await judgePage.setViewportSize({width,height:844});expect(await judgePage.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
  await judgePage.setViewportSize({width:390,height:844});await panel.evaluate(el=>{el.scrollTop=0;});await panel.screenshot({path:'/private/tmp/note-wolf-judge-mobile.png',animations:'disabled'});
  await f.hostPage.getByRole('button',{name:'法官设置',exact:true}).click();await f.hostPage.getByLabel('临时法官',{exact:true}).selectOption('');await f.hostPage.getByRole('button',{name:'确认法官设置',exact:true}).click();await expect(panel).not.toContainText('预言家');await expect(judgePage.getByRole('button',{name:'法官面板',exact:true})).toHaveCount(0);expect((await f.contexts[4].request.get(f.path+'/judge/private')).status()).toBe(403);
 }finally{await Promise.all(f.contexts.map(context=>context.close()));}
});

test('judge reconstructs missing facts and returns through the UI, then resumes a full phase without old requests',async({browser})=>{
 test.setTimeout(90000);const f=await fixture(browser);try{
  await f.post(f.host,'/judge/appoint',{confirmed:true,version:0,seat:5,deathSkillsComplete:true});const judge=f.contexts[4];let current=await (await judge.request.get(f.path+'/judge/private')).json();current=await f.post(judge,'/judge/draft',{assignmentVersion:current.assignmentVersion,manualVersion:current.manualVersion,requestId:crypto.randomUUID()});
  const supplement=async(operation:unknown)=>{const d=current.draft;current=await f.post(judge,'/judge/supplement',{assignmentVersion:current.assignmentVersion,manualVersion:current.manualVersion,draftId:d.id,draftVersion:d.version,requestId:crypto.randomUUID(),operation});};
  const day=async(action:string,extra={})=>supplement({kind:'day',actorSeat:1,command:{action,turnId:current.day.turnId,...extra}});
  await supplement({kind:'advance'});for(const actorSeat of [1,2,3,4])await supplement({kind:'night',actorSeat,command:{action:'vote',turnId:current.night.turnId,target:5}});
  while(current.night.phase!=='witch')await supplement({kind:'advance'});await supplement({kind:'night',actorSeat:10,command:{action:'witch',turnId:current.night.turnId,choice:'skip',target:null}});
  while(current.night.phase!=='first_night_complete')await supplement({kind:'advance'});await supplement({kind:'enter-day'});await day('close_signup');await day('continue');await day('continue');while(['death_skill','last_words'].includes(current.day.phase))await supplement({kind:'advance'});await day('speech_mode',{mode:'phone'});expect(current.day.phase).toBe('day_speech');const oldTurn=current.day.turnId;
  const judgePage=await judge.newPage();await judgePage.goto('/');await judgePage.locator('.recent-room').click();await judgePage.getByRole('button',{name:'法官面板',exact:true}).click();const panel=judgePage.getByRole('dialog',{name:'临时法官',exact:true});await expect(panel).toContainText('白天发言');await panel.getByRole('button',{name:'核对并切回自动',exact:true}).click();await panel.getByRole('button',{name:'确认切回自动',exact:true}).click();await expect(panel).toHaveCount(0);await expect(judgePage.getByRole('status',{name:'对局暂停状态'})).toContainText('90 秒');
  await judgePage.getByRole('button',{name:'恢复对局',exact:true}).click();await judgePage.getByRole('button',{name:'确认恢复对局',exact:true}).click();await expect(judgePage.getByRole('status',{name:'对局暂停状态'})).toContainText('准备恢复');await expect(judgePage.getByRole('status',{name:'对局暂停状态'})).toHaveCount(0,{timeout:10000});
  const snapshot=await (await f.host.request.get(f.path)).json();expect(snapshot.room.manual).toBeNull();expect(snapshot.room.day.phase).toBe('day_speech');expect(snapshot.room.day.deadline-snapshot.room.day.serverNow).toBeGreaterThan(85000);expect(snapshot.room.day.deadline-snapshot.room.day.serverNow).toBeLessThanOrEqual(90000);
  expect((await f.host.request.post(f.path+'/day/command',{data:{action:'end_speech',turnId:oldTurn}})).status()).toBe(409);
  expect((await judge.request.post(f.path+'/day/command',{data:{action:'interject',turnId:snapshot.room.day.turnId}})).status()).toBe(403);
  for(const width of [320,390,430]){for(const page of [judgePage,f.hostPage]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}}
  const records=await (await f.host.request.get(f.path+'/records')).json();expect(records.own.document.notes).toBe('HOST_PRIVATE_NOTE');expect((await f.host.request.get(f.path+'/judge/private')).status()).toBe(403);
 }finally{await Promise.all(f.contexts.map(context=>context.close()));}
});
