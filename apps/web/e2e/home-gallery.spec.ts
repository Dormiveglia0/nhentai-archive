import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("首页只展示真实作品，优先继续阅读，无重复页头和统计面板", async ({ page, request }) => {
  const recent = await (await request.get("/api/library/search?per_page=1&sort=recent_added")).json();
  const continuing = await (await request.get("/api/library/continue-reading?limit=1")).json();
  const ids = [...new Set([...continuing.result, ...recent.result].map(work => work.id))].slice(0, 1);
  await page.goto("/#workbench");
  const books = page.locator(".folio-home-book");
  await expect(books).toHaveCount(ids.length);
  for (let index = 0; index < ids.length; index++) await expect(books.nth(index).locator("a").first()).toHaveAttribute("href", `#reader/${ids[index]}`);
  await expect(page.locator(".folio-page-copy h1, .folio-studio-ledger, .folio-studio-console, [role='slider']")).toHaveCount(0);
  await expect(page.locator(".folio-brand-mark .folio-monogram")).toHaveText("NH");
  await expect(page.locator(".folio-brand-mark img")).toHaveCount(0);
  expect(await page.locator(".folio-home h1, .folio-home h2").evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) <= 20))).toBe(true);
});

test("窄屏空作品不生成假封面，读取失败可重试且减少动态效果可用", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/library/continue-reading?*", route => route.abort());
  await page.route("**/api/library/search?*", async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ json: { ...data, result: [] } });
  });
  await page.goto("/#workbench");
  await expect(page.getByRole("alert")).toContainText("部分数据加载失败");
  await expect(page.locator(".folio-home-book")).toHaveCount(0);
  await expect(page.locator(".folio-home-entry").getByRole("link", { name: "发现作品" })).toHaveAttribute("href", "#discover");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.unroute("**/api/library/continue-reading?*");
  await page.unroute("**/api/library/search?*");
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator(".folio-home-book").first()).toBeVisible();
});

for (const [width, height] of [[320, 740], [844, 390]]) test(`${width}×${height} 首页阅读入口在首屏且内容不横向溢出`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.goto("/#workbench");
  await expect(page.locator(".folio-home-featured")).toBeVisible();
  await expect(page.locator(".folio-home-read")).toBeInViewport({ ratio: 1 });
  expect(await page.locator(".folio-scroll").evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false);
});
