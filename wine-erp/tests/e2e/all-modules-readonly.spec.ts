import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test, type Browser, type Page, type Response } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100'
const STORAGE_FILE = path.join(os.tmpdir(), 'wine-erp-e2e-admin.json')

const ADMIN_CANDIDATES = [
    { email: 'lyptc@lyscellars.com', password: '123456' },
    { email: 'admin@lyscellars.com', password: '123456' },
]

const ALL_DASHBOARD_ROUTES = [
    '/dashboard',
    '/dashboard/agency',
    '/dashboard/ai',
    '/dashboard/allocation',
    '/dashboard/audit-log',
    '/dashboard/consignment',
    '/dashboard/contracts',
    '/dashboard/costing',
    '/dashboard/crm',
    '/dashboard/customers',
    '/dashboard/declarations',
    '/dashboard/delivery',
    '/dashboard/delivery/shipper',
    '/dashboard/finance',
    '/dashboard/hr',
    '/dashboard/kpi',
    '/dashboard/margin',
    '/dashboard/market-price',
    '/dashboard/media',
    '/dashboard/payment-requests',
    '/dashboard/pipeline',
    '/dashboard/pos',
    '/dashboard/pos/loyalty',
    '/dashboard/price-list',
    '/dashboard/procurement',
    '/dashboard/products',
    '/dashboard/proposals',
    '/dashboard/qr-codes',
    '/dashboard/quotations',
    '/dashboard/reconciliation',
    '/dashboard/reports',
    '/dashboard/returns',
    '/dashboard/sales',
    '/dashboard/sales/print',
    '/dashboard/sales/visits',
    '/dashboard/settings',
    '/dashboard/settings/approval-matrix',
    '/dashboard/settings/telegram',
    '/dashboard/shipments',
    '/dashboard/sop',
    '/dashboard/stamps',
    '/dashboard/stock-count',
    '/dashboard/suppliers',
    '/dashboard/transfers',
    '/dashboard/warehouse',
    '/dashboard/warehouse/print',
] as const

interface ErrorCapture {
    pageErrors: string[]
    serverErrors: string[]
    clear: () => void
}

function attachErrorWatchers(page: Page): ErrorCapture {
    const pageErrors: string[] = []
    const serverErrors: string[] = []
    const baseOrigin = new URL(BASE_URL).origin

    page.on('pageerror', err => {
        pageErrors.push(err.message || String(err))
    })

    page.on('response', (res: Response) => {
        const url = res.url()
        if (url.startsWith(baseOrigin) && res.status() >= 500) {
            serverErrors.push(`${res.status()} ${url}`)
        }
    })

    return {
        pageErrors,
        serverErrors,
        clear() {
            pageErrors.length = 0
            serverErrors.length = 0
        },
    }
}

async function assertHealthyBody(page: Page, routeLabel: string) {
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length, `${routeLabel}: body text should not be empty`).toBeGreaterThan(0)
    expect(bodyText, `${routeLabel}: client-side exception detected`).not.toContain('Application error: a client-side exception')
    expect(bodyText, `${routeLabel}: unhandled runtime error detected`).not.toContain('Unhandled Runtime Error')
    expect(bodyText, `${routeLabel}: generic crash boundary rendered`).not.toContain('Something went wrong!')
    expect(bodyText, `${routeLabel}: [object Object] rendered`).not.toContain('[object Object]')
    expect(bodyText, `${routeLabel}: standalone NaN rendered`).not.toMatch(/(?:^|\s|₫)NaN(?:\s|%|₫|$)/)
}

async function loginAs(
    browser: Browser,
    candidates: { email: string; password: string }[],
    storageOutPath?: string,
) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    let loggedIn = false
    let lastErr = ''

    try {
        for (const cred of candidates) {
            await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' })
            await page.locator('#email').fill(cred.email)
            await page.locator('#password').fill(cred.password)
            await Promise.all([
                page.waitForURL(url => url.pathname.startsWith('/dashboard'), { timeout: 20_000 }).catch(() => null),
                page.locator('button[type="submit"]').click(),
            ])

            if (new URL(page.url()).pathname.startsWith('/dashboard')) {
                await page.waitForLoadState('domcontentloaded')
                loggedIn = true
                if (storageOutPath) {
                    await context.storageState({ path: storageOutPath })
                }
                break
            }
            lastErr = await page.locator('body').innerText()
        }
    } finally {
        await context.close()
    }

    if (!loggedIn) {
        throw new Error(`Authentication failed for all candidates (${candidates.map(c => c.email).join(', ')}). Last body: ${lastErr.slice(0, 200)}`)
    }
}

test.describe('Group A — Public, Auth, Partner Portal & Unauthenticated Security Guards', () => {
    test('unauthenticated / redirects to /login and login form renders cleanly', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            const res = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
            expect(res?.status()).toBeLessThan(400)
            await expect(page).toHaveURL(/\/login/)
            await expect(page.locator('#email')).toBeVisible()
            await expect(page.locator('#password')).toBeVisible()
            await expect(page.locator('button[type="submit"]')).toBeVisible()
            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('/partner-login bypasses employee /login redirect and handles invalid login cleanly', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            const res = await page.goto(`${BASE_URL}/partner-login`, { waitUntil: 'load' })
            expect(res?.status()).toBe(200)
            await expect(page).toHaveURL(/\/partner-login$/)
            await expect(page.getByRole('heading', { name: /Partner Portal/i })).toBeVisible()

            const loginBtn = page.getByRole('button', { name: /Đăng Nhập/i })
            await page.locator('input[type="email"]').fill('e2e-invalid@example.com')
            await page.locator('input[type="password"]').fill('wrongpass123')
            await expect(loginBtn).toBeEnabled({ timeout: 5_000 })
            await loginBtn.click()

            await expect(page.getByText(/không tồn tại|không hợp lệ|invalid|lỗi/i)).toBeVisible({ timeout: 15_000 })
            await expect(page).toHaveURL(/\/partner-login$/)
            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('/kiem-ke and /kiem-ke/bien-ban render read-only without errors', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            for (const route of ['/kiem-ke', '/kiem-ke/bien-ban']) {
                errors.clear()
                const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
                expect(res?.status(), `${route} status`).toBe(200)
                await assertHealthyBody(page, route)
                expect(errors.pageErrors, `${route} pageErrors`).toEqual([])
                expect(errors.serverErrors, `${route} serverErrors`).toEqual([])
            }
        } finally {
            await context.close()
        }
    })

    test('non-existent /verify QR and quotation tokens return 404 (not 500)', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()

        try {
            const qrRes = await page.goto(`${BASE_URL}/verify/NON_EXISTENT_QR_E2E_CHECK`, { waitUntil: 'domcontentloaded' })
            expect(qrRes?.status()).toBe(404)

            const qtRes = await page.goto(`${BASE_URL}/verify/quotation/NON_EXISTENT_QT_E2E_CHECK`, { waitUntil: 'domcontentloaded' })
            expect(qtRes?.status()).toBe(404)
        } finally {
            await context.close()
        }
    })

    test('unauthenticated protected dashboard routes redirect to /login', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()

        try {
            for (const route of ['/dashboard', '/dashboard/sales', '/dashboard/finance', '/dashboard/settings']) {
                await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
                await expect(page, `${route} should redirect unauth users to /login`).toHaveURL(/\/login/)
            }
        } finally {
            await context.close()
        }
    })

    test('unauthenticated API endpoints reject access cleanly (401/403/400)', async ({ playwright }) => {
        const reqCtx = await playwright.request.newContext({ baseURL: BASE_URL })

        try {
            const protectedEndpoints = [
                '/api/ai/config',
                '/api/ai/prompts',
                '/api/ai/reports',
                '/api/export?report=sales',
                '/api/reports/stock-velocity',
                '/api/qr-print',
                '/api/cron/compliance',
            ]

            for (const ep of protectedEndpoints) {
                const res = await reqCtx.get(ep)
                expect([401, 403], `Unauthenticated GET ${ep} returned ${res.status()}`).toContain(res.status())
            }

            const r2Res = await reqCtx.get('/api/r2-file/..%2F..%2F.env')
            expect([400, 401, 403], `Unauthenticated traversal /api/r2-file returned ${r2Res.status()}`).toContain(r2Res.status())
        } finally {
            await reqCtx.dispose()
        }
    })
})

test.describe('Group B & C — Authenticated All-Modules E2E, Interactions, APIs & RBAC', () => {
    test.beforeAll(async ({ browser }) => {
        await loginAs(browser, ADMIN_CANDIDATES, STORAGE_FILE)
    })

    test.afterAll(() => {
        if (fs.existsSync(STORAGE_FILE)) {
            fs.rmSync(STORAGE_FILE, { force: true })
        }
    })

    test('Group B: all 46 /dashboard/* routes load cleanly with 0 runtime/500 errors', async ({ browser }) => {
        test.setTimeout(240_000)
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)
        const routeFailures: string[] = []

        try {
            for (const route of ALL_DASHBOARD_ROUTES) {
                errors.clear()
                try {
                    const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load' })
                    const status = res?.status() ?? 0
                    if (status >= 400) {
                        routeFailures.push(`${route}: HTTP ${status}`)
                        continue
                    }

                    const currentUrl = new URL(page.url())
                    if (currentUrl.pathname !== route) {
                        routeFailures.push(`${route}: redirected to ${currentUrl.pathname}${currentUrl.search}`)
                        continue
                    }
                    if (currentUrl.searchParams.get('error')) {
                        routeFailures.push(`${route}: error param ${currentUrl.searchParams.get('error')}`)
                        continue
                    }

                    await page.waitForTimeout(300)
                    await assertHealthyBody(page, route)
                    if (errors.pageErrors.length > 0) {
                        routeFailures.push(`${route}: pageErrors=${errors.pageErrors.join(' | ')}`)
                    }
                    if (errors.serverErrors.length > 0) {
                        routeFailures.push(`${route}: serverErrors=${errors.serverErrors.join(' | ')}`)
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    routeFailures.push(`${route}: ${msg}`)
                }
            }
            expect(routeFailures, `Failing routes:\n${routeFailures.join('\n')}`).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.1: Header VI/EN locale toggle works cleanly on /dashboard and /dashboard/sales', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
            const enBtn = page.locator('header button:text-is("EN")').first()
            const viBtn = page.locator('header button:text-is("VI")').first()

            await enBtn.click()
            await expect(page.locator('header')).toContainText(/Executive Overview|Dashboard/i)

            await page.goto(`${BASE_URL}/dashboard/sales`, { waitUntil: 'domcontentloaded' })
            await expect(page.getByRole('button', { name: /New Sales Order/i })).toBeVisible()

            await viBtn.click()
            await expect(page.getByRole('button', { name: /Tạo Đơn Hàng/i })).toBeVisible()

            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.2: /dashboard/warehouse workspace entry and tab switching work read-only', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard/warehouse`, { waitUntil: 'load' })
            await page.getByText('Sơ Đồ & Vị Trí Kho', { exact: false }).locator('visible=true').first().click()

            const tabSelect = page.locator('select:has(option[value="gr"])').locator('visible=true').first()
            await expect(tabSelect).toBeVisible()

            for (const tabKey of ['gr', 'do', 'posm', 'sample', 'map', 'inspection', 'inventory']) {
                await tabSelect.selectOption(tabKey)
                await expect(tabSelect).toHaveValue(tabKey)
                await page.waitForTimeout(200)
                await assertHealthyBody(page, `/dashboard/warehouse?tab=${tabKey}`)
            }

            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.3: /dashboard/finance tab switching across AR, AP, Aging, Journal, P&L, Balance Sheet', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard/finance`, { waitUntil: 'domcontentloaded' })
            const tabPatterns = [
                /Phải Thu \(AR\)|Receivables \(AR\)/i,
                /Phải Trả \(AP\)|Payables \(AP\)/i,
                /AR Aging/i,
                /Bút Toán GL|GL Journal/i,
                /^P&L$/i,
                /Bảng CĐKT|Balance Sheet/i,
            ]

            for (const pattern of tabPatterns) {
                const btn = page.getByRole('button', { name: pattern }).first()
                await expect(btn).toBeVisible()
                await btn.click()
                await page.waitForTimeout(250)
                await assertHealthyBody(page, `/dashboard/finance[${pattern}]`)
            }

            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.4: /dashboard/price-list StatusTabs switch cleanly read-only', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard/price-list`, { waitUntil: 'domcontentloaded' })
            const tabs = page.locator('[role="tablist"] button[role="tab"]')
            await expect(tabs).toHaveCount(2)

            await tabs.nth(1).click()
            await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
            await page.waitForTimeout(250)
            await assertHealthyBody(page, '/dashboard/price-list[customer]')

            await tabs.nth(0).click()
            await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')

            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.5: /dashboard/sop switches to SOPs tab and opens/closes SOP detail cleanly', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard/sop`, { waitUntil: 'domcontentloaded' })
            const sopTabBtn = page.getByRole('button', { name: /Quy Trình Trọng Yếu|Core Procedures/i }).first()
            await expect(sopTabBtn).toBeVisible()
            await sopTabBtn.click()
            await page.waitForTimeout(200)

            const detailBtn = page.getByRole('button', { name: /Xem chi tiết|View Details/i }).first()
            if (await detailBtn.count() > 0) {
                await detailBtn.click()
                await page.waitForTimeout(200)
                await page.keyboard.press('Escape')
                const closeBtn = page.locator('button[aria-label="Đóng"], button:has-text("Đóng"), button:has-text("Close")').first()
                if (await closeBtn.isVisible().catch(() => false)) {
                    await closeBtn.click()
                }
            }

            await assertHealthyBody(page, '/dashboard/sop')
            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.6: /dashboard/sales opens Create Order drawer and closes without submitting', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })
        const page = await context.newPage()
        const errors = attachErrorWatchers(page)

        try {
            await page.goto(`${BASE_URL}/dashboard/sales`, { waitUntil: 'domcontentloaded' })
            const createBtn = page.getByRole('button', { name: /Tạo Đơn Hàng|New Sales Order/i }).first()
            await expect(createBtn).toBeVisible()
            await createBtn.click()

            const dialog = page.locator('[role="dialog"]').first()
            await expect(dialog).toBeVisible({ timeout: 10_000 })

            await page.keyboard.press('Escape')
            await expect(dialog).toBeHidden({ timeout: 5_000 })

            expect(errors.pageErrors).toEqual([])
            expect(errors.serverErrors).toEqual([])
        } finally {
            await context.close()
        }
    })

    test('Group C.7: authenticated read-only API endpoints respond with expected payloads', async ({ browser }) => {
        const context = await browser.newContext({
            storageState: STORAGE_FILE,
            viewport: { width: 1440, height: 900 },
        })

        try {
            const aiStatusRes = await context.request.get(`${BASE_URL}/api/ai/status`)
            expect(aiStatusRes.status()).toBe(200)
            const aiStatusJson = await aiStatusRes.json()
            expect(typeof aiStatusJson.enabled).toBe('boolean')

            const velocityRes = await context.request.get(`${BASE_URL}/api/reports/stock-velocity?cycleMonths=6`)
            expect(velocityRes.status()).toBe(200)
            const velocityJson = await velocityRes.json()
            expect(velocityJson.success).toBe(true)

            const exportRes = await context.request.get(`${BASE_URL}/api/export?report=sales`)
            expect(exportRes.status()).toBe(200)
            const contentType = exportRes.headers()['content-type'] || ''
            expect(contentType).toMatch(/spreadsheetml|excel|octet-stream/i)
        } finally {
            await context.close()
        }
    })

    test('Group C.8: RBAC isolation restricts thukho role to /dashboard/warehouse and blocks /settings & /hr', async ({ browser }) => {
        const tmpThuKhoStorage = path.join(os.tmpdir(), 'wine-erp-e2e-thukho.json')
        try {
            await loginAs(browser, [{ email: 'thukho@lyscellars.com', password: '123456' }], tmpThuKhoStorage)

            const context = await browser.newContext({
                storageState: tmpThuKhoStorage,
                viewport: { width: 1440, height: 900 },
            })
            const page = await context.newPage()
            const errors = attachErrorWatchers(page)

            try {
                const whRes = await page.goto(`${BASE_URL}/dashboard/warehouse`, { waitUntil: 'domcontentloaded' })
                expect(whRes?.status()).toBeLessThan(400)
                await expect(page).toHaveURL(/\/dashboard\/warehouse$/)
                await assertHealthyBody(page, 'thukho /dashboard/warehouse')

                for (const restrictedRoute of ['/dashboard/settings', '/dashboard/hr']) {
                    await page.goto(`${BASE_URL}${restrictedRoute}`, { waitUntil: 'domcontentloaded' })
                    await expect(page, `${restrictedRoute} should block thukho`).toHaveURL(/\/dashboard\?error=unauthorized/)
                }

                expect(errors.pageErrors).toEqual([])
                expect(errors.serverErrors).toEqual([])
            } finally {
                await context.close()
            }
        } finally {
            if (fs.existsSync(tmpThuKhoStorage)) {
                fs.rmSync(tmpThuKhoStorage, { force: true })
            }
        }
    })
})
