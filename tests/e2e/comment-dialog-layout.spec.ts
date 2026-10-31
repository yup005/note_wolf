import {test,expect,type Locator} from '@playwright/test';
import {communityFixture} from './helpers/community';
import {requestWithBackoff} from './helpers/test-admin';

async function reachable(dialog:Locator,button:Locator){
 await expect(async()=>{
 await button.scrollIntoViewIfNeeded();
 const bounds=await dialog.boundingBox(),target=await button.boundingBox();expect(bounds).not.toBeNull();expect(target).not.toBeNull();
 expect(target!.y).toBeGreaterThanOrEqual(bounds!.y);expect(target!.y+target!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height);
 expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 }).toPass({timeout:5000});
}

test('published record comments stay inside a scrollable dialog and its record remains readable',async({browser})=>{
 const f=await communityFixture(browser);try{
 for(let i=0;i<4;i++)expect((await requestWithBackoff(()=>f.host.request.post('/api/community/comment',{data:{scope:f.scope,requestId:crypto.randomUUID(),parentId:null,text:i===0?'长评论\n'+('评论内容\n'.repeat(35)):'布局评论 '+i}}))).ok()).toBe(true);
 const page=await f.host.newPage();await page.goto('/');await page.getByRole('region',{name:'我的收藏'}).getByRole('button',{name:new RegExp('房间 '+f.room.code+' · 官方')}).click();
 const dialog=page.getByRole('dialog',{name:'房主官方版本'});await dialog.getByRole('button',{name:'查看评论',exact:true}).click();await expect(dialog.locator('article')).toHaveCount(4);
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
  await reachable(dialog,dialog.locator('article').last().getByRole('button',{name:'举报',exact:true}));
  await dialog.locator('.record-notes').scrollIntoViewIfNeeded();expect(await dialog.locator('.record-notes').evaluate(el=>{const r=el.getBoundingClientRect();return r.height>0&&el.contains(document.elementFromPoint(r.x+5,r.y+r.height/2));})).toBe(true);
  await reachable(dialog,dialog.getByRole('button',{name:'关闭',exact:true}));
 }
 await page.setViewportSize({width:390,height:844});await dialog.getByLabel('评论内容').fill('滚动弹窗仍能发表评论');await dialog.getByRole('button',{name:'发布评论',exact:true}).click();await expect(dialog.getByText('滚动弹窗仍能发表评论',{exact:true})).toBeVisible();
 await reachable(dialog,dialog.locator('article').first().getByRole('button',{name:'回复',exact:true}));await dialog.locator('article').first().getByRole('button',{name:'回复',exact:true}).click();await dialog.getByLabel('回复内容').fill('布局回复');await dialog.getByRole('button',{name:'发布回复',exact:true}).click();await dialog.locator('article').first().getByRole('button',{name:'展开回复 1',exact:true}).click();await expect(dialog.getByText('布局回复',{exact:true})).toBeVisible();
 await reachable(dialog,dialog.getByRole('button',{name:'发布评论',exact:true}));await page.screenshot({path:'test-results/note-wolf-comment-dialog-fixed.png',animations:'disabled'});
 }finally{await f.close();}
});
