import { expect, test } from '@playwright/test';
import type { LibraryWork, LibraryWorkGroup } from '../src/lib/api';

test.skip(!process.env.E2E_LIBRARY_GROUP_COVERS, 'Requires an isolated real library with author groups');

for (const [width, height] of [[1440, 1000], [1365, 768], [390, 844], [320, 844]]) {
  test(`${width}px group cards use one stable random cover and the shared card layout`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const payload = await (await request.get('/api/library/search?group_by=author&per_page=24')).json();
    const group: LibraryWorkGroup | undefined = payload.result.map((work: LibraryWork) => work.group)
      .find((value?: LibraryWorkGroup) => value?.covers.filter(cover => cover.cover_path).length === 2);
    expect(group).toBeTruthy();
    const covers = group!.covers.filter(cover => cover.cover_path);
    await page.addInitScript(() => { Math.random = () => .99; });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#library?group_by=author');
    const card = page.locator('.folio-library-group-card').filter({ has: page.getByRole('button', { name: group!.name, exact: true }) });
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    const image = card.locator('.folio-ambient-cover-artwork');
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', new RegExp(`/api/works/${covers.at(-1)!.id}/cover\\?`));
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(card.locator('.folio-library-card-body > p')).toContainText(`共 ${group!.total_count ?? group!.count} 部作品`);
    const tags = card.locator('.folio-library-card-tags');
    expect(await tags.evaluate(node => getComputedStyle(node).flexWrap)).toBe('nowrap');
    expect(await tags.evaluate(node => node.clientHeight)).toBeLessThanOrEqual(30);
    expect(await tags.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    await expect(tags).toHaveCSS('scrollbar-width', 'none');
    const positions = await tags.locator('a').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)));
    expect(new Set(positions).size).toBeLessThanOrEqual(1);
    if (group!.tags.length) {
      const count = tags.locator('.folio-library-group-tag-count').first();
      await expect(count).toHaveText(String(group!.tags[0].count));
      expect(await count.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
    }
    const action = card.getByRole('button', { name: '打开分组', exact: true });
    const regular = page.locator('.folio-library-card:not(.folio-library-group-card) .folio-library-read-action').first();
    const styles = (node: Element) => {
      const style = getComputedStyle(node);
      return ['font-size', 'font-family', 'font-weight', 'min-height', 'padding', 'border', 'background-color', 'color', 'justify-content'].map(key => style.getPropertyValue(key));
    };
    expect(await action.evaluate(styles)).toEqual(await regular.evaluate(styles));
    const before = await image.getAttribute('src');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(4600);
    expect(await image.getAttribute('src')).toBe(before);
    await action.focus();
    expect(await image.getAttribute('src')).toBe(before);
    await page.getByRole('button', { name: '批量选择', exact: true }).click();
    await expect(card.locator('.folio-library-cover')).toHaveAttribute('aria-pressed', 'false');
    expect(await image.getAttribute('src')).toBe(before);
    await card.locator('.folio-library-cover').click();
    await expect(card.locator('.folio-library-cover')).toHaveAttribute('aria-pressed', 'true');
    expect(await image.getAttribute('src')).toBe(before);
    await action.click();
    await expect(page.locator('.folio-work-group-dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
