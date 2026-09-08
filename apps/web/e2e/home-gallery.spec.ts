import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("纸上装置支持变形、拖转、键盘、暂停和重置，数据来自统计接口", async ({ page }) => {
  const summaryPromise = page.waitForResponse(response => response.url().endsWith('/api/library/summary'));
  await page.goto('/#workbench');
  const summary = await (await summaryPromise).json();
  await expect(page.locator('.folio-studio-total > strong')).toHaveText(summary.total.toLocaleString('zh-CN'));
  const stage = page.getByRole('slider', { name: '页片旋转' });
  await stage.focus(); await page.keyboard.press('ArrowRight');
  await expect(stage).toHaveAttribute('aria-valuenow', '15');
  const rect = (await stage.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 90, rect.y + rect.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(stage).toHaveAttribute('aria-valuenow', '60');
  for (const name of ['回环', '流线', '叠页']) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('slider', { name: '展开', exact: true }).focus(); await page.keyboard.press('End');
  await expect(page.locator('.folio-studio-range output')).toHaveText('100°');
  await page.getByRole('button', { name: '重新排印' }).click();
  await expect(page.getByRole('button', { name: /回环/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '暂停动效' }).click();
  await expect(page.locator('.folio-home-studio')).toHaveClass(/is-still/);
  await page.getByRole('button', { name: '重置画面' }).click();
  await expect(stage).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.folio-studio-range output')).toHaveText('55°');
  await page.locator('.folio-studio-bars button').first().click();
  await expect(page.locator('.folio-studio-activity strong')).toContainText('分钟');
});

test("窄屏与减少动态效果可用，数据失败仍可操作装置并重试", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/library/summary', route => route.abort());
  await page.goto('/#workbench');
  await expect(page.getByRole('alert')).toContainText('部分数据加载失败');
  await expect(page.locator('.folio-studio-total > strong')).toHaveText('—');
  await page.getByRole('button', { name: /流线/ }).click();
  await expect(page.getByRole('button', { name: /流线/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.folio-home-studio')).toHaveClass(/is-still/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute('**/api/library/summary');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.folio-studio-total > strong')).not.toHaveText('—');
});
