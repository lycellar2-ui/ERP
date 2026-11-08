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

  console.log('Navigating to http://localhost:3000/dashboard/proposals ...');
  await page.goto('http://localhost:3000/dashboard/proposals', { timeout: 60000 });
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

  // Step 1: Proposals List + "+ Tạo Tờ Trình" button
  const createBtn = page.locator('button:has-text("Tạo Tờ Trình"), button:has-text("Tạo tờ trình")').first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.createBtn = await getBox(createBtn);
  console.log('meta.createBtn:', meta.createBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prop-step1-list.png' });
  console.log('1. Saved prop-step1-list.png');

  // Step 2: Open Create Drawer
  await createBtn.click();
  await page.waitForTimeout(1500);

  // Select Category = PRICE_ADJUSTMENT
  const catSelect = page.locator('select').first();
  await catSelect.waitFor({ state: 'visible', timeout: 10000 });
  meta.catSelect = await getBox(catSelect);
  await catSelect.selectOption('PRICE_ADJUSTMENT');
  await page.waitForTimeout(1000);

  // Select Customer via search input
  const custSearchInput = page.locator('input[placeholder*="Gõ mã"]').first();
  if (await custSearchInput.isVisible()) {
    meta.custSearchInput = await getBox(custSearchInput);
    await custSearchInput.click();
    await custSearchInput.fill('Fabrik');
    await page.waitForTimeout(800);

    const firstCustOption = page.locator('div:has-text("Fabrik")').last();
    if (await firstCustOption.isVisible()) {
      await firstCustOption.click();
      await page.waitForTimeout(800);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prop-step2-category-customer.png' });
  console.log('2. Saved prop-step2-category-customer.png');

  // Step 3: Mechanism details, dates & % discount
  const dateInputs = await page.locator('input[type="date"]').all();
  if (dateInputs.length >= 2) {
    meta.startDateInput = await getBox(dateInputs[0]);
    meta.endDateInput = await getBox(dateInputs[1]);
    await dateInputs[0].fill('2026-11-01');
    await dateInputs[1].fill('2027-10-31');
  }

  // Base price list & discount %
  const discountInput = page.locator('input[type="number"][min="0"]').first();
  if (await discountInput.isVisible()) {
    meta.discountInput = await getBox(discountInput);
    await discountInput.fill('15');
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prop-step3-mechanism-dates.png' });
  console.log('3. Saved prop-step3-mechanism-dates.png');

  // Step 4: Title, Justification, Priority & Submit
  const titleInput = page.locator('input[placeholder*="tiêu đề"], input[placeholder*="Tiêu đề"]').first();
  if (await titleInput.isVisible()) {
    meta.titleInput = await getBox(titleInput);
    await titleInput.fill('Tờ trình cơ chế giá đặc biệt năm 2026-2027 — Fabrik Group');
  }

  const justTextarea = page.locator('textarea').first();
  if (await justTextarea.isVisible()) {
    meta.justTextarea = await getBox(justTextarea);
    await justTextarea.fill('Cam kết sản lượng tiêu thụ tối thiểu 1.500 chai vang cao cấp/năm. Đề xuất áp dụng cơ chế chiết khấu toàn kho 15% để bảo vệ thị phần.');
  }

  // Submit button
  const submitBtn = page.locator('button:has-text("Tạo Tờ Trình"), button:has-text("Gửi Trình Duyệt"), button:has-text("Lưu")').last();
  meta.submitBtn = await getBox(submitBtn);
  console.log('meta.submitBtn:', meta.submitBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prop-step4-content-justification.png' });
  console.log('4. Saved prop-step4-content-justification.png');

  // Step 5: Close or click an existing pending proposal to capture Detail & Approval Matrix
  const closeBtn = page.locator('button:has-text("Hủy"), button:has-text("Đóng")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click on the first proposal row in the list to open DetailDrawer
  const firstRow = page.locator('table tbody tr').first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await page.waitForTimeout(2000);

    const approveBtn = page.locator('button:has-text("Duyệt Tờ Trình"), button:has-text("Phê Duyệt")').first();
    if (await approveBtn.isVisible()) {
      meta.approveBtn = await getBox(approveBtn);
      console.log('meta.approveBtn:', meta.approveBtn);
    }

    const auditTrail = page.locator('text="Tiến Trình Duyệt Hệ Thống", text="Digital Audit Trail"').first();
    if (await auditTrail.isVisible()) {
      meta.auditTrail = await getBox(auditTrail);
    }

    await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/prop-step5-detail-approval.png' });
    console.log('5. Saved prop-step5-detail-approval.png');
  }

  // Save meta coordinates
  fs.writeFileSync('d:/Lyruou/remotion-studio/src/prop-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved prop-steps-meta.json successfully!');

  await browser.close();
  console.log('Browser closed cleanly.');
}

main().catch(err => {
  console.error('Error during proposal capture:', err);
  process.exit(1);
});
