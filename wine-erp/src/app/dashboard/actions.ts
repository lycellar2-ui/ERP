'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns'
import { revalidatePath } from 'next/cache'

export type DateRange = 'month' | 'quarter' | 'year'

// ─── Dashboard aggregate data ─────────────────────────────
export async function getDashboardStats(range: DateRange = 'month') {
    return cached(`dashboard:stats:${range}`, async () => {
        const now = new Date()

        const { from, to } = range === 'month'
            ? { from: startOfMonth(now), to: endOfMonth(now) }
            : range === 'quarter'
                ? { from: startOfQuarter(now), to: endOfQuarter(now) }
                : { from: startOfYear(now), to: endOfYear(now) }

        const prevStart = subMonths(from, 1)
        const prevEnd = subMonths(from, 0)

        const [
            currentRevenue,
            prevRevenue,
            stockAgg,
            pendingApprovals,
            inTransitShipments,
            pendingSOs,
            monthOrders,
        ] = await Promise.all([
            prisma.salesOrder.aggregate({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: from, lte: to },
                },
                _sum: { totalAmount: true },
            }),
            prisma.salesOrder.aggregate({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: prevStart, lte: prevEnd },
                },
                _sum: { totalAmount: true },
            }),
            prisma.stockLot.findMany({
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: { qtyAvailable: true, unitLandedCost: true },
            }),
            prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
            prisma.shipment.findMany({
                where: { status: { in: ['BOOKED', 'ON_VESSEL', 'ARRIVED_PORT'] } },
                select: {
                    id: true, billOfLading: true, eta: true,
                    cifAmount: true, cifCurrency: true, status: true,
                    vesselName: true,
                },
                orderBy: { eta: 'asc' },
                take: 5,
            }),
            prisma.salesOrder.findMany({
                where: { status: { in: ['PENDING_APPROVAL', 'DRAFT'] } },
                select: {
                    id: true, soNo: true, totalAmount: true, status: true,
                    customer: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 8,
            }),
            prisma.salesOrder.count({
                where: { createdAt: { gte: from, lte: to } },
            }),
        ])

        const revenue = Number(currentRevenue._sum.totalAmount ?? 0)
        const prevRev = Number(prevRevenue._sum.totalAmount ?? 0)
        const revenueGrowth = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : 0

        const stockTotalValue = stockAgg.reduce(
            (sum, lot) => sum + Number(lot.qtyAvailable) * Number(lot.unitLandedCost), 0
        )
        const stockQty = stockAgg.reduce((sum, lot) => sum + Number(lot.qtyAvailable), 0)

        return {
            revenue,
            revenueGrowth,
            stockTotalValue,
            stockQty,
            pendingApprovals,
            monthOrders,
            inTransitShipments: inTransitShipments.map(s => ({
                id: s.id,
                billOfLading: s.billOfLading,
                eta: s.eta?.toISOString() ?? null,
                cifAmount: Number(s.cifAmount),
                cifCurrency: s.cifCurrency,
                status: s.status,
                vesselName: s.vesselName,
            })),
            pendingSOs: pendingSOs.map(so => ({
                id: so.id,
                soNo: so.soNo,
                amount: Number(so.totalAmount),
                customerName: so.customer?.name ?? 'Khách Lẻ',
                status: so.status,
            })),
        }
    }, 30_000) // Cache 30s
}

// ─── Monthly revenue chart (last 6 months) ───────────────
export async function getMonthlyRevenue() {
    return cached('dashboard:monthly-revenue', async () => {
        const now = new Date()
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(now, 5 - i)
            return {
                from: startOfMonth(d),
                to: endOfMonth(d),
                label: d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
            }
        })

        const results = await Promise.all(
            months.map(m =>
                prisma.salesOrder.aggregate({
                    where: {
                        status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                        createdAt: { gte: m.from, lte: m.to },
                    },
                    _sum: { totalAmount: true },
                }).then(r => ({
                    label: m.label,
                    revenue: Number(r._sum.totalAmount ?? 0),
                }))
            )
        )

        return results
    }, 60_000) // Cache 60s — chart data changes slowly
}

// ─── Approve/Reject SO (quick action from dashboard) ──────
export async function approveSO(id: string) {
    await prisma.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
    })
    revalidateCache('dashboard')
}

export async function rejectSO(id: string) {
    await prisma.salesOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
    })
    revalidateCache('dashboard')
    revalidatePath('/dashboard')
}

// ─── Pending Approval Requests (Approval Engine) ──────────
export async function getPendingApprovalDetails() {
    return cached('dashboard:approvals', async () => {
        const requests = await prisma.approvalRequest.findMany({
            where: { status: 'PENDING' },
            include: {
                template: { select: { name: true, docType: true } },
                requester: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        })

        return requests.map(r => ({
            id: r.id,
            docType: r.docType,
            docId: r.docId,
            templateName: r.template.name,
            requestedBy: r.requester.name,
            currentStep: r.currentStep,
            createdAt: r.createdAt,
        }))
    }, 15_000) // 15s — approvals need fresher data
}

// ─── Slow-moving / Dead stock alert ──────────────────────
export async function getSlowMovingStock() {
    return cached('dashboard:slow-stock', async () => {
        const now = new Date()
        const d90 = new Date(now.getTime() - 90 * 86400000)
        const d180 = new Date(now.getTime() - 180 * 86400000)

        // Get all products with available stock
        const products = await prisma.product.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
            include: {
                stockLots: {
                    where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                    select: { qtyAvailable: true, unitLandedCost: true },
                },
            },
        })

        // Get last sales date per product
        const soLines = await prisma.salesOrderLine.groupBy({
            by: ['productId'],
            _max: { soId: true },
        })

        const lastSaleMap = new Map<string, Date>()
        for (const sol of soLines) {
            if (sol._max.soId) {
                const so = await prisma.salesOrder.findUnique({
                    where: { id: sol._max.soId },
                    select: { createdAt: true },
                })
                if (so) lastSaleMap.set(sol.productId, so.createdAt)
            }
        }

        const alerts: {
            productId: string
            skuCode: string
            productName: string
            qtyAvailable: number
            stockValue: number
            lastSaleDate: Date | null
            daysSinceLastSale: number | null
            severity: 'slow' | 'dead'
        }[] = []

        for (const p of products) {
            const totalQty = p.stockLots.reduce((s: number, l: any) => s + Number(l.qtyAvailable), 0)
            if (totalQty === 0) continue

            const stockValue = p.stockLots.reduce(
                (s: number, l: any) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0
            )

            const lastSale = lastSaleMap.get(p.id)
            const daysSinceLastSale = lastSale
                ? Math.floor((now.getTime() - lastSale.getTime()) / 86400000)
                : null

            // Dead: no sale in 180+ days or never sold
            if (!lastSale || lastSale < d180) {
                alerts.push({
                    productId: p.id,
                    skuCode: p.skuCode,
                    productName: p.productName,
                    qtyAvailable: totalQty,
                    stockValue,
                    lastSaleDate: lastSale ?? null,
                    daysSinceLastSale,
                    severity: 'dead',
                })
            }
            // Slow: no sale in 90-180 days
            else if (lastSale < d90) {
                alerts.push({
                    productId: p.id,
                    skuCode: p.skuCode,
                    productName: p.productName,
                    qtyAvailable: totalQty,
                    stockValue,
                    lastSaleDate: lastSale,
                    daysSinceLastSale,
                    severity: 'slow',
                })
            }
        }

        // Sort by severity then stock value
        alerts.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'dead' ? -1 : 1
            return b.stockValue - a.stockValue
        })

        return alerts
    }, 120_000) // 2min — slow stock changes rarely
}

// ─── P&L Summary for Dashboard ───────────────────────────
export async function getPLSummary() {
    return cached('dashboard:pl-summary', async () => {
        const now = new Date()
        const from = startOfMonth(now)
        const to = endOfMonth(now)

        // Sum journal lines grouped by account prefix for current month
        const lines = await prisma.journalLine.findMany({
            where: {
                entry: {
                    postedAt: { gte: from, lte: to },
                },
            },
            select: { account: true, debit: true, credit: true },
        })

        let revenue = 0    // TK 511 = Revenue
        let cogs = 0       // TK 632 = COGS
        let expenses = 0   // TK 641, 642, 635, 811

        for (const l of lines) {
            const acc = l.account.split(' - ')[0]?.trim() ?? l.account
            const debit = Number(l.debit)
            const credit = Number(l.credit)

            if (acc.startsWith('511')) {
                revenue += credit - debit // Revenue is Credit-side
            } else if (acc.startsWith('632')) {
                cogs += debit - credit    // COGS is Debit-side
            } else if (acc.startsWith('641') || acc.startsWith('642') || acc.startsWith('635') || acc.startsWith('811')) {
                expenses += debit - credit // Expenses are Debit-side
            }
        }

        const grossProfit = revenue - cogs
        const netProfit = grossProfit - expenses
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

        return { revenue, cogs, grossProfit, netProfit, expenses, grossMargin }
    }, 60_000) // 60s
}

// ─── Cash Position for Dashboard ─────────────────────────
export async function getCashPosition() {
    return cached('dashboard:cash-position', async () => {
        const now = new Date()
        const from = startOfMonth(now)
        const to = endOfMonth(now)

        const [arPayments, apPayments, approvedExpenses, totalAR, totalAP] = await Promise.all([
            // AR Payments received this month (cash in)
            prisma.aRPayment.aggregate({
                where: { paidAt: { gte: from, lte: to } },
                _sum: { amount: true },
            }),

            // AP Payments made this month (cash out)
            prisma.aPPayment.aggregate({
                where: { paidAt: { gte: from, lte: to } },
                _sum: { amount: true },
            }),

            // Expenses approved this month (cash out)
            prisma.expense.aggregate({
                where: {
                    status: 'APPROVED',
                    createdAt: { gte: from, lte: to },
                },
                _sum: { amount: true },
            }),

            // Total outstanding AR (unpaid, partially paid)
            prisma.aRInvoice.aggregate({
                where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
                _sum: { totalAmount: true },
            }),

            // Total outstanding AP (unpaid, partially paid)
            prisma.aPInvoice.aggregate({
                where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
                _sum: { amount: true },
            }),
        ])

        const cashIn = Number(arPayments._sum.amount ?? 0)
        const cashOutAP = Number(apPayments._sum.amount ?? 0)
        const cashOutExpenses = Number(approvedExpenses._sum.amount ?? 0)
        const cashOut = cashOutAP + cashOutExpenses
        const netCashFlow = cashIn - cashOut
        const arOutstanding = Number(totalAR._sum.totalAmount ?? 0)
        const apOutstanding = Number(totalAP._sum.amount ?? 0)

        return {
            cashIn,
            cashOutAP,
            cashOutExpenses,
            cashOut,
            netCashFlow,
            arOutstanding,
            apOutstanding,
        }
    }, 60_000) // 60s
}

// ─── AR Aging Chart for Dashboard ────────────────────────
export async function getARAgingChart() {
    return cached('dashboard:ar-aging', async () => {
        const now = new Date()

        const invoices = await prisma.aRInvoice.findMany({
            where: {
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
            },
            select: {
                totalAmount: true,
                dueDate: true,
                status: true,
            },
        })

        // Aggregate paid amounts per invoice to calculate remaining
        const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }

        for (const inv of invoices) {
            const amount = Number(inv.totalAmount)
            const daysPast = Math.floor(
                (now.getTime() - new Date(inv.dueDate).getTime()) / 86400000
            )

            if (daysPast <= 0) {
                buckets.current += amount     // Not yet due
            } else if (daysPast <= 30) {
                buckets.d30 += amount         // 1-30 days overdue
            } else if (daysPast <= 60) {
                buckets.d60 += amount         // 31-60 days overdue
            } else if (daysPast <= 90) {
                buckets.d90 += amount         // 61-90 days overdue
            } else {
                buckets.d90plus += amount     // >90 days overdue
            }
        }

        return {
            invoiceCount: invoices.length,
            totalOutstanding: Object.values(buckets).reduce((a, b) => a + b, 0),
            buckets: [
                { label: 'Chưa đến hạn', amount: buckets.current, color: '#5BA88A' },
                { label: '1-30 ngày', amount: buckets.d30, color: '#87CBB9' },
                { label: '31-60 ngày', amount: buckets.d60, color: '#D4A853' },
                { label: '61-90 ngày', amount: buckets.d90, color: '#E05252' },
                { label: '>90 ngày', amount: buckets.d90plus, color: '#8B1A2E' },
            ],
        }
    }, 60_000) // 60s
}

// ── Export Dashboard Data to Excel ─────────────────
export async function exportDashboardExcel(): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const [stats, monthlyRevenue, plSummary, cashPosition, arAging] = await Promise.all([
        getDashboardStats('month'),
        getMonthlyRevenue(),
        getPLSummary(),
        getCashPosition(),
        getARAgingChart(),
    ])

    // Sheet 1: KPI Summary
    const kpiRows = [
        { metric: 'Doanh Thu Tháng', value: stats.revenue, unit: 'VND' },
        { metric: 'Số Đơn Hàng', value: stats.monthOrders, unit: '' },
        { metric: 'Tồn Kho (chai)', value: stats.stockQty, unit: 'chai' },
        { metric: 'Tổng Giá Trị Tồn Kho', value: stats.stockTotalValue, unit: 'VND' },
        { metric: 'Công Nợ Phải Thu', value: arAging.totalOutstanding, unit: 'VND' },
        { metric: 'Chờ Duyệt', value: stats.pendingApprovals, unit: '' },
        { metric: 'Lãi Gộp (P&L)', value: plSummary.grossProfit, unit: 'VND' },
        { metric: 'Lãi Ròng (P&L)', value: plSummary.netProfit, unit: 'VND' },
        { metric: 'Net Cash Flow', value: cashPosition.netCashFlow, unit: 'VND' },
    ]

    const buffer = await generateExcelBuffer({
        sheetName: 'KPI Summary',
        title: `CEO Dashboard — ${new Date().toLocaleDateString('vi-VN')}`,
        columns: [
            { header: 'Chỉ số', key: 'metric', width: 30 },
            { header: 'Giá trị', key: 'value', width: 20, numFmt: '#,##0' },
            { header: 'Đơn vị', key: 'unit', width: 10 },
        ],
        rows: kpiRows,
    })

    return Buffer.from(buffer).toString('base64')
}

// ─── Cost Structure Waterfall for Dashboard ──────────────
export type WaterfallBar = {
    label: string
    value: number
    type: 'total' | 'positive' | 'negative'
    color: string
    pct: number // % of revenue
}

export async function getCostWaterfall() {
    return cached('dashboard:cost-waterfall', async () => {
        const now = new Date()
        const from = startOfMonth(now)
        const to = endOfMonth(now)

        const lines = await prisma.journalLine.findMany({
            where: { entry: { postedAt: { gte: from, lte: to } } },
            select: { account: true, debit: true, credit: true },
        })

        let revenue = 0
        let cogs = 0
        let sellingExp = 0   // TK 641
        let adminExp = 0     // TK 642
        let financialExp = 0 // TK 635
        let otherExp = 0     // TK 811

        for (const l of lines) {
            const acc = l.account.split(' - ')[0]?.trim() ?? l.account
            const debit = Number(l.debit)
            const credit = Number(l.credit)

            if (acc.startsWith('511')) revenue += credit - debit
            else if (acc.startsWith('632')) cogs += debit - credit
            else if (acc.startsWith('641')) sellingExp += debit - credit
            else if (acc.startsWith('642')) adminExp += debit - credit
            else if (acc.startsWith('635')) financialExp += debit - credit
            else if (acc.startsWith('811')) otherExp += debit - credit
        }

        const grossProfit = revenue - cogs
        const totalExpenses = sellingExp + adminExp + financialExp + otherExp
        const netProfit = grossProfit - totalExpenses

        const pct = (v: number) => revenue > 0 ? Math.round((v / revenue) * 100) : 0

        const bars: WaterfallBar[] = [
            { label: 'Doanh Thu', value: revenue, type: 'total', color: '#5BA88A', pct: 100 },
            { label: 'Giá Vốn (COGS)', value: -cogs, type: 'negative', color: '#E05252', pct: pct(cogs) },
            { label: 'Lãi Gộp', value: grossProfit, type: 'total', color: '#87CBB9', pct: pct(grossProfit) },
            { label: 'CP Bán Hàng (641)', value: -sellingExp, type: 'negative', color: '#D4A853', pct: pct(sellingExp) },
            { label: 'CP Quản Lý (642)', value: -adminExp, type: 'negative', color: '#C45A2A', pct: pct(adminExp) },
            { label: 'CP Tài Chính (635)', value: -financialExp, type: 'negative', color: '#4A8FAB', pct: pct(financialExp) },
            { label: 'CP Khác (811)', value: -otherExp, type: 'negative', color: '#8B1A2E', pct: pct(otherExp) },
            { label: 'Lãi Ròng', value: netProfit, type: 'total', color: netProfit >= 0 ? '#5BA88A' : '#8B1A2E', pct: pct(netProfit) },
        ]

        return { bars, revenue, cogs, grossProfit, totalExpenses, netProfit }
    }, 60_000)
}

// ─── Revenue YoY Comparison (12 months) ──────────────
export async function getRevenueYoY() {
    return cached('dashboard:revenue-yoy', async () => {
        const now = new Date()
        const thisYear = now.getFullYear()
        const lastYear = thisYear - 1

        const fetchYear = async (year: number) => {
            const results = await Promise.all(
                Array.from({ length: 12 }, (_, i) => {
                    const m = new Date(year, i, 1)
                    return prisma.salesOrder.aggregate({
                        where: {
                            status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                            createdAt: { gte: startOfMonth(m), lte: endOfMonth(m) },
                        },
                        _sum: { totalAmount: true },
                    }).then(r => ({
                        month: i + 1,
                        label: `T${i + 1}`,
                        revenue: Number(r._sum.totalAmount ?? 0),
                    }))
                })
            )
            return results
        }

        const [current, previous] = await Promise.all([
            fetchYear(thisYear),
            fetchYear(lastYear),
        ])

        const totalCurrent = current.reduce((s, m) => s + m.revenue, 0)
        const totalPrevious = previous.reduce((s, m) => s + m.revenue, 0)
        const yoyGrowth = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0

        return {
            thisYear,
            lastYear,
            current,
            previous,
            totalCurrent,
            totalPrevious,
            yoyGrowth,
        }
    }, 120_000) // 2min
}

// ═══════════════════════════════════════════════════
// #10 — ROLE-BASED DASHBOARD CONFIG
// ═══════════════════════════════════════════════════

export type DashboardSection =
    | 'kpi_cards' | 'revenue_chart' | 'pending_approvals' | 'pl_summary'
    | 'cash_position' | 'ar_aging' | 'cost_waterfall' | 'revenue_yoy'
    | 'shipment_tracker' | 'kpi_targets' | 'stock_alerts' | 'recent_orders'
    | 'my_sales' | 'warehouse_summary'

export type DashboardConfig = {
    greeting: string
    sections: DashboardSection[]
    quickLinks: { label: string; href: string; icon: string }[]
}

const ROLE_DASHBOARD: Record<string, DashboardConfig> = {
    CEO: {
        greeting: 'Tổng Quan Kinh Doanh',
        sections: [
            'kpi_cards', 'revenue_chart', 'pl_summary', 'cash_position',
            'ar_aging', 'cost_waterfall', 'revenue_yoy', 'pending_approvals',
            'shipment_tracker', 'kpi_targets',
        ],
        quickLinks: [
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
            { label: 'Phê duyệt', href: '/dashboard/settings?tab=approvals', icon: 'ClipboardCheck' },
            { label: 'Tài chính', href: '/dashboard/finance', icon: 'DollarSign' },
        ],
    },
    SALES_MGR: {
        greeting: 'Quản Lý Bán Hàng',
        sections: [
            'kpi_cards', 'revenue_chart', 'recent_orders', 'my_sales',
            'ar_aging', 'kpi_targets', 'pending_approvals',
        ],
        quickLinks: [
            { label: 'Đơn hàng', href: '/dashboard/sales', icon: 'Package' },
            { label: 'Khách hàng', href: '/dashboard/crm', icon: 'Users' },
            { label: 'Pipeline', href: '/dashboard/pipeline', icon: 'Target' },
        ],
    },
    SALES_REP: {
        greeting: 'Bán Hàng',
        sections: ['kpi_cards', 'my_sales', 'recent_orders', 'kpi_targets'],
        quickLinks: [
            { label: 'Tạo đơn mới', href: '/dashboard/sales', icon: 'Plus' },
            { label: 'Khách hàng', href: '/dashboard/crm', icon: 'Users' },
            { label: 'Báo giá', href: '/dashboard/quotations', icon: 'FileText' },
        ],
    },
    KE_TOAN: {
        greeting: 'Kế Toán — Tài Chính',
        sections: [
            'kpi_cards', 'pl_summary', 'cash_position', 'ar_aging',
            'pending_approvals', 'cost_waterfall',
        ],
        quickLinks: [
            { label: 'Công nợ', href: '/dashboard/finance', icon: 'DollarSign' },
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
            { label: 'Sổ cái', href: '/dashboard/finance?tab=journal', icon: 'BookOpen' },
        ],
    },
    THU_KHO: {
        greeting: 'Quản Lý Kho',
        sections: ['kpi_cards', 'warehouse_summary', 'stock_alerts', 'shipment_tracker'],
        quickLinks: [
            { label: 'Tồn kho', href: '/dashboard/warehouse', icon: 'Package' },
            { label: 'Nhập kho', href: '/dashboard/warehouse?tab=gr', icon: 'ArrowDownLeft' },
            { label: 'Xuất kho', href: '/dashboard/warehouse?tab=do', icon: 'ArrowUpRight' },
        ],
    },
    THU_MUA: {
        greeting: 'Mua Hàng — Nhập Khẩu',
        sections: ['kpi_cards', 'shipment_tracker', 'pending_approvals', 'stock_alerts'],
        quickLinks: [
            { label: 'Đơn mua', href: '/dashboard/procurement', icon: 'Ship' },
            { label: 'NCC', href: '/dashboard/suppliers', icon: 'Users' },
            { label: 'Lô hàng', href: '/dashboard/procurement?tab=shipments', icon: 'Package' },
        ],
    },
}

export async function getDashboardConfig(roles: string[]): Promise<DashboardConfig> {
    // Priority: CEO > KE_TOAN > SALES_MGR > THU_KHO > THU_MUA > SALES_REP
    const priority = ['CEO', 'KE_TOAN', 'SALES_MGR', 'THU_KHO', 'THU_MUA', 'SALES_REP']

    for (const role of priority) {
        if (roles.includes(role)) {
            return ROLE_DASHBOARD[role]
        }
    }

    // Default fallback — minimal dashboard
    return {
        greeting: 'Dashboard',
        sections: ['kpi_cards', 'recent_orders'],
        quickLinks: [],
    }
}

// ── Sales Rep's own sales data ────────────────────
export async function getMySales(salesRepId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const orders = await prisma.salesOrder.findMany({
        where: {
            salesRepId,
            createdAt: { gte: startOfMonth },
            status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
    })

    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0)

    return {
        orderCount: orders.length,
        totalRevenue,
        orders: orders.map(o => ({
            soNo: o.soNo,
            customerName: o.customer.name,
            amount: Number(o.totalAmount),
            status: o.status,
            date: o.createdAt,
        })),
    }
}

// ── Warehouse quick summary for THU_KHO ───────────
export async function getWarehouseDashboard() {
    const [totalQty, lowStock, quarantine, pendingGR, pendingDO] = await Promise.all([
        prisma.stockLot.aggregate({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
        }),
        prisma.stockLot.groupBy({
            by: ['productId'],
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
            having: { qtyAvailable: { _sum: { lt: 12 } } },
        }),
        prisma.stockLot.count({
            where: { status: 'QUARANTINE', qtyAvailable: { gt: 0 } },
        }),
        prisma.goodsReceipt.count({ where: { status: 'DRAFT' } }),
        prisma.deliveryOrder.count({ where: { status: 'DRAFT' } }),
    ])

    return {
        totalBottles: Number(totalQty._sum.qtyAvailable ?? 0),
        lowStockSKUs: lowStock.length,
        quarantinedLots: quarantine,
        pendingGoodsReceipts: pendingGR,
        pendingDeliveryOrders: pendingDO,
    }
}

// ═══════════════════════════════════════════════════
// #9 — SUPABASE REALTIME CONFIG
// ═══════════════════════════════════════════════════

export type RealtimeChannelConfig = {
    channel: string
    table: string
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    filter?: string
}

export async function getRealtimeChannels(roles: string[]): Promise<RealtimeChannelConfig[]> {
    const channels: RealtimeChannelConfig[] = []

    // Everyone gets approval notifications
    channels.push({
        channel: 'approvals',
        table: 'ApprovalRequest',
        event: '*',
    })

    // CEO/KE_TOAN get AR invoice updates
    if (roles.some(r => ['CEO', 'KE_TOAN'].includes(r))) {
        channels.push({
            channel: 'ar-invoices',
            table: 'ARInvoice',
            event: '*',
        })
    }

    // THU_KHO gets stock lot changes
    if (roles.some(r => ['CEO', 'THU_KHO'].includes(r))) {
        channels.push({
            channel: 'stock-changes',
            table: 'StockLot',
            event: '*',
        })
        channels.push({
            channel: 'goods-receipts',
            table: 'GoodsReceipt',
            event: 'INSERT',
        })
    }

    // SALES gets SO updates
    if (roles.some(r => ['CEO', 'SALES_MGR', 'SALES_REP'].includes(r))) {
        channels.push({
            channel: 'sales-orders',
            table: 'SalesOrder',
            event: '*',
        })
    }

    // THU_MUA gets shipment updates
    if (roles.some(r => ['CEO', 'THU_MUA'].includes(r))) {
        channels.push({
            channel: 'shipments',
            table: 'Shipment',
            event: '*',
        })
    }

    return channels
}
