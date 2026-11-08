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

  // Step 1: Proposals List & "+ Tạo Tờ Trình" button
  const createBtn = page.locator('button:has-text("Tạo Tờ Trình"), button:has-text("Tạo tờ trình")').first();
  await createBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.createBtn = await getBox(createBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step1-list.png' });
  console.log('1. Saved special-step1-list.png');

  // Step 2: Open Create Drawer & Select SPECIAL_PRICE category + Customer
  await createBtn.click();
  await page.waitForTimeout(1500);

  const catSelect = page.locator('select:has(option[value="SPECIAL_PRICE"])');
  await catSelect.waitFor({ state: 'visible', timeout: 10000 });
  meta.catSelect = await getBox(catSelect);
  await catSelect.selectOption('SPECIAL_PRICE');
  await page.waitForTimeout(1200);

  // Select Customer
  const custSearchInput = page.locator('div.shadow-2xl input[placeholder*="Gõ mã"], div.shadow-2xl input[placeholder*="khách hàng"], input[placeholder*="Gõ mã"]').first();
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

  // Validity Dates
  const dateInputs = await page.locator('div.shadow-2xl input[type="date"], input[type="date"]').all();
  if (dateInputs.length >= 2) {
    meta.startDateInput = await getBox(dateInputs[0]);
    meta.endDateInput = await getBox(dateInputs[1]);
    await dateInputs[0].fill('2026-11-01');
    await dateInputs[1].fill('2027-10-31');
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step2-customer-dates.png' });
  console.log('2. Saved special-step2-customer-dates.png');

  // Step 3: Add SKU lines in Special Price table
  const addSkuBtn = page.locator('button:has-text("Thêm dòng SKU")').first();
  if (await addSkuBtn.isVisible()) {
    meta.addSkuBtn = await getBox(addSkuBtn);
    await addSkuBtn.click();
    await page.waitForTimeout(800);

    // Pick first product from product combobox using pointerdown
    const prodInput = page.locator('div.shadow-2xl input[placeholder*="Gõ mã SKU"]').first();
    if (await prodInput.isVisible()) {
      await prodInput.click();
      await page.waitForTimeout(600);
      const firstOption = page.locator('div.shadow-2xl div[class*="divide-y"] > div').first();
      if (await firstOption.isVisible()) {
        await firstOption.dispatchEvent('pointerdown');
        await page.waitForTimeout(600);
      }
    }

    // Set Quantity = 60
    const qtyInputs = await page.locator('div.shadow-2xl input[type="number"]').all();
    if (qtyInputs.length >= 1) {
      await qtyInputs[0].fill('60');
    }

    // Set Proposed Special Price (e.g. 5,800,000)
    const priceInputs = await page.locator('div.shadow-2xl input[placeholder="0"]').all();
    if (priceInputs.length >= 1) {
      meta.priceInput = await getBox(priceInputs[0]);
      await priceInputs[0].fill('5800000');
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step3-sku-table.png' });
  console.log('3. Saved special-step3-sku-table.png');

  // Step 4: Title, Justification, Priority & Ready to Submit
  const titleInput = page.locator('div.shadow-2xl input[placeholder*="tiêu đề"], div.shadow-2xl input[placeholder*="Tiêu đề"]').first();
  if (await titleInput.isVisible()) {
    meta.titleInput = await getBox(titleInput);
    await titleInput.fill('Tờ trình giá đặc biệt SKU Grand Cru 2026-2027 — Fabrik Group');
  }

  // Fill content textarea (mandatory in handleSave)
  const textareas = await page.locator('div.shadow-2xl textarea').all();
  if (textareas.length >= 1) {
    meta.contentInput = await getBox(textareas[0]);
    await textareas[0].fill('Kính trình Ban Lãnh đạo phê duyệt chính sách giá đặc biệt cố định cho đối tác chiến lược Fabrik Group đối với dòng sản phẩm Grand Cru phục vụ mùa sự kiện 2026-2027.');
  }
  if (textareas.length >= 2) {
    meta.justTextarea = await getBox(textareas[1]);
    await textareas[1].fill('Cam kết bao tiêu sản lượng tối thiểu 180 chai Grand Cru/năm cho chuỗi nhà hàng cao cấp. Đề xuất khóa đơn giá net cố định để đối tác đưa vào thực đơn chính thức.');
  }

  const saveBtn = page.locator('div.shadow-2xl button:has-text("Lưu Bản Nháp")').first();
  meta.saveBtn = await getBox(saveBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step4-submit.png' });
  console.log('4. Saved special-step4-submit.png');

  // Click Save
  if (await saveBtn.isVisible()) {
    console.log('Saving special price proposal draft...');
    await saveBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // If create drawer is still open, close it
  const closeCreateBtn = page.locator('div.shadow-2xl button:has(svg.lucide-x)').first();
  if (await closeCreateBtn.isVisible()) {
    await closeCreateBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Step 5: Capture Proposal Detail & Approval Matrix
  const detailBtn = page.locator('table tbody tr:first-child button').first();
  if (await detailBtn.isVisible()) {
    meta.detailBtn = await getBox(detailBtn);
    console.log('Clicking top proposal detail button...');
    await detailBtn.click({ force: true });
    await page.waitForTimeout(2500);

    meta.detailDrawer = await getBox(page.locator('div.shadow-2xl').first());
    await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step5-detail-matrix.png' });
    console.log('5. Saved special-step5-detail-matrix.png');
  } else {
    await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/special-step5-detail-matrix.png' });
  }

  // Save metadata
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/special-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved special-steps-meta.json successfully!');

  await browser.close();
  console.log('Browser closed. Capture completed!');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
