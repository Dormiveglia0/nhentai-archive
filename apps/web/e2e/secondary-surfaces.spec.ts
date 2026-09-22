import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.E2E_STORAGE_STATE });

test('远端详情只为实际关联作品显示入口，标签切换保留阅读入口', async ({ page }) => {
  await page.goto('/#discover');
  const detailResponse = page.waitForResponse(response => /\/api\/discover\/galleries\/\d+$/.test(response.url()) && response.ok());
  await page.locator('.popular-cover').first().click();
  const payload = await (await detailResponse).json();
  const detail = payload;
  const related = page.getByRole('button', { name: '相关作品', exact: true });
  await expect(related).toHaveCount(detail.related.length ? 1 : 0);
  await page.getByRole('button', { name: '作品标签', exact: true }).click();
  await expect(page.locator('.folio-gallery-tags')).toBeVisible();
  await expect(page.locator('.folio-gallery-actions a.is-primary')).toHaveAttribute('href', /^#reader/);
});

test('历史封面与文本保持间距，手机和桌面不溢出', async ({ page }) => {
  await page.goto('/#history');
  const row = page.locator('.folio-history-row').first();
  await expect(row).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const cover = await row.locator('.folio-history-cover').boundingBox();
    const main = await row.locator('.folio-history-main').boundingBox();
    expect(main!.x - cover!.x - cover!.width).toBeGreaterThanOrEqual(10);
    expect(await page.locator('.folio-scroll').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await expect(row.locator('.folio-history-main small')).toContainText(/\d{2}-\d{2} · \d{2}:\d{2}/);
  }
});
