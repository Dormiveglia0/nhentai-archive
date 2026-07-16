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
