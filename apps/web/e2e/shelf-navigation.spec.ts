import { expect, test } from "@playwright/test";

// Use an authenticated, disposable copy of a real archive. No generated works or tags.
test.use({ storageState: process.env.E2E_STORAGE_STATE });

test("我的库标签拖动后可用键盘筛选，中键保持本地范围", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#library");
  const tags = page.locator(".folio-library-card-tags").filter({ has: page.locator("a") }).first();
  const link = tags.locator("a").first();
  await expect(link).toHaveAttribute("href", /^#library\?/);
  const href = await link.getAttribute("href");
  const opened = context.waitForEvent("page");
  await link.click({ button: "middle" });
  const tab = await opened;
  await expect.poll(() => new URL(tab.url()).hash).toBe(href);
  await expect(tab.locator(".folio-library-tag-selection a")).toHaveAttribute("href", href!);
  await tab.close();

  await link.scrollIntoViewIfNeeded();
  const box = (await link.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 35, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".folio-library-tag-selection")).toHaveCount(0);
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".folio-library-tag-selection a")).toHaveAttribute("href", href!);
});

test("数字逐渐递增到实际值，动效切换与离屏暂停正常", async ({ page }) => {
  const response = await page.request.get("/api/workbench/overview");
  const overview = await response.json();
  await page.addInitScript(() => {
    const samples: number[] = [];
    Object.assign(window, { metricFrames: samples });
    const start = performance.now();
    function sample() {
      const text = document.querySelector(".folio-workbench-summary .fx-scope")?.textContent;
      if (text) samples.push(Number(text.replaceAll(",", "")));
      if (performance.now() - start < 4_000) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto("/#workbench");
  const total = page.locator(".folio-workbench-summary .fx-scope").first();
  await expect(total).toHaveText(overview.library.total.toLocaleString("zh-CN"));
  const frames = await page.evaluate(() => (window as unknown as { metricFrames: number[] }).metricFrames);
  expect(frames.some((value) => value > 0 && value < overview.library.total)).toBe(true);
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(total).toHaveText(overview.library.total.toLocaleString("zh-CN"));
  }
  await page.locator(".folio-scroll").evaluate((node) => { node.scrollTop = 600; });
  await expect(page.locator(".folio-page-head")).toHaveClass(/is-offscreen/);
  await expect(page.locator(".folio-scene-hub-orbits")).toHaveCSS("animation-play-state", "paused");
});

for (const [route, titles] of [
  ["workbench", ["继续阅读", "最近导入"]],
  ["library", ["继续阅读", "最近添加"]],
] as const) {
  test(`${route} 两个书架支持点击、拖动后点击和键盘进入`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const title of titles) {
      await page.goto(`/#${route}`);
      const shelf = page.locator(".folio-shelf").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      const track = shelf.locator(".folio-shelf-track");
      const link = track.locator("a").first();
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      expect(await track.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);

      await link.locator(".folio-shelf-cover").click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator(".reader-shell")).toBeVisible();
      await expect(page.locator(".reader-counter")).toHaveText(/\d+\s*\/\s*\d+/);
      await page.goBack();
      await expect(page.locator(".app-route-reader")).toHaveCount(0);

      await shelf.getByRole("button", { name: `${title}：向后浏览` }).click();
      await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(20);
      await track.evaluate((node) => { node.scrollLeft = 0; });
      await link.scrollIntoViewIfNeeded();
      const box = (await link.boundingBox())!;
      await page.mouse.move(box.x + 100, box.y + 70);
      await page.mouse.down();
      await page.mouse.move(box.x + 15, box.y + 70, { steps: 6 });
      await expect(track).toHaveClass(/is-dragging/);
      await page.mouse.up();
      await expect(track).not.toHaveClass(/is-dragging/);
      await expect(page).toHaveURL(new RegExp(`#${route}$`));
      await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(20);

      // A keyboard click has no pointerdown to clear a previous drag.
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await page.goBack();
      await expect(page.locator(".app-route-reader")).toHaveCount(0);
      await link.locator("strong").click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    }
    expect(errors).toEqual([]);
  });
}

test("书架保留长按点击、中键和修饰键链接行为", async ({ page, context }) => {
  await page.goto("/#workbench");
  const link = page.locator(".folio-shelf-item").first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await link.click({ delay: 350 });
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await page.goBack();
  await expect(page.locator(".app-route-reader")).toHaveCount(0);
  for (const options of [{ button: "middle" as const }, { modifiers: ["Control" as const] }]) {
    const opened = context.waitForEvent("page");
    await link.click(options);
    const tab = await opened;
    await expect(tab).toHaveURL(new RegExp(`${href}$`));
    await tab.close();
    await expect(page).toHaveURL(/#workbench$/);
  }
});

test("手机书架原生滑动后可点开作品，导航焦点不会穿透", async ({ browser }) => {
  const context = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173"}/#library`);
  const track = page.locator(".folio-shelf-track").first();
  await expect(track).toBeVisible();
  await track.scrollIntoViewIfNeeded();
  const box = (await track.boundingBox())!;
  const client = await context.newCDPSession(page);
  const y = box.y + 70;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y }] });
  for (const x of [260, 220, 180, 140, 100]) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(40);
  await expect(page).toHaveURL(/#library$/);
  const link = track.locator("a").nth(2);
  await link.scrollIntoViewIfNeeded();
  const href = await link.getAttribute("href");
  await link.tap();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await page.goBack();
  await expect(page.locator(".app-route-reader")).toHaveCount(0);

  const menu = page.getByRole("button", { name: "打开导航", exact: true });
  await menu.click();
  const drawer = page.locator(".folio-mobile-nav");
  await expect(drawer.locator('a[aria-current="page"]')).toBeFocused();
  await expect.poll(() => page.locator(".folio-scroll").evaluate((node) => (node as HTMLElement).inert)).toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".folio-mobile-nav, .folio-menu-button")))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect.poll(() => page.locator(".folio-scroll").evaluate((node) => (node as HTMLElement).inert)).toBe(false);
  await menu.click();
  await drawer.locator('a[aria-current="page"]').click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.locator(".folio-scroll").evaluate((node) => (node as HTMLElement).inert)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});
