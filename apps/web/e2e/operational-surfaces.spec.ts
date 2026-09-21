import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, '需要隔离的真实测试会话');

test('任务状态卡对应实际记录，手动刷新同步获取日志', async ({ page }) => {
  await page.goto('/#tasks');
  await expect(page.locator('.task-object').first()).toBeVisible();
  const response = await page.request.get('/api/jobs');
  const { result: jobs } = await response.json();
  for (const [i, states] of [['queued'], ['running', 'cancelling'], ['paused', 'failed'], ['completed', 'cancelled']].entries()) {
    const matching = jobs.filter((job: {status:string}) => states.includes(job.status));
    const lane = page.locator('.task-lane').nth(i);
    await expect(lane.locator('.task-lane-heading strong')).toHaveText(String(matching.length));
    await expect(lane.locator('.task-object')).toHaveCount(Math.min(matching.length, 1));
  }
  await page.locator('.task-object').first().click();
  const dialog = page.getByRole('dialog', {name:'任务详情', exact:true});
  await expect(dialog).toHaveAttribute('data-phase', 'open');
  await expect(dialog.locator('.folio-tasks-log li').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  const logsRequest = page.waitForResponse(response => /\/api\/jobs\/\d+\/logs/.test(response.url()) && response.ok());
  await page.getByRole('button', {name:'刷新',exact:true}).click();
  await logsRequest;
  await page.locator('.task-object').first().click();
  await expect(dialog.locator('.folio-tasks-log li').first()).toBeVisible();
});

test('任务与词条来源展开可在途中关闭并恢复来源焦点', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  for (const entry of [{route:'tasks',selector:'.task-object',label:'任务详情'}, {route:'dictionary',selector:'.folio-dictionary-row',label:'编辑词条'}]) {
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
