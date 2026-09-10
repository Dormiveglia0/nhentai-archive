import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, '需要隔离测试会话');

test('偶遇连续抽取不同的未读作品，拖动只触发一次且收藏持久化', async ({ page }) => {
  await page.goto('/?home-preview=encounter#workbench');
  const draw = page.getByRole('button', { name: '抽取一部未读作品' });
  await draw.waitFor(); await expect(draw).toBeEnabled(); await draw.click();
  const link = page.locator('.encounter-result a'); await expect(link).toBeVisible();
  const first = await link.getAttribute('href');
  await expect(draw).toBeEnabled();
  const box = (await draw.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 25); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 75, box.y + 25, { steps: 6 }); await page.mouse.up();
  await expect(link).not.toHaveAttribute('href', first!);
  await expect(page.locator('.encounter-history button')).toHaveCount(2);
  const id = (await link.getAttribute('href'))!.split('/').pop();
  const before = await (await page.request.get(`/api/works/${id}`)).json();
  if (!before.favorite) {
    try {
      await page.getByRole('button', { name: '留下这部' }).click();
      await expect(page.getByRole('button', { name: '已收藏' })).toBeDisabled();
      expect((await (await page.request.get(`/api/works/${id}`)).json()).favorite).toBeTruthy();
    } finally { await page.request.patch(`/api/works/${id}/favorite`, { data: { favorite: false } }); }
  }
  await page.locator('.encounter-history button').last().click(); await expect(link).toHaveAttribute('href', first!);
});

test('阅读回声沿真实作品关系前进并能返回探索路径', async ({ page }) => {
  await page.goto('/?home-preview=echo#workbench');
  await expect(page.locator('.echo-branch')).toHaveCount(3);
  const first = await page.locator('.echo-origin a').getAttribute('href');
  await page.locator('.echo-branch button').first().click();
  await expect(page.locator('.echo-origin a')).not.toHaveAttribute('href', first!);
  await expect(page.locator('.echo-branch')).toHaveCount(3);
  await page.locator('.echo-trail button').first().click();
  await expect(page.locator('.echo-origin a')).toHaveAttribute('href', first!);
  await expect(page.locator('.echo-map')).toHaveAttribute('aria-busy', 'false');
});

test('私人扉页拖动与键盘改变记录曲线，导出有效 PNG，重置恢复', async ({ page }) => {
  await page.goto('/?home-preview=imprint#workbench');
  const save = page.getByRole('button', { name: '保存这一页' }); await expect(save).toBeEnabled();
  const mark = page.getByRole('slider', { name: '书签1' });
  const path = page.locator('[data-trace="0"]').first(), before = await path.getAttribute('d');
  const box = (await mark.boundingBox())!;
  await page.mouse.move(box.x + 22, box.y + 22); await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 80, { steps: 6 }); await page.mouse.up();
  await expect(path).not.toHaveAttribute('d', before!);
  await mark.focus(); await page.keyboard.press('Home'); await expect(mark).toHaveAttribute('aria-valuenow', '210');
  await page.keyboard.press('ArrowDown'); await expect(mark).toHaveAttribute('aria-valuenow', '225');
  const pending = page.waitForEvent('download'); await save.click(); const download = await pending;
  const bytes = await readFile((await download.path())!); expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(1800); expect(bytes.readUInt32BE(20)).toBe(1200);
  await page.getByRole('button', { name: '恢复初始编排' }).click(); await expect(path).toHaveAttribute('d', before!);
});
