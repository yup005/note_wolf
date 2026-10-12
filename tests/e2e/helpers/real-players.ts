import {expect,type Browser,type BrowserContext} from '@playwright/test';
export async function prepareOrdinaryRoom(browser:Browser,host:BrowserContext,room:{id:string;code:string},mode:'automatic'|'manual'='automatic'){
 const path=`/api/rooms/${room.id}`,others:BrowserContext[]=[];
 try{
  expect((await host.request.post(path+'/seat',{data:{seat:1}})).ok()).toBe(true);
  if(mode==='manual')expect((await host.request.post(path+'/settings',{data:{dealMethod:'online',gameMode:mode}})).ok()).toBe(true);
  const revision=(await (await host.request.get(path)).json()).room.preparation.settingsRevision;
  for(let seat=2;seat<=12;seat++){
   const c=await browser.newContext();others.push(c);await c.request.get('/api/session');
   expect((await c.request.post('/api/rooms/join',{data:{code:room.code,nickname:'Synthetic '+seat}})).ok()).toBe(true);
   expect((await c.request.post(path+'/seat',{data:{seat}})).ok()).toBe(true);
   expect((await c.request.post(path+'/ready',{data:{ready:true,settingsRevision:revision}})).ok()).toBe(true);
  }
  expect((await host.request.post(path+'/ready',{data:{ready:true,settingsRevision:revision}})).ok()).toBe(true);
  expect((await host.request.post(path+'/deal',{data:{}})).ok()).toBe(true);
  const roles=[];
  for(const [i,c] of [host,...others].entries()){
   const identity=await (await c.request.get(path+'/identity')).json();roles.push({seat:i+1,role:identity.role});
   expect((await c.request.post(path+'/identity/confirm',{data:{}})).ok()).toBe(true);
  }
  expect((await host.request.post(path+'/start',{data:{}})).ok()).toBe(true);return roles;
 }finally{await Promise.all(others.map(c=>c.close()));}
}
