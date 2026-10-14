import {expect,type Browser} from '@playwright/test';
import {prepareOrdinaryRoom} from './real-players';
import {loginTestAdmin,requestWithBackoff} from './test-admin';

/** Independent synthetic, fully ended published game. Never uses live rooms. */
export async function communityFixture(browser:Browser){
 const host=await browser.newContext({viewport:{width:390,height:844}}),admin=await browser.newContext(),reader=await browser.newContext({viewport:{width:390,height:844}});
 await requestWithBackoff(()=>host.request.get('/api/session'));const adminPage=await admin.newPage();await loginTestAdmin(adminPage);await adminPage.close();
 const created=await requestWithBackoff(()=>host.request.post('/api/rooms',{data:{nickname:'评论房主',requestId:crypto.randomUUID()}}));expect(created.ok()).toBe(true);
 const room=(await created.json()).room,path='/api/rooms/'+room.id,roles=await prepareOrdinaryRoom(browser,host,room,'manual');
 const registration=await requestWithBackoff(()=>host.request.post('/api/auth/register',{data:{username:'community_'+crypto.randomUUID().slice(0,8),password:'community-test-password',nickname:'评论作者'}}));expect(registration.ok()).toBe(true);const account=(await registration.json()).account;
 expect((await requestWithBackoff(()=>admin.request.post(`/api/admin/users/${account.id}/vip`,{data:{enabled:true,expiresAt:null}}))).ok()).toBe(true);
 const doc={deaths:roles.filter(r=>r.role==='wolf').map(r=>({seat:r.seat,round:1,period:'night',cause:'unrecorded'})),badges:[],exiles:[],votes:[],notes:'公开评论复盘'};
 const recordId=(await (await requestWithBackoff(()=>host.request.get(path+'/records'))).json()).own.id;
 for(const response of [await requestWithBackoff(()=>host.request.post(path+'/record',{data:{revision:0,document:doc}})),await requestWithBackoff(()=>host.request.post(path+'/manual/commit',{data:{revision:1}})),await requestWithBackoff(()=>host.request.post(path+'/record/publish',{data:{revision:1}})),await requestWithBackoff(()=>host.request.post(`/api/records/${recordId}/favorite`,{data:{}}))])expect(response.ok()).toBe(true);
 const shareResponse=await requestWithBackoff(()=>host.request.post(`/api/records/${recordId}/share`,{data:{action:'create',revision:0}}));expect(shareResponse.ok()).toBe(true);const share=await shareResponse.json(),shareToken=share.token as string,page=await reader.newPage();
 return {host,admin,reader,page,account,room,path,recordId,doc,shareToken,share,scope:{kind:'share' as const,token:shareToken},close:()=>Promise.all([host.close(),admin.close(),reader.close()])};
}
