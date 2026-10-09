import { expect, test } from '@playwright/test';
const migrationWorkId = process.env.E2E_MIGRATION_WORK_ID;
for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  test.describe(`${viewport.width} 媒体库整合`, () => {
    test.use({viewport});
    test('跳过文件选项卡时仅请求迁移内容，指示器连续滑动', async ({page}) => {
      await page.goto('/#files');
      await expect(page.locator('.folio-media-libraries')).toBeVisible();
      let inventoryRequests = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/files/inventory') inventoryRequests++; });
      const marker = page.locator('.folio-files-primary-tabs .folio-slide-indicator');
      const start = await marker.boundingBox();
      await page.getByRole('navigation', {name:'文件内容'}).getByRole('button', {name:'迁移', exact:true}).click();
      await expect(page.getByRole('navigation', {name:'文件内容'}).getByRole('button', {name:'迁移', exact:true})).toHaveAttribute('aria-current','page');
      await page.waitForTimeout(90);
      const middle = await marker.boundingBox();
      await page.waitForTimeout(500);
      const end = await marker.boundingBox();
      expect(middle!.x).toBeGreaterThan(start!.x+2); expect(middle!.x).toBeLessThan(end!.x-2);
      expect(inventoryRequests).toBe(0);
      await expect(page.locator('.folio-migration')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThan(2);
    });
    test('实际归档迁移预览支持背景返回，复制保留作品记录', async ({page}) => {
      test.skip(!migrationWorkId, '需要实际自有的本地导入副本');
      await page.goto('/#files?view=migration');
      const row = page.locator(`.folio-migration-row[data-work-id="${migrationWorkId}"]`);
      await row.getByRole('checkbox').check();
      await page.getByRole('button',{name:'预览迁移',exact:true}).click();
      const dialog = page.getByRole('dialog',{name:'迁移预览'});
      await expect(dialog.getByRole('button',{name:'确认复制'})).toBeEnabled();
      const box = await dialog.boundingBox();
      await page.mouse.click(5,box!.y > 10 ? box!.y/2 : 5);
      await expect(dialog).not.toBeVisible();
      await page.getByRole('button',{name:'预览迁移',exact:true}).click();
      await expect(dialog.getByRole('button',{name:'确认复制'})).toBeEnabled();
      if (viewport.width === 1440) {
        const started = page.waitForResponse(response => new URL(response.url()).pathname === '/api/library/migration' && response.request().method() === 'POST');
        await dialog.getByRole('button',{name:'确认复制'}).click();
        const job = await (await started).json();
        await expect(page.getByText('迁移已加入队列',{exact:true})).toBeVisible();
        await expect.poll(async()=> (await (await page.request.get(`/api/jobs/${job.id}`)).json()).status).toBe('completed');
        const work = await (await page.request.get(`/api/works/${migrationWorkId}`)).json();
        expect(work.page_count).toBe(61);
      } else {
        await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
      }
    });
    test('邮件预览显示实际封面与作品信息，关闭返回触发按钮', async ({page}) => {
      await page.goto('/#settings?section=notifications');
      await page.getByRole('button',{name:'预览邮件',exact:true}).click();
      const dialog = page.getByRole('dialog',{name:'通知邮件预览'});
      await expect(dialog).toBeVisible();
      const content = dialog.frameLocator('iframe');
      await expect(content.locator('img').first()).toBeVisible();
      await expect(content.locator('h2').first()).toHaveText(/.+/);
      await expect(content.locator('body')).toContainText(/\d+ 页/);
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('button',{name:'预览邮件',exact:true})).toBeFocused();
    });
  });
}
