import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const workId = process.env.E2E_CACHE_WORK_ID;
test.skip(!workId, "Requires an actual indexed work in an isolated library with reading cache enabled.");

for (const width of [1440, 390]) {
  test(`阅读准备在 ${width}px 显示进度且无溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.request.post("/api/library/cache/clear");
    const leases = new Set<string>();
    let releaseReady: (() => void) | undefined;
    const heldResponse = new Promise<void>((resolve) => { releaseReady = resolve; });
    let inspected = false;
    // Delay delivery of a real ready response; do not fabricate jobs or works.
    await page.route(`**/api/works/${workId}/reading-source`, async (route) => {
      const response = await route.fetch();
      const actual = await response.json();
      if (actual.lease) leases.add(actual.lease);
      if (actual.status === "ready" && !inspected) await heldResponse;
      await route.fulfill({ response });
    });
    try {
      await page.goto(`/#reader/${workId}`);
      const card = page.locator(".reader-preparation");
      await expect(card).toBeVisible();
      await expect(card.getByRole("progressbar", { name: "归档缓存进度" })).toBeVisible();
      await expect(card.getByRole("button", { name: "暂停" })).toBeVisible();
      await expect(card.getByRole("button", { name: "取消" })).toBeVisible();
      await expect.poll(() => page.locator(".app-route-reader").evaluate((element) => getComputedStyle(element).clipPath)).toBe("inset(0%)");
      await page.evaluate(async () => {
        const animations = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
        await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await card.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
      if (process.env.E2E_CACHE_ARTIFACT_DIR) {
        await mkdir(process.env.E2E_CACHE_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.E2E_CACHE_ARTIFACT_DIR}/reader-preparation-${width}.png` });
      }
      inspected = true;
      releaseReady?.();
      await expect(page.locator(".reader-counter")).toHaveText(/\d+\s*\/\s*[1-9]\d*/);
      await page.evaluate(() => { window.location.hash = "library"; });
      await expect(page.locator(".reader-shell")).toHaveCount(0);
      await expect.poll(async () => (await (await page.request.get("/api/library/cache")).json()).active_count).toBe(0);
    } finally {
      releaseReady?.();
      for (const lease of leases) await page.request.delete(`/api/works/${workId}/reading-source/${lease}`);
    }
  });
}

test("退出缓存阅读先保存最新页码，再释放缓存并允许重新进入", async ({ page }) => {
  const leases = new Set<string>();
  page.on("response", async (response) => {
    if (!response.url().endsWith(`/api/works/${workId}/reading-source`)) return;
    try { const data = await response.json(); if (data.lease) leases.add(data.lease); } catch { /* A superseded request has no body. */ }
  });
  try {
    await page.request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: 1, completed: false } });
    await page.goto(`/#reader/${workId}`);
    await expect(page.locator(".reader-counter")).toHaveText(/^1\s*\/\s*[1-9]\d*/);
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.locator(".reader-counter")).toHaveText(/^2\s*\//);
    await page.evaluate(() => { window.location.hash = "library"; });
    await expect(page.locator(".reader-shell")).toHaveCount(0);
    await expect.poll(async () => (await (await page.request.get(`/api/works/${workId}/reader-state`)).json()).page_index).toBe(2);
    await expect.poll(async () => (await (await page.request.get("/api/library/cache")).json()).active_count).toBe(0);
    await page.evaluate((id) => { window.location.hash = `reader/${id}`; }, workId);
    await expect(page.locator(".reader-counter")).toHaveText(/^2\s*\/\s*[1-9]\d*/);
    await page.goto("/?cache-navigation=1#library");
    await page.goBack();
    await expect(page.locator(".reader-counter")).toHaveText(/^2\s*\/\s*[1-9]\d*/);
    await page.evaluate(() => { window.location.hash = "library"; });
    await expect(page.locator(".reader-shell")).toHaveCount(0);
  } finally {
    for (const lease of leases) await page.request.delete(`/api/works/${workId}/reading-source/${lease}`);
  }
});
