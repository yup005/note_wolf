import {test,expect} from '@playwright/test';

test('seat labels have enough vertical space on desktop and narrow phones',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await context.request.get('/api/session');const response=await context.request.post('/api/rooms',{data:{nickname:'模拟文字测试房主',requestId:crypto.randomUUID()}});const view=await response.json();
  await page.goto('/');await page.getByRole('button',{name:new RegExp(view.room.code)}).click();
  for(const width of [1440,1040,430,390,320]){
   await page.setViewportSize({width,height:900});
   const labels=await page.locator('.seat-name').evaluateAll(nodes=>nodes.map(node=>{const e=node as HTMLElement;const style=getComputedStyle(e);const range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();const box=e.getBoundingClientRect();return {fontSize:parseFloat(style.fontSize),height:e.clientHeight,textBottom:text.bottom,boxBottom:box.bottom};}));
   expect(labels).toHaveLength(12);
   for(const label of labels){expect(label.height,`vertical text space at ${width}px`).toBeGreaterThanOrEqual(label.fontSize*1.2);expect(label.textBottom,`text containment at ${width}px`).toBeLessThanOrEqual(label.boxBottom+1);}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/seat-labels-desktop.png',fullPage:true});
 }finally{await context.close();}
});
