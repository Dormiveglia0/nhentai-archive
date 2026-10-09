import { expect, test } from "@playwright/test";
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");
test("边角 SVG 不占布局空间，短时绘制结束且减少动态效果立即完成", async ({ page }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/demo');
    for (const route of ['library','discover','governance','dictionary','tasks','files','settings']) {
      await page.locator('.folio-topnav a[href="#' + route + '"]').click();
      await expect(page.locator('.folio-page-' + route)).toBeVisible();
      await expect(page.locator('.folio-page-head,.folio-scene')).toHaveCount(0);
      await page.waitForTimeout(1000);
      await expect(page.locator('.folio-page')).toHaveCSS('opacity', '1');
      await expect(page.locator('.folio-scroll')).toHaveCSS('transform','none');
      const glyph = page.locator('.folio-atmosphere svg');
      const bounds = await glyph.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(160);
      expect(bounds!.height).toBeLessThanOrEqual(160);
      expect(await glyph.evaluate(node => node.getAnimations({subtree:true}).every(animation => animation.playState !== 'running'))).toBe(true);
    }
  }
});
