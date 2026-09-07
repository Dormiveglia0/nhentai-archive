import { expect, test } from "@playwright/test";
import { balanceGridRows } from "../src/lib/useGridColumns";

test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要真实馆藏的独立测试会话");

test("发现页向下滚动后翻页，顶栏始终完整且选项背景填满菜单", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#discover");
  const next = page.locator('.folio-discover-pager button[aria-label="下一页"]');
  await expect(next).toBeEnabled({ timeout: 20_000 });
  for (let index = 0; index < 2; index++) {
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(page.locator('.folio-discover-pager input')).toHaveValue(String(index + 2), { timeout: 20_000 });
    await expect(next).toBeEnabled();
    await expect.poll(async () => (await page.locator('.folio-topbar').boundingBox())!.y).toBe(0);
    expect(await page.locator('.auth-wake-demo').evaluate(n => n.scrollTop)).toBe(0);
  }
  for (const label of ["语言", "类型", "排序"]) {
    const select = page.locator('.folio-select').filter({ has: page.locator(':scope > span', { hasText: label }) }).first();
    await select.locator(':scope > button').click();
    const menu = select.locator('.folio-select-menu');
    const selected = menu.locator('.is-selected');
    const bounds = await menu.boundingBox();
    const row = await selected.boundingBox();
    expect(Math.abs(row!.x - bounds!.x - 1)).toBeLessThan(1);
    expect(Math.abs(bounds!.width - row!.width - 2)).toBeLessThan(1);
    await page.keyboard.press('Escape');
  }
});

test("稀疏馆藏保留正常列宽，书架悬停明确，热门作品铺满大屏展示区", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  // Use subsets of the real API response; never fabricate works or covers.
  let count = 1;
  await page.route('**/api/library/search?*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, result: data.result.slice(0, count), total: count, num_pages: 1 } });
  });
  for (count of [1, 2, 13]) {
    await page.goto('/#library');
    await page.reload();
    await expect(page.locator('.folio-library-card-cell')).toHaveCount(count);
    const widths = await page.locator('.folio-library-card-cell').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    expect(Math.max(...widths)).toBeLessThan(300);
  }
  const shelf = page.locator('.folio-shelf-item').first();
  await shelf.hover();
  await expect(shelf.locator('.folio-shelf-cover')).toHaveCSS('border-color', 'rgb(173, 56, 46)');
  await expect(shelf.locator('.folio-shelf-cover')).not.toHaveCSS('box-shadow', 'none');
  await page.goto('/#discover');
  const covers = page.locator('.folio-discover-popular-media');
  await expect(covers).toHaveCount(5, { timeout: 20_000 });
  const heights = await covers.evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThanOrEqual(560);
  expect(Math.min(...heights)).toBeGreaterThan(400);
  const track = await page.locator('.folio-discover-popular-track').boundingBox();
  await expect.poll(async () => {
    const first = await covers.first().boundingBox();
    const last = await covers.last().boundingBox();
    return (last!.x + last!.width - first!.x) / track!.width;
  }).toBeGreaterThan(.95);
});


test("均衡网格保留密集行的填充，并限制稀疏行放大", () => {
  for (let columns = 1; columns <= 12; columns++) {
    for (let count = 0; count <= 60; count++) {
      const { style } = balanceGridRows(count, columns);
      const tracks = style["--folio-grid-tracks"];
      expect(style["--folio-grid-span"] / tracks).toBeLessThanOrEqual(1.25 / columns);
      expect(style["--folio-grid-tail-span"] / tracks).toBeLessThanOrEqual(1.25 / columns);
      if (count <= columns) expect(tracks).toBe(columns);
    }
  }
  const dense = balanceGridRows(23, 6);
  expect(dense.tailStart).toBe(18);
  expect(dense.style["--folio-grid-span"] * 6).toBe(dense.style["--folio-grid-tracks"]);
  expect(dense.style["--folio-grid-tail-span"] * 5).toBe(dense.style["--folio-grid-tracks"]);
});


test("25个发现作品按9／8／8排列，每行按自身封面高度排版", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.route('**/api/discover/feed?*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ json: { ...data, result: data.result.slice(0, 25), total: 25, num_pages: 1 } });
  });
  await page.goto('/#discover');
  await expect(page.locator('.folio-discover-card')).toHaveCount(25);
  await page.waitForTimeout(650);
  const cards = await page.locator('.folio-discover-card').evaluateAll(nodes => nodes.map(n => {
    const bounds = n.getBoundingClientRect();
    const tags = n.querySelector('.folio-discover-card-tags')!.getBoundingClientRect();
    const actions = n.querySelector('.folio-discover-card-actions')!.getBoundingClientRect();
    return { y: Math.round(bounds.y), height: bounds.height, gap: actions.top - tags.bottom };
  }));
  const rows = [...new Set(cards.map(n => n.y))];
  expect(rows.map(y => cards.filter(n => n.y === y).length)).toEqual([9, 8, 8]);
  expect(cards[9].height - cards[0].height).toBeGreaterThan(20);
  expect(Math.max(...cards.map(n => n.gap))).toBeLessThan(12);
});

test("快速切换只保留当前页面，视窗动画完成后释放位移并尊重减少动态效果", async ({ page }) => {
  await page.goto('/#library');
  await expect(page.locator('.folio-library-card').first()).toBeVisible();
  for (const id of ['workbench', 'discover', 'library', 'discover']) {
    await page.locator(`.folio-topnav a[href='#${id}']`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}(?:[?]|$)`));
    await expect(page.locator('.folio-page')).toHaveCount(1);
  }
  await expect(page.locator('.folio-scroll')).toHaveCSS('transform', 'none');
  expect((await page.locator('.folio-topbar').boundingBox())!.y).toBe(0);
  await page.locator('.folio-discover-card').first().waitFor();
  await page.locator('.folio-scroll').evaluate(n => { n.scrollTop = 500; });
  await expect(page.locator('.folio-app')).toHaveClass(/is-scrolling/);
  await expect(page.locator('.folio-app')).not.toHaveClass(/is-scrolling/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator(".folio-topnav a[href='#library']").click();
  expect(await page.locator('.folio-scroll').evaluate(n => n.getAnimations().length)).toBe(0);
});
