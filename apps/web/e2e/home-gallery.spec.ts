import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("首页页片对应真实作品，拖动与键盘翻阅同步作品详情，日期联动阅读数据", async ({ page }) => {
  const searchPromise = page.waitForResponse(response => response.url().includes('/api/library/search?'));
  await page.goto('/#workbench');
  const { result: works } = await (await searchPromise).json();
  expect(works.length).toBeGreaterThan(3);
  const stage = page.getByRole('slider', { name: '翻阅最近作品' });
  await expect(page.locator('.folio-studio-stage svg > g')).toHaveCount(works.length);
  await expect(page.locator('.folio-studio-work-title')).toHaveAttribute('href', `#reader/${works[0].id}`);
  await stage.focus(); await page.keyboard.press('ArrowRight');
  await expect(stage).toHaveAttribute('aria-valuenow', '2');
  await expect(page.locator('.folio-studio-work-title')).toHaveAttribute('href', `#reader/${works[1].id}`);
  const rect = (await stage.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 - 48, rect.y + rect.height / 2, { steps: 6 }); await page.mouse.up();
  await expect(stage).toHaveAttribute('aria-valuenow', '4');
  await expect(page.locator('.folio-studio-work-title')).toHaveAttribute('href', `#reader/${works[3].id}`);
  await page.getByRole('button', { name: '上一本', exact: true }).click();
  await expect(stage).toHaveAttribute('aria-valuenow', '3');
  await page.getByRole('button', { name: '暂停动效' }).click();
  await expect(page.locator('.folio-home-studio')).toHaveClass(/is-still/);
  const bar = page.locator('.folio-studio-bars button').first();
  const date = (await bar.getAttribute('aria-label'))!.split('，')[0];
  await bar.click();
  await expect(page.locator('.folio-studio-duration > span').first()).toHaveText(date);
  await expect(page.locator('.folio-studio-activity strong')).toContainText('分钟');
  await page.getByRole('button', { name: '查看30天阅读汇总' }).click();
  await expect(page.locator('.folio-studio-duration > span').first()).toHaveText('近 30 天阅读');
});

test("窄屏空作品不生成假页片，数据失败可重试，减少动态效果可用", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/library/summary', route => route.abort());
  await page.route('**/api/library/search?*', async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ json: { ...data, result: [] } });
  });
  await page.goto('/#workbench');
  await expect(page.getByRole('alert')).toContainText('部分数据加载失败');
  await expect(page.locator('.folio-studio-total > strong')).toHaveText('—');
  await expect(page.locator('.folio-studio-stage svg > g')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下一本', exact: true })).toBeDisabled();
  await expect(page.locator('.folio-home-studio')).toHaveClass(/is-still/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.unroute('**/api/library/summary'); await page.unroute('**/api/library/search?*');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.folio-studio-work-title')).toBeVisible();
});
