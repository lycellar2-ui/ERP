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

  // ── Step 1: Channel Price Lists Table ─────────────────────────
  console.log('Navigating to http://localhost:3000/dashboard/price-list ...');
  await page.goto('http://localhost:3000/dashboard/price-list', { timeout: 60000 });
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

  const priceTable = page.locator('table').first();
  await priceTable.waitFor({ state: 'visible', timeout: 10000 });
  meta.priceTable = await getBox(priceTable);

  const firstListRow = page.locator('table tbody tr').first();
  if (await firstListRow.isVisible()) {
    meta.firstListRow = await getBox(firstListRow);
  }

  const mappingBtn = page.locator('button:has-text("Cấu hình Kênh"), button:has-text("Ánh xạ kênh")').first();
  if (await mappingBtn.isVisible()) {
    meta.mappingBtn = await getBox(mappingBtn);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/price-channel-step1-lists.png' });
  console.log('1. Saved price-channel-step1-lists.png');

  // ── Step 2: Open Price List Detail Drawer ──────────────────────
  console.log('Opening Price List detail drawer...');
  if (await firstListRow.isVisible()) {
    await firstListRow.click();
    await page.waitForTimeout(1500);

    const drawer = page.locator('div.fixed.inset-0.z-50 > div, div[role="dialog"]').first();
    if (await drawer.isVisible()) {
      meta.detailDrawer = await getBox(drawer);
    }

    const drawerSearch = page.locator('input[placeholder*="Tìm"]').first();
    if (await drawerSearch.isVisible()) {
      meta.drawerSearch = await getBox(drawerSearch);
    }

    const filterSegment = page.locator('button:has-text("Đã định giá"), button:has-text("Tất cả")').first();
    if (await filterSegment.isVisible()) {
      meta.filterSegment = await getBox(filterSegment);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/price-channel-step2-detail-drawer.png' });
  console.log('2. Saved price-channel-step2-detail-drawer.png');

  // Close drawer
  await closeModalSafely(page);

  // ── Step 3: Channel Mapping Modal ─────────────────────────────
  console.log('Opening Channel Mapping Modal...');
  if (await mappingBtn.isVisible()) {
    await mappingBtn.click();
    await page.waitForTimeout(1200);

    const modal = page.locator('div.fixed.inset-0.z-50').first();
    if (await modal.isVisible()) {
      meta.mappingModal = await getBox(modal.locator('> div').first());
    }

    const saveMappingBtn = page.locator('button:has-text("Lưu Cấu Hình"), button:has-text("Lưu")').first();
    if (await saveMappingBtn.isVisible()) {
      meta.saveMappingBtn = await getBox(saveMappingBtn);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/price-channel-step3-mapping-modal.png' });
  console.log('3. Saved price-channel-step3-mapping-modal.png');

  // Close mapping modal
  await closeModalSafely(page);

  // ── Step 4: Customer Rules Tab (Giá theo Khách hàng) ──────────
  console.log('Switching to Customer Rules Tab...');
  const customerTab = page.locator('button[role="tab"]:has-text("Giá theo Khách hàng"), button:has-text("Khách hàng")').first();
  if (await customerTab.isVisible()) {
    await customerTab.click();
    await page.waitForTimeout(1500);
    meta.customerTab = await getBox(customerTab);
  }

  const custSearchInput = page.locator('input[placeholder*="Tìm"]').first();
  if (await custSearchInput.isVisible()) {
    meta.custSearchInput = await getBox(custSearchInput);
  }

  const custTable = page.locator('table').first();
  if (await custTable.isVisible()) {
    meta.custTable = await getBox(custTable);
  }

  const firstCustRow = page.locator('table tbody tr').first();
  if (await firstCustRow.isVisible()) {
    meta.firstCustRow = await getBox(firstCustRow);
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/price-channel-step4-customer-rules.png' });
  console.log('4. Saved price-channel-step4-customer-rules.png');

  // ── Step 5: Customer Special Price Detail Drawer ──────────────
  console.log('Opening Customer Special Price Drawer...');
  if (await firstCustRow.isVisible()) {
    await firstCustRow.click();
    await page.waitForTimeout(1800);

    const custDrawer = page.locator('div.fixed.inset-0.z-50 > div, div[role="dialog"]').first();
    if (await custDrawer.isVisible()) {
      meta.custDrawer = await getBox(custDrawer);
    }
  }

  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/price-channel-step5-customer-drawer.png' });
  console.log('5. Saved price-channel-step5-customer-drawer.png');

  fs.writeFileSync('d:/Lyruou/remotion-studio/public/price-channel-steps-meta.json', JSON.stringify(meta, null, 2), 'utf-8');
  console.log('Saved price-channel-steps-meta.json');

  await browser.close();
  console.log('Pricing and channel capture completed successfully!');
}

main().catch(err => {
  console.error('Error during screen capture:', err);
  process.exit(1);
});
