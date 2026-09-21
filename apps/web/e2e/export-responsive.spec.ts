import { expect, test } from '@playwright/test';

test.use({storageState:process.env.E2E_STORAGE_STATE});
test('手机导出切换步骤和桌面断点保持输出名称与打包配置',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#export');
  await page.locator('.folio-export-work-item').first().click();
  const steps=page.getByRole('navigation',{name:'导出步骤'});
  await steps.getByRole('button',{name:/02.*配置与下载/}).click();
  const name=page.getByRole('textbox',{name:'输出名称'});
  await expect(name).toBeVisible();
  const original=await name.inputValue();
  await name.fill('review-output.cbz');
  const json=page.getByRole('checkbox',{name:'保留 JSON',exact:true});
  const previous=await json.isChecked();
  await json.setChecked(!previous);
  await steps.getByRole('button',{name:/01.*选择作品/}).click();
  await expect(page.locator('.export-package-workspace')).toBeHidden();
  await steps.getByRole('button',{name:/02.*配置与下载/}).click();
  await expect(name).toHaveValue('review-output.cbz');
  await expect(json).toBeChecked({checked:!previous});
  await page.setViewportSize({width:1440,height:1000});
  await expect(page.locator('.folio-export-source')).toBeVisible();
  await expect(page.locator('.export-package-workspace')).toBeVisible();
  await expect(steps).toBeHidden();
  await expect(name).toHaveValue('review-output.cbz');
  await name.fill(original);
  await json.setChecked(previous);
});
