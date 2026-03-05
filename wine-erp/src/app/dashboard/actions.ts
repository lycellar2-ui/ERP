'use server'

import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns'
import { revalidatePath } from 'next/cache'

export type DateRange = 'month' | 'quarter' | 'year'

// ─── Dashboard aggregate data ─────────────────────────────
export async function getDashboardStats(range: DateRange = 'month') {
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
        // Current period revenue
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
            },
            _sum: { totalAmount: true },
        }),

        // Previous period revenue (for growth %)
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: prevStart, lte: prevEnd },
            },
            _sum: { totalAmount: true },
        }),

        // Stock valuation: SUM(qty * unitLandedCost)
        prisma.stockLot.findMany({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            select: { qtyAvailable: true, unitLandedCost: true },
        }),

        // Pending CEO approvals
        prisma.approvalRequest.count({ where: { status: 'PENDING' } }),

        // In-transit shipments
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

        // Pending SOs for CEO approval queue
        prisma.salesOrder.findMany({
            where: { status: { in: ['PENDING_APPROVAL', 'DRAFT'] } },
            select: {
                id: true, soNo: true, totalAmount: true, status: true,
                customer: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
        }),

        // Order count this period
        prisma.salesOrder.count({
            where: { createdAt: { gte: from, lte: to } },
        }),
    ])

    const revenue = Number(currentRevenue._sum.totalAmount ?? 0)
    const prevRev = Number(prevRevenue._sum.totalAmount ?? 0)
    const revenueGrowth = prevRev > 0 ? ((revenue - prevRev) / prevRev) * 100 : 0

    // Calculate stock value from raw lots
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
}

// ─── Monthly revenue chart (last 6 months) ───────────────
export async function getMonthlyRevenue() {
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
}

// ─── Approve/Reject SO (quick action from dashboard) ──────
export async function approveSO(id: string) {
    await prisma.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
    })
}

export async function rejectSO(id: string) {
    await prisma.salesOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
    })
    revalidatePath('/dashboard')
}

// ─── Pending Approval Requests (Approval Engine) ──────────
export async function getPendingApprovalDetails() {
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
}

// ─── Slow-moving / Dead stock alert ──────────────────────
export async function getSlowMovingStock() {
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
}

// ─── P&L Summary for Dashboard ───────────────────────────
export async function getPLSummary() {
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
}

// ─── Cash Position for Dashboard ─────────────────────────
export async function getCashPosition() {
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
}

// ─── AR Aging Chart for Dashboard ────────────────────────
export async function getARAgingChart() {
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
