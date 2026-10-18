import { expect, test } from '@playwright/test';
import type { LibraryWork, LibraryWorkGroup } from '../src/lib/api';

test.skip(!process.env.E2E_LIBRARY_GROUP_COVERS, 'Requires an isolated real library with author groups');

for (const scenario of ['slow', 'failed'] as const) {
  test(`group cover ${scenario} preload preserves the decoded current image`, async ({ page, request }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const payload = await (await request.get('/api/library/search?group_by=author&per_page=24')).json();
    const group: LibraryWorkGroup | undefined = payload.result.map((work: LibraryWork) => work.group)
      .find((value?: LibraryWorkGroup) => value?.covers.filter(cover => cover.cover_path).length === 2);
    expect(group, 'Use actual works with two available covers').toBeTruthy();
    const covers = group!.covers.filter(cover => cover.cover_path);
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requested = 0;
    await page.route(url => url.pathname === `/api/works/${covers[1].id}/cover` && url.searchParams.get('w') === '512', async route => {
      requested++;
      if (scenario === 'failed') await route.abort('failed');
      else { await gate; await route.continue().catch(() => {}); }
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto('/#library?group_by=author');
      const card = page.locator('.folio-library-group-card').filter({ has: page.getByRole('button', { name: `打开分组${group!.name}`, exact: true }) });
      await expect(card).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const active = card.locator('.folio-library-group-cover.is-active .folio-ambient-cover-artwork');
      await expect.poll(() => active.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect.poll(() => requested).toBeGreaterThan(0);
      const before = await active.getAttribute('src');
      await page.waitForTimeout(4400);
      expect(await active.getAttribute('src')).toBe(before);
      await expect(card.getByRole('button', { name: /上一张封面|下一张封面/ })).toHaveCount(0);
      for (const tag of group!.tags) {
        await expect(card.locator('.folio-library-group-tags > span').filter({ has: page.locator(`sup:text-is("${tag.count}")`) }).filter({ hasText: tag.display }).first()).toBeAttached();
      }
      if (scenario === 'slow') {
        release();
        await expect.poll(() => active.getAttribute('src'), { timeout: 6000, intervals: [50] }).not.toBe(before);
        await expect.poll(() => card.locator('.folio-library-group-cover.is-active').evaluate(node => Number(getComputedStyle(node).opacity)), { intervals: [20] }).toBeGreaterThan(0);
        const opacity = await card.locator('.folio-library-group-cover.is-active').evaluate(node => Number(getComputedStyle(node).opacity));
        expect(opacity).toBeLessThan(1);
        expect(await active.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        await card.hover();
        const paused = await active.getAttribute('src');
        await page.waitForTimeout(4300);
        expect(await active.getAttribute('src')).toBe(paused);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(4300);
        expect(await active.getAttribute('src')).toBe(paused);
      }
      await card.getByRole('button', { name: '打开分组', exact: true }).click();
      await expect(page.locator('.folio-work-group-dialog')).toBeVisible();
      expect(errors).toEqual([]);
    } finally { release(); }
  });
}
