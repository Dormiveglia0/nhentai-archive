import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });

test("续读保留作品列表，手机隐藏补充信息，窗口变化重新分配列数", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#library");
  await expect(page.locator(".folio-shelf-context")).toBeVisible();
  await expect(page.locator(".folio-library-card").first()).toBeVisible();
  const status = page.getByRole("group", { name: "阅读状态" });
  const before = await status.boundingBox();
  await status.getByRole("button", { name: /^未读/ }).click();
  await expect(status.getByRole("button", { name: /^未读/ })).toHaveAttribute("aria-pressed", "true");
  expect((await status.boundingBox())!.x).toBe(before!.x);
  expect((await status.boundingBox())!.y).toBe(before!.y);
  for (const width of [2560, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.locator(".folio-library-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(width === 390 ? 2 : 12);
  }
  await expect(page.locator(".folio-shelf-context")).toBeHidden();
  await expect(page.locator(".folio-shelf-item strong").first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("续读资料随焦点更新，标签使用实际作品数据并进入本地筛选", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const payload = await (await page.request.get('/api/library/continue-reading?limit=12')).json();
  const index = payload.result.findIndex((work: { tags?: { type: string }[] }) => work.tags?.some(tag => tag.type === 'tag'));
  test.skip(index < 0, '当前实际续读作品没有内容标签');
  await page.goto('/#library');
  await page.locator('.folio-shelf-item').nth(index).focus();
  const expected = payload.result[index].tags.filter((tag: { type: string }) => tag.type === 'tag').map((tag: { display: string }) => tag.display);
  await expect(page.locator('.folio-shelf-context-tags a')).toHaveText(expected);
  const tag = page.locator('.folio-shelf-context-tags a').first();
  const href = await tag.getAttribute('href');
  await tag.click();
  await expect(page.locator('.folio-library-tag-selection a')).toHaveAttribute('href', href!);
});
