import { expect, test } from '@playwright/test';
test.use({storageState:process.env.E2E_STORAGE_STATE});
test.skip(!process.env.E2E_STORAGE_STATE,'需要隔离的真实测试会话');

test('封面展开中反向关闭保持当前位置，完成后归还焦点',async({page})=>{
 await page.goto('/#library');
 const cover=page.locator('.folio-library-cover').first();
 await expect(cover).toBeVisible();
 await cover.click();
 const sheet=page.getByRole('dialog',{name:'作品详情',exact:true});
 const anchor=sheet.locator('[data-sheet-anchor]');
 await expect(sheet).toHaveAttribute('data-phase','opening');
 await page.waitForTimeout(100);
 const jump=await sheet.evaluate(node=>{
   const element=node.querySelector('[data-sheet-anchor]')!;
   const before=element.getBoundingClientRect();
   node.dispatchEvent(new Event('cancel',{cancelable:true}));
   return new Promise<number>(resolve=>requestAnimationFrame(()=>{
     const after=element.getBoundingClientRect();
     resolve(Math.abs(before.x-after.x)+Math.abs(before.y-after.y));
   }));
 });
 expect(jump).toBeLessThan(45);
 await expect(sheet).not.toBeVisible();await expect(cover).toBeFocused();
 await expect(cover).not.toHaveClass(/is-detail-source/);
 await cover.press('Enter');await expect(sheet).toHaveAttribute('data-phase','open');
 expect((await anchor.boundingBox())!.width).toBeGreaterThan(250);
 await page.keyboard.press('Escape');await expect(sheet).not.toBeVisible();
});

test('设置控制摘要跟随草稿，导出组成操作保持真实选项',async({page})=>{
 await page.goto('/#settings');
 const nav=page.getByRole('navigation',{name:'设置章节'});
 await nav.getByRole('button',{name:/访问与阅读/}).click();
 const control=page.getByRole('checkbox',{name:/封面模糊默认开启/});
 const original=await control.isChecked();
 await control.setChecked(!original);
 await expect(nav.getByRole('button',{name:/访问与阅读/})).toContainText(original?'封面可见':'封面模糊');
 await expect(page.locator('.settings-control-directory')).toHaveClass(/is-dirty/);
 await nav.getByRole('button',{name:/翻译/}).click();
 await nav.getByRole('button',{name:/访问与阅读/}).click();
 await expect(control).toBeChecked({checked:!original});
 await control.setChecked(original);
 await page.goto('/#export');
 const box=page.getByRole('checkbox',{name:'保留 JSON',exact:true});
 const checked=await box.isChecked();await box.setChecked(!checked);
 const layer=box.locator('..');
 if(checked)await expect(layer).not.toHaveClass(/is-included/);else await expect(layer).toHaveClass(/is-included/);
 await box.setChecked(checked);
});

test('任务状态分组使用真实记录，减少动态效果不阻碍选择',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#tasks');
 await expect(page.locator('.task-flow-live')).not.toContainText('读取中');
 const response=await page.request.get('/api/jobs');const data=await response.json();
 const jobs=data.result;
 const groups=[{key:'queued',statuses:['queued']},{key:'active',statuses:['running','cancelling']},{key:'attention',statuses:['paused','failed']},{key:'finished',statuses:['completed','cancelled']}];
 for(const group of groups){
   await page.locator(`.flow-${group.key} > header button`).click();
   await expect(page.locator('.folio-tasks-row')).toHaveCount(jobs.filter((job:{status:string})=>group.statuses.includes(job.status)).length);
 }
});


test('词典映射和治理采用来源值直接更新草稿',async({page})=>{
 await page.goto('/#dictionary');
 await page.locator('.folio-dictionary-row').first().click();
 const source=page.locator('.dictionary-mapping label').first().locator('input');
 await expect(source).not.toHaveValue('');
 const translated=page.locator('.dictionary-mapping label').last().locator('input');
 const before=await translated.inputValue();
 await translated.fill(await source.inputValue());
 await expect(page.locator('.dictionary-mapping')).toHaveClass(/is-mapped/);
 await translated.fill(before);
 await page.goto('/#governance');
 const adopt=page.getByRole('button',{name:'采用来源值',exact:true}).and(page.locator('button:enabled')).first();
 await expect(adopt).toBeVisible();
 const card=adopt.locator('xpath=ancestor::article[1]');
 await adopt.click();
 await expect(card.locator('.folio-governance-field-input')).not.toHaveValue('');
 await expect(card.locator('.governance-value-transfer')).toBeVisible();
 // Leave without saving; the next page load reconstructs the original draft.
 await page.goto('/#library');
});
