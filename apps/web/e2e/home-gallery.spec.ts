import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立的真实作品测试会话");

test("封面墙拖动不会误选，点选连续转入翻阅，键盘与复位可用", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#workbench');
  const gallery = page.locator('.folio-home-gallery');
  await expect(page.locator('.folio-home-art')).toHaveCount(36);
  await page.waitForTimeout(1200);
  const bounds = (await gallery.boundingBox())!;
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx + 180, cy + 80, { steps: 12 }); await page.mouse.up();
  await expect(gallery).toHaveClass(/is-wall/);
  await page.getByRole('button', { name: '复位', exact: true }).click();
  await page.waitForTimeout(800);
  const target = await page.locator('.folio-home-art').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label')!, x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }).find(p => p.x > 300 && p.x < 1100 && p.y > 200 && p.y < 700));
  expect(target).toBeTruthy();
  await page.mouse.click(target!.x, target!.y);
  await expect(gallery).toHaveClass(/is-shelf/);
  await expect(page.locator('.folio-home-art.is-selected')).toHaveAttribute('aria-label', target!.label);
  await expect(page.locator('.folio-home-art.is-selected')).toBeInViewport();
  const previous = await page.locator('.folio-home-caption').innerText();
  await page.getByRole('button', { name: '下一本', exact: true }).click();
  await expect(page.locator('.folio-home-caption')).not.toHaveText(previous);
  await gallery.focus(); await page.keyboard.press('Escape');
  await expect(gallery).toHaveClass(/is-wall/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '翻阅', exact: true }).click();
  await expect(page.locator('.folio-home-art.is-selected')).toBeInViewport();
});

test("空集和单本作品不生成假封面，触屏可以切换翻阅", async ({ browser }) => {
  const context = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
  for (const count of [0, 1, 3]) {
    await page.route('**/api/library/search?*', async route => {
      const response = await route.fetch(); const data = await response.json();
      await route.fulfill({ json: { ...data, result: data.result.slice(0, count) } });
    });
    await page.goto('about:blank'); await page.goto(base + '/#workbench');
    if (!count) await expect(page.getByText('暂无作品', { exact: true })).toBeVisible();
    await expect(page.locator('.folio-home-art')).toHaveCount(count);
    if (count) {
      await page.getByRole('button', { name: '翻阅', exact: true }).tap();
      await expect(page.locator('.folio-home-art.is-selected')).toBeInViewport();
      if (count > 1) {
        const previous = await page.locator('.folio-home-caption').innerText();
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 290, y: 400 }] });
        for (const x of [250, 210, 170, 130, 90]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 400 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(page.locator('.folio-home-caption')).not.toHaveText(previous);
        await session.detach();
      }
    } else await expect(page.getByRole('button', { name: '翻阅', exact: true })).toBeDisabled();
    await page.unrouteAll({ behavior: 'wait' });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1000);
  const cover = (await page.locator('.folio-home-art.is-selected').boundingBox())!;
  const caption = (await page.locator('.folio-home-caption').boundingBox())!;
  const controls = (await page.locator('.folio-home-controls').boundingBox())!;
  expect(cover.y + cover.height).toBeLessThan(caption.y);
  expect(caption.y + caption.height).toBeLessThan(controls.y);
  await context.close();
});
