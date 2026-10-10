import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_LAYOUT_OWNED_ROOT !== '/tmp/nh-reader-media-update-20261009/owned', '需要私有实际归档及会话');

const cases = [
  ...[1440, 390].flatMap(width => ['original', 'width', 'height'].map(fit => ({ width, fit, workId: process.env.E2E_WORK_ID, target: 40 }))),
  ...[1440, 390].map(width => ({ width, fit: 'original', workId: process.env.E2E_LANDSCAPE_WORK_ID, target: 20 })),
];
for (const { width, fit, workId, target } of cases) {
  test(`${width}px 连续${fit}恢复第${target}页，图片慢加载不遍历或覆盖原进度`, async ({ page, request }) => {
    test.skip(!workId, '需要实际作品 ID');
    const prior = await (await request.get(`/api/works/${workId}/reader-state`)).json();
    const work = await (await request.get(`/api/works/${workId}`)).json();
    test.skip(work.page_count < target + 5, '实际作品页数不足');
    const requested = new Set<number>(), written: number[] = [], errors: string[] = [];
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.addInitScript(fit => {
      localStorage.setItem('nh.reader.prefs', JSON.stringify({ mode: 'webtoon', direction: 'rtl', fit }));
      const seen: number[] = [];
      Object.assign(window, { readerObservedPages: seen });
      const sample = () => {
        const text = document.querySelector('.reader-counter')?.textContent;
        if (text) seen.push(Number(text.split('/')[0]));
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, fit);
    // The real settings response still controls the reader's default mode.
    await page.route('**/api/settings', async route => {
      const response = await route.fetch(), actual = await response.json();
      await route.fulfill({ response, json: { ...actual, reader: { ...actual.reader, default_mode: 'scroll' } } });
    });
    await page.route(new RegExp(`/api/works/${workId}/pages/\\d+(?:\\?.*)?$`), async route => {
      const index = Number(new URL(route.request().url()).pathname.split('/').at(-1));
      await new Promise(resolve => setTimeout(resolve, index === target - 1 ? 900 : 180));
      await route.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', value => {
      const path = new URL(value.url()).pathname;
      if (new RegExp(`/api/works/${workId}/pages/\\d+$`).test(path)) requested.add(Number(path.split('/').at(-1)));
      if (path === `/api/works/${workId}/reader-state` && value.method() === 'PATCH') written.push(value.postDataJSON().page_index);
    });
    await request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: target, completed: false } });
    try {
      await page.goto(`/#reader/${workId}`);
      const counter = page.locator('.reader-counter');
      const image = page.locator(`.reader-webtoon img[data-page-index="${target}"]`);
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
      await page.waitForTimeout(1400);
      await expect(counter).toHaveText(new RegExp(`^${target}\\s*\\/`));
      const observed = await page.evaluate(() => (window as unknown as { readerObservedPages: number[] }).readerObservedPages);
      expect([...new Set(observed)]).toEqual([target]);
      expect(requested.size).toBeLessThan(24);
      expect(written.every(index => index === target)).toBe(true);
      expect(Math.abs((await image.boundingBox())!.y)).toBeLessThan(32);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      expect(errors).toEqual([]);
      await page.evaluate(() => { location.hash = 'library'; });
      await expect(page.locator('.reader-shell')).toHaveCount(0);
      await expect.poll(async () => (await (await request.get(`/api/works/${workId}/reader-state`)).json()).page_index).toBe(target);
    } finally {
      await page.evaluate(() => { location.hash = 'library'; });
      await expect(page.locator('.reader-shell')).toHaveCount(0);
      await request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: prior.page_index, completed: prior.completed } });
    }
  });
}

test('恢复图片尚未加载时，主动滚动仍更新并保存页码', async ({ page, request }) => {
  const workId = process.env.E2E_LANDSCAPE_WORK_ID;
  test.skip(!workId, '需要横向封面的实际作品');
  const prior = await (await request.get(`/api/works/${workId}/reader-state`)).json();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('nh.reader.prefs', JSON.stringify({ mode: 'webtoon', direction: 'rtl', fit: 'original' })));
  await page.route('**/api/settings', async route => {
    const response = await route.fetch(), actual = await response.json();
    await route.fulfill({ response, json: { ...actual, reader: { ...actual.reader, default_mode: 'scroll' } } });
  });
  await page.route(new RegExp(`/api/works/${workId}/pages/20(?:\\?.*)?$`), async route => { await gate; await route.continue(); });
  await request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: 20, completed: false } });
  try {
    await page.goto(`/#reader/${workId}`);
    const next = page.locator('.reader-webtoon img[data-page-index="22"]');
    await expect.poll(() => next.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
    await next.evaluate(node => node.scrollIntoView({ block: 'start' }));
    await expect(page.locator('.reader-counter')).toHaveText(/^22\s*\//);
    release();
    await expect.poll(() => page.locator('.reader-webtoon img[data-page-index="20"]').evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
    expect(Math.abs((await next.boundingBox())!.y)).toBeLessThan(32);
    await page.evaluate(() => { location.hash = 'library'; });
    await expect(page.locator('.reader-shell')).toHaveCount(0);
    await expect.poll(async () => (await (await request.get(`/api/works/${workId}/reader-state`)).json()).page_index).toBe(22);
  } finally {
    release();
    await page.evaluate(() => { location.hash = 'library'; });
    await expect(page.locator('.reader-shell')).toHaveCount(0);
    await request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: prior.page_index, completed: prior.completed } });
  }
});
