import {expect,test} from '@playwright/test';
test.use({storageState:process.env.E2E_STORAGE_STATE});
test('热门不因鼠标路过换选，大屏封面有上限且方向键可选择',async({page})=>{
 await page.setViewportSize({width:2560,height:1440});
 await page.goto('/#discover');
 const selectors=page.locator('.popular-position');
 await expect(selectors).toHaveCount(5);
 await selectors.first().click();
 await page.locator('.popular-cover').nth(3).hover();
 await expect(selectors.first()).toHaveAttribute('aria-pressed','true');
 await selectors.first().focus();
 await page.keyboard.press('ArrowRight');
 await expect(selectors.nth(1)).toBeFocused();
 await expect(selectors.nth(1)).toHaveAttribute('aria-pressed','true');
 for(const cover of await page.locator('.popular-cover').all()){
   const box=(await cover.boundingBox())!;
   expect(box.height).toBeLessThanOrEqual(390.1);
   expect(box.width).toBeGreaterThan(180);
 }
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.popular-cover').first()).toHaveAttribute('href',/^#/);
});
