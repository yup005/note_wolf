import {test,expect} from '@playwright/test';
import {setRoleCount} from './helpers/board-tags';
test('eleven-player dual idiot is explicit, saved, readable, and retained at other player counts and cleared without an idiot',async({page})=>{
 await page.goto('/');await page.getByLabel('你的昵称').fill('十一人双边');await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'以游客身份继续'}).click();
 await page.getByText('自定义调整',{exact:true}).click();await setRoleCount(page,'狼人',3);await expect(page.getByTestId('draft-player-count')).toHaveText('共 11 人');
 await expect(page.getByLabel('白痴规则').locator('option[value="dual-category-14"]')).toHaveJSProperty('disabled',false);await page.getByLabel('白痴规则').selectOption('dual-category-14');await page.getByLabel('板子名称').fill('11人双边');await page.getByRole('button',{name:'另存板子',exact:true}).click();await expect(page.getByTestId('seated-count')).toHaveText('0 / 11');
 await page.reload();await page.getByText('自定义调整',{exact:true}).click();await expect(page.getByLabel('白痴规则')).toHaveValue('dual-category-14');
 await page.getByRole('button',{name:'规则速查',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByText('白痴 × 1',{exact:true}).click();await expect(dialog).toContainText('神边算死、民边仍活');await expect(dialog).not.toContainText('启用14人');await dialog.getByRole('button',{name:'关闭规则',exact:true}).click();
 await setRoleCount(page,'狼人',4);await expect(page.getByLabel('白痴规则')).toHaveValue('dual-category-14');await expect(page.getByLabel('白痴规则').locator('option[value="dual-category-14"]')).toHaveJSProperty('disabled',false);
 await setRoleCount(page,'白痴',0);await expect(page.getByLabel('白痴规则')).toHaveCount(0);await setRoleCount(page,'白痴',1);await expect(page.getByLabel('白痴规则')).toHaveValue('standard');
});
