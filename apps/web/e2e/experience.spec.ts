import { expect, test } from "@playwright/test";

const workId = process.env.E2E_WORK_ID ?? "1";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width} 阅读与弹窗`, () => {
    test.use({ viewport });

    test("连续阅读在滚动前请求后续页，失败操作保持居中", async ({ page }) => {
      await page.request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: 1, completed: false } });
      await page.addInitScript(() => localStorage.setItem("nh.reader.prefs", JSON.stringify({ mode: "single", fit: "width", direction: "rtl" })));
      const requested = new Set<number>();
      page.on("request", request => {
        const match = new URL(request.url()).pathname.match(new RegExp(`/works/${workId}/pages/(\\d+)$`));
        if (match) requested.add(Number(match[1]));
      });
      await page.route(new RegExp(`/works/${workId}/pages/1(?:\\?.*)?$`), route => route.fulfill({ status: 503, body: "test retry" }));
      await page.goto(`/#reader/${workId}`);
      await expect(page.locator('.reader-single')).toBeVisible();
      if (!await page.getByRole('button', { name: '阅读设置', exact: true }).isVisible()) await page.locator('.reader-zone-center').click();
      await page.getByRole('button', { name: '阅读设置', exact: true }).click();
      await page.getByRole('button', { name: '连续', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.reader-webtoon')).toBeVisible();
      await expect.poll(() => requested.has(5)).toBeTruthy();
      const fifth = await page.locator('[data-page-index="5"]').boundingBox();
      expect(fifth!.y).toBeGreaterThan(viewport.height);
      const failed = page.locator('.reader-img-error[data-page-index="1"]');
      await expect(failed).toBeVisible();
      const positions = await failed.evaluate(node => {
        const outer = node.getBoundingClientRect();
        const retry = node.querySelector("button")!.getBoundingClientRect();
        return { dx: Math.abs(outer.x + outer.width / 2 - retry.x - retry.width / 2), dy: Math.abs(outer.y + outer.height / 2 - retry.y - retry.height / 2) };
      });
      expect(positions.dx).toBeLessThan(2);
      expect(positions.dy).toBeLessThan(40);
      expect(requested.has(20)).toBeFalsy();
    });

    test("删除和刮削背景点击独立关闭并返回作品弹窗", async ({ page }) => {
      await page.goto("/#library");
      await page.locator('.folio-library-cover').first().click();
      const inspector = page.locator('.folio-work-dialog');
      await expect(inspector).toBeVisible();
      await inspector.getByRole('button', { name: '删除', exact: true }).click();
      await expect(page.locator('.folio-work-delete-dialog')).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(page.locator('.folio-work-delete-dialog')).toHaveCount(0);
      await expect(inspector).toBeVisible();
      await expect(inspector.getByRole('button', { name: '删除', exact: true })).toBeFocused();
      await inspector.getByRole('button', { name: '刮削元数据' }).click();
      await expect(page.getByRole('dialog', { name: '刮削元数据' })).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(page.getByRole('dialog', { name: '刮削元数据' })).toHaveCount(0);
      await expect(inspector).toBeVisible();
    });

    test("导出在作品内打开，选项预览后能下载实际文件", async ({ page }) => {
      await page.goto(`/#export/${workId}`);
      const dialog = page.getByRole('dialog', { name: '导出作品' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: '下载此作品' })).toBeEnabled();
      const downloaded = page.waitForEvent('download');
      await dialog.getByRole('button', { name: '下载此作品' }).click();
      const download = await downloaded;
      expect(download.suggestedFilename()).toMatch(/\.cbz$/i);
      expect(await download.failure()).toBeNull();
      await expect(page.getByRole('navigation').getByRole('link', { name: '导出', exact: true })).toHaveCount(0);
      await page.mouse.click(2, 2);
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/#library$/);
    });
  });
}
