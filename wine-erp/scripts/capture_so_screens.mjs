import { chromium } from '@playwright/test';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to http://localhost:3000/dashboard/sales ...');
  await page.goto('http://localhost:3000/dashboard/sales', { waitUntil: 'networkidle', timeout: 35000 });

  // 1. Capture Main Sales List Page
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-1-sales-list.png' });
  console.log('1. Captured real-1-sales-list.png');

  // Look for Create Order button
  const createBtn = page.locator('button:has-text("Tạo Đơn Hàng")').first();
  if (await createBtn.isVisible()) {
    console.log('Found "+ Tạo Đơn Hàng" button, clicking...');
    await createBtn.click();
    
    // Wait for drawer loading spinner to detach
    console.log('Waiting for drawer data to load...');
    await page.waitForTimeout(4000);

    // 2. Capture Drawer with Customer & Form loaded
    await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-2-drawer-form.png' });
    console.log('2. Captured real-2-drawer-form.png');

    // Click customer input
    const custSearch = page.locator('input[placeholder*="khách"], input[placeholder*="Tìm kiếm"]').last();
    if (await custSearch.isVisible()) {
      console.log('Found customer search input, clicking...');
      await custSearch.click();
      await page.waitForTimeout(600);
      await custSearch.fill('Fabrik');
      await page.waitForTimeout(1200);

      // 3. Capture search dropdown
      await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-3-customer-dropdown.png' });
      console.log('3. Captured real-3-customer-dropdown.png');

      // Click customer item
      const custOption = page.locator('text=HR10071-01').first();
      if (await custOption.isVisible()) {
        console.log('Clicking HR10071-01 with force...');
        await custOption.click({ force: true });
        await page.waitForTimeout(1500);

        // 3b. Customer selected view
        await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-3b-customer-selected.png' });
        console.log('3b. Captured real-3b-customer-selected.png');
      }
    }

    // Click "+ Thêm dòng" to add product
    const addLineBtn = page.locator('button:has-text("Thêm dòng")').first();
    if (await addLineBtn.isVisible()) {
      console.log('Clicking "+ Thêm dòng" with force...');
      await addLineBtn.click({ force: true });
      await page.waitForTimeout(1500);

      // 4. Capture product line added
      await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-4-product-added.png' });
      console.log('4. Captured real-4-product-added.png');
    }

    // Scroll to bottom for summary & submit button
    await page.evaluate(() => {
      const allDivs = document.querySelectorAll('div');
      for (const d of allDivs) {
        if (d.scrollHeight > d.clientHeight && d.clientHeight > 400) {
          d.scrollTop = d.scrollHeight;
        }
      }
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'd:/Lyruou/remotion-studio/public/real-5-summary-bottom.png' });
    console.log('5. Captured real-5-summary-bottom.png');
  }

  await browser.close();
  console.log('ALL REAL SCREENSHOTS COMPLETED!');
}

main().catch(console.error);
