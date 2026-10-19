import { chromium } from '@playwright/test';
import fs from 'fs';

async function getBox(locator) {
  try {
    const box = await locator.boundingBox({ timeout: 3000 });
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
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const meta = {};

  console.log('Navigating to http://localhost:3000/dashboard/sales ...');
  await page.goto('http://localhost:3000/dashboard/sales', { waitUntil: 'networkidle', timeout: 45000 });
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      #__next-build-watcher {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `
  });
  await page.waitForTimeout(1500);

  // Step 1: Sales Order List + "+ Tạo Đơn Hàng" button
  const createBtn = page.locator('button:has-text("Tạo Đơn Hàng")').first();
  meta.createBtn = await getBox(createBtn);
  console.log('createBtn box:', meta.createBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step1-sales-list.png' });
  console.log('Saved step1-sales-list.png');

  // Click "+ Tạo Đơn Hàng"
  await createBtn.click();
  console.log('Waiting for CreateSODrawer data to load...');
  await page.waitForSelector('input[placeholder*="khách"], input[placeholder*="Tìm kiếm"]', { timeout: 15000 });
  await page.waitForTimeout(2500);

  // Step 2a: Drawer opened (empty initial state)
  const custInput = page.locator('input[placeholder*="khách"], input[placeholder*="Tìm kiếm"]').last();
  meta.custInput = await getBox(custInput);
  console.log('custInput box:', meta.custInput);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step2a-drawer-empty.png' });
  console.log('Saved step2a-drawer-empty.png');

  // Step 2b: Focus customer input & type "Fabrik"
  await custInput.click();
  await custInput.fill('Fabrik');
  await page.waitForTimeout(800);

  const custBadge = page.locator('span:has-text("HR10071-01")').last();
  meta.custOption = await getBox(custBadge);
  console.log('custOption box:', meta.custOption);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step2b-customer-search.png' });
  console.log('Saved step2b-customer-search.png');

  // Step 2c: Select customer via pointerdown with bubbles: true
  await custBadge.dispatchEvent('pointerdown', { bubbles: true });
  await page.waitForTimeout(2200);

  // Fill order notes
  const notesArea = page.locator('textarea').first();
  if (await notesArea.isVisible()) {
    await notesArea.fill('Giao hàng tiêu chuẩn bảo quản lạnh cho bộ phận Sommelier - Fabrik Restaurant');
  }
  await page.waitForTimeout(500);

  const addLineBtn = page.locator('button:has-text("Thêm dòng")').first();
  meta.addLineBtn = await getBox(addLineBtn);
  console.log('addLineBtn box:', meta.addLineBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step2c-customer-selected.png' });
  console.log('Saved step2c-customer-selected.png');

  // Step 3a: Click "+ Thêm dòng" to add first wine product line
  await addLineBtn.click();
  await page.waitForTimeout(800);

  const prodInput = page.locator('table input[type="text"]').first();
  meta.prodInput = await getBox(prodInput);
  console.log('prodInput box:', meta.prodInput);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step3a-line-added.png' });
  console.log('Saved step3a-line-added.png');

  // Step 3b: Click product input to open wine dropdown
  await prodInput.click();
  await page.waitForTimeout(800);

  const prodOption1 = page.locator('span:has-text("[L10014]")').first();
  meta.prodOption = await getBox(prodOption1);
  console.log('prodOption box:', meta.prodOption);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step3b-product-dropdown.png' });
  console.log('Saved step3b-product-dropdown.png');

  // Select first product [L10014]
  await prodOption1.dispatchEvent('pointerdown', { bubbles: true });
  await page.waitForTimeout(1200);

  // Update quantity to 6 bottles
  const qtyInput = page.locator('table input[type="number"]').first();
  meta.qtyInput = await getBox(qtyInput);
  if (await qtyInput.isVisible()) {
    await qtyInput.fill('6');
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step3c-product-filled.png' });
  console.log('Saved step3c-product-filled.png');

  // Add second product [L10031] (Tồn: 78) with 12 bottles
  await addLineBtn.click();
  await page.waitForTimeout(800);
  const prodInput2 = page.locator('table input[type="text"]').nth(1);
  if (await prodInput2.isVisible()) {
    await prodInput2.click();
    await page.waitForTimeout(800);
    const prodOption2 = page.locator('span:has-text("[L10031]")').first();
    if (await prodOption2.isVisible()) {
      await prodOption2.dispatchEvent('pointerdown', { bubbles: true });
      await page.waitForTimeout(1200);
    }
    const qtyInput2 = page.locator('table input[type="number"]').nth(2);
    if (await qtyInput2.isVisible()) {
      await qtyInput2.fill('12');
    }
  }
  await page.waitForTimeout(1000);

  // Step 4: Full order populated with customer + credit limit + 2 wine lines + total summary
  const submitBtn = page.locator('button:has-text("Tạo Đơn")').last();
  meta.submitBtn = await getBox(submitBtn);
  const printBtn = page.locator('button:has-text("Xem File In")').first();
  meta.printBtn = await getBox(printBtn);
  console.log('submitBtn box:', meta.submitBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step4-order-complete.png' });
  console.log('Saved step4-order-complete.png');

  // Scroll drawer body down to reveal full payment total box
  await page.evaluate(() => {
    const scrollables = document.querySelectorAll('div');
    for (const el of scrollables) {
      if (el.scrollHeight > el.clientHeight + 20 && el.clientWidth > 500) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/step4b-order-summary.png' });
  console.log('Saved step4b-order-summary.png');

  fs.writeFileSync('d:/Lyruou/remotion-studio/src/steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved steps-meta.json');

  await browser.close();
  console.log('ALL DONE!');
}

main().catch(console.error);
