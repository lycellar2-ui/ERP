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
  console.log('Launching Chromium via msedge channel (1600x900 @ 2x deviceScaleFactor)...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const meta = {};

  console.log('Logging in as lyptc@lyscellars.com (CEO/Admin)...');
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
  await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), null, { timeout: 45000 });
  console.log('Login successful! Current URL:', page.url());

  console.log('Navigating to http://localhost:3000/dashboard/margin ...');
  await page.goto('http://localhost:3000/dashboard/margin', { timeout: 60000 });
  await page.waitForTimeout(2500);

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

  // ── Step 1: Search & Supplier Selector ──────────────────────────
  const supplierSelect = page.locator('select').first();
  await supplierSelect.waitFor({ state: 'visible', timeout: 10000 });
  meta.supplierSelect = await getBox(supplierSelect);

  const searchInput = page.locator('input[placeholder*="Gõ SKU hoặc tên sản phẩm"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  meta.searchInput = await getBox(searchInput);

  // Focus search input to open dropdown
  await searchInput.click();
  await page.waitForTimeout(800);

  const dropdownMenu = page.locator('div.divide-y.divide-slate-100');
  if (await dropdownMenu.isVisible()) {
    meta.dropdownMenu = await getBox(dropdownMenu);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/margin-step1-search.png' });
  console.log('1. Saved margin-step1-search.png');

  // ── Step 2: Select Product & Inspect Base 3 Prices (Cost, WS, Retail) ──
  const firstProductItem = page.locator('div.divide-y.divide-slate-100 button').first();
  await firstProductItem.waitFor({ state: 'visible', timeout: 8000 });
  meta.firstProductItem = await getBox(firstProductItem);
  await firstProductItem.click();
  await page.waitForTimeout(1000);

  const basePriceBox = page.locator('div.grid.grid-cols-1.sm\\:grid-cols-3').first();
  await basePriceBox.waitFor({ state: 'visible', timeout: 8000 });
  meta.basePriceBox = await getBox(basePriceBox);

  const productInfoCard = page.locator('div.md\\:col-span-4').first();
  meta.productInfoCard = await getBox(productInfoCard);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/margin-step2-select-product.png' });
  console.log('2. Saved margin-step2-select-product.png');

  // ── Step 3: Enter Simulation Inputs (Discount, Buy/FOC, Incentive) ──────
  const discountInput = page.locator('input[placeholder="0"]').first();
  if (await discountInput.isVisible()) {
    await discountInput.fill('15');
    meta.discountInput = await getBox(discountInput);
    await page.waitForTimeout(300);
  }

  const buyInput = page.locator('input[placeholder="1"]').first();
  if (await buyInput.isVisible()) {
    await buyInput.fill('6');
    meta.buyInput = await getBox(buyInput);
  }

  const focInput = page.locator('input[placeholder="0"]').nth(1);
  if (await focInput.isVisible()) {
    await focInput.fill('1');
    meta.focInput = await getBox(focInput);
  }

  const incPctInput = page.locator('input[placeholder="0"]').last();
  if (await incPctInput.isVisible()) {
    await incPctInput.fill('3');
    meta.incPctInput = await getBox(incPctInput);
  }

  const inputGrid = page.locator('div.grid.grid-cols-2.sm\\:grid-cols-6');
  meta.inputGrid = await getBox(inputGrid);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/margin-step3-inputs.png' });
  console.log('3. Saved margin-step3-inputs.png');

  // ── Step 4: Real-time Calculated Metrics & Add to Report ───────
  const metricsGrid = page.locator('div.grid.grid-cols-2.sm\\:grid-cols-4');
  meta.metricsGrid = await getBox(metricsGrid);

  const addBtn = page.locator('button:has-text("THÊM VÀO BẢNG CHECK MARGIN")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 8000 });
  meta.addBtn = await getBox(addBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/margin-step4-analysis.png' });
  console.log('4. Saved margin-step4-analysis.png');

  // Click Add to Report
  await addBtn.click();
  await page.waitForTimeout(1000);

  // ── Step 5: Report Table & CSV Export ──────────────────────────
  const reportSection = page.locator('div.border-b.border-slate-200.pb-2');
  meta.reportSection = await getBox(reportSection);

  const exportCsvBtn = page.locator('button:has-text("Xuất Báo Giá (CSV)")').first();
  if (await exportCsvBtn.isVisible()) {
    meta.exportCsvBtn = await getBox(exportCsvBtn);
  }

  const viewToggleBtn = page.locator('button:has-text("Xem đầy đủ"), button:has-text("Xem rút gọn")').first();
  if (await viewToggleBtn.isVisible()) {
    meta.viewToggleBtn = await getBox(viewToggleBtn);
  }

  const reportTable = page.locator('table').first();
  if (await reportTable.isVisible()) {
    meta.reportTable = await getBox(reportTable);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/margin-step5-report.png' });
  console.log('5. Saved margin-step5-report.png');

  // Save metadata
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/margin-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved margin-steps-meta.json successfully!');

  await browser.close();
  console.log('Margin screen capture process completed!');
}

main().catch(err => {
  console.error('Margin capture failed:', err);
  process.exit(1);
});
