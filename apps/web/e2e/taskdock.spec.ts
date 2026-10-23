import { expect, test, type Page } from "@playwright/test";

import type { Job } from "../src/lib/api";

test.setTimeout(60_000);

// Replay real private-library records; never create gallery or task rows for the UI.
async function taskRecords(page: Page): Promise<Job[]> {
  const response = await page.request.get("/api/jobs");
  expect(response.ok()).toBe(true);
  const { result } = await response.json() as { result: Job[] };
  expect(result.length, "Task dock checks require at least three real task records").toBeGreaterThanOrEqual(3);
  return result;
}

function notice(job: Job, status: Job["status"]): Job {
  return { ...job, status };
}

async function poll(page: Page) {
  await page.waitForResponse((response) => response.url().endsWith("/api/jobs"));
  // Wait for React to commit the polling result.
  await page.waitForTimeout(100);
}

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

test("关闭长期和失败提醒后跨页、返回及刷新保持隐藏，任务中心保留记录", async ({ page }, testInfo) => {
  const [first, second, third] = await taskRecords(page);
  let jobs = [notice(first, "running"), notice(second, "failed"), notice(third, "paused")];
  await page.route("**/api/jobs", (route) => route.fulfill({ json: { result: jobs } }));
  await page.goto("/#settings");

  const dock = page.locator(".folio-task-dock");
  await expect(dock).toBeVisible();
  await expect(dock.locator("article")).toHaveCount(2);
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);

  await page.locator(".folio-topnav").getByRole("link", { name: "队列", exact: true }).click();
  await expect(page.locator(".folio-tasks-page")).toBeVisible();
  await expect(page.locator(".folio-tasks-row")).toHaveCount(jobs.length);
  await page.goBack();
  await expect(page).toHaveURL(/#settings$/);
  await poll(page);
  await expect(dock).toHaveCount(0);

  await page.reload();
  await poll(page);
  await expect(dock).toHaveCount(0);

  jobs = [notice({ ...first, updated_at: third.updated_at }, "paused"), notice(second, "failed")];
  await poll(page);
  await expect(dock).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("dismissed-after-navigation.png") });
});

test("新任务和新的失败单独提醒，不带回已关闭的旧任务", async ({ page }, testInfo) => {
  const [first, second] = await taskRecords(page);
  let jobs = [notice(first, "running")];
  await page.route("**/api/jobs", (route) => route.fulfill({ json: { result: jobs } }));
  await page.goto("/#settings");
  const dock = page.locator(".folio-task-dock");
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);

  jobs = [notice(second, "queued"), ...jobs];
  await expect(dock.locator("article")).toHaveCount(1, { timeout: 4_000 });
  await expect(dock.locator(".folio-task-dock-head em")).toHaveText("1");
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);

  jobs = [notice(second, "completed"), notice(first, "failed")];
  await expect(dock.locator("article.is-failed")).toHaveCount(1, { timeout: 17_000 });
  await page.screenshot({ path: testInfo.outputPath("new-failure-only.png") });
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);
  jobs = [notice(second, "cancelled"), notice(first, "failed")];
  await poll(page);
  await expect(dock).toHaveCount(0);

  // A later failed attempt of the same task must not share the old dismissal.
  jobs = [{ ...notice(first, "failed"), updated_at: new Date().toISOString() }];
  await expect(dock.locator("article.is-failed")).toHaveCount(1, { timeout: 17_000 });
});

test("相同连接错误关闭后不重复弹出，恢复后仍可提示任务", async ({ page }) => {
  const [first] = await taskRecords(page);
  let unavailable = true;
  await page.route("**/api/jobs", (route) => unavailable
    ? route.abort()
    : route.fulfill({ json: { result: [notice(first, "running")] } }));
  await page.goto("/#settings");
  const dock = page.locator(".folio-task-dock");
  await expect(dock.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);
  await page.reload();
  await page.waitForRequest("**/api/jobs");
  await expect(dock).toHaveCount(0);
  unavailable = false;
  await expect(dock.locator("article")).toHaveCount(1, { timeout: 7_000 });
  await expect(dock.getByRole("alert")).toHaveCount(0);
});

for (const state of ["损坏", "不可用", "已满"]) test(`浏览器存储${state}时仍可关闭提醒并跨页`, async ({ page }) => {
  const [first] = await taskRecords(page);
  await page.addInitScript((storageState) => {
    if (storageState === "不可用") {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Unavailable", "SecurityError"); } });
    } else if (storageState === "已满") {
      Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
    } else {
      window.localStorage.setItem("nh-archive:task-dock-dismissed:v1", "invalid json");
    }
  }, state);
  await page.route("**/api/jobs", (route) => route.fulfill({ json: { result: [notice(first, "running")] } }));
  await page.goto("/#settings");
  const dock = page.locator(".folio-task-dock");
  await page.getByRole("button", { name: "隐藏任务进度" }).click();
  await expect(dock).toHaveCount(0);
  if (state === "已满") expect(await page.evaluate(() => window.localStorage.getItem("nh-archive:task-dock-dismissed:v1"))).toBeNull();
  await page.locator(".folio-topnav").getByRole("link", { name: "队列", exact: true }).click();
  await expect(page.locator(".folio-tasks-page")).toBeVisible();
  await page.goBack();
  await poll(page);
  await expect(dock).toHaveCount(0);
});
