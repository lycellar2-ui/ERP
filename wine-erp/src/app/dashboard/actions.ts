'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { serialize } from '@/lib/serialize'

export type DateRange = 'month' | 'quarter' | 'year'

export interface DashboardFilterOptions {
    from?: Date
    to?: Date
    legalEntityId?: string
}

export interface DailyRevenueItem {
    date: string       // YYYY-MM-DD
    label: string      // "01/09"
    dayOfWeek: string  // "Thứ 2"
    revenue: number
    orderCount: number
    isWeekend: boolean
}

export interface DailyRevenueSummary {
    items: DailyRevenueItem[]
    totalRevenue: number
    totalOrders: number
    avgOrderValue: number
    peakDay: { date: string; label: string; revenue: number } | null
    startDate: string
    endDate: string
}

// ─── Legal Entities for Dashboard filter ──────────────────
export async function getLegalEntitiesForDashboard() {
    return cached('dashboard:legal-entities', async () => {
        return prisma.legalEntity.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
        })
    }, 60_000)
}

// ─── Daily Revenue Chart ──────────────────────────────────
export async function getDailyRevenueChart(options?: DashboardFilterOptions): Promise<DailyRevenueSummary> {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}

    const cacheKey = `dashboard:daily-revenue:${from.getTime()}-${to.getTime()}-${options?.legalEntityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
                ...entityFilter,
            },
            select: {
                id: true,
                totalAmount: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        })

        const formatVN = (d: Date) => {
            const parts = new Intl.DateTimeFormat('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).formatToParts(d)
            const y = parts.find(p => p.type === 'year')?.value
            const m = parts.find(p => p.type === 'month')?.value
            const day = parts.find(p => p.type === 'day')?.value
            return `${y}-${m}-${day}`
        }

        const dateMap = new Map<string, { revenue: number; orders: number }>()
        for (const o of orders) {
            const key = formatVN(o.createdAt)
            const curr = dateMap.get(key) ?? { revenue: 0, orders: 0 }
            curr.revenue += Number(o.totalAmount)
            curr.orders += 1
            dateMap.set(key, curr)
        }

        const items: DailyRevenueItem[] = []
        const cur = new Date(from)
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

        while (cur <= to) {
            const key = formatVN(cur)
            const dayVal = dateMap.get(key) ?? { revenue: 0, orders: 0 }
            const dayIdx = cur.getDay()
            const parts = key.split('-')
            const displayLabel = `${parts[2]}/${parts[1]}`

            items.push({
                date: key,
                label: displayLabel,
                dayOfWeek: dayNames[dayIdx],
                revenue: dayVal.revenue,
                orderCount: dayVal.orders,
                isWeekend: dayIdx === 0 || dayIdx === 6,
            })

            cur.setDate(cur.getDate() + 1)
        }

        const totalRevenue = items.reduce((s, it) => s + it.revenue, 0)
        const totalOrders = items.reduce((s, it) => s + it.orderCount, 0)
        const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

        let peakDay: { date: string; label: string; revenue: number } | null = null
        for (const it of items) {
            if (!peakDay || it.revenue > peakDay.revenue) {
                if (it.revenue > 0) {
                    peakDay = { date: it.date, label: `${it.dayOfWeek} ${it.label}`, revenue: it.revenue }
                }
            }
        }

        return {
            items,
            totalRevenue,
            totalOrders,
            avgOrderValue,
            peakDay,
            startDate: formatVN(from),
            endDate: formatVN(to),
        }
    }, 5_000)
}

// ─── Dashboard aggregate data ─────────────────────────────
export async function getDashboardStats(range: DateRange = 'month', options?: DashboardFilterOptions) {
    const now = new Date()

    let from: Date
    let to: Date
    let prevStart: Date
    let prevEnd: Date

    if (options?.from && options?.to) {
        from = options.from
        to = options.to
        const duration = to.getTime() - from.getTime()
        prevEnd = new Date(from.getTime() - 1)
        prevStart = new Date(prevEnd.getTime() - duration)
    } else {
        const span = range === 'month'
            ? { from: startOfMonth(now), to: endOfMonth(now) }
            : range === 'quarter'
                ? { from: startOfQuarter(now), to: endOfQuarter(now) }
                : { from: startOfYear(now), to: endOfYear(now) }
        from = span.from
        to = span.to
        prevStart = subMonths(from, 1)
        prevEnd = subMonths(from, 0)
    }

    const cacheKey = options?.from && options?.to
        ? `dashboard:stats:${options.from.getTime()}-${options.to.getTime()}-${options.legalEntityId ?? 'all'}`
        : `dashboard:stats:${range}:${options?.legalEntityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}
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
                    ...entityFilter,
                },
                _sum: { totalAmount: true },
            }),
            prisma.salesOrder.aggregate({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: prevStart, lte: prevEnd },
                    ...entityFilter,
                },
                _sum: { totalAmount: true },
            }),
            prisma.stockLot.findMany({
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: {
                    qtyAvailable: true,
                    unitLandedCost: true,
                    product: {
                        select: {
                            marginPrice: { select: { wholesalePrice: true, costPrice: true } },
                            priceLines: { select: { unitPrice: true }, take: 1 },
                        }
                    }
                },
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

        const stockTotalValue = stockAgg.reduce((sum, lot) => {
            const qty = Number(lot.qtyAvailable)
            let unitCost = Number(lot.unitLandedCost)
            if (!unitCost || unitCost <= 0) {
                unitCost = Number(
                    lot.product?.marginPrice?.costPrice ??
                    lot.product?.marginPrice?.wholesalePrice ??
                    lot.product?.priceLines?.[0]?.unitPrice ??
                    350000
                )
            }
            return sum + qty * unitCost
        }, 0)
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
    }, 5_000) // Cache 5s
}

// ─── Monthly revenue chart (last 6 months) ───────────────
export async function getMonthlyRevenue() {
    return cached('dashboard:monthly-revenue', async () => {
        const now = new Date()
        const sixMonthsAgo = startOfMonth(subMonths(now, 5))

        // Fetch all matching orders for the last 6 months in a single query
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: sixMonthsAgo },
            },
            select: { createdAt: true, totalAmount: true },
        })

        const months = Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(now, 5 - i)
            return {
                from: startOfMonth(d),
                to: endOfMonth(d),
                label: d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
                revenue: 0,
            }
        })

        for (const o of orders) {
            const oDate = new Date(o.createdAt)
            const oTime = oDate.getTime()
            const amount = Number(o.totalAmount ?? 0)

            for (const m of months) {
                if (oTime >= m.from.getTime() && oTime <= m.to.getTime()) {
                    m.revenue += amount
                    break
                }
            }
        }

        return months.map(m => ({
            label: m.label,
            revenue: m.revenue,
        }))
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
export async function getPLSummary(options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}

    const cacheKey = `dashboard:pl-summary:${from.getTime()}-${to.getTime()}-${options?.legalEntityId ?? 'all'}`

    return cached(cacheKey, async () => {
        // Group journal lines by account on the DB side, and fetch month sales orders with cost
        const [groups, monthOrders] = await Promise.all([
            prisma.journalLine.groupBy({
                by: ['account'],
                where: {
                    entry: {
                        postedAt: { gte: from, lte: to },
                    },
                },
                _sum: { debit: true, credit: true },
            }),
            prisma.salesOrder.findMany({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: from, lte: to },
                    ...entityFilter,
                },
                include: {
                    lines: {
                        include: {
                            product: {
                                select: {
                                    marginPrice: { select: { costPrice: true } }
                                }
                            }
                        }
                    }
                }
            }),
        ])

        let revenueFromJournal = 0    // TK 511 = Revenue
        let cogsFromJournal = 0       // TK 632 = COGS
        let expenses = 0   // TK 641, 642, 635, 811

        // If filtering by specific legal entity, skip generic journal accounts which don't isolate entity
        if (!options?.legalEntityId) {
            for (const g of groups) {
                const acc = g.account.split(' - ')[0]?.trim() ?? g.account
                const debit = Number(g._sum.debit ?? 0)
                const credit = Number(g._sum.credit ?? 0)

                if (acc.startsWith('511')) {
                    revenueFromJournal += credit - debit
                } else if (acc.startsWith('632')) {
                    cogsFromJournal += debit - credit
                } else if (acc.startsWith('641') || acc.startsWith('642') || acc.startsWith('635') || acc.startsWith('811')) {
                    expenses += debit - credit
                }
            }
        }

        let soRevenue = 0
        let soCOGS = 0
        for (const so of (monthOrders || [])) {
            for (const line of so.lines || []) {
                const qty = Number(line.qtyOrdered)
                const price = Number(line.unitPrice)
                const discPct = Number(line.lineDiscountPct)
                const rev = qty * price * (1 - discPct / 100)
                const cost = line.product?.marginPrice ? Number(line.product.marginPrice.costPrice) : 0
                soRevenue += rev
                soCOGS += qty * cost
            }
        }

        // Match revenue and COGS by source (Accounting Matching Principle)
        const revenue = revenueFromJournal > 0 ? revenueFromJournal : soRevenue
        const cogs = revenueFromJournal > 0
            ? (cogsFromJournal > 0 ? cogsFromJournal : soCOGS)
            : (soCOGS > 0 ? soCOGS : cogsFromJournal)

        const grossProfit = revenue - cogs
        const netProfit = grossProfit - expenses
        const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

        return { revenue, cogs, grossProfit, netProfit, expenses, grossMargin }
    }, 5_000)
}

// ─── Cash Position for Dashboard ─────────────────────────
export async function getCashPosition(options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityId = options?.legalEntityId

    const cacheKey = `dashboard:cash-position:${from.getTime()}-${to.getTime()}-${entityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const arEntityFilter = entityId ? { invoice: { legalEntityId: entityId } } : {}
        const apEntityFilter = entityId ? { invoice: { legalEntityId: entityId } } : {}
        const invEntityFilter = entityId ? { legalEntityId: entityId } : {}

        const [arPayments, apPayments, approvedExpenses, unpaidInvoices, unpaidAPInvoices] = await Promise.all([
            // AR Payments received in this period (cash in)
            prisma.aRPayment.aggregate({
                where: {
                    paidAt: { gte: from, lte: to },
                    ...arEntityFilter,
                },
                _sum: { amount: true },
            }),

            // AP Payments made in this period (cash out)
            prisma.aPPayment.aggregate({
                where: {
                    paidAt: { gte: from, lte: to },
                    ...apEntityFilter,
                },
                _sum: { amount: true },
            }),

            // Expenses approved in this period (cash out)
            prisma.expense.aggregate({
                where: {
                    status: 'APPROVED',
                    createdAt: { gte: from, lte: to },
                },
                _sum: { amount: true },
            }),

            // Actual remaining unpaid AR debt (subtract already received payments)
            prisma.aRInvoice.findMany({
                where: {
                    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                    ...invEntityFilter,
                },
                select: { totalAmount: true, paidAmount: true },
            }),

            // Total outstanding AP
            prisma.aPInvoice.findMany({
                where: {
                    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                    ...invEntityFilter,
                },
                select: {
                    amount: true,
                    exchangeRate: true,
                    payments: { select: { amount: true } },
                },
            }),
        ])

        const cashIn = Number(arPayments._sum.amount ?? 0)
        const cashOutAP = Number(apPayments._sum.amount ?? 0)
        const cashOutExpenses = Number(approvedExpenses._sum.amount ?? 0)
        const cashOut = cashOutAP + cashOutExpenses
        const netCashFlow = cashIn - cashOut

        const arOutstanding = unpaidInvoices.reduce((sum, inv) => {
            const remaining = Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount ?? 0))
            return sum + remaining
        }, 0)

        const apOutstanding = unpaidAPInvoices.reduce((sum, inv) => {
            const rate = Number(inv.exchangeRate ?? 1)
            const totalVnd = Number(inv.amount) * rate
            const paidVnd = inv.payments.reduce((pSum, p) => pSum + Number(p.amount) * rate, 0)
            return sum + Math.max(0, totalVnd - paidVnd)
        }, 0)

        return {
            cashIn,
            cashOutAP,
            cashOutExpenses,
            cashOut,
            netCashFlow,
            arOutstanding,
            apOutstanding,
        }
    }, 15_000) // 15s
}

// ─── AR Aging Chart for Dashboard ────────────────────────
export async function getARAgingChart(options?: DashboardFilterOptions) {
    const entityId = options?.legalEntityId
    const cacheKey = `dashboard:ar-aging:${entityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const now = new Date()
        const entityFilter = entityId ? { legalEntityId: entityId } : {}

        const invoices = await prisma.aRInvoice.findMany({
            where: {
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                ...entityFilter,
            },
            select: {
                totalAmount: true,
                paidAmount: true,
                dueDate: true,
                status: true,
            },
        })

        // Accurate remaining unpaid debt per invoice
        const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
        let totalActiveInvoices = 0

        for (const inv of invoices) {
            const remainingAmount = Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount ?? 0))
            if (remainingAmount <= 0) continue

            totalActiveInvoices++
            const daysPast = Math.floor(
                (now.getTime() - new Date(inv.dueDate).getTime()) / 86400000
            )

            if (daysPast <= 0) {
                buckets.current += remainingAmount     // Chưa đến hạn
            } else if (daysPast <= 30) {
                buckets.d30 += remainingAmount         // Quá hạn 1-30 ngày
            } else if (daysPast <= 60) {
                buckets.d60 += remainingAmount         // Quá hạn 31-60 ngày
            } else if (daysPast <= 90) {
                buckets.d90 += remainingAmount         // Quá hạn 61-90 ngày
            } else {
                buckets.d90plus += remainingAmount     // Quá hạn >90 ngày
            }
        }

        return {
            invoiceCount: totalActiveInvoices,
            totalOutstanding: Object.values(buckets).reduce((a, b) => a + b, 0),
            buckets: [
                { label: 'Chưa đến hạn', amount: buckets.current, color: '#5BA88A' },
                { label: '1-30 ngày', amount: buckets.d30, color: '#0891B2' },
                { label: '31-60 ngày', amount: buckets.d60, color: '#D4A853' },
                { label: '61-90 ngày', amount: buckets.d90, color: '#E05252' },
                { label: '>90 ngày', amount: buckets.d90plus, color: '#8B1A2E' },
            ],
        }
    }, 15_000)
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

export async function getCostWaterfall(options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityId = options?.legalEntityId

    const cacheKey = `dashboard:cost-waterfall:${from.getTime()}-${to.getTime()}-${entityId ?? 'all'}`

    return cached(cacheKey, async () => {
        // Group journal lines by account on the DB side for performance
        const groups = await prisma.journalLine.groupBy({
            by: ['account'],
            where: { entry: { postedAt: { gte: from, lte: to } } },
            _sum: { debit: true, credit: true },
        })

        let revenue = 0
        let cogs = 0
        let sellingExp = 0   // TK 641
        let adminExp = 0     // TK 642
        let financialExp = 0 // TK 635
        let otherExp = 0     // TK 811

        if (!entityId) {
            for (const g of groups) {
                const acc = g.account.split(' - ')[0]?.trim() ?? g.account
                const debit = Number(g._sum.debit ?? 0)
                const credit = Number(g._sum.credit ?? 0)

                if (acc.startsWith('511')) revenue += credit - debit
                else if (acc.startsWith('632')) cogs += debit - credit
                else if (acc.startsWith('641')) sellingExp += debit - credit
                else if (acc.startsWith('642')) adminExp += debit - credit
                else if (acc.startsWith('635')) financialExp += debit - credit
                else if (acc.startsWith('811')) otherExp += debit - credit
            }
        }

        // Fallback to SO revenue & estimated COGS + approved expenses if journal hasn't been posted
        if (revenue === 0) {
            const entityFilter = entityId ? { legalEntityId: entityId } : {}
            const [orders, expensesList] = await Promise.all([
                prisma.salesOrder.findMany({
                    where: {
                        status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                        createdAt: { gte: from, lte: to },
                        ...entityFilter,
                    },
                    include: {
                        lines: {
                            include: {
                                product: { select: { marginPrice: { select: { costPrice: true } } } }
                            }
                        }
                    }
                }),
                prisma.expense.findMany({
                    where: {
                        status: 'APPROVED',
                        createdAt: { gte: from, lte: to },
                    },
                    select: { account: true, category: true, amount: true }
                })
            ])

            for (const so of orders) {
                for (const l of so.lines) {
                    const qty = Number(l.qtyOrdered)
                    const price = Number(l.unitPrice)
                    const discPct = Number(l.lineDiscountPct)
                    const rev = qty * price * (1 - discPct / 100)
                    const cost = l.product?.marginPrice ? Number(l.product.marginPrice.costPrice) : 0
                    revenue += rev
                    cogs += qty * cost
                }
            }

            for (const exp of expensesList) {
                const amt = Number(exp.amount)
                const cat = exp.category
                if (cat === 'LOGISTICS' || cat === 'MARKETING' || exp.account.startsWith('641')) {
                    sellingExp += amt
                } else if (cat === 'SALARY' || cat === 'RENT' || cat === 'UTILITIES' || exp.account.startsWith('642')) {
                    adminExp += amt
                } else if (exp.account.startsWith('635')) {
                    financialExp += amt
                } else {
                    otherExp += amt
                }
            }
        }

        const grossProfit = revenue - cogs
        const totalExpenses = sellingExp + adminExp + financialExp + otherExp
        const netProfit = grossProfit - totalExpenses

        const pct = (v: number) => revenue > 0 ? Math.round((v / revenue) * 100) : 0

        const bars: WaterfallBar[] = [
            { label: 'Doanh Thu', value: revenue, type: 'total', color: '#5BA88A', pct: 100 },
            { label: 'Giá Vốn (COGS)', value: -cogs, type: 'negative', color: '#E05252', pct: pct(cogs) },
            { label: 'Lãi Gộp', value: grossProfit, type: 'total', color: '#0891B2', pct: pct(grossProfit) },
            { label: 'CP Bán Hàng (641)', value: -sellingExp, type: 'negative', color: '#D4A853', pct: pct(sellingExp) },
            { label: 'CP Quản Lý (642)', value: -adminExp, type: 'negative', color: '#C45A2A', pct: pct(adminExp) },
            { label: 'CP Tài Chính (635)', value: -financialExp, type: 'negative', color: '#4A8FAB', pct: pct(financialExp) },
            { label: 'CP Khác (811)', value: -otherExp, type: 'negative', color: '#8B1A2E', pct: pct(otherExp) },
            { label: 'Lãi Ròng', value: netProfit, type: 'total', color: netProfit >= 0 ? '#5BA88A' : '#8B1A2E', pct: pct(netProfit) },
        ]

        return { bars, revenue, cogs, grossProfit, totalExpenses, netProfit }
    }, 15_000)
}

// ─── Revenue YoY Comparison (12 months) ──────────────
export async function getRevenueYoY() {
    return cached('dashboard:revenue-yoy', async () => {
        const now = new Date()
        const thisYear = now.getFullYear()
        const lastYear = thisYear - 1

        // Fetch all matching orders for both years in a single query
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: {
                    gte: new Date(lastYear, 0, 1),
                    lte: new Date(thisYear, 11, 31, 23, 59, 59, 999),
                },
            },
            select: { createdAt: true, totalAmount: true },
        })

        const current = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            label: `T${i + 1}`,
            revenue: 0,
        }))

        const previous = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            label: `T${i + 1}`,
            revenue: 0,
        }))

        for (const o of orders) {
            const date = new Date(o.createdAt)
            const year = date.getFullYear()
            const monthIdx = date.getMonth()
            const amount = Number(o.totalAmount ?? 0)

            if (year === thisYear) {
                current[monthIdx].revenue += amount
            } else if (year === lastYear) {
                previous[monthIdx].revenue += amount
            }
        }

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
    | 'my_sales' | 'warehouse_summary' | 'legal_compliance'

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
            'shipment_tracker', 'kpi_targets', 'legal_compliance',
        ],
        quickLinks: [
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
            { label: 'Phê duyệt', href: '/dashboard/settings?tab=approvals', icon: 'ClipboardCheck' },
            { label: 'Tài chính', href: '/dashboard/finance', icon: 'DollarSign' },
            { label: 'Pháp lý', href: '/dashboard/contracts', icon: 'Shield' },
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
        sections: ['kpi_cards', 'shipment_tracker', 'pending_approvals', 'stock_alerts', 'legal_compliance'],
        quickLinks: [
            { label: 'Đơn mua', href: '/dashboard/procurement', icon: 'Ship' },
            { label: 'NCC', href: '/dashboard/suppliers', icon: 'Users' },
            { label: 'Lô hàng', href: '/dashboard/procurement?tab=shipments', icon: 'Package' },
        ],
    },
    SALES_ADMIN: {
        greeting: 'Điều Hành Kinh Doanh (Sales Admin)',
        sections: [
            'kpi_cards', 'recent_orders', 'pending_approvals', 'revenue_chart',
            'kpi_targets',
        ],
        quickLinks: [
            { label: 'Đơn hàng', href: '/dashboard/sales', icon: 'Package' },
            { label: 'Khách hàng', href: '/dashboard/crm', icon: 'Users' },
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
        ],
    },
}

export async function getDashboardConfig(roles: string[]): Promise<DashboardConfig> {
    // Priority: CEO > KE_TOAN > SALES_MGR > SALES_ADMIN > THU_KHO > THU_MUA > SALES_REP
    const priority = ['CEO', 'KE_TOAN', 'SALES_MGR', 'SALES_ADMIN', 'THU_KHO', 'THU_MUA', 'SALES_REP']

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

// ═══════════════════════════════════════════════════
// TOP CUSTOMERS & PRODUCTS & CHANNEL BREAKDOWN
// ═══════════════════════════════════════════════════

export async function getTopCustomers(limit = 5, options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}
    const cacheKey = `dashboard:top-customers:${from.getTime()}-${to.getTime()}-${options?.legalEntityId ?? 'all'}:${limit}`

    return cached(cacheKey, async () => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
                ...entityFilter,
            },
            select: {
                totalAmount: true,
                customer: { select: { id: true, code: true, name: true, channel: true } },
            },
        })

        const map = new Map<string, { id: string; code: string; name: string; channel: string | null; revenue: number; orders: number }>()
        for (const o of orders) {
            const cid = o.customer?.id ?? 'walk-in'
            const existing = map.get(cid)
            if (existing) {
                existing.revenue += Number(o.totalAmount)
                existing.orders += 1
            } else {
                map.set(cid, {
                    id: o.customer?.id ?? '',
                    code: o.customer?.code ?? '',
                    name: o.customer?.name ?? 'Khách Lẻ',
                    channel: (o.customer as any)?.channel ?? null,
                    revenue: Number(o.totalAmount),
                    orders: 1,
                })
            }
        }

        return Array.from(map.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit)
    }, 60_000)
}

export async function getTopProducts(limit = 5, options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}
    const cacheKey = `dashboard:top-products:${from.getTime()}-${to.getTime()}-${options?.legalEntityId ?? 'all'}:${limit}`

    return cached(cacheKey, async () => {
        const lines = await prisma.salesOrderLine.findMany({
            where: {
                so: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: from, lte: to },
                    ...entityFilter,
                },
            },
            select: {
                qtyOrdered: true,
                unitPrice: true,
                product: { select: { id: true, skuCode: true, productName: true } },
            },
        })

        const map = new Map<string, { sku: string; name: string; qty: number; revenue: number }>()
        for (const l of lines) {
            const pid = l.product?.id ?? 'unknown'
            const existing = map.get(pid)
            const lineRevenue = Number(l.qtyOrdered) * Number(l.unitPrice)
            if (existing) {
                existing.qty += Number(l.qtyOrdered)
                existing.revenue += lineRevenue
            } else {
                map.set(pid, {
                    sku: l.product?.skuCode ?? '?',
                    name: l.product?.productName ?? 'Unknown',
                    qty: Number(l.qtyOrdered),
                    revenue: lineRevenue,
                })
            }
        }

        return Array.from(map.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit)
    }, 60_000)
}

export async function getRevenueByChannel(options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityFilter = options?.legalEntityId ? { legalEntityId: options.legalEntityId } : {}
    const cacheKey = `dashboard:revenue-channel:${from.getTime()}-${to.getTime()}-${options?.legalEntityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
                ...entityFilter,
            },
            select: { channel: true, totalAmount: true },
        })

        const map: Record<string, number> = {}
        for (const o of orders) {
            const ch = o.channel ?? 'OTHER'
            map[ch] = (map[ch] ?? 0) + Number(o.totalAmount)
        }

        const total = Object.values(map).reduce((s, v) => s + v, 0)

        const CHANNEL_LABELS: Record<string, string> = {
            HORECA: 'HORECA',
            WHOLESALE: 'Đại Lý',
            VIP_RETAIL: 'VIP Retail',
            POS: 'POS Showroom',
            CONSIGNMENT: 'Ký Gửi',
            OTHER: 'Khác',
        }

        const CHANNEL_COLORS: Record<string, string> = {
            HORECA: '#87CBB9',
            WHOLESALE: '#4A8FAB',
            VIP_RETAIL: '#D4A853',
            POS: '#5BA88A',
            CONSIGNMENT: '#475569',
            OTHER: '#64748B',
        }

        return {
            total,
            channels: Object.entries(map)
                .map(([ch, rev]) => ({
                    channel: ch,
                    label: CHANNEL_LABELS[ch] ?? ch,
                    revenue: rev,
                    pct: total > 0 ? Math.round((rev / total) * 100) : 0,
                    color: CHANNEL_COLORS[ch] ?? '#64748B',
                }))
                .sort((a, b) => b.revenue - a.revenue),
        }
    }, 60_000)
}

// ═══════════════════════════════════════════════════
// CUSTOMER 360° PURCHASE HISTORY & SEARCH
// ═══════════════════════════════════════════════════

export interface DashboardCustomerSearchItem {
    id: string
    code: string
    name: string
    channel: string
    entityType: string
    salesRepName: string | null
    parentName: string | null
    orderCount: number
}

export async function searchCustomersForDashboard(query: string = ''): Promise<DashboardCustomerSearchItem[]> {
    const q = query.trim()
    const where: any = { deletedAt: null, status: 'ACTIVE' }
    if (q) {
        where.OR = [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { shortName: { contains: q, mode: 'insensitive' } },
            { purchasingPhone: { contains: q } },
            { receiverPhone: { contains: q } },
        ]
    }

    const customers = await prisma.customer.findMany({
        where,
        take: 20,
        orderBy: [{ salesOrders: { _count: 'desc' } }, { name: 'asc' }],
        select: {
            id: true,
            code: true,
            name: true,
            channel: true,
            entityType: true,
            salesRep: { select: { name: true } },
            parent: { select: { name: true, code: true } },
            _count: { select: { salesOrders: true } },
        }
    })

    return customers.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        channel: c.channel,
        entityType: c.entityType,
        salesRepName: c.salesRep?.name ?? null,
        parentName: c.parent ? `${c.parent.code} - ${c.parent.name}` : null,
        orderCount: c._count.salesOrders,
    }))
}

export interface CustomerSpecialPriceRuleItem {
    id: string
    productId: string
    skuCode: string
    productName: string
    wineType: string | null
    country: string | null
    ruleType: 'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'
    value: number
    retailPrice: number | null
    wholesalePrice: number | null
    specialPrice: number
    discountAmount: number
    discountPct: number
    startDate: string
    endDate: string | null
    isExpired: boolean
    isExpiringSoon: boolean
    notes: string | null
}

export interface CustomerPriceProposalItem {
    id: string
    proposalNo: string
    title: string
    status: string
    startDate: string | null
    endDate: string | null
    resolvedAt: string | null
    notes: string | null
}

export interface CustomerPricingInfo {
    basePriceType: string
    defaultDiscountPct: number
    specialRules: CustomerSpecialPriceRuleItem[]
    proposals: CustomerPriceProposalItem[]
}

export interface CustomerHealthInfo {
    status: 'HEALTHY' | 'WARNING' | 'AT_RISK' | 'NEW'
    statusLabel: string
    daysSinceLastOrder: number | null
    averageOrderCycleDays: number | null
    delayDays: number
}

export interface CustomerOrderBreakdown {
    commercialCount: number
    commercialRevenue: number
    commercialBottles: number
    tastingCount: number
    tastingBottles: number
}

export interface CustomerPreferenceInfo {
    wineTypes: Array<{ type: string; label: string; bottles: number; revenue: number; pct: number }>
    priceBrackets: Array<{ label: string; bottles: number; revenue: number; pct: number }>
}

export interface CustomerHistorySOItem {
    id: string
    soNo: string
    createdAt: string
    orderType: string
    totalAmount: number
    paidAmount: number
    unpaidAmount: number
    status: string
    deliveryStatus: string
    salesRepName: string
    branchName?: string | null
    totalBottles: number
    lineCount: number
    shippingAddress: string | null
    receiverName: string | null
    receiverPhone: string | null
    deliveryNotes: string | null
    deliveryOrders: Array<{ id: string; doNo: string; status: string }>
    arInvoices: Array<{ id: string; invoiceNo: string; status: string; amount: number; paidAmount: number }>
    lines: Array<{
        id: string
        skuCode: string
        productName: string
        wineType: string | null
        qtyOrdered: number
        unitPrice: number
        lineDiscountPct: number
        lineTotal: number
    }>
}

export interface CustomerHistoryTopProduct {
    productId: string
    skuCode: string
    name: string
    wineType: string | null
    originCountry: string | null
    totalQty: number
    totalSpend: number
    lastUnitPrice: number
    lastPurchasedAt: string
}

export interface CustomerHistoryMonthlyTrend {
    month: string
    label: string
    revenue: number
    bottles: number
    orders: number
}

export interface CustomerPurchaseHistoryResult {
    customer: {
        id: string
        code: string
        name: string
        channel: string
        paymentTerm: string
        creditLimit: number
        entityType: string
        status: string
        basePriceType: string
        defaultDiscountPct: number
        salesRepName: string | null
        parentName: string | null
        childrenCount: number
        purchasingName: string | null
        purchasingPhone: string | null
        receiverName: string | null
        receiverPhone: string | null
        deliveryNotes: string | null
    }
    kpis: {
        totalRevenue: number
        totalOrders: number
        totalBottles: number
        lastOrderDate: string | null
        lastOrderNo: string | null
        totalPaidAmount: number
        totalArDebt: number
        overdueArDebt: number
    }
    pricing: CustomerPricingInfo
    health: CustomerHealthInfo
    orderBreakdown: CustomerOrderBreakdown
    preferences: CustomerPreferenceInfo
    orders: CustomerHistorySOItem[]
    topProducts: CustomerHistoryTopProduct[]
    monthlyTrend: CustomerHistoryMonthlyTrend[]
}

export async function getCustomerPurchaseHistory(
    customerId: string,
    timeRange: 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH' = 'ALL'
): Promise<CustomerPurchaseHistoryResult | null> {
    if (!customerId) return null

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
            id: true,
            code: true,
            name: true,
            channel: true,
            paymentTerm: true,
            creditLimit: true,
            entityType: true,
            status: true,
            basePriceType: true,
            defaultDiscountPct: true,
            purchasingName: true,
            purchasingPhone: true,
            receiverName: true,
            receiverPhone: true,
            deliveryNotes: true,
            salesRep: { select: { id: true, name: true } },
            parent: { select: { id: true, code: true, name: true } },
            children: { select: { id: true, code: true, name: true } },
        }
    })

    if (!customer) return null

    const targetCustomerIds = [customer.id, ...customer.children.map(c => c.id)]
    const now = new Date()

    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined
    if (timeRange === 'THIS_MONTH') {
        dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) }
    } else if (timeRange === 'LAST_6_MONTHS') {
        dateFilter = { gte: subMonths(now, 6), lte: endOfMonth(now) }
    } else if (timeRange === 'THIS_YEAR') {
        dateFilter = { gte: startOfYear(now), lte: endOfYear(now) }
    }

    // 1. Fetch Orders with lines, shipping, delivery, and AR
    const orders = await prisma.salesOrder.findMany({
        where: {
            customerId: { in: targetCustomerIds },
            status: { not: 'CANCELLED' },
            ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            customer: { select: { id: true, code: true, name: true } },
            salesRep: { select: { name: true } },
            shippingAddress: { select: { label: true, address: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            id: true,
                            skuCode: true,
                            productName: true,
                            wineType: true,
                            country: true,
                            marginPrice: {
                                select: {
                                    retailPrice: true,
                                    wholesalePrice: true,
                                }
                            }
                        }
                    }
                }
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, paidAmount: true, dueDate: true } },
        }
    })

    // 2. Fetch Customer Price Rules (Bảng giá đặc biệt)
    const rawPriceRules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: { in: targetCustomerIds },
            status: { in: ['APPROVED', 'DRAFT'] },
        },
        include: {
            product: {
                select: {
                    id: true,
                    skuCode: true,
                    productName: true,
                    wineType: true,
                    country: true,
                    marginPrice: {
                        select: {
                            retailPrice: true,
                            wholesalePrice: true,
                        }
                    }
                }
            }
        },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }]
    })

    const specialRules: CustomerSpecialPriceRuleItem[] = rawPriceRules.map(r => {
        const val = Number(r.value)
        const stdPrice = Number(r.product.marginPrice?.wholesalePrice ?? r.product.marginPrice?.retailPrice ?? 0)
        let specialPrice = val
        let discountAmount = 0
        let discountPct = 0

        if (r.ruleType === 'FIXED_DISCOUNT') {
            discountPct = val
            discountAmount = stdPrice > 0 ? (stdPrice * val) / 100 : 0
            specialPrice = Math.max(0, stdPrice - discountAmount)
        } else {
            specialPrice = val
            if (stdPrice > specialPrice) {
                discountAmount = stdPrice - specialPrice
                discountPct = stdPrice > 0 ? Math.round((discountAmount / stdPrice) * 100) : 0
            }
        }

        const end = r.endDate ? new Date(r.endDate) : null
        const isExpired = end !== null && end.getTime() < now.getTime()
        const isExpiringSoon = end !== null && !isExpired && (end.getTime() - now.getTime()) < 15 * 86400000

        return {
            id: r.id,
            productId: r.productId,
            skuCode: r.product.skuCode,
            productName: r.product.productName,
            wineType: r.product.wineType,
            country: r.product.country,
            ruleType: r.ruleType,
            value: val,
            retailPrice: r.product.marginPrice?.retailPrice ? Number(r.product.marginPrice.retailPrice) : null,
            wholesalePrice: r.product.marginPrice?.wholesalePrice ? Number(r.product.marginPrice.wholesalePrice) : null,
            specialPrice,
            discountAmount,
            discountPct,
            startDate: r.startDate.toISOString(),
            endDate: r.endDate ? r.endDate.toISOString() : null,
            isExpired,
            isExpiringSoon,
            notes: r.notes,
        }
    })

    // 3. Fetch Price Adjustment Proposals (Tờ trình cơ chế giá)
    const rawProposals = await prisma.proposal.findMany({
        where: {
            customerId: { in: targetCustomerIds },
            category: 'PRICE_ADJUSTMENT',
            status: { in: ['APPROVED', 'APPROVED_L2', 'CLOSED'] },
        },
        select: {
            id: true,
            proposalNo: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            resolvedAt: true,
            justification: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    })

    const proposals: CustomerPriceProposalItem[] = rawProposals.map(p => ({
        id: p.id,
        proposalNo: p.proposalNo,
        title: p.title,
        status: p.status,
        startDate: p.startDate ? p.startDate.toISOString() : null,
        endDate: p.endDate ? p.endDate.toISOString() : null,
        resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
        notes: p.justification,
    }))

    // 4. Fetch AR debt across target customer IDs
    const arInvoices = await prisma.aRInvoice.findMany({
        where: {
            customerId: { in: targetCustomerIds },
            status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] }
        },
        select: {
            amount: true,
            paidAmount: true,
            status: true,
            dueDate: true,
        }
    })

    let totalArDebt = 0
    let overdueArDebt = 0
    for (const inv of arInvoices) {
        const unpaid = Number(inv.amount) - Number(inv.paidAmount ?? 0)
        if (unpaid > 0) {
            totalArDebt += unpaid
            if (inv.dueDate && new Date(inv.dueDate) < now) {
                overdueArDebt += unpaid
            }
        }
    }

    // 5. Calculate Metrics, Health, Preferences, and Monthly Trends
    let totalRevenue = 0
    let totalBottles = 0
    let totalPaidAmount = 0

    let commercialCount = 0
    let commercialRevenue = 0
    let commercialBottles = 0
    let tastingCount = 0
    let tastingBottles = 0

    const productMap = new Map<string, {
        productId: string
        skuCode: string
        name: string
        wineType: string | null
        originCountry: string | null
        totalQty: number
        totalSpend: number
        lastUnitPrice: number
        lastPurchasedAt: Date
    }>()

    const wineTypeMap = new Map<string, { bottles: number; revenue: number }>()
    const priceBrackets = {
        under500k: { label: 'Phổ thông (< 500k)', bottles: 0, revenue: 0 },
        mid500k_1500k: { label: 'Trung cấp (500k – 1.5M)', bottles: 0, revenue: 0 },
        grandCru: { label: 'Cao cấp (> 1.5M)', bottles: 0, revenue: 0 },
    }

    const monthlyMap = new Map<string, { month: string; label: string; revenue: number; bottles: number; orders: number }>()

    for (const so of orders) {
        const amt = Number(so.totalAmount)
        totalRevenue += amt

        const soPaid = so.arInvoices.reduce((s, inv) => s + Number(inv.paidAmount ?? 0), 0)
        totalPaidAmount += soPaid

        const isTasting = (so as any).orderType === 'TASTING'
        const isSample = (so as any).orderType === 'SAMPLE'
        const orderBottles = so.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0)

        if (isTasting || isSample) {
            tastingCount++
            tastingBottles += orderBottles
        } else {
            commercialCount++
            commercialRevenue += amt
            commercialBottles += orderBottles
        }

        const orderDate = new Date(so.createdAt)
        const mKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
        const mLabel = `T${orderDate.getMonth() + 1}/${String(orderDate.getFullYear()).slice(-2)}`
        const mCurr = monthlyMap.get(mKey) ?? { month: mKey, label: mLabel, revenue: 0, bottles: 0, orders: 0 }
        mCurr.revenue += amt
        mCurr.orders += 1

        for (const l of so.lines) {
            const qty = Number(l.qtyOrdered)
            const price = Number(l.unitPrice)
            const lineSpend = qty * price * (1 - (Number(l.lineDiscountPct ?? 0) / 100))
            totalBottles += qty
            mCurr.bottles += qty

            // Wine type breakdown
            const wt = l.product?.wineType || 'OTHER'
            const curWt = wineTypeMap.get(wt) ?? { bottles: 0, revenue: 0 }
            curWt.bottles += qty
            curWt.revenue += lineSpend
            wineTypeMap.set(wt, curWt)

            // Price tier breakdown
            if (price < 500_000) {
                priceBrackets.under500k.bottles += qty
                priceBrackets.under500k.revenue += lineSpend
            } else if (price <= 1_500_000) {
                priceBrackets.mid500k_1500k.bottles += qty
                priceBrackets.mid500k_1500k.revenue += lineSpend
            } else {
                priceBrackets.grandCru.bottles += qty
                priceBrackets.grandCru.revenue += lineSpend
            }

            if (l.product) {
                const pid = l.product.id
                const pCurr = productMap.get(pid)
                if (pCurr) {
                    pCurr.totalQty += qty
                    pCurr.totalSpend += lineSpend
                    if (new Date(so.createdAt) > new Date(pCurr.lastPurchasedAt)) {
                        pCurr.lastUnitPrice = price
                        pCurr.lastPurchasedAt = so.createdAt
                    }
                } else {
                    productMap.set(pid, {
                        productId: pid,
                        skuCode: l.product.skuCode,
                        name: l.product.productName,
                        wineType: l.product.wineType,
                        originCountry: l.product.country,
                        totalQty: qty,
                        totalSpend: lineSpend,
                        lastUnitPrice: price,
                        lastPurchasedAt: so.createdAt,
                    })
                }
            }
        }
        monthlyMap.set(mKey, mCurr)
    }

    // Health / Buying cycle calculation
    let daysSinceLastOrder: number | null = null
    let averageOrderCycleDays: number | null = null
    let healthStatus: 'HEALTHY' | 'WARNING' | 'AT_RISK' | 'NEW' = 'NEW'
    let healthLabel = 'Khách mới'
    let delayDays = 0

    if (orders.length > 0) {
        const latestDate = new Date(orders[0].createdAt)
        daysSinceLastOrder = Math.max(0, Math.floor((now.getTime() - latestDate.getTime()) / 86400000))

        if (orders.length >= 2) {
            const timestamps = orders.map(o => new Date(o.createdAt).getTime()).reverse()
            let totalDiffDays = 0
            for (let i = 1; i < timestamps.length; i++) {
                totalDiffDays += (timestamps[i] - timestamps[i - 1]) / 86400000
            }
            averageOrderCycleDays = Math.max(1, Math.round(totalDiffDays / (timestamps.length - 1)))
            delayDays = Math.max(0, daysSinceLastOrder - averageOrderCycleDays)

            if (daysSinceLastOrder <= averageOrderCycleDays * 1.3) {
                healthStatus = 'HEALTHY'
                healthLabel = 'Nhập hàng đều'
            } else if (daysSinceLastOrder <= averageOrderCycleDays * 2.2) {
                healthStatus = 'WARNING'
                healthLabel = `Chậm hơn chu kỳ (${delayDays} ngày)`
            } else {
                healthStatus = 'AT_RISK'
                healthLabel = `Quá hạn chu kỳ (${delayDays} ngày)`
            }
        } else {
            healthStatus = 'HEALTHY'
            healthLabel = 'Đã có 1 đơn gần đây'
        }
    }

    const WINE_TYPE_LABELS: Record<string, string> = {
        RED: 'Vang Đỏ',
        WHITE: 'Vang Trắng',
        SPARKLING: 'Vang Nổ / Champagne',
        ROSE: 'Vang Hồng',
        DESSERT: 'Vang Ngọt',
        FORTIFIED: 'Vang Cường Hoá',
        OTHER: 'Khác',
    }

    const wineTypePreferences = Array.from(wineTypeMap.entries()).map(([k, v]) => ({
        type: k,
        label: WINE_TYPE_LABELS[k] ?? k,
        bottles: v.bottles,
        revenue: v.revenue,
        pct: totalBottles > 0 ? Math.round((v.bottles / totalBottles) * 100) : 0,
    })).sort((a, b) => b.bottles - a.bottles)

    const priceTierPreferences = [
        { ...priceBrackets.under500k, pct: totalBottles > 0 ? Math.round((priceBrackets.under500k.bottles / totalBottles) * 100) : 0 },
        { ...priceBrackets.mid500k_1500k, pct: totalBottles > 0 ? Math.round((priceBrackets.mid500k_1500k.bottles / totalBottles) * 100) : 0 },
        { ...priceBrackets.grandCru, pct: totalBottles > 0 ? Math.round((priceBrackets.grandCru.bottles / totalBottles) * 100) : 0 },
    ]

    const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.totalQty - a.totalQty)

    const monthlyTrend = Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))

    const formattedOrders: CustomerHistorySOItem[] = orders.map(o => {
        let deliveryStatus = 'UNDELIVERED'
        if (o.status === 'DELIVERED' || o.deliveryOrders.some(d => d.status === 'DELIVERED')) {
            deliveryStatus = 'DELIVERED'
        } else if (o.deliveryOrders.some(d => d.status === 'PICKING' || d.status === 'PACKED')) {
            deliveryStatus = 'PREPARING'
        } else if (o.deliveryOrders.length > 0) {
            deliveryStatus = 'PREPARING'
        }

        const soTotal = Number(o.totalAmount)
        const soPaid = o.arInvoices.reduce((s, inv) => s + Number(inv.paidAmount ?? 0), 0)
        const soUnpaid = Math.max(0, soTotal - soPaid)

        return {
            id: o.id,
            soNo: o.soNo,
            createdAt: o.createdAt.toISOString(),
            orderType: (o as any).orderType || 'STANDARD',
            totalAmount: soTotal,
            paidAmount: soPaid,
            unpaidAmount: soUnpaid,
            status: o.status,
            deliveryStatus,
            salesRepName: o.salesRep?.name ?? '—',
            branchName: o.customer.id !== customer.id ? `${o.customer.code} - ${o.customer.name}` : null,
            totalBottles: o.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0),
            lineCount: o.lines.length,
            shippingAddress: o.shippingAddress?.address ? `${o.shippingAddress.label ? `[${o.shippingAddress.label}] ` : ''}${o.shippingAddress.address}` : null,
            receiverName: (o as any).receiverName || customer.receiverName || null,
            receiverPhone: (o as any).receiverPhone || customer.receiverPhone || null,
            deliveryNotes: (o as any).deliveryNotes || customer.deliveryNotes || null,
            deliveryOrders: o.deliveryOrders.map(d => ({ id: d.id, doNo: d.doNo, status: d.status })),
            arInvoices: o.arInvoices.map(i => ({ id: i.id, invoiceNo: i.invoiceNo, status: i.status, amount: Number(i.amount), paidAmount: Number(i.paidAmount ?? 0) })),
            lines: o.lines.map(l => {
                const qty = Number(l.qtyOrdered)
                const price = Number(l.unitPrice)
                const disc = Number(l.lineDiscountPct ?? 0)
                return {
                    id: l.id,
                    skuCode: l.product?.skuCode ?? '',
                    productName: l.product?.productName ?? '',
                    wineType: l.product?.wineType ?? null,
                    qtyOrdered: qty,
                    unitPrice: price,
                    lineDiscountPct: disc,
                    lineTotal: qty * price * (1 - (disc / 100)),
                }
            }),
        }
    })

    return serialize({
        customer: {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            channel: customer.channel,
            paymentTerm: customer.paymentTerm,
            creditLimit: Number(customer.creditLimit),
            entityType: customer.entityType,
            status: customer.status,
            basePriceType: customer.basePriceType ?? 'BY_CHANNEL',
            defaultDiscountPct: Number(customer.defaultDiscountPct ?? 0),
            salesRepName: customer.salesRep?.name ?? null,
            parentName: customer.parent ? `${customer.parent.code} - ${customer.parent.name}` : null,
            childrenCount: customer.children.length,
            purchasingName: customer.purchasingName,
            purchasingPhone: customer.purchasingPhone,
            receiverName: customer.receiverName,
            receiverPhone: customer.receiverPhone,
            deliveryNotes: customer.deliveryNotes,
        },
        kpis: {
            totalRevenue,
            totalOrders: orders.length,
            totalBottles,
            lastOrderDate: orders[0]?.createdAt.toISOString() ?? null,
            lastOrderNo: orders[0]?.soNo ?? null,
            totalPaidAmount,
            totalArDebt,
            overdueArDebt,
        },
        pricing: {
            basePriceType: customer.basePriceType ?? 'BY_CHANNEL',
            defaultDiscountPct: Number(customer.defaultDiscountPct ?? 0),
            specialRules,
            proposals,
        },
        health: {
            status: healthStatus,
            statusLabel: healthLabel,
            daysSinceLastOrder,
            averageOrderCycleDays,
            delayDays,
        },
        orderBreakdown: {
            commercialCount,
            commercialRevenue,
            commercialBottles,
            tastingCount,
            tastingBottles,
        },
        preferences: {
            wineTypes: wineTypePreferences,
            priceBrackets: priceTierPreferences,
        },
        orders: formattedOrders,
        topProducts: topProducts.map(p => ({
            ...p,
            lastPurchasedAt: p.lastPurchasedAt.toISOString(),
        })),
        monthlyTrend,
    })
}
