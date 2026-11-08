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

  console.log('Navigating to http://localhost:3000/dashboard/customers ...');
  await page.goto('http://localhost:3000/dashboard/customers', { timeout: 60000 });
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

  // Step 1: Customers Table + "+ Thêm khách hàng" button
  const addBtn = page.locator('button:has-text("Thêm khách hàng")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.addBtn = await getBox(addBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/child-step1-list.png' });
  console.log('1. Saved child-step1-list.png');

  // Step 2: Open Drawer & Select Parent Customer
  await addBtn.click();
  await page.waitForTimeout(1500);

  // Ensure "Điểm bán / Nhà hàng con" tab is active
  const restaurantTab = page.locator('button:has-text("Điểm bán / Nhà hàng"), button:has-text("Nhà hàng con")').first();
  if (await restaurantTab.isVisible()) {
    meta.restaurantTab = await getBox(restaurantTab);
    await restaurantTab.click();
    await page.waitForTimeout(600);
  }

  // Parent customer search input
  const parentSearchInput = page.locator('input[placeholder*="KH cha"]').first();
  await parentSearchInput.waitFor({ state: 'visible', timeout: 8000 });
  meta.parentSearchInput = await getBox(parentSearchInput);
  await parentSearchInput.click();
  await page.waitForTimeout(500);
  await parentSearchInput.fill('Fabrik');
  await page.waitForTimeout(600);

  // Pick Fabrik candidate from dropdown
  const parentCandidate = page.locator('button:has-text("Fabrik"), button:has-text("FABRIK")').first();
  if (await parentCandidate.isVisible()) {
    meta.parentCandidate = await getBox(parentCandidate);
    await parentCandidate.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/child-step2-select-parent.png' });
  console.log('2. Saved child-step2-select-parent.png');

  // Step 3: VAT Invoice Inheritance
  // Click "Áp dụng" button in VAT section
  const applyVatBtn = page.locator('button:has-text("Áp dụng")').first();
  if (await applyVatBtn.isVisible()) {
    meta.applyVatBtn = await getBox(applyVatBtn);
    await applyVatBtn.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/child-step3-vat-inheritance.png' });
  console.log('3. Saved child-step3-vat-inheritance.png');

  // Step 4: Fill Delivery Outlet Info
  const nameInput = page.locator('input[placeholder*="Park Hyatt Saigon"], input[placeholder*="Tên điểm bán"]').first();
  if (await nameInput.isVisible()) {
    meta.nameInput = await getBox(nameInput);
    await nameInput.fill('Fabrik Lounge & Dining — Chi Nhánh Thảo Điền');
  }

  const shortNameInput = page.locator('input[placeholder="PH Saigon"]').first();
  if (await shortNameInput.isVisible()) {
    await shortNameInput.fill('Fabrik Thao Dien');
  }

  const brandChainInput = page.locator('input[placeholder*="Golden Gate, Redsun"]').first();
  if (await brandChainInput.isVisible()) {
    await brandChainInput.fill('Fabrik Signature');
  }

  const contactInput = page.locator('input[placeholder="Nguyễn Văn A"]').first();
  if (await contactInput.isVisible()) {
    meta.contactInput = await getBox(contactInput);
    await contactInput.fill('Trần Tuấn Anh - Quản Lý Chi Nhánh');
  }

  const phoneInput = page.locator('input[placeholder="0901234567"]').first();
  if (await phoneInput.isVisible()) {
    await phoneInput.fill('0908889999');
  }

  const addrInput = page.locator('input[placeholder*="Số 2 Công Trường Lam Sơn"]').first();
  if (await addrInput.isVisible()) {
    meta.addrInput = await getBox(addrInput);
    await addrInput.fill('Số 28 Thảo Điền, Phường Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh');
  }

  // Save button ("Tạo KH")
  const saveBtn = page.locator('button:has-text("Tạo KH")').first();
  meta.saveBtn = await getBox(saveBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/child-step4-delivery-outlet.png' });
  console.log('4. Saved child-step4-delivery-outlet.png');

  // Submit
  if (await saveBtn.isVisible()) {
    console.log('Saving child customer...');
    await saveBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Step 5: Table hierarchy view
  // Search for "Fabrik" in customer search input to show parent + child
  const tableSearchInput = page.locator('input[placeholder*="Tìm kiếm"]').first();
  if (await tableSearchInput.isVisible()) {
    await tableSearchInput.fill('Fabrik');
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/child-step5-hierarchy-view.png' });
  console.log('5. Saved child-step5-hierarchy-view.png');

  // Save metadata
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/child-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved child-steps-meta.json successfully!');

  await browser.close();
  console.log('Browser closed. Child capture completed!');
}

main().catch(err => {
  console.error('Error during child customer capture:', err);
  process.exit(1);
});
