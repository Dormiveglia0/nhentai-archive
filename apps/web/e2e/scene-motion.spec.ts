import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("标题场景的箭头、完成状态、书页文字和放大镜在完整周期内保持定位", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/demo');
  for (const name of ['队列', '词典', '发现']) {
    await page.locator('.folio-topnav').getByRole('link', { name, exact: true }).click();
    await expect(page.locator('.folio-scroll')).toHaveCSS('transform', 'none');
    const scene = page.locator('.folio-scene');
    for (let time = 0; time <= 9000; time += 500) {
      await scene.evaluate((node, t) => node.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = t; }), time);
      if (name === '队列') {
        const columns = await page.locator('.folio-scene-task-columns rect').evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
        const arrows = await page.locator('.folio-scene-task-transfer path').evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
        arrows.forEach((r, i) => {
          expect(r.x).toBeGreaterThan(columns[i].right);
          expect(r.right).toBeLessThan(columns[i + 1].x);
          expect(Math.abs((r.x + r.right) / 2 - (columns[i].right + columns[i + 1].x) / 2)).toBeLessThan(0.5);
        });
        const card = Number(await page.locator('.folio-scene-task-card-main').evaluate(n => getComputedStyle(n).opacity));
        const check = Number(await page.locator('.folio-scene-task-complete').evaluate(n => getComputedStyle(n).opacity));
        expect(Math.min(card, check)).toBeLessThan(0.05);
      } else if (name === '词典') {
        const book = await page.locator('.folio-scene-dictionary-book').boundingBox();
        const slots = await page.locator('.folio-scene-dictionary-slots rect').evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
        slots.forEach(r => { expect(r.x).toBeGreaterThan(book!.x); expect(r.right).toBeLessThan(book!.x + book!.width); });
      } else {
        const bounds = await scene.boundingBox();
        const lens = await page.locator('.folio-scene-search-lens').boundingBox();
        expect(lens!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
        expect(lens!.y + lens!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
      }
    }
  }
});
