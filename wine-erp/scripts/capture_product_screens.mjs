import { chromium } from '@playwright/test';
import fs from 'fs';

async function getBox(locator) {
  try {
    const box = await locator.boundingBox({ timeout: 4000 });
    if (!box) return null;
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      cx: Math.round(box.x + box.width / 2),
      cy: Math.round(box.y + box.height / 2),
    };
  } catch {
    return null;
  }
}

async function main() {
  console.log('Launching Chromium (1600x900 @ 2x deviceScaleFactor)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const meta = {};

  console.log('Logging in as lyptc@lyscellars.com...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      #__next-build-watcher {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  });
  await page.fill('input[type="email"], input[name="email"]', 'lyptc@lyscellars.com');
  await page.fill('input[type="password"], input[name="password"]', '123456');
  await page.click('button[type="submit"]', { force: true });
  console.log('Waiting for dashboard...');
  await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), null, { timeout: 45000 });
  console.log('Login successful! Current URL:', page.url());

  console.log('Navigating to http://localhost:3000/dashboard/products ...');
  await page.goto('http://localhost:3000/dashboard/products', { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Hide nextjs overlays
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      #__next-build-watcher {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
  });

  // Step 1: Catalog list + addBtn
  const addBtn = page.locator('button:has-text("Thêm sản phẩm")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.addBtn = await getBox(addBtn);
  console.log('meta.addBtn:', meta.addBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prod-step1-list.png' });
  console.log('1. Saved prod-step1-list.png');

  // Step 2: Click "+ Thêm sản phẩm" to open Drawer
  await addBtn.click();
  await page.waitForTimeout(2500);

  const skuInput = page.locator('input[placeholder="CHATEAU-PETRUS-750"]').first();
  await skuInput.waitFor({ state: 'visible', timeout: 15000 });
  meta.skuInput = await getBox(skuInput);

  const nameInput = page.locator('input[placeholder="Château Pétrus 2018"]').first();
  meta.nameInput = await getBox(nameInput);

  console.log('meta.skuInput:', meta.skuInput);
  console.log('meta.nameInput:', meta.nameInput);

  // 2a. Capture empty drawer
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prod-step2a-drawer.png' });
  console.log('2. Saved prod-step2a-drawer.png');

  // Step 3: Type Product Name & SKU
  await nameInput.click();
  await nameInput.fill('Château Margaux Premier Grand Cru Classé 2018');
  await page.waitForTimeout(500);

  await skuInput.click();
  await skuInput.fill('FR-BOR-MAR-2018-750');
  await page.waitForTimeout(600);

  // Fill ABV
  const abvInput = page.locator('input[placeholder="13.5"]').first();
  if (await abvInput.isVisible()) {
    meta.abvInput = await getBox(abvInput);
    await abvInput.fill('13.5');
  }

  // Select Wine Type = RED if exists
  const typeSelect = page.locator('select').first();
  if (await typeSelect.isVisible()) {
    meta.typeSelect = await getBox(typeSelect);
    await typeSelect.selectOption({ label: 'Vang đỏ' }).catch(() => typeSelect.selectOption({ index: 1 }));
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prod-step3-filled.png' });
  console.log('3. Saved prod-step3-filled.png');

  // Step 4: Scroll down to pricing section
  const priceInput = page.locator('input[placeholder="5200000"]').first();
  if (await priceInput.isVisible()) {
    await priceInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    meta.priceInput = await getBox(priceInput);
    await priceInput.click();
    await priceInput.fill('28500000');
    console.log('meta.priceInput:', meta.priceInput);
  }

  // Find Save Button in Drawer Footer
  const saveBtn = page.locator('button:has-text("Lưu"), button:has-text("Tạo sản phẩm")').last();
  meta.saveBtn = await getBox(saveBtn);
  console.log('meta.saveBtn:', meta.saveBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prod-step4-pricing.png' });
  console.log('4. Saved prod-step4-pricing.png');

  // Write meta to remotion-studio/src/prod-steps-meta.json
  fs.writeFileSync('d:/Lyruou/remotion-studio/src/prod-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved prod-steps-meta.json successfully!');

  await browser.close();
  console.log('Browser closed cleanly.');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
