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

  console.log('Navigating to http://localhost:3000/dashboard/settings ...');
  await page.goto('http://localhost:3000/dashboard/settings', { timeout: 60000 });
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

  // ── Step 1: Users Tab & Overview Table ──────────────────────────
  const addUserBtn = page.locator('button:has-text("Thêm người dùng")').first();
  await addUserBtn.waitFor({ state: 'visible', timeout: 15000 });
  meta.addUserBtn = await getBox(addUserBtn);

  const searchInput = page.locator('input[placeholder*="Tìm tên"]').first();
  if (await searchInput.isVisible()) {
    meta.searchInput = await getBox(searchInput);
  }

  const statCards = page.locator('div.grid').first();
  if (await statCards.isVisible()) {
    meta.statCards = await getBox(statCards);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/account-step1-list.png' });
  console.log('1. Saved account-step1-list.png');

  // ── Step 2: Open Create Drawer & Enter Basic Info ───────────────
  await addUserBtn.click();
  await page.waitForTimeout(1500);

  const createDrawerTitle = page.locator('h3:has-text("Tạo Người Dùng"), h3:has-text("Người Dùng")').first();
  await createDrawerTitle.waitFor({ state: 'visible', timeout: 15000 });
  meta.createDrawerTitle = await getBox(createDrawerTitle);

  const emailInput = page.locator('input[placeholder*="@lyscellars.com"]').first();
  await emailInput.fill('hoang.nam@lyscellars.com');
  meta.emailInput = await getBox(emailInput);

  const nameInput = page.locator('input[placeholder*="Nguyễn Văn A"]').first();
  await nameInput.fill('Hoàng Văn Nam');
  meta.nameInput = await getBox(nameInput);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill('Lys@Wine2026!');
  meta.passwordInput = await getBox(passwordInput);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/account-step2-create.png' });
  console.log('2. Saved account-step2-create.png');

  // ── Step 3: Assign RBAC Roles & Save ───────────────────────────
  const roleButtons = page.locator('div.grid.grid-cols-2 button');
  const roleCount = await roleButtons.count();
  console.log(`Found ${roleCount} role options in drawer.`);

  if (roleCount > 0) {
    const firstRole = roleButtons.nth(0);
    await firstRole.click();
    meta.firstRole = await getBox(firstRole);
    await page.waitForTimeout(300);

    if (roleCount > 1) {
      const secondRole = roleButtons.nth(1);
      await secondRole.click();
      meta.secondRole = await getBox(secondRole);
    }
  }

  const saveUserBtn = page.locator('div.w-full.max-w-md button:has-text("Tạo Người Dùng"), div.w-full.max-w-md button:has-text("Lưu")').last();
  meta.saveUserBtn = await getBox(saveUserBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/account-step3-roles.png' });
  console.log('3. Saved account-step3-roles.png');

  // Close create drawer
  const closeDrawerBtn = page.locator('div.w-full.max-w-md button:has(svg)').first();
  await closeDrawerBtn.click();
  await page.waitForTimeout(1000);

  // ── Step 4: Open User Detail & Edit Roles / Reset Password ──────
  const firstUserCell = page.locator('table tbody tr td').first();
  await firstUserCell.waitFor({ state: 'visible', timeout: 15000 });
  meta.firstUserCell = await getBox(firstUserCell);
  await firstUserCell.click();
  await page.waitForTimeout(1500);

  const editDrawerTitle = page.locator('h3:has-text("Chỉnh Sửa Người Dùng"), h3:has-text("Thông Tin Chi Tiết")').first();
  await editDrawerTitle.waitFor({ state: 'visible', timeout: 15000 });
  meta.editDrawerTitle = await getBox(editDrawerTitle);

  const resetPassInput = page.locator('input[placeholder*="mật khẩu mới"], input[type="password"]').first();
  if (await resetPassInput.isVisible()) {
    await resetPassInput.fill('NewSecurePass2026#');
    meta.resetPassInput = await getBox(resetPassInput);
  }

  const editRoleGrid = page.locator('div.grid.grid-cols-2').last();
  if (await editRoleGrid.isVisible()) {
    meta.editRoleGrid = await getBox(editRoleGrid);
  }

  const saveChangesBtn = page.locator('button:has-text("Lưu Thay Đổi"), button:has-text("Lưu")').last();
  if (await saveChangesBtn.isVisible()) {
    meta.saveChangesBtn = await getBox(saveChangesBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/account-step4-detail.png' });
  console.log('4. Saved account-step4-detail.png');

  // ── Step 5: Account Status & Security Controls ─────────────────
  const statusSelect = page.locator('select').first();
  if (await statusSelect.isVisible()) {
    meta.statusSelect = await getBox(statusSelect);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/account-step5-status.png' });
  console.log('5. Saved account-step5-status.png');

  // Save metadata
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/account-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved account-steps-meta.json successfully!');

  await browser.close();
  console.log('Account screen capture process completed!');
}

main().catch(err => {
  console.error('Account capture failed:', err);
  process.exit(1);
});
