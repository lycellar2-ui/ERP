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

async function closeModalSafely(page) {
  try {
    const closeBtn = page.locator('div.fixed.inset-0.z-50 button:has(svg.lucide-x), div.fixed.inset-0.z-50 button:has-text("Đóng"), div.fixed.inset-0.z-50 button:has-text("Hủy")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(600);
    }
  } catch {}
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
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

  // ── Step 1: Consignment Warehouses List & Stat Grid ──────────
  console.log('Navigating to http://localhost:3000/dashboard/consignment ...');
  await page.goto('http://localhost:3000/dashboard/consignment', { timeout: 60000 });
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

  const addWarehouseBtn = page.locator('button:has-text("Tạo Kho Ký Gửi")').first();
  if (await addWarehouseBtn.isVisible()) {
    meta.addWarehouseBtn = await getBox(addWarehouseBtn);
  }

  const statCards = page.locator('div.grid').first();
  if (await statCards.isVisible()) {
    meta.statCards = await getBox(statCards);
  }

  const warehouseTable = page.locator('table').first();
  if (await warehouseTable.isVisible()) {
    meta.warehouseTable = await getBox(warehouseTable);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step1-warehouses.png' });
  console.log('1. Saved consignment-step1-warehouses.png');

  // ── Step 2: Consignment Transfer Modal ─────────────────────────
  console.log('Opening Create Transfer Modal...');
  const transferBtn = page.locator('button:has-text("Xuất Hàng Ký Gửi")').first();
  if (await transferBtn.isVisible()) {
    meta.transferBtn = await getBox(transferBtn);
    await transferBtn.click();
    await page.waitForTimeout(1200);

    const modal = page.locator('div.fixed.inset-0.z-50').first();
    if (await modal.isVisible()) {
      meta.transferModal = await getBox(modal.locator('> div').first());
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step2-transfer-modal.png' });
  console.log('2. Saved consignment-step2-transfer-modal.png');

  await closeModalSafely(page);

  // ── Step 3: Transfers Tab (Lịch Sử Xuất Kho Ký Gửi) ───────────
  console.log('Switching to Transfers Tab...');
  const transfersTab = page.locator('button[role="tab"]:has-text("Lịch Sử Xuất Kho Ký Gửi"), button[role="tab"]:has-text("Lịch Sử Xuất Kho")').first();
  if (await transfersTab.isVisible()) {
    await transfersTab.click();
    await page.waitForTimeout(1500);
    meta.transfersTab = await getBox(transfersTab);
  }

  const transfersTable = page.locator('table, div.rounded-lg.border').first();
  if (await transfersTable.isVisible()) {
    meta.transfersTable = await getBox(transfersTable);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step3-dispatch-list.png' });
  console.log('3. Saved consignment-step3-dispatch-list.png');

  // ── Step 4: Sales from Consignment Warehouse Modal ────────────
  console.log('Opening Sale Modal...');
  const createSaleHeaderBtn = page.locator('button:has-text("Xuất Bán Ký Gửi")').first();
  if (await createSaleHeaderBtn.isVisible()) {
    meta.createSaleHeaderBtn = await getBox(createSaleHeaderBtn);
    await createSaleHeaderBtn.click();
    await page.waitForTimeout(1200);

    const saleModal = page.locator('div.fixed.inset-0.z-50').first();
    if (await saleModal.isVisible()) {
      meta.saleModal = await getBox(saleModal.locator('> div').first());
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step4-sale-modal.png' });
  console.log('4. Saved consignment-step4-sale-modal.png');

  await closeModalSafely(page);

  // ── Step 5: Stock Count Tab (Kiểm Kê Kho Ký Gửi) ──────────────
  console.log('Navigating to Stock Count tab...');
  const stockCountTab = page.locator('button[role="tab"]:has-text("Kiểm Kê Kho Ký Gửi")').first();
  if (await stockCountTab.isVisible()) {
    await stockCountTab.click();
    await page.waitForTimeout(1500);
    meta.stockCountTab = await getBox(stockCountTab);
  }

  const stockCountCard = page.locator('div.grid.grid-cols-1 > div, div.space-y-4').first();
  if (await stockCountCard.isVisible()) {
    meta.stockCountCard = await getBox(stockCountCard);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step5-count-sheet.png' });
  console.log('5. Saved consignment-step5-count-sheet.png');

  // ── Step 6: Stock Map Tab (Bản Đồ Tồn Ký Gửi) ─────────────────
  console.log('Navigating to Stock Map tab...');
  const stockMapTab = page.locator('button[role="tab"]:has-text("Bản Đồ Tồn Ký Gửi")').first();
  if (await stockMapTab.isVisible()) {
    await stockMapTab.click();
    await page.waitForTimeout(1500);
    meta.stockMapTab = await getBox(stockMapTab);
  }

  const stockMapContent = page.locator('div.space-y-6, div.space-y-4').first();
  if (await stockMapContent.isVisible()) {
    meta.stockMapContent = await getBox(stockMapContent);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/consignment-step6-stock-map.png' });
  console.log('6. Saved consignment-step6-stock-map.png');

  fs.writeFileSync('d:/Lyruou/remotion-studio/public/consignment-steps-meta.json', JSON.stringify(meta, null, 2), 'utf-8');
  console.log('Saved consignment-steps-meta.json');

  await browser.close();
  console.log('Consignment capture completed successfully!');
}

main().catch(err => {
  console.error('Error during screen capture:', err);
  process.exit(1);
});
