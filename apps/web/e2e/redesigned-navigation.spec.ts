import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, '需要隔离的真实测试会话');

for (const width of [1440, 390]) {
  test(`分类筛选保留焦点和返回入口：${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#library');
    await expect(page.locator('.folio-shelf-item').first()).toBeVisible();
    await expect(page.locator('.folio-library-card').first()).toBeVisible();
    const states = page.getByRole('group', { name: '阅读状态', exact: true });
    const reading = states.getByRole('button', { name: /在读/ });
    const before = await states.boundingBox();
    await reading.click();
    await expect(reading).toHaveAttribute('aria-pressed', 'true');
    expect((await states.boundingBox())!.x).toBe(before!.x);
    expect((await states.boundingBox())!.y).toBe(before!.y);
    await expect(reading).toBeFocused();
    await states.getByRole('button', { name: /全部/ }).click();
    await expect(states.getByRole('button', { name: /全部/ })).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/#files');
    const folder = page.getByRole('group', {name:'文件类型'}).getByRole('button', {name:/孤立文件/});
    const inventory = page.waitForResponse(r => r.url().includes('/api/files/inventory?category=orphan') && r.ok());
    await folder.click();
    await inventory;
    await expect(folder).toHaveAttribute('aria-pressed', 'true');
    await expect(folder).toBeFocused();
    await expect(page.locator('.folio-files-main')).toBeVisible();
    await page.getByRole('button', { name: '全部文件', exact: true }).click();
    await expect(page.getByRole('button', { name: '全部文件', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/#dictionary');
    const artists = page.waitForResponse(r => r.url().includes('/api/dictionary/candidates?') && new URL(r.url()).searchParams.get('type') === 'artist' && r.ok());
    await page.getByRole('navigation', { name: '词条类型' }).getByRole('button', { name: /作者/ }).click();
    await artists;
    await expect(page.getByRole('navigation', { name: '词条类型' }).getByRole('button', { name: /作者/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.folio-scroll').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
  });
}
