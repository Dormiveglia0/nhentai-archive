import { expect, test } from "@playwright/test";
test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立真实作品测试会话");
test("独立首页预览保留真实封面比例、阅读链接和正常首页", async ({ page }) => {
  for (const width of [1440, 390, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?home-preview=1#workbench');
    await expect(page.locator('.home-proof-work.is-primary')).toBeVisible();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.home-proof-cover img')].every(image => image.complete && image.naturalWidth > 0));
    const ratios = await page.locator('.home-proof-cover img').evaluateAll(nodes => nodes.map(node => {
      const image = node as HTMLImageElement; return Math.abs(image.naturalWidth / image.naturalHeight - image.width / image.height);
    }));
    expect(ratios.length).toBeGreaterThan(0);
    for (const difference of ratios) expect(difference).toBeLessThan(.03);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const link = page.locator('.home-proof-work.is-primary');
    const href = await link.getAttribute('href'); await link.click();
    expect(new URL(page.url()).hash).toBe(href);
  }
  await page.goto('/#workbench');
  await expect(page.locator('.home-proof')).toHaveCount(0);
  await expect(page.locator('.folio-home-studio')).toBeVisible();
});
