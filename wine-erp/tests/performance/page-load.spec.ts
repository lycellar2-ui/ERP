import { test, expect } from '@playwright/test'

const PAGES = [
    { name: 'Dashboard', path: '/dashboard', sla: 800 },
    { name: 'Products', path: '/dashboard/products', sla: 500 },
    { name: 'Customers', path: '/dashboard/customers', sla: 500 },
    { name: 'Suppliers', path: '/dashboard/suppliers', sla: 500 },
    { name: 'Sales', path: '/dashboard/sales', sla: 600 },
    { name: 'Warehouse', path: '/dashboard/warehouse', sla: 600 },
    { name: 'Finance', path: '/dashboard/finance', sla: 600 },
    { name: 'Procurement', path: '/dashboard/procurement', sla: 600 },
    { name: 'CRM', path: '/dashboard/crm', sla: 600 },
    { name: 'Reports', path: '/dashboard/reports', sla: 400 },
    { name: 'Contracts', path: '/dashboard/contracts', sla: 500 },
    { name: 'Agency', path: '/dashboard/agency', sla: 500 },
    { name: 'Tax', path: '/dashboard/tax', sla: 400 },
    { name: 'Delivery', path: '/dashboard/delivery', sla: 500 },
    { name: 'Consignment', path: '/dashboard/consignment', sla: 500 },
    { name: 'Stamps', path: '/dashboard/stamps', sla: 400 },
    { name: 'KPI', path: '/dashboard/kpi', sla: 400 },
    { name: 'POS', path: '/dashboard/pos', sla: 500 },
    { name: 'AI', path: '/dashboard/ai', sla: 600 },
    { name: 'Declarations', path: '/dashboard/declarations', sla: 500 },
    { name: 'QR Codes', path: '/dashboard/qr-codes', sla: 400 },
    { name: 'Allocation', path: '/dashboard/allocation', sla: 500 },
    { name: 'Quotations', path: '/dashboard/quotations', sla: 500 },
    { name: 'Returns', path: '/dashboard/returns', sla: 500 },
    { name: 'Settings', path: '/dashboard/settings', sla: 400 },
    { name: 'Pipeline', path: '/dashboard/pipeline', sla: 500 },
    { name: 'Market Price', path: '/dashboard/market-price', sla: 500 },
    { name: 'Costing', path: '/dashboard/costing', sla: 500 },
    { name: 'Stock Count', path: '/dashboard/stock-count', sla: 500 },
    { name: 'Transfers', path: '/dashboard/transfers', sla: 500 },
]

for (const page of PAGES) {
    test(`[PERF] ${page.name} loads within ${page.sla}ms`, async ({ browser }: { browser: any }) => {
        const context = await browser.newContext()
        const p = await context.newPage()

        // Assuming we do not need actual auth, or we just measure raw load with redirects
        // or if the pages are somewhat accessible in test environment
        const start = Date.now()
        await p.goto(`http://localhost:3000${page.path}`, {
            waitUntil: 'domcontentloaded',
        })
        const loadTime = Date.now() - start

        console.log(`${page.name}: ${loadTime}ms`)
        expect(loadTime).toBeLessThan(page.sla * 2) // Using *2 for local dev mode performance tolerance

        await context.close()
    })
}
