import { copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const root = process.env.E2E_DIRECT_ROOT ?? '';
const source = process.env.E2E_REMOVAL_SOURCE ?? '';
test.skip(!root.startsWith('/tmp/direct-reader-owned-') || !source.startsWith('/tmp/nh-reader-media-update-20261009/owned/'), 'Requires isolated owned actual archive copies');

for (const width of [1440, 390]) {
  test(`${width}px 移除媒体库可保留或清理作品并保护共享源文件`, async ({ page, request }) => {
    test.setTimeout(60_000);
    expect(await realpath(root)).toBe(root);
    const originalSize = (await stat(source)).size;
    const libraries: number[] = [];
    const sourcePaths: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });

    async function add(suffix: string) {
      const name = `移除验收 ${width} ${suffix}`;
      const directory = join(root, `remove-${width}-${suffix}`);
      await mkdir(directory, { recursive: true });
      const path = join(directory, 'actual.cbz');
      await copyFile(source, path); sourcePaths.push(path);
      const response = await request.post('/api/library/directories', { data: { name, root_path: directory, kind: 'local', read_only: true, config: { watch: false, stable_seconds: 0, cache_mode: 'off', auto_scrape: false } } });
      expect(response.ok()).toBe(true);
      const library = await response.json(); libraries.push(library.id);
      const job = await (await request.post('/api/library/scan', { data: { library_id: library.id } })).json();
      await expect.poll(async () => (await (await request.get(`/api/jobs/${job.id}`)).json()).status).toBe('completed');
      const search = await (await request.get(`/api/library/search?library_id=${library.id}`)).json();
      expect(search.result).toHaveLength(1);
      return { id: library.id, name, workId: search.result[0].id };
    }

    async function remove(library: { id: number; name: string }, purge: boolean, shared = false) {
      await page.goto('/#files');
      const opener = page.getByRole('button', { name: '移除媒体库 ' + library.name, exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: '移除媒体库', exact: true });
      await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused();
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
      await opener.click();
      const box = await dialog.boundingBox();
      await page.mouse.click(4, box!.y > 10 ? box!.y / 2 : 4);
      await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
      await opener.click();
      if (purge) await dialog.getByRole('radio').nth(1).check();
      if (shared) await expect(dialog).toContainText('关联其他来源，将保留');
      const response = page.waitForResponse(value => value.request().method() === 'DELETE' && new URL(value.url()).pathname === `/api/library/directories/${library.id}`);
      await dialog.getByRole('button', { name: '确认移除', exact: true }).click();
      const result = await (await response).json();
      expect(result.source_files_deleted).toBe(false);
      await expect(dialog).not.toBeVisible();
      return result;
    }

    try {
      const retained = await add('retain');
      await request.patch(`/api/works/${retained.workId}/favorite`, { data: { favorite: true } });
      await request.patch(`/api/works/${retained.workId}/reader-state`, { data: { page_index: 2, completed: false } });
      expect((await remove(retained, false)).metadata_preserved).toBe(true);
      expect((await (await request.get(`/api/works/${retained.workId}`)).json()).favorite).toBe(true);
      expect((await (await request.get(`/api/works/${retained.workId}/reader-state`)).json()).page_index).toBe(2);
      await page.goto('/#library');
      await page.locator(`.folio-library-card-title[href="#reader/${retained.workId}"]`).click();
      await page.locator('.folio-work-dialog').getByRole('button', { name: '删除', exact: true }).click();
      const deletion = page.getByRole('dialog', { name: '确认删除本地作品', exact: true });
      await expect(deletion.getByRole('button', { name: '确认永久删除', exact: true })).toBeEnabled();
      const deleted = page.waitForResponse(value => new URL(value.url()).pathname === '/api/files/delete');
      await deletion.getByRole('button', { name: '确认永久删除', exact: true }).click();
      expect((await (await deleted).json()).removed_works).toBe(1);
      expect((await request.get(`/api/works/${retained.workId}`)).status()).toBe(404);

      const primary = await add('shared-a');
      const shared = await add('shared-b');
      expect(primary.workId).toBe(shared.workId);
      expect((await remove(primary, true, true)).removed_works).toBe(0);
      expect((await request.get(`/api/works/${primary.workId}`)).ok()).toBe(true);
      expect((await remove(shared, true)).removed_works).toBe(1);
      expect((await request.get(`/api/works/${primary.workId}`)).status()).toBe(404);
      for (const path of sourcePaths) expect((await stat(path)).size).toBe(originalSize);
      expect((await stat(source)).size).toBe(originalSize);
      expect(errors).toEqual([]);
    } finally {
      for (const id of libraries) await request.delete(`/api/library/directories/${id}?purge=true`).catch(() => undefined);
    }
  });
}
