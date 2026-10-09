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
  await expect(page.locator(".folio-home-cover")).toBeInViewport({ ratio: 1 });
  expect(await page.locator(".folio-scroll").evaluate(node => node.scrollWidth > node.clientWidth + 1)).toBe(false);
});

test("桌面首页最新作品位于右下方且一屏显示，封面保持实际比例", async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [width,height] of [[1440,1000],[1365,768]]) {
    await page.setViewportSize({width,height});
    await page.goto('/#workbench');
    await expect(page.locator('.folio-home-book')).toHaveCount(1);
    await expect(page.locator('.folio-home-latest-work')).toHaveCount(4);
    await page.locator('.folio-home-latest img').evaluateAll(nodes=>Promise.all(nodes.map(node=>(node as HTMLImageElement).decode())));
    const hero = (await page.locator('.folio-home-hero').boundingBox())!;
    const latest = (await page.locator('.folio-home-latest').boundingBox())!;
    expect(latest.x).toBeGreaterThan(hero.x+hero.width);
    expect(latest.y+latest.height).toBeLessThanOrEqual(height);
    expect(await page.locator('.folio-scroll').evaluate(node=>node.scrollHeight-node.clientHeight)).toBeLessThan(2);
    const ratios = await page.locator('.folio-home-cover img, .folio-home-latest img').evaluateAll(nodes=>nodes.map(node=>{
      const image=node as HTMLImageElement, rect=image.getBoundingClientRect();
      return Math.abs(rect.width/rect.height-image.naturalWidth/image.naturalHeight);
    }));
    expect(ratios.every(difference=>difference<.01)).toBe(true);
  }
});

test("首页自动轮播在四秒后只前进一部", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#workbench');
  const controls=page.locator('.folio-home-carousel-controls');
  await expect(controls).toContainText('1 /');
  await page.mouse.move(0,0);
  await expect(controls).toContainText('2 /',{timeout:5000});
  await controls.getByRole('button',{name:'暂停轮播'}).click();
  await expect(controls).toContainText('2 /');
});
