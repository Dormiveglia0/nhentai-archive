import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("标题场景的流转、完成状态、书页文字和放大镜在完整周期内保持定位", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/demo');
  for (const name of ['队列', '治理', '词典', '发现']) {
    await page.locator('.folio-topnav').getByRole('link', { name, exact: true }).click();
    await expect(page.locator('.folio-scroll')).toHaveCSS('transform', 'none');
    const scene = page.locator('.folio-scene');
    for (let time = 0; time <= 9000; time += 500) {
      await scene.evaluate((node, t) => node.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = t; }), time);
      if (name === '队列') {
        const card = Number(await page.locator('.folio-scene-queue-document').evaluate(n => getComputedStyle(n).opacity));
        const check = Number(await page.locator('.folio-scene-queue-done').evaluate(n => getComputedStyle(n).opacity));
        expect(Math.min(card, check)).toBeLessThan(0.05);
        if (time >= 3000 && time <= 4500) {
          const cardBox = await page.locator('.folio-scene-queue-document').boundingBox();
          const ring = await page.locator('.folio-scene-queue-track').boundingBox();
          expect(Math.abs(cardBox!.x + cardBox!.width / 2 - ring!.x - ring!.width / 2)).toBeLessThan(1);
        }
      } else if (name === '治理' && time >= 5500 && time <= 7500) {
        const rects = await page.locator('.folio-scene-edit-label rect').evaluateAll(ns => ns.map(n => n.getBoundingClientRect().x));
        expect(Math.max(...rects) - Math.min(...rects)).toBeLessThan(1);
      } else if (name === '词典') {
        const book = await page.locator('.folio-scene-dictionary-book').boundingBox();
        const slots = await page.locator('.folio-scene-dictionary-slots rect').evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
        slots.forEach(r => { expect(r.x).toBeGreaterThan(book!.x); expect(r.right).toBeLessThan(book!.x + book!.width); });
      } else if (name === '发现') {
        const bounds = await scene.boundingBox();
        const lens = await page.locator('.folio-scene-search-lens').boundingBox();
        expect(lens!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
        expect(lens!.y + lens!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
      }
    }
  }
});
