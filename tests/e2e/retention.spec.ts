import {test,expect} from '@playwright/test';
import {createServer} from '../../apps/server/app';
import {createServer as createViteServer} from 'vite';

test('real expired-room socket returns the browser home and keeps its account',async({page})=>{
 let now=1000;const app=await createServer({dbPath:':memory:',now:()=>now});
 const frontend=await createViteServer({server:{middlewareMode:true,hmr:false},appType:'spa'});
 app.web.use(frontend.middlewares);
 await new Promise<void>(resolve=>app.http.listen(0,'127.0.0.1',resolve));
 const address=app.http.address();if(!address||typeof address==='string')throw Error('address');
 try{
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByRole('button',{name:'登录 / 注册',exact:true}).click();
  await page.getByRole('button',{name:'注册新账号',exact:true}).click();
  await page.getByLabel('用户名',{exact:true}).fill('retention_browser');
  await page.getByLabel('昵称',{exact:true}).fill('清理测试玩家');
  await page.getByLabel('密码',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'注册并登录',exact:true}).click();
  await page.getByRole('button',{name:'创建房间',exact:true}).click();
  await expect(page.getByText('已连接',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'选择你的座位',exact:true})).toBeVisible();
  now+=24*60*60*1000;app.cleanupExpiredRooms();
  await expect(page.getByRole('heading',{name:'房间大厅',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('房间已清理，请返回首页');
  await expect(page.getByRole('button',{name:'清理测试玩家',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('wolf.room'))).toBeNull();
  await expect(page.getByRole('heading',{name:'我的房间',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'我的收藏',exact:true})).toHaveCount(1);
  await page.screenshot({path:'test-results/retention-home-mobile.png',fullPage:true});
 }finally{await frontend.close();await app.close();}
});
