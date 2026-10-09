import { expect, test, type Page } from "@playwright/test";

test.skip(!process.env.E2E_STORAGE_STATE, "需要隔离数据库与真实会话");

async function slide(page: Page, group: string, index: number) {
  await page.waitForFunction(() => !document.documentElement.dataset.folioSlide);
  await page.locator(group).scrollIntoViewIfNeeded();
  await page.evaluate(selector => {
    const group = document.querySelector(selector)!;
    const samples: Array<{ x: number; y: number }> = [];
    Object.assign(window, { indicatorSamples: samples });
    const started = performance.now();
    function sample() {
      const rect = group.querySelector('.folio-slide-indicator')?.getBoundingClientRect();
      const origin = group.getBoundingClientRect();
      if (rect) samples.push({ x: rect.x - origin.x, y: rect.y - origin.y });
      if (performance.now() - started < 900) requestAnimationFrame(sample);
    }
    sample();
  }, group);
  const buttons = page.locator(group).locator(':scope > :is(button, a)');
  if (await buttons.nth(index).evaluate(node => node.matches('.is-active, [aria-pressed="true"], [aria-current="page"]'))) index = index === 0 ? await buttons.count() - 1 : 0;
  await buttons.nth(index).click();
  await page.waitForTimeout(950);
  const samples = await page.evaluate(() => (window as unknown as { indicatorSamples: Array<{ x: number; y: number }> }).indicatorSamples);
  const first = samples[0], last = samples.at(-1)!;
  const dx = last.x - first.x, dy = last.y - first.y, distance = dx * dx + dy * dy;
  expect(distance).toBeGreaterThan(100);
  expect(samples.some(point => {
    const fraction = ((point.x - first.x) * dx + (point.y - first.y) * dy) / distance;
    return fraction > .1 && fraction < .9;
  })).toBe(true);
  await expect(buttons.nth(index)).toHaveCSS('overflow', 'visible');
}

test("全站同类控件的指示条连续滑动，跨项不加载中间页面", async ({ page }) => {
  test.setTimeout(90_000);
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/#workbench');
  await expect(page.locator('.folio-home')).toBeVisible();
  await expect(page.locator('.folio-home-library-state .folio-home-state-row')).toBeVisible();
  requests.length = 0;
  await slide(page, '.folio-topnav', 7);
  await expect(page.locator('.folio-settings-nav')).toBeVisible();
  expect(requests.filter(path => /\/api\/(library|discover|governance|dictionary|files|exports)\//.test(path))).toEqual([]);
  await slide(page, '.folio-settings-nav', 2);
  await slide(page, '.folio-segment-field > div', 1);
  await slide(page, '.folio-settings-nav', 1);
  await slide(page, '.folio-choice-row', 1);
  await slide(page, '.folio-settings-nav', 4);
  await slide(page, '.folio-reading-period', 3);
  await slide(page, '.folio-reading-work-ranking > header > div', 1);
  await page.goto('/#settings?section=storage');
  await expect(page.getByRole('region', {name:'阅读缓存',exact:true})).toBeVisible();
  await page.goto('/#settings?section=notifications');
  await expect(page.locator('.folio-smtp')).toBeVisible();
  await page.goto('/#discover?view=subscriptions');
  await expect(page.getByRole('region',{name:'订阅管理',exact:true})).toBeVisible();
  await page.goto('/#files?view=files');
  await slide(page, '.folio-files-primary-tabs', 2);
  await slide(page, '.folio-files-primary-tabs', 1);
  await slide(page, '.folio-files-toolbar .folio-files-tabs', 2);
  await page.goto('/#tasks');
  await slide(page, '.folio-tasks-tabs', 3);
  await page.goto('/#library');
  await slide(page, '.folio-library-view-switch', 1);
  const trigger = page.locator('.folio-library-tag-filter > button');
  await trigger.click();
  await slide(page, '.folio-library-tag-scope', 1);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.goto('/#discover');
  await page.getByRole('button', { name: '添加标签', exact: true }).click();
  await slide(page, '.folio-discover-tag-scope', 1);
  await slide(page, '.folio-discover-tag-mode', 1);
  await page.goto(`/#reader/${process.env.E2E_WORK_ID}`);
  await page.getByRole('button', { name: '阅读设置', exact: true }).click();
  await slide(page, '.reader-mode-choice', 1);
  await page.goto('/#governance');
  await expect(page.locator('.folio-governance-queue-filters')).toBeVisible();
  await slide(page, '.folio-governance-queue-filters', 4);
});

for (const width of [1440, 390]) test(`${width}px 库详情完整显示真实横向封面，读取失败可重新加载`, async ({ page, request }) => {
  await page.setViewportSize({ width, height: 1000 });
  const id = Number(process.env.E2E_LANDSCAPE_WORK_ID);
  const work = await (await request.get(`/api/works/${id}`)).json();
  await page.goto('/#library');
  await page.getByRole('searchbox', { name: '搜索作品', exact: true }).fill(String(work.remote_gallery_id));
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.locator('.folio-library-card-title').first().click();
  const cover = page.locator('.folio-work-detail-cover');
  const image = cover.locator('.folio-ambient-cover-artwork');
  await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true);
  const difference = await cover.evaluate(node => {
    const image = node.querySelector('img.folio-ambient-cover-artwork') as HTMLImageElement;
    const rect = node.getBoundingClientRect();
    return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight);
  });
  expect(difference).toBeLessThan(.03);
  await expect(cover).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Escape');
  await page.route(`**/api/works/${id}/cover?*`, route => route.abort());
  await page.locator('.folio-library-card-title').first().click();
  await expect(cover).toContainText('封面读取失败');
  await page.unroute(`**/api/works/${id}/cover?*`);
  await cover.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth > 0)).toBe(true);
});

test("文件选择与删除预览可取消，导出预览可切换选项，词典弹窗恢复焦点", async ({ page, request }) => {
  const before = await (await request.get('/api/library/summary')).json();
  await page.goto('/#files?view=files');
  await page.locator('.folio-files-select').first().click();
  await page.getByRole('button', { name: '预览删除影响', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认删除', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await (await request.get('/api/library/summary')).json()).total).toBe(before.total);
  await page.goto(`/#export/${process.env.E2E_WORK_ID}`);
  const preview = page.locator('.folio-export-inspector .folio-export-name-input');
  await expect(preview).toBeVisible();
  const comic = page.getByRole('checkbox', { name: '写入 ComicInfo.xml', exact: true });
  await comic.uncheck();
  await expect(page.locator('.folio-export-comicinfo')).toHaveClass(/is-off/);
  await comic.check();
  await expect(page.locator('.folio-export-comicinfo')).not.toHaveClass(/is-off/);
  await page.goto('/#dictionary');
  const trigger = page.getByRole('button', { name: '批量导入', exact: true });
  await trigger.click();
  const bulk = page.getByRole('dialog', { name: '批量导入', exact: true });
  await expect(bulk).toBeVisible();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await bulk.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(bulk).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("词典关联作品沿用网站的封面模糊设置", async ({ page, request }) => {
  const settings = await (await request.get('/api/settings')).json();
  const { result } = await (await request.get('/api/dictionary/candidates?limit=80')).json();
  const candidate = result.find((item: { impact_work_count: number }) => item.impact_work_count > 0);
  expect(candidate).toBeDefined();
  for (const blur of [true, false]) {
    await page.route('**/api/settings', route => route.fulfill({ json: { ...settings, privacy: { ...settings.privacy, blur_covers_default: blur } } }));
    await page.goto('/#dictionary');
    await page.reload();
    await page.getByRole('searchbox', { name: '搜索原文或中文词条', exact: true }).fill(candidate.name || candidate.slug);
    await page.locator('.folio-dictionary-row').filter({ has: page.getByText(candidate.name || candidate.slug, { exact: true }) }).first().click();
    const cover = page.locator('.folio-dictionary-related img').first();
    await expect(cover).toBeAttached();
    if (blur) await expect(cover).toHaveClass('folio-media-blurred');
    else await expect(cover).not.toHaveClass('folio-media-blurred');
    await page.unroute('**/api/settings');
    await page.goto('/#workbench');
  }
});
