import {expect,type Page} from '@playwright/test';
export async function setRoleCount(page:Page,label:string,target:number){
 const tag=page.locator('.custom-board-editor').getByRole('button',{name:label,exact:true});
 let count=Number(await tag.getAttribute('data-role-count'));
 if(label==='狼人'||label==='村民'){
  while(count!==target){const next=count+(count<target?1:-1);await page.getByRole('button',{name:(count<target?'增加':'减少')+label,exact:true}).click();await expect(tag).toHaveAttribute('data-role-count',String(next));count=next;}
 }else{if(target>1)throw Error('Singleton tag cannot create multiple '+label);if(count!==target)await tag.click();await expect(tag).toHaveAttribute('data-role-count',String(target));}
}
