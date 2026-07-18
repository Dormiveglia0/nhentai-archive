import { expect, test } from "@playwright/test";

test("任务轮询不重叠并在页面隐藏时暂停", async ({ page }) => {
  await page.addInitScript(() => {
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    (window as typeof window & { setQaHidden: (value: boolean) => void }).setQaHidden = (value) => {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });

  let inFlight = 0;
  let maxInFlight = 0;
  let requests = 0;
  await page.route("**/api/jobs", async (route) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    try {
      await route.continue();
    } finally {
      inFlight -= 1;
    }
  });

  await page.goto("/#workbench");
  await page.waitForTimeout(8_800);
  expect(maxInFlight).toBe(1);

  const beforeHidden = requests;
  await page.evaluate(() => (window as typeof window & { setQaHidden: (value: boolean) => void }).setQaHidden(true));
  await page.waitForTimeout(5_500);
  expect(requests).toBe(beforeHidden);

  await page.evaluate(() => (window as typeof window & { setQaHidden: (value: boolean) => void }).setQaHidden(false));
  await expect.poll(() => requests).toBe(beforeHidden + 1);
});

test("任务进度可隐藏并在新任务出现时重新提示", async ({ page }) => {
  const job = (id: number) => ({
    id,
    type: "remote_import",
    status: "running",
    stage: "downloading_cbz",
    progress: { current: 52 * 1024 * 1024, total: 104 * 1024 * 1024, percent: 53 },
    target: { gallery_id: id },
    meta: { title: `Gallery ${id}`, page_count: 300 },
    error: null,
    retry_after: null,
    created_at: "2026-07-16T00:00:00Z",
    updated_at: "2026-07-16T00:00:00Z",
  });
  let jobs = [job(901)];

  await page.route("**/api/jobs", (route) => route.fulfill({ json: { result: jobs } }));
  await page.goto("/#workbench");

  const dock = page.locator(".folio-task-dock");
  await expect(dock).toBeVisible();
  await expect(dock).toContainText("52.0 MB / 104 MB · 300 页");
  await expect(dock).toContainText("53%");
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);

  jobs = [job(902), ...jobs];
  await expect(dock).toBeVisible({ timeout: 4_000 });
});
