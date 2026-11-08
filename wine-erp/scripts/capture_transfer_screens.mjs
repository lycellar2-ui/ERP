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

  console.log('Navigating to http://localhost:3000/dashboard/transfers ...');
  await page.goto('http://localhost:3000/dashboard/transfers', { timeout: 60000 });
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

  // ── Step 1: Transfers List & Create Button ──────────────────────────────
  const createBtn = page.locator('button:has-text("Lập Phiếu Chuyển Kho")').first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.createBtn = await getBox(createBtn);

  // Stats / Tabs area
  const tabsBar = page.locator('button:has-text("Chờ Kế Toán Duyệt"), button:has-text("Đã Duyệt")').first();
  if (await tabsBar.isVisible()) {
    meta.tabsBar = await getBox(tabsBar);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/transfer-step1-list.png' });
  console.log('1. Saved transfer-step1-list.png');

  // ── Step 2: Open Create Drawer & Select Route + Reason ───────────────────
  await createBtn.click();
  await page.waitForTimeout(1500);

  const drawerTitle = page.locator('h3:has-text("Lập Phiếu Chuyển Kho")').first();
  await drawerTitle.waitFor({ state: 'visible', timeout: 10000 });
  meta.drawerTitle = await getBox(drawerTitle);

  // Warehouse selects
  const warehouseSelects = page.locator('select');
  const sourceSelect = warehouseSelects.nth(0);
  const destSelect = warehouseSelects.nth(1);
  const reasonSelect = warehouseSelects.nth(2);

  meta.sourceSelect = await getBox(sourceSelect);
  meta.destSelect = await getBox(destSelect);
  meta.reasonSelect = await getBox(reasonSelect);

  // Select warehouses if needed
  const sourceOptions = await sourceSelect.locator('option').all();
  if (sourceOptions.length > 1) {
    const val = await sourceOptions[1].getAttribute('value');
    if (val) await sourceSelect.selectOption(val);
  }
  await page.waitForTimeout(500);

  const destOptions = await destSelect.locator('option:not([disabled])').all();
  for (const opt of destOptions) {
    const val = await opt.getAttribute('value');
    if (val && val !== (await sourceSelect.inputValue())) {
      await destSelect.selectOption(val);
      break;
    }
  }
  await page.waitForTimeout(500);

  // Select transfer reason
  try {
    await reasonSelect.selectOption({ index: 1 });
  } catch (e) {
    console.log('Reason select error or default used:', e.message);
  }

  const notesInput = page.locator('input[placeholder*="Ghi Chú"], input[placeholder*="VD:"]').first();
  if (await notesInput.isVisible()) {
    await notesInput.fill('Điều chuyển bổ sung phục vụ cao điểm HORECA cuối tuần');
    meta.notesInput = await getBox(notesInput);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/transfer-step2-route-reason.png' });
  console.log('2. Saved transfer-step2-route-reason.png');

  // ── Step 3: Add Wine & Select Vintage with real stock ───────────────────
  const wineInput = page.locator('input[placeholder*="Gõ SKU hoặc tên"]').first();
  await wineInput.waitFor({ state: 'visible', timeout: 8000 });
  meta.wineInput = await getBox(wineInput);

  await wineInput.click();
  await page.waitForTimeout(800);

  // Look for dropdown items
  const dropdownItems = page.locator('div[style*="background: #FFFFFF"] div.cursor-pointer, div.divide-y > div.cursor-pointer');
  const itemCount = await dropdownItems.count();
  console.log(`Found ${itemCount} products in dropdown.`);

  if (itemCount > 0) {
    meta.firstProduct = await getBox(dropdownItems.first());
    await dropdownItems.first().click();
  } else {
    await wineInput.fill('Chateau');
    await page.waitForTimeout(800);
    const searchResult = page.locator('div.divide-y > div').first();
    if (await searchResult.isVisible()) {
      await searchResult.click();
    }
  }
  await page.waitForTimeout(800);

  // Vintage select
  const lineVintageSelect = page.locator('tbody tr select').first();
  if (await lineVintageSelect.isVisible()) {
    meta.vintageSelect = await getBox(lineVintageSelect);
    const vOpts = await lineVintageSelect.locator('option').all();
    for (const vo of vOpts) {
      const text = await vo.innerText();
      if (!text.includes('(0)')) {
        const val = await vo.getAttribute('value');
        if (val !== null) {
          await lineVintageSelect.selectOption(val);
          break;
        }
      }
    }
  }

  // Transfer Quantity
  const qtyInput = page.locator('tbody tr input[type="number"]').first();
  if (await qtyInput.isVisible()) {
    await qtyInput.fill('12');
    meta.qtyInput = await getBox(qtyInput);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/transfer-step3-products.png' });
  console.log('3. Saved transfer-step3-products.png');

  // ── Step 4: Review & Submit for Accounting Approval ─────────────────────
  const submitBtn = page.locator('button:has-text("Xác Nhận Lập Phiếu"), button:has-text("submitCreateBtn")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
  meta.submitBtn = await getBox(submitBtn);

  const saveDraftBtn = page.locator('button:has-text("Lưu Nháp")').first();
  if (await saveDraftBtn.isVisible()) {
    meta.saveDraftBtn = await getBox(saveDraftBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/transfer-step4-submit.png' });
  console.log('4. Saved transfer-step4-submit.png');

  // Click Submit
  console.log('Submitting transfer order for accounting approval...');
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // ── Step 5: Detail & Accounting Audit / Print Screen ────────────────────
  // Check if first row is present in table and click it to open detail drawer
  const firstRow = page.locator('table tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 15000 });
  meta.firstRow = await getBox(firstRow);
  await firstRow.click();
  await page.waitForTimeout(2000);

  const detailDrawer = page.locator('h3:has-text("Chi Tiết Phiếu Chuyển Kho")').first();
  await detailDrawer.waitFor({ state: 'visible', timeout: 10000 });
  meta.detailTitle = await getBox(detailDrawer);

  const approveActionBtn = page.locator('button:has-text("Kế Toán Duyệt Phiếu")').first();
  if (await approveActionBtn.isVisible()) {
    meta.approveActionBtn = await getBox(approveActionBtn);
  }

  const printVoucherBtn = page.locator('button:has-text("In Phiếu Xuất"), button:has-text("A4")').first();
  if (await printVoucherBtn.isVisible()) {
    meta.printVoucherBtn = await getBox(printVoucherBtn);
  }

  const printPickListBtn = page.locator('button:has-text("Pick List")').first();
  if (await printPickListBtn.isVisible()) {
    meta.printPickListBtn = await getBox(printPickListBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/transfer-step5-detail.png' });
  console.log('5. Saved transfer-step5-detail.png');

  // Save meta
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/transfer-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved transfer-steps-meta.json successfully!');

  await browser.close();
  console.log('Capture process completed successfully!');
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
