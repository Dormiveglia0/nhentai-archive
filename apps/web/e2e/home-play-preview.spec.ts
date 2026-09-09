import { expect, test } from "@playwright/test";
test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要隔离测试会话");
test("书签连续拖动、点击和键盘能编排，分镜独立响应且不会重叠", async ({ page }) => {
  await page.goto('/?home-preview=play#workbench');
  const mark = page.getByRole('button', { name: '拖动书签重新编排' }), panels = page.locator('.home-play-panel');
  await expect(panels).toHaveCount(6); await page.waitForTimeout(900);
  for (const direction of [1, -1, 1, -1]) {
    const box = (await mark.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + direction * 220, box.y + 20, { steps: 4 }); await page.mouse.up();
    await expect(mark).toHaveAttribute('aria-pressed', String(direction === 1)); await page.waitForTimeout(500);
  }
  await mark.click(); await expect(mark).toHaveAttribute('aria-pressed', 'true'); await page.waitForTimeout(700);
  const positions = await panels.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const a = positions[i], b = positions[j];
    expect(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1).toBe(true);
  }
  for (const panel of await panels.all()) { await panel.focus(); await page.keyboard.press('Enter'); await expect(panel).toHaveAttribute('aria-pressed', 'true'); }
  // Local panel interactions must preserve the rearranged native SVG coordinates.
  expect(await panels.first().getAttribute('width')).toBe('350');
  await mark.focus(); await page.keyboard.press('Home'); await expect(mark).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.keyboard.press('End'); await expect(panels.first()).toHaveAttribute('width', '350');
});
test("触屏拖动书签、取消手势和窄屏点击正常", async ({ browser }) => {
  const context = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto((process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173') + '/?home-preview=play#workbench');
  const mark = page.getByRole('button', { name: '拖动书签重新编排' });
  await expect(mark).toBeVisible(); await page.waitForTimeout(900);
  const box = (await mark.boundingBox())!, session = await context.newCDPSession(page), x = box.x + box.width / 2, y = box.y + 20;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (const delta of [15, 35, 60, 90]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + delta, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(mark).toHaveAttribute('aria-pressed', 'true'); await page.waitForTimeout(700);
  await mark.tap(); await expect(mark).toHaveAttribute('aria-pressed', 'false'); await mark.dispatchEvent('pointercancel');
  await page.getByRole('button', { name: '变换对白' }).tap(); await expect(page.getByRole('button', { name: '变换对白' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await session.detach(); await context.close();
});
