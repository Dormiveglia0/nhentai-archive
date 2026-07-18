import { expect, test } from "@playwright/test";

test("收藏可从馆藏卡、右侧预览和阅读器统一操作并快速筛选", async ({ page, request }) => {
  const payload = await (await request.get("/api/library/search?page=1&per_page=1")).json();
  const work = payload.result[0] as { id: number; favorite: boolean };
  let sessionStarts = 0;
  page.on("request", (outgoing) => {
    if (outgoing.method() === "POST" && new URL(outgoing.url()).pathname === `/api/works/${work.id}/reading-sessions`) {
      sessionStarts += 1;
    }
  });
  await request.patch(`/api/works/${work.id}/favorite`, { data: { favorite: false } });

  await page.goto("/#library");
  const card = page.locator(".folio-library-card").filter({ has: page.locator(`a[href='#reader/${work.id}']`) }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: /^收藏/ }).click();
  await expect(card.locator(".folio-library-favorite")).toHaveAttribute("aria-pressed", "true");
  await card.screenshot({ path: "/tmp/nh-archive-favorite-card-desktop.png" });

  const favoriteFilter = page.locator(".folio-library-favorite-filter");
  await favoriteFilter.click();
  await expect(favoriteFilter).toHaveAttribute("aria-pressed", "true");
  await expect(card).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/nh-archive-favorites-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await favoriteFilter.click();

  await card.locator(".folio-library-card-title").click();
  const inspector = page.locator(".folio-library-inspector.is-open");
  await expect(inspector).toBeVisible();
  await inspector.getByRole("button", { name: "已收藏" }).click();
  await expect(inspector.getByRole("button", { name: "收藏作品" })).toBeVisible();

  await page.goto(`/#reader/${work.id}`);
  await expect(page.locator(".reader-shell")).toBeVisible();
  await expect(page.locator(".reader-counter")).toHaveText(/\d+\s*\/\s*\d+/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("i");
  const info = page.locator(".reader-info-panel");
  await expect(info).toBeVisible();
  await info.getByRole("button", { name: "收藏作品" }).click();
  await expect(info.getByRole("button", { name: "已收藏" })).toBeVisible();
  await page.waitForTimeout(1_100);
  await page.goto("/#library");
  await expect.poll(() => sessionStarts).toBe(1);
  await expect.poll(async () => {
    const statistics = await (await request.get("/api/library/statistics?days=30")).json();
    return statistics.top_by_time.find((row: { id: number }) => row.id === work.id)?.reading_seconds ?? 0;
  }).toBeGreaterThan(0);
  await request.patch(`/api/works/${work.id}/favorite`, { data: { favorite: false } });
});

test("设置统计展示真实时长、次数、作者与 Tag 排行并适配移动端", async ({ page, request }) => {
  const payload = await (await request.get("/api/library/search?page=1&per_page=2")).json();
  const works = payload.result as Array<{ id: number }>;
  expect(works.length).toBeGreaterThan(0);
  const work = works[0];
  await request.patch(`/api/works/${work.id}/favorite`, { data: { favorite: true } });
  const started = await request.post(`/api/works/${work.id}/reading-sessions`, {
    data: { session_key: `e2e-statistics-${Date.now()}`, page_index: 1 },
  });
  const session = await started.json();
  await request.patch(`/api/works/${work.id}/reading-sessions/${session.id}`, {
    data: { duration_seconds: 5_460, page_index: 2, finished: true },
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#settings");
  await page.getByRole("button", { name: /统计/ }).click();
  const report = page.locator(".folio-settings-reading-report");
  await expect(report).toBeVisible();
  await expect(report.getByText("阅读时长排行")).toBeVisible();
  await expect(report.getByText("阅读次数排行")).toBeVisible();
  await expect(report.getByText("作者馆藏")).toBeVisible();
  await expect(report.getByText("喜爱 Tag")).toBeVisible();
  await expect(report.locator(".folio-settings-work-ranking a").first()).toHaveAttribute("href", `#reader/${work.id}`);
  await expect(report.locator(".folio-settings-activity-bars i")).toHaveCount(30);
  await expect(page.locator(".folio-settings-actions")).toHaveCount(0);
  await positionReportBelowStickyNav(report);
  await page.waitForTimeout(900);
  await expect.poll(() => report.locator(".folio-settings-rank-cover img").first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  await page.screenshot({ path: "/tmp/nh-archive-statistics-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(report).toBeVisible();
  const rankingBoxes = await report.locator(".folio-settings-work-ranking").evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  expect(rankingBoxes[1].top).toBeGreaterThanOrEqual(rankingBoxes[0].bottom);
  await positionReportBelowStickyNav(report);
  await page.screenshot({ path: "/tmp/nh-archive-statistics-mobile.png" });
  await request.patch(`/api/works/${work.id}/favorite`, { data: { favorite: false } });
});

async function positionReportBelowStickyNav(report: import("@playwright/test").Locator) {
  await report.evaluate((node) => {
    const scroll = node.closest<HTMLElement>(".folio-scroll");
    const nav = document.querySelector<HTMLElement>(".folio-settings-nav");
    if (!scroll || !nav) return;
    scroll.scrollTop += node.getBoundingClientRect().top - scroll.getBoundingClientRect().top - nav.getBoundingClientRect().height - 12;
  });
}
