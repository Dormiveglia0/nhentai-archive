import { expect, test } from '@playwright/test';

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, '需要隔离的真实测试会话');

for (const width of [1440, 390]) {
  test(`分类对象收拢后保留筛选、焦点和返回入口：${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#library');
    const states = page.getByRole('group', { name: '阅读状态', exact: true });
    const reading = states.getByRole('button', { name: /在读/ });
    await reading.click();
    await expect(page.locator('.library-composition')).toHaveClass(/has-selection/);
    await expect(reading).toBeFocused();
    await states.getByRole('button', { name: /全部/ }).click();
    await expect(page.locator('.library-composition')).not.toHaveClass(/has-selection/);

    await page.goto('/#files');
    const folder = page.locator('.file-volume').nth(1);
    const inventory = page.waitForResponse(r => r.url().includes('/api/files/inventory?category=orphan') && r.ok());
    await folder.click();
    await inventory;
    await expect(folder).toHaveAttribute('aria-pressed', 'true');
    await expect(folder).toBeFocused();
    await expect(page.locator('.files-composition')).toHaveClass(/has-selection/);
    await page.getByRole('button', { name: '全部文件', exact: true }).click();
    await expect(page.locator('.files-composition')).not.toHaveClass(/has-selection/);

    await page.goto('/#dictionary');
    const artists = page.waitForResponse(r => r.url().includes('/api/dictionary/candidates?') && new URL(r.url()).searchParams.get('type') === 'artist' && r.ok());
    await page.getByRole('navigation', { name: '词条类型' }).getByRole('button', { name: /作者/ }).click();
    await artists;
    await expect(page.getByRole('navigation', { name: '词条类型' }).getByRole('button', { name: /作者/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.folio-scroll').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
  });
}
