import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, '需要隔离的真实测试会话');

test('任务筛选对应实际记录，桌面同步显示详情，刷新同步获取日志', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/#tasks');
  await expect(page.locator('.task-record-row-main').first()).toBeVisible();
  const {result: jobs} = await (await page.request.get('/api/jobs')).json();
  const filters = page.getByRole('group',{name:'任务状态筛选'});
  for (const [i, status] of ['all','running','paused','queued','cancelling','failed','completed','cancelled'].entries()) {
    await expect(filters.locator('button').nth(i).locator('small')).toHaveText(String(status === 'all' ? jobs.length : jobs.filter((job:{status:string})=>job.status===status).length));
  }
  await page.locator('.task-record-row-main').first().click();
  await expect(page.locator('.folio-tasks-inspector')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'任务详情',exact:true})).toHaveCount(0);
  const logsRequest = page.waitForResponse(response => /\/api\/jobs\/\d+\/logs/.test(response.url()) && response.ok());
  await page.getByRole('button', {name:'刷新',exact:true}).click();
  await logsRequest;
  await expect(page.locator('.folio-tasks-log li').first()).toBeVisible();
  const before = await filters.boundingBox();
  await filters.locator('button').nth(1).click();
  await expect(page.locator('.task-record-row-main')).toHaveCount(jobs.filter((job:{status:string})=>job.status==='running').length);
  expect((await filters.boundingBox())!.y).toBe(before!.y);
});

test('任务与词条来源展开可在途中关闭并恢复来源焦点', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.setViewportSize({width:390,height:844});
  for (const entry of [{route:'tasks',selector:'.task-record-row-main',label:'任务详情'}, {route:'dictionary',selector:'.folio-dictionary-row',label:'编辑词条'}]) {
    await page.goto('/#'+entry.route);
    const trigger = page.locator(entry.selector).first();
    await trigger.click();
    const dialog = page.getByRole('dialog',{name:entry.label,exact:true});
    await expect(dialog.locator('[data-sheet-anchor]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('.is-detail-source')).toHaveCount(0);
    await trigger.click();
    await expect(dialog).toHaveAttribute('data-phase','open');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});

test('治理来源值进入草稿，手动输入可接管正在播放的转移动效', async ({page}) => {
  await page.goto('/#governance');
  const adopt = page.getByRole('button',{name:'采用来源值',exact:true}).and(page.locator('button:enabled')).first();
  const field = adopt.locator('xpath=ancestor::article[1]');
  const input = field.getByRole('textbox');
  const before = await input.inputValue();
  const overlaps = await page.locator('.folio-governance-work').evaluate(node => {
    const cover = node.querySelector('.folio-governance-work-cover')!.getBoundingClientRect();
    const copy = node.querySelector('.folio-governance-work-copy')!.getBoundingClientRect();
    return cover.right > copy.left && cover.bottom > copy.top && cover.left < copy.right && cover.top < copy.bottom;
  });
  expect(overlaps).toBe(false);
  await adopt.click();
  await expect(input).not.toHaveValue('');
  await input.fill(before+' ');
  await expect(field.locator('.governance-transfer-copy')).toHaveCount(0);
  await expect(input).toHaveValue(before+' ');
  await input.fill(before);
});
