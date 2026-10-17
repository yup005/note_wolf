import {test,expect} from '@playwright/test';
import {loginTestAdmin,requestWithBackoff} from './helpers/test-admin';

test('night voice enable stays disabled until the room socket connects',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('wolf.voice.enabled','off'));await loginTestAdmin(page);const created=await requestWithBackoff(()=>page.request.post('/api/rooms',{data:{nickname:'Connection simulation',requestId:crypto.randomUUID()}}));expect(created.ok()).toBe(true);const {room}=await created.json(),path=`/api/rooms/${room.id}`;
 for(const [endpoint,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:0}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)expect((await requestWithBackoff(()=>page.request.post(path+'/'+endpoint,{data}))).ok()).toBe(true);
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.route('**/socket.io/**',route=>route.abort());await page.reload();
 await expect(page.getByRole('heading',{name:'狼人行动',exact:true})).toBeVisible();await expect(page.locator('.night-nav .live')).toContainText('重连中');await expect(page.getByRole('button',{name:'开启播报',exact:true})).toBeDisabled();
 await page.unroute('**/socket.io/**');await expect(page.locator('.night-nav .live')).toContainText('已连接');await expect(page.getByRole('button',{name:'开启播报',exact:true})).toBeEnabled();
});
