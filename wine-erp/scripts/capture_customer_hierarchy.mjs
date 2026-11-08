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

  // Step 1: Customers List + "+ Thêm khách hàng" button
  const addBtn = page.locator('button:has-text("Thêm khách hàng")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.addBtn = await getBox(addBtn);
  console.log('meta.addBtn:', meta.addBtn);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/cust-step1-list.png' });
  console.log('1. Saved cust-step1-list.png');

  // Step 2: Open Drawer & Select Parent Company tab
  await addBtn.click();
  await page.waitForTimeout(1500);

  const companyTab = page.locator('button:has-text("Công ty mẹ"), button:has-text("Doanh nghiệp")').first();
  if (await companyTab.isVisible()) {
    meta.companyTab = await getBox(companyTab);
    await companyTab.click();
    await page.waitForTimeout(600);
  }

  // Fill in Parent Company Fields
  const codeInput = page.locator('input[placeholder*="KH-"]').first();
  if (await codeInput.isVisible()) {
    meta.parentCodeInput = await getBox(codeInput);
    await codeInput.fill('KH-REDR-001');
  }

  const taxInput = page.locator('input[placeholder*="0101234567"]').first();
  if (await taxInput.isVisible()) {
    meta.taxInput = await getBox(taxInput);
    await taxInput.fill('0108999888');
  }

  const nameInput = page.locator('input[placeholder*="Công ty TNHH"]').first();
  if (await nameInput.isVisible()) {
    meta.parentNameInput = await getBox(nameInput);
    await nameInput.fill('Công ty Cổ phần Ẩm thực Red Apron Group');
  }

  const addressInput = page.locator('input[placeholder*="Số 123 đường"]').first();
  if (await addressInput.isVisible()) {
    meta.parentAddressInput = await getBox(addressInput);
    await addressInput.fill('Số 12 Tràng Tiền, Quận Hoàn Kiếm, TP Hà Nội');
  }

  const emailInput = page.locator('input[placeholder*="ketoan@"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill('ketoan@redapron.vn');
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/cust-step2-parent-company.png' });
  console.log('2. Saved cust-step2-parent-company.png');

  // Step 3: Switch to Restaurant / Child Branch tab
  const restaurantTab = page.locator('button:has-text("Nhà hàng"), button:has-text("Điểm bán")').first();
  if (await restaurantTab.isVisible()) {
    meta.restaurantTab = await getBox(restaurantTab);
    await restaurantTab.click();
    await page.waitForTimeout(800);
  }

  // Select Parent in Child Drawer
  const parentSearchInput = page.locator('input[placeholder*="Tìm công ty mẹ"], input[placeholder*="công ty mẹ"]').first();
  if (await parentSearchInput.isVisible()) {
    meta.parentSearchInput = await getBox(parentSearchInput);
    await parentSearchInput.click();
    await page.waitForTimeout(600);

    const firstParentOption = page.locator('button:has-text("Fabrik"), button:has-text("Lotte"), button:has-text("Công ty")').first();
    if (await firstParentOption.isVisible()) {
      await firstParentOption.click();
      await page.waitForTimeout(600);
    }
  }

  // Fill child restaurant name & address
  const childNameInput = page.locator('input[placeholder*="Nhà hàng"]').first();
  if (await childNameInput.isVisible()) {
    meta.childNameInput = await getBox(childNameInput);
    await childNameInput.fill('Nhà hàng Red Apron Tràng Tiền');
  }

  const childCodeInput = page.locator('input[placeholder*="KH-"]').first();
  if (await childCodeInput.isVisible()) {
    meta.childCodeInput = await getBox(childCodeInput);
    await childCodeInput.fill('KH-REDR-001-01');
  }

  const deliveryAddress = page.locator('input[placeholder*="Số 123 đường"], input[placeholder*="giao hàng"]').first();
  if (await deliveryAddress.isVisible()) {
    meta.deliveryAddress = await getBox(deliveryAddress);
    await deliveryAddress.fill('Tầng 1, Tòa nhà Opera, Số 12 Tràng Tiền, Hoàn Kiếm, Hà Nội');
  }

  const contactPhone = page.locator('input[placeholder*="0901234567"], input[placeholder*="09"]').first();
  if (await contactPhone.isVisible()) {
    meta.contactPhone = await getBox(contactPhone);
    await contactPhone.fill('0988123456');
  }

  const saveBtn = page.locator('button:has-text("Tạo khách hàng"), button:has-text("Lưu")').last();
  meta.saveBtn = await getBox(saveBtn);
  console.log('meta.saveBtn:', meta.saveBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/cust-step3-child-restaurant.png' });
  console.log('3. Saved cust-step3-child-restaurant.png');

  // Step 4: Close drawer and capture parent badge & children filter in table
  const closeBtn = page.locator('button:has-text("Hủy"), button:has-text("Đóng")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(1200);
  }

  // Filter or focus on parent customer in table
  const searchTableInput = page.locator('input[placeholder*="Tìm kiếm"]').first();
  if (await searchTableInput.isVisible()) {
    await searchTableInput.fill('Fabrik');
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/cust-step4-hierarchy-result.png' });
  console.log('4. Saved cust-step4-hierarchy-result.png');

  fs.writeFileSync('d:/Lyruou/remotion-studio/src/customer-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved customer-steps-meta.json successfully!');

  await browser.close();
  console.log('Browser closed cleanly.');
}

main().catch(err => {
  console.error('Error during customer capture:', err);
  process.exit(1);
});
