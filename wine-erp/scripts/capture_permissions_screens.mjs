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

  // Switch to Roles & Permissions tab
  const rolesTab = page.locator('button:has-text("Vai Trò & Phân Quyền"), button:has-text("Roles")').first();
  await rolesTab.waitFor({ state: 'visible', timeout: 10000 });
  meta.rolesTab = await getBox(rolesTab);
  await rolesTab.click();
  await page.waitForTimeout(1500);

  // ── Step 1: Roles Tab & System Roles Grid ───────────────────────
  const createRoleBtn = page.locator('button:has-text("Tạo Vai Trò")').first();
  await createRoleBtn.waitFor({ state: 'visible', timeout: 10000 });
  meta.createRoleBtn = await getBox(createRoleBtn);

  const roleCards = page.locator('div.grid.grid-cols-1.lg\\:grid-cols-2.xl\\:grid-cols-3 > div');
  const roleCardCount = await roleCards.count();
  console.log(`Found ${roleCardCount} role cards.`);

  if (roleCardCount > 0) {
    meta.firstRoleCard = await getBox(roleCards.nth(0));
    if (roleCardCount > 1) {
      meta.secondRoleCard = await getBox(roleCards.nth(1));
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/permissions-step1-roles.png' });
  console.log('1. Saved permissions-step1-roles.png');

  // ── Step 2: Open Create Role Drawer & Enter Name ─────────────────
  await createRoleBtn.click();
  await page.waitForTimeout(1500);

  const drawerTitle = page.locator('h3:has-text("Tạo Vai Trò Mới")').first();
  await drawerTitle.waitFor({ state: 'visible', timeout: 10000 });
  meta.drawerTitle = await getBox(drawerTitle);

  const roleNameInput = page.locator('input[placeholder*="Trợ Lý Giám Đốc"], input[placeholder*="Vai Trò"]').first();
  await roleNameInput.waitFor({ state: 'visible', timeout: 8000 });
  await roleNameInput.fill('Trưởng Nhóm Bán Lẻ Showroom');
  meta.roleNameInput = await getBox(roleNameInput);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/permissions-step2-create-role.png' });
  console.log('2. Saved permissions-step2-create-role.png');

  // ── Step 3: Group Permissions (7 ERP Business Domains) ─────────
  const searchPermInput = page.locator('input[placeholder*="Tìm theo tên phân hệ"]').first();
  if (await searchPermInput.isVisible()) {
    meta.searchPermInput = await getBox(searchPermInput);
  }

  // Click "Chọn cả nhóm" on first group (e.g. Exec or Sales)
  const groupSelectBtn = page.locator('button:has-text("Chọn cả nhóm")').nth(2); // Sales group
  if (await groupSelectBtn.isVisible()) {
    meta.groupSelectBtn = await getBox(groupSelectBtn);
    await groupSelectBtn.click();
    await page.waitForTimeout(500);
  }

  const groupCard = page.locator('div.border.border-slate-200').nth(2);
  if (await groupCard.isVisible()) {
    meta.groupCard = await getBox(groupCard);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/permissions-step3-group-perms.png' });
  console.log('3. Saved permissions-step3-group-perms.png');

  // ── Step 4: Granular Actions & Save Role ─────────────────────────
  const actionBadges = page.locator('button:has-text("READ"), button:has-text("CREATE"), button:has-text("APPROVE")');
  if (await actionBadges.count() > 0) {
    meta.actionBadges = await getBox(actionBadges.first());
  }

  const saveRoleBtn = page.locator('button:has-text("Tạo Vai Trò (")').first();
  if (await saveRoleBtn.isVisible()) {
    meta.saveRoleBtn = await getBox(saveRoleBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/permissions-step4-actions-save.png' });
  console.log('4. Saved permissions-step4-actions-save.png');

  // Close create drawer
  const closeDrawerBtn = page.locator('div.w-full.max-w-lg button:has(svg)').first();
  await closeDrawerBtn.click();
  await page.waitForTimeout(1000);

  // ── Step 5: Multi-tier Approval Matrix ──────────────────────────
  console.log('Navigating to http://localhost:3000/dashboard/settings/approval-matrix ...');
  await page.goto('http://localhost:3000/dashboard/settings/approval-matrix', { timeout: 60000 });
  await page.waitForTimeout(2500);

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

  const matrixHeader = page.locator('h1, h2, h3').first();
  meta.matrixHeader = await getBox(matrixHeader);

  const routeCards = page.locator('div.p-5, div.border.rounded-lg');
  if (await routeCards.count() > 0) {
    meta.firstRouteCard = await getBox(routeCards.first());
  }

  const thresholdSection = page.locator('div:has-text("Hạn Mức"), div:has-text("Ngưỡng Phê Duyệt")').first();
  if (await thresholdSection.isVisible()) {
    meta.thresholdSection = await getBox(thresholdSection);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/permissions-step5-approval-matrix.png' });
  console.log('5. Saved permissions-step5-approval-matrix.png');

  // Save metadata
  fs.writeFileSync('d:/Lyruou/remotion-studio/public/permissions-steps-meta.json', JSON.stringify(meta, null, 2));
  console.log('Saved permissions-steps-meta.json successfully!');

  await browser.close();
  console.log('Permissions screen capture process completed!');
}

main().catch(err => {
  console.error('Permissions capture failed:', err);
  process.exit(1);
});
