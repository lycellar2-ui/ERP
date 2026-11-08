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

  // ── Step 1: Approval Matrix Overview ──────────────────────────
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

  const matrixTable = page.locator('table').first();
  await matrixTable.waitFor({ state: 'visible', timeout: 10000 });
  meta.matrixTable = await getBox(matrixTable);

  const firstEditBtn = page.locator('table tbody tr button').first();
  await firstEditBtn.waitFor({ state: 'visible', timeout: 8000 });
  meta.firstEditBtn = await getBox(firstEditBtn);

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/approval-step1-matrix.png' });
  console.log('1. Saved approval-step1-matrix.png');

  // ── Step 2: Multi-step Routing Modal ──────────────────────────
  console.log('Opening Edit Modal for Proposal Routing...');
  await firstEditBtn.click();
  await page.waitForTimeout(1000);

  const modalContainer = page.locator('div.fixed.inset-0.z-50').first();
  await modalContainer.waitFor({ state: 'visible', timeout: 8000 });
  meta.modalContainer = await getBox(modalContainer.locator('> div').first());

  const addStepBtn = modalContainer.locator('button:has-text("Thêm cấp")').first();
  if (await addStepBtn.isVisible()) {
    meta.addStepBtn = await getBox(addStepBtn);
  }

  const modalSaveBtn = modalContainer.locator('button:has-text("Xác nhận")').first();
  if (await modalSaveBtn.isVisible()) {
    meta.modalSaveBtn = await getBox(modalSaveBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/approval-step2-edit-modal.png' });
  console.log('2. Saved approval-step2-edit-modal.png');

  // Close modal by clicking cancel or outside
  const cancelBtn = modalContainer.locator('button:has-text("Hủy")').first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);

  // ── Step 3: Thresholds Matrix (Ngưỡng hạn mức phê duyệt) ───────
  console.log('Scrolling down to Thresholds Matrix...');
  const thresholdSection = page.locator('h3:has-text("Ngưỡng Giá Trị"), h3:has-text("Ngưỡng Phê Duyệt")').first();
  if (await thresholdSection.isVisible()) {
    await thresholdSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    meta.thresholdSection = await getBox(thresholdSection.locator('..'));
  } else {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(600);
  }

  const thresholdInputs = page.locator('input[type="number"], input[type="text"]');
  const countInputs = await thresholdInputs.count();
  if (countInputs > 0) {
    meta.thresholdInput = await getBox(thresholdInputs.first());
  }

  const saveThresholdBtn = page.locator('button:has-text("Lưu Ngưỡng"), button:has-text("Lưu")').last();
  if (await saveThresholdBtn.isVisible()) {
    meta.saveThresholdBtn = await getBox(saveThresholdBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/approval-step3-thresholds.png' });
  console.log('3. Saved approval-step3-thresholds.png');

  // ── Step 4: Pending Proposals List ────────────────────────────
  console.log('Navigating to http://localhost:3000/dashboard/proposals ...');
  await page.goto('http://localhost:3000/dashboard/proposals', { timeout: 60000 });
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

  const proposalRows = page.locator('table tbody tr');
  const pCount = await proposalRows.count();
  console.log(`Found ${pCount} proposals in table`);

  let targetProposal = proposalRows.first();
  if (pCount > 0) {
    meta.targetProposal = await getBox(targetProposal);
    const quickApproveBtn = targetProposal.locator('button:has-text("Duyệt")').first();
    if (await quickApproveBtn.isVisible()) {
      meta.quickApproveBtn = await getBox(quickApproveBtn);
    }
    const detailBtn = targetProposal.locator('button:has-text("Chi tiết")').first();
    if (await detailBtn.isVisible()) {
      meta.detailBtn = await getBox(detailBtn);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/approval-step4-pending-proposal.png' });
  console.log('4. Saved approval-step4-pending-proposal.png');

  // ── Step 5: Proposal Detail Modal & Approval Decision ────────
  console.log('Opening proposal detail modal...');
  if (pCount > 0) {
    const detailBtn = targetProposal.locator('button:has-text("Chi tiết")').first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
    } else {
      await targetProposal.click();
    }
    
    // Wait for the modal or detail drawer to appear
    await page.waitForSelector('div.fixed.inset-0.z-50, div[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const detailDialog = page.locator('div.fixed.inset-0.z-50 > div').first();
    if (await detailDialog.isVisible()) {
      meta.detailDialog = await getBox(detailDialog);
    }

    const modalApproveBtn = page.locator('button:has-text("Phê duyệt"), button:has-text("Duyệt")').last();
    if (await modalApproveBtn.isVisible()) {
      meta.modalApproveBtn = await getBox(modalApproveBtn);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/approval-step5-approve-action.png' });
  console.log('5. Saved approval-step5-approve-action.png');

  fs.writeFileSync('d:/Lyruou/remotion-studio/public/approval-steps-meta.json', JSON.stringify(meta, null, 2), 'utf-8');
  console.log('Saved d:/Lyruou/remotion-studio/public/approval-steps-meta.json');

  await browser.close();
  console.log('Screen capture completed successfully!');
}

main().catch(err => {
  console.error('Error during screen capture:', err);
  process.exit(1);
});
