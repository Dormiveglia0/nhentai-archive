import { expect, test } from '@playwright/test';
test.use({ storageState: process.env.E2E_STORAGE_STATE });

test('治理仅有改动时固定保存栏，切换分区保留草稿', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#governance');
  const input=page.locator('.is-long-field textarea').first();
  await expect(input).toBeVisible();
  const actions=page.locator('.folio-governance-actions');
  await expect(actions).toHaveCSS('position','static');
  const before=await input.inputValue();
  await input.fill(before+'审核');
  await expect(actions).toHaveCSS('position','fixed');
  const sections=page.getByRole('group',{name:'治理内容'});
  await sections.getByRole('button',{name:/标签映射/}).click();
  await sections.getByRole('button',{name:/元数据/}).click();
  await expect(input).toHaveValue(before+'审核');
  await input.fill(before);
  await expect(page.locator('.governance-translation-disclosure')).not.toHaveAttribute('open');
  await page.locator('.governance-translation-disclosure>summary').click();
  await expect(page.getByRole('button',{name:'生成建议',exact:true})).toBeVisible();
});

test('词典各列对齐，侧边编辑关闭后恢复来源焦点',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/#dictionary');
  const rows=page.locator('.folio-dictionary-row');
  await expect(rows.first()).toBeVisible();
  const first=await rows.first().boundingBox();
  const second=await rows.nth(1).boundingBox();
  expect(first!.x).toBe(second!.x);
  expect(first!.y+first!.height).toBeCloseTo(second!.y,0);
  await rows.first().click();
  const dialog=page.getByRole('dialog',{name:'编辑词条',exact:true});
  await expect(dialog).toHaveAttribute('data-phase','open');
  expect((await dialog.boundingBox())!.x).toBeGreaterThan(100);
  await page.keyboard.press('Escape');
  await expect(rows.first()).toBeFocused();
});
