import { expect, test } from "@playwright/test";
test.use({ storageState: process.env.E2E_STORAGE_STATE });
test.skip(!process.env.E2E_STORAGE_STATE, "需要隔离的真实作品测试会话");

test("作品详情侧板隔离背景，嵌套删除预览可取消并恢复焦点", async ({ page }) => {
  await page.goto('/#library');
  const cover = page.locator('.folio-library-cover').first();
  await cover.click();
  const sheet = page.getByRole('dialog', {name:'作品详情',exact:true});
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', {name:'删除本地作品',exact:true}).click();
  const deletion = page.getByRole('dialog', {name:'确认删除本地作品'});
  await expect(deletion).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(deletion).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(cover).toBeFocused();
  await cover.press('Enter');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', {name:'关闭详情',exact:true}).click();
  await expect(sheet).not.toBeVisible();
});

test("设置快速换章不排队，未保存表单仍保留", async ({ page }) => {
  await page.goto('/#settings');
  const nav = page.getByRole('navigation',{name:'设置章节'});
  await nav.getByRole('button',{name:/翻译/}).click();
  const field = page.getByRole('spinbutton',{name:'批量建议数量（每次）'});
  await expect(field).toBeVisible();
  const original = await field.inputValue();
  const changed = String(Number(original) + 1);
  await field.fill(changed);
  for (const name of ['访问与阅读','导出','连接','翻译']) {
    await nav.getByRole('button',{name:new RegExp(name)}).click();
  }
  await expect(field).toHaveValue(changed);
  await expect(page.locator('.folio-settings-stage')).toHaveCount(1);
  await expect(page.locator('.folio-settings-head h2')).toHaveText('机器翻译配置');
  await field.fill(original);
});

test("治理内容切换保留编辑，词典侧板正确约束键盘焦点", async ({ page }) => {
  await page.goto('/#governance');
  await page.locator('.folio-governance-queue-card-body').first().click();
  const field = page.locator('.folio-governance-field-input').first();
  await expect(field).toBeVisible();
  const original = await field.inputValue();
  await field.fill(`${original} `);
  const tabs = page.getByRole('group',{name:'治理内容'});
  await tabs.getByRole('button',{name:'标签映射',exact:true}).click();
  await expect(field).toHaveCount(0);
  await tabs.getByRole('button',{name:'元数据',exact:true}).click();
  await expect(field).toHaveValue(`${original} `);
  await field.fill(original);
  await page.goto('/#dictionary');
  const row = page.locator('.folio-dictionary-row').first();
  await expect(row).toBeVisible();
  const bounds = await row.boundingBox();
  const status = await row.locator('.folio-dictionary-status').boundingBox();
  expect(status!.x + status!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
  const trigger = page.getByRole('button',{name:'批量导入',exact:true});
  await trigger.click();
  const dialog = page.getByRole('dialog',{name:'批量导入词典'});
  await expect(dialog).toBeVisible();
  for(let i=0;i<12;i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("文件维护与清单分区互换，导出选项只更新打包内容", async ({ page }) => {
  await page.goto('/#files');
  const tabs = page.getByRole('group',{name:'文件工作区'});
  await tabs.getByRole('button',{name:'扫描与清理',exact:true}).click();
  await expect(page.locator('.folio-files-main')).not.toBeVisible();
  await expect(page.locator('.files-maintenance-workspace')).toBeVisible();
  await tabs.getByRole('button',{name:'文件清单',exact:true}).click();
  await expect(page.locator('.folio-files-main')).toBeVisible();
  await page.goto('/#export');
  await page.locator('.folio-export-work-item').first().click();
  const input = page.getByRole('textbox',{name:'输出名称'});
  await expect(input).toBeVisible();
  await input.evaluate(node=>node.setAttribute('data-preserved','yes'));
  const option = page.getByRole('checkbox',{name:'保留 JSON'});
  const before = await option.isChecked();
  await option.setChecked(!before);
  await expect(input).toHaveAttribute('data-preserved','yes');
  await expect(page.locator('.export-package-map')).toContainText('CBZ');
  await option.setChecked(before);
});

test("阅读控制分布于顶部与底部，翻页与收起完整保留", async ({ page }) => {
  await page.goto('/#library');
  await page.locator('.folio-library-read-action').first().click();
  await expect(page.locator('.reader-shell')).toBeVisible();
  await page.keyboard.press('Shift');
  const controls=page.getByRole('toolbar',{name:'阅读操作',exact:true});
  await expect(controls).toBeVisible();
  const top = await page.locator('.reader-toolbar').boundingBox();
  const dock = await controls.boundingBox();
  expect(dock!.y).toBeGreaterThan(top!.y + top!.height + 100);
  const counter = controls.locator('.reader-page-jump');
  const before = await counter.textContent();
  const next=controls.getByRole('button',{name:'下一页',exact:true});
  if (await next.isEnabled()) { await next.click(); await expect(counter).not.toHaveText(before!); }
  await page.getByRole('button',{name:'返回我的库',exact:true}).click();
  await expect(page.locator('.folio-library-page')).toBeVisible();
});

test("手机文件详情立即显示并可返回，减少动态效果时热门选择仍更新", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#files');
  const row = page.locator('.folio-files-row-main').first();
  await row.click();
  const sheet = page.getByRole('dialog',{name:'文件详情',exact:true});
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button',{name:'关闭文件详情'}).click();
  await expect(sheet).not.toBeVisible();
  await expect(row).toBeFocused();
  await page.goto('/#discover');
  const selectors=page.locator('.popular-selector');
  await expect(selectors).toHaveCount(5,{timeout:20000});
  await selectors.nth(3).click();
  await expect(selectors.nth(3)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.popular-studio > header > span')).toHaveText('04 / 05');
  expect(await page.locator('.folio-scroll').evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
});
