'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { serialize } from '@/lib/serialize'
import { requireAuth, hasRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { approveRequest, rejectRequest } from '@/lib/approval'
import { approveSalesOrder } from './sales/actions'
import { processProposalApproval } from './proposals/actions'
import { processPaymentApproval } from './payment-requests/actions'

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
    }, 30_000)
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
                where: { status: 'PENDING_APPROVAL' },
                select: {
                    id: true,
                    soNo: true,
                    totalAmount: true,
                    orderDiscount: true,
                    paymentTerm: true,
                    status: true,
                    createdAt: true,
                    customer: { select: { id: true, name: true, code: true } },
                    salesRep: { select: { name: true } },
                    lines: {
                        select: {
                            qtyOrdered: true,
                            unitPrice: true,
                            lineDiscountPct: true,
                            product: {
                                select: {
                                    marginPrice: { select: { costPrice: true } }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma.salesOrder.count({
                where: {
                    status: { not: 'CANCELLED' },
                    createdAt: { gte: from, lte: to },
                    ...entityFilter,
                },
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
            pendingSOs: pendingSOs.map(so => {
                const amount = Number(so.totalAmount)
                const orderDiscount = Number((so as any).orderDiscount ?? 0)
                let totalBottles = 0
                let estCogs = 0
                let maxLineDisc = 0

                for (const l of so.lines ?? []) {
                    const qty = Number(l.qtyOrdered)
                    const lineDisc = Number(l.lineDiscountPct ?? 0)
                    if (lineDisc > maxLineDisc) maxLineDisc = lineDisc
                    const unitCost = Number(l.product?.marginPrice?.costPrice ?? 0)
                    totalBottles += qty
                    estCogs += qty * unitCost
                }

                const estGrossProfit = amount - estCogs
                const estimatedMarginPct = amount > 0 && estCogs > 0 ? Math.round((estGrossProfit / amount) * 1000) / 10 : null
                const effectiveDiscountPct = Math.max(orderDiscount, maxLineDisc)

                return {
                    id: so.id,
                    soNo: so.soNo,
                    amount,
                    customerId: so.customer?.id ?? null,
                    customerName: so.customer?.name ?? 'Khách Lẻ',
                    customerCode: so.customer?.code ?? '',
                    salesRepName: so.salesRep?.name ?? '—',
                    paymentTerm: so.paymentTerm,
                    bottleCount: totalBottles,
                    estimatedMarginPct,
                    effectiveDiscountPct,
                    status: so.status,
                    createdAt: so.createdAt.toISOString(),
                }
            }),
        }
    }, 30_000) // Cache 30s
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

// ─── Approve/Reject SO (quick action from dashboard via DDD Sales Flow) ──────
export async function approveSO(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await approveSalesOrder(id)
        if (!res.success) {
            // Fallback if SO had no ApprovalRequest record created yet
            const user = await requireAuth()
            if (!hasRole(user, 'CEO', 'ADMIN', 'Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR')) {
                return { success: false, error: 'Bạn không có quyền phê duyệt đơn hàng này' }
            }
            const so = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true, soNo: true } })
            if (!so || so.status !== 'PENDING_APPROVAL') {
                return { success: false, error: res.error || 'Đơn hàng không ở trạng thái chờ duyệt' }
            }
            await prisma.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' } })
            await logAudit({
                userId: user.id,
                action: 'APPROVE',
                entityType: 'SalesOrder',
                entityId: id,
                newValue: { status: 'CONFIRMED', source: 'CEO_DASHBOARD' },
            }).catch(() => {})
        }
        revalidateCache('dashboard')
        revalidateCache('sales')
        revalidatePath('/dashboard')
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi phê duyệt đơn hàng' }
    }
}

export async function rejectSO(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'CEO', 'ADMIN', 'Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR')) {
            return { success: false, error: 'Bạn không có quyền từ chối đơn hàng này' }
        }

        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { status: true, soNo: true, totalAmount: true },
        })
        if (!so) return { success: false, error: 'Không tìm thấy đơn hàng' }
        if (so.status !== 'PENDING_APPROVAL') {
            return { success: false, error: `Đơn hàng không ở trạng thái Chờ Duyệt (hiện: ${so.status})` }
        }

        const cleanReason = reason?.trim() || 'Ban Giám Đốc từ chối phê duyệt từ Dashboard'

        const approvalReq = await prisma.approvalRequest.findFirst({
            where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' },
        })

        if (approvalReq) {
            await prisma.approvalLog.create({
                data: {
                    requestId: approvalReq.id,
                    step: approvalReq.currentStep,
                    action: 'REJECT',
                    approvedBy: user.id,
                    comment: cleanReason,
                },
            })
            await prisma.approvalRequest.update({
                where: { id: approvalReq.id },
                data: { status: 'REJECTED' },
            })
        }

        await prisma.salesOrder.update({
            where: { id },
            data: { status: 'CANCELLED' },
        })

        await logAudit({
            userId: user.id,
            action: 'REJECT',
            entityType: 'SalesOrder',
            entityId: id,
            newValue: { status: 'CANCELLED', soNo: so.soNo, amount: Number(so.totalAmount), reason: cleanReason },
        }).catch(() => {})

        revalidateCache('dashboard')
        revalidateCache('sales')
        revalidatePath('/dashboard')
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi từ chối đơn hàng' }
    }
}

// ─── Direct CEO Actions for Proposals, Payment Requests & Approval Engine ───
export async function approveProposalFromDashboard(proposalId: string, comment?: string): Promise<{ success: boolean; error?: string }> {
    const res = await processProposalApproval({
        proposalId,
        action: 'APPROVE',
        comment: comment || 'CEO phê duyệt nhanh từ Dashboard',
    })
    if (res.success) {
        revalidateCache('dashboard')
        revalidatePath('/dashboard')
    }
    return { success: res.success, error: res.error }
}

export async function rejectProposalFromDashboard(proposalId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const res = await processProposalApproval({
        proposalId,
        action: 'REJECT',
        comment: reason?.trim() || 'CEO từ chối từ Dashboard',
    })
    if (res.success) {
        revalidateCache('dashboard')
        revalidatePath('/dashboard')
    }
    return { success: res.success, error: res.error }
}

export async function getPendingPaymentRequestsForCEO() {
    return cached('dashboard:pending-payment-requests', async () => {
        const requests = await prisma.paymentRequest.findMany({
            where: {
                status: { in: ['SUBMITTED', 'REVIEWING_L1', 'REVIEWING_L2'] },
            },
            include: {
                creator: { select: { name: true, email: true } },
                department: { select: { name: true } },
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' },
            ],
            take: 10,
        })

        return requests.map(r => ({
            id: r.id,
            requestNo: r.requestNo,
            title: r.title,
            category: r.category,
            priority: r.priority,
            status: r.status,
            currentLevel: r.currentLevel,
            totalAmountVND: Number(r.totalAmountVND),
            beneficiaryName: r.beneficiaryName,
            creatorName: r.creator?.name || r.creator?.email || '—',
            departmentName: r.department?.name || null,
            dueDate: r.dueDate ? r.dueDate.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
        }))
    }, 10_000)
}

export async function approvePaymentRequestFromDashboard(requestId: string, comment?: string): Promise<{ success: boolean; error?: string }> {
    const res = await processPaymentApproval({
        requestId,
        action: 'APPROVE',
        comment: comment || 'CEO phê duyệt từ Dashboard',
    })
    if (res.success) {
        revalidateCache('dashboard')
        revalidatePath('/dashboard')
    }
    return { success: res.success, error: res.error }
}

export async function rejectPaymentRequestFromDashboard(requestId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const res = await processPaymentApproval({
        requestId,
        action: 'REJECT',
        comment: reason?.trim() || 'CEO từ chối từ Dashboard',
    })
    if (res.success) {
        revalidateCache('dashboard')
        revalidatePath('/dashboard')
    }
    return { success: res.success, error: res.error }
}

export async function approveEngineRequestFromDashboard(requestId: string, comment?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const res = await approveRequest({
            requestId,
            approvedBy: user.id,
            approverName: user.name,
            comment: comment || 'Phê duyệt từ Dashboard CEO',
        })
        if (res.success) {
            revalidateCache('dashboard')
            revalidatePath('/dashboard')
        }
        return res
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function rejectEngineRequestFromDashboard(requestId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const res = await rejectRequest({
            requestId,
            rejectedBy: user.id,
            rejectorName: user.name,
            reason: reason?.trim() || 'Từ chối từ Dashboard CEO',
        })
        if (res.success) {
            revalidateCache('dashboard')
            revalidatePath('/dashboard')
        }
        return res
    } catch (err: any) {
        return { success: false, error: err.message }
    }
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

// ─── Slow-moving / Dead stock alert (Single-query, zero N+1) ──────────────────────
export async function getSlowMovingStock() {
    return cached('dashboard:slow-stock', async () => {
        const now = new Date()
        const d90 = new Date(now.getTime() - 90 * 86400000)
        const d180 = new Date(now.getTime() - 180 * 86400000)

        const [products, salesLines] = await Promise.all([
            prisma.product.findMany({
                where: { deletedAt: null, status: 'ACTIVE' },
                include: {
                    marginPrice: { select: { costPrice: true, wholesalePrice: true } },
                    stockLots: {
                        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                        select: { qtyAvailable: true, unitLandedCost: true },
                    },
                },
            }),
            prisma.salesOrderLine.findMany({
                where: {
                    so: { status: { not: 'CANCELLED' } },
                },
                select: {
                    productId: true,
                    so: { select: { createdAt: true } },
                },
            }),
        ])

        const lastSaleMap = new Map<string, Date>()
        for (const sol of salesLines) {
            const dt = sol.so?.createdAt
            if (!dt) continue
            const prev = lastSaleMap.get(sol.productId)
            if (!prev || dt > prev) {
                lastSaleMap.set(sol.productId, dt)
            }
        }

        const alerts: {
            productId: string
            skuCode: string
            productName: string
            qtyAvailable: number
            stockValue: number
            lastSaleDate: string | null
            daysSinceLastSale: number | null
            severity: 'slow' | 'dead'
        }[] = []

        for (const p of products) {
            const totalQty = p.stockLots.reduce((s: number, l: any) => s + Number(l.qtyAvailable), 0)
            if (totalQty === 0) continue

            const fallbackCost = Number(p.marginPrice?.costPrice ?? p.marginPrice?.wholesalePrice ?? 350000)
            const stockValue = p.stockLots.reduce((s: number, l: any) => {
                const uc = Number(l.unitLandedCost) > 0 ? Number(l.unitLandedCost) : fallbackCost
                return s + Number(l.qtyAvailable) * uc
            }, 0)

            const lastSale = lastSaleMap.get(p.id)
            const daysSinceLastSale = lastSale
                ? Math.floor((now.getTime() - lastSale.getTime()) / 86400000)
                : null

            if (!lastSale || lastSale < d180) {
                alerts.push({
                    productId: p.id,
                    skuCode: p.skuCode,
                    productName: p.productName,
                    qtyAvailable: totalQty,
                    stockValue,
                    lastSaleDate: lastSale ? lastSale.toISOString() : null,
                    daysSinceLastSale,
                    severity: 'dead',
                })
            } else if (lastSale < d90) {
                alerts.push({
                    productId: p.id,
                    skuCode: p.skuCode,
                    productName: p.productName,
                    qtyAvailable: totalQty,
                    stockValue,
                    lastSaleDate: lastSale.toISOString(),
                    daysSinceLastSale,
                    severity: 'slow',
                })
            }
        }

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
            const orderDiscPct = Number((so as any).orderDiscount ?? 0)
            const orderDiscFactor = Math.max(0, 1 - orderDiscPct / 100)
            for (const line of so.lines || []) {
                const qty = Number(line.qtyOrdered)
                const price = Number(line.unitPrice)
                const discPct = Number(line.lineDiscountPct)
                const rev = qty * price * (1 - discPct / 100) * orderDiscFactor
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
    }, 30_000)
}

// ─── Cash Position for Dashboard ─────────────────────────
export async function getCashPosition(options?: DashboardFilterOptions) {
    const now = new Date()
    const from = options?.from ?? startOfMonth(now)
    const to = options?.to ?? endOfMonth(now)
    const entityId = options?.legalEntityId
    const in30Days = new Date(now.getTime() + 30 * 86400000)

    const cacheKey = `dashboard:cash-position:${from.getTime()}-${to.getTime()}-${entityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const arEntityFilter = entityId ? { invoice: { legalEntityId: entityId } } : {}
        const apEntityFilter = entityId ? { invoice: { legalEntityId: entityId } } : {}
        const invEntityFilter = entityId ? { legalEntityId: entityId } : {}

        const [arPayments, apPayments, approvedExpenses, unpaidInvoices, unpaidAPInvoices, approvedPendingPRs] = await Promise.all([
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

            // Total outstanding AP + due dates for 30-day obligation projection
            prisma.aPInvoice.findMany({
                where: {
                    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                    ...invEntityFilter,
                },
                select: {
                    amount: true,
                    exchangeRate: true,
                    dueDate: true,
                    payments: { select: { amount: true } },
                },
            }),

            // Approved payment requests awaiting disbursement
            prisma.paymentRequest.aggregate({
                where: {
                    status: 'APPROVED',
                    ...(entityId ? { legalEntityId: entityId } : {}),
                },
                _sum: { totalAmountVND: true },
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

        let apOutstanding = 0
        let apDueWithin30d = 0
        for (const inv of unpaidAPInvoices) {
            const rate = Number(inv.exchangeRate ?? 1)
            const totalVnd = Number(inv.amount) * rate
            const paidVnd = inv.payments.reduce((pSum, p) => pSum + Number(p.amount) * rate, 0)
            const rem = Math.max(0, totalVnd - paidVnd)
            apOutstanding += rem
            if (rem > 0 && inv.dueDate && new Date(inv.dueDate) <= in30Days) {
                apDueWithin30d += rem
            }
        }

        const pendingDisbursementPR = Number(approvedPendingPRs._sum.totalAmountVND ?? 0)

        return {
            cashIn,
            cashOutAP,
            cashOutExpenses,
            cashOut,
            netCashFlow,
            arOutstanding,
            apOutstanding,
            apDueWithin30d,
            pendingDisbursementPR,
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
export async function exportDashboardExcel(options?: DashboardFilterOptions): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const [stats, plSummary, cashPosition, arAging, topCust, topProd] = await Promise.all([
        getDashboardStats('month', options),
        getPLSummary(options),
        getCashPosition(options),
        getARAgingChart(options),
        getTopCustomers(5, options),
        getTopProducts(5, options),
    ])

    const primaryRev = plSummary.revenue > 0 ? plSummary.revenue : stats.revenue

    // Sheet 1: KPI & Financial Summary
    const kpiRows: Array<{ metric: string; value: number | string; unit: string }> = [
        { metric: 'Doanh Thu Kỳ Lọc', value: Math.round(primaryRev), unit: 'VND' },
        { metric: 'Tăng Trưởng vs Kỳ Trước (%)', value: Number(stats.revenueGrowth.toFixed(1)), unit: '%' },
        { metric: 'Số Đơn Hàng Phát Sinh', value: stats.monthOrders, unit: 'đơn' },
        { metric: 'Giá Vốn Hàng Bán (COGS)', value: Math.round(plSummary.cogs), unit: 'VND' },
        { metric: 'Lợi Nhuận Gộp (Gross Profit)', value: Math.round(plSummary.grossProfit), unit: 'VND' },
        { metric: 'Biên Lợi Nhuận Gộp (%)', value: Number(plSummary.grossMargin.toFixed(1)), unit: '%' },
        { metric: 'Chi Phí Vận Hành (OPEX)', value: Math.round(plSummary.expenses), unit: 'VND' },
        { metric: 'Lợi Nhuận Ròng (Net Profit)', value: Math.round(plSummary.netProfit), unit: 'VND' },
        { metric: 'Dòng Tiền Ròng (Net Cash Flow)', value: Math.round(cashPosition.netCashFlow), unit: 'VND' },
        { metric: 'Thu Nợ Khách Hàng (AR Inflow)', value: Math.round(cashPosition.cashIn), unit: 'VND' },
        { metric: 'Chi Trả Nhà Cung Cấp (AP Outflow)', value: Math.round(cashPosition.cashOutAP), unit: 'VND' },
        { metric: 'Tổng Công Nợ Phải Thu (AR)', value: Math.round(arAging.totalOutstanding), unit: 'VND' },
        { metric: 'Tổng Công Nợ Phải Trả (AP)', value: Math.round(cashPosition.apOutstanding), unit: 'VND' },
        { metric: 'Tồn Kho Khả Dụng (Chai)', value: stats.stockQty, unit: 'chai' },
        { metric: 'Tổng Giá Trị Tồn Kho', value: Math.round(stats.stockTotalValue), unit: 'VND' },
        ...topCust.map((c, idx) => ({
            metric: `Top KH #${idx + 1}: ${c.name}`,
            value: Math.round(c.revenue),
            unit: `VND (${c.orders} đơn)`,
        })),
        ...topProd.map((p, idx) => ({
            metric: `Top SP #${idx + 1}: ${p.name}`,
            value: Math.round(p.revenue),
            unit: `VND (${p.qty} chai)`,
        })),
    ]

    const buffer = await generateExcelBuffer({
        sheetName: 'CEO Executive Summary',
        title: `CEO Dashboard — ${new Date().toLocaleDateString('vi-VN')}`,
        columns: [
            { header: 'Chỉ số / Hạng mục', key: 'metric', width: 42 },
            { header: 'Giá trị', key: 'value', width: 22, numFmt: '#,##0' },
            { header: 'Đơn vị / Ghi chú', key: 'unit', width: 18 },
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
                const orderDiscPct = Number((so as any).orderDiscount ?? 0)
                const orderDiscFactor = Math.max(0, 1 - orderDiscPct / 100)
                for (const l of so.lines) {
                    const qty = Number(l.qtyOrdered)
                    const price = Number(l.unitPrice)
                    const discPct = Number(l.lineDiscountPct)
                    const rev = qty * price * (1 - discPct / 100) * orderDiscFactor
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

// ─── Revenue YoY Comparison (12 months, Entity-aware) ──────────────
export async function getRevenueYoY(options?: DashboardFilterOptions) {
    const entityId = options?.legalEntityId
    const cacheKey = `dashboard:revenue-yoy:${entityId ?? 'all'}`

    return cached(cacheKey, async () => {
        const now = new Date()
        const thisYear = now.getFullYear()
        const lastYear = thisYear - 1
        const entityFilter = entityId ? { legalEntityId: entityId } : {}

        // Fetch all matching orders for both years in a single query
        const orders = await prisma.salesOrder.findMany({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: {
                    gte: new Date(lastYear, 0, 1),
                    lte: new Date(thisYear, 11, 31, 23, 59, 59, 999),
                },
                ...entityFilter,
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
    | 'my_sales' | 'warehouse_summary' | 'legal_compliance' | 'top_products'

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
            'shipment_tracker', 'kpi_targets', 'legal_compliance', 'top_products', 'stock_alerts',
        ],
        quickLinks: [
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
            { label: 'Đề nghị TT', href: '/dashboard/payment-requests', icon: 'ClipboardCheck' },
            { label: 'Tài chính', href: '/dashboard/finance', icon: 'DollarSign' },
            { label: 'Pháp lý', href: '/dashboard/contracts', icon: 'Shield' },
        ],
    },
    SALES_MGR: {
        greeting: 'Quản Lý Bán Hàng',
        sections: [
            'kpi_cards', 'revenue_chart', 'recent_orders', 'my_sales',
            'ar_aging', 'kpi_targets', 'pending_approvals', 'top_products',
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
            'kpi_cards', 'revenue_chart', 'pl_summary', 'cash_position', 'ar_aging',
            'pending_approvals', 'cost_waterfall', 'revenue_yoy', 'top_products',
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
            'ar_aging', 'shipment_tracker', 'kpi_targets', 'top_products', 'stock_alerts',
        ],
        quickLinks: [
            { label: 'Đơn hàng', href: '/dashboard/sales', icon: 'Package' },
            { label: 'Khách hàng', href: '/dashboard/crm', icon: 'Users' },
            { label: 'Báo cáo', href: '/dashboard/reports', icon: 'BarChart3' },
        ],
    },
}

const DASHBOARD_ROLE_MATCHERS: Record<string, string[]> = {
    CEO: ['CEO', 'ADMIN', 'SYS:ADMIN', 'DIRECTOR', 'BOD', 'Admin', 'Giám Đốc', 'Trợ Lý', 'Trợ lý', 'TRO_LY', 'ASSISTANT'],
    KE_TOAN: ['KE_TOAN', 'Kế Toán', 'Kế toán', 'ACCOUNTANT', 'ACCOUNTING', 'CHIEF_ACCOUNTANT', 'KE_TOAN_TRUONG', 'Kế toán trưởng'],
    SALES_MGR: ['SALES_MGR', 'Sales Manager', 'CBO', 'MANAGER', 'TP', 'TRUONG_PHONG', 'Trưởng Phòng'],
    SALES_ADMIN: ['SALES_ADMIN', 'SALE_ADMIN', 'Sales Admin', 'Sale Admin', 'sale admin'],
    THU_KHO: ['THU_KHO', 'Thủ Kho', 'THU_KHO_TRUONG', 'WAREHOUSE_MANAGER'],
    THU_MUA: ['THU_MUA', 'Thu Mua', 'PURCHASING'],
    SALES_REP: ['SALES_REP', 'Sales Rep', 'SALES', 'Nhân Viên Kinh Doanh'],
}

export async function getDashboardConfig(roles: string[]): Promise<DashboardConfig> {
    // Priority: CEO > KE_TOAN > SALES_MGR > SALES_ADMIN > THU_KHO > THU_MUA > SALES_REP
    const priority = ['CEO', 'KE_TOAN', 'SALES_MGR', 'SALES_ADMIN', 'THU_KHO', 'THU_MUA', 'SALES_REP']

    for (const roleKey of priority) {
        const matchers = DASHBOARD_ROLE_MATCHERS[roleKey] ?? [roleKey]
        if (roles.some(r => matchers.includes(r))) {
            return ROLE_DASHBOARD[roleKey]
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
                lineDiscountPct: true,
                so: { select: { orderDiscount: true } },
                product: {
                    select: {
                        id: true,
                        skuCode: true,
                        productName: true,
                        marginPrice: { select: { costPrice: true } },
                    },
                },
            },
        })

        const map = new Map<string, { id: string; sku: string; name: string; qty: number; revenue: number; cogs: number }>()
        for (const l of lines) {
            const pid = l.product?.id ?? 'unknown'
            const existing = map.get(pid)
            const qty = Number(l.qtyOrdered)
            const price = Number(l.unitPrice)
            const lineDisc = Number(l.lineDiscountPct ?? 0)
            const orderDisc = Number((l.so as any)?.orderDiscount ?? 0)
            const lineRevenue = qty * price * (1 - lineDisc / 100) * Math.max(0, 1 - orderDisc / 100)
            const unitCost = Number(l.product?.marginPrice?.costPrice ?? 0)
            const lineCogs = qty * unitCost

            if (existing) {
                existing.qty += qty
                existing.revenue += lineRevenue
                existing.cogs += lineCogs
            } else {
                map.set(pid, { id: pid, sku: l.product?.skuCode ?? '?',
                    name: l.product?.productName ?? 'Unknown',
                    qty,
                    revenue: lineRevenue,
                    cogs: lineCogs,
                })
            }
        }

        return Array.from(map.values())
            .map(item => ({ id: item.id, sku: item.sku,
                name: item.name,
                qty: item.qty,
                revenue: item.revenue,
                marginPct: item.revenue > 0 && item.cogs > 0
                    ? Math.round(((item.revenue - item.cogs) / item.revenue) * 100)
                    : null,
            }))
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
            HORECA: '#0891B2',
            WHOLESALE: '#0E7490',
            VIP_RETAIL: '#B45309',
            POS: '#15803D',
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

    // 5. Calculate Metrics, Health, Preferences, and Monthly Trends (including migrated pre-Aug 2026 Supabase records)
    const histTargetIds = customer.parent ? [...targetCustomerIds, customer.parent.id] : targetCustomerIds
    const histCustomerSales = await prisma.historicalCustomerSkuSale.findMany({
        where: {
            OR: [
                { customerId: { in: histTargetIds } },
                { customerCode: { in: [customer.code, ...customer.children.map(c => c.code)] } },
            ],
            ...(dateFilter ? { invoiceDate: dateFilter } : {}),
        },
        include: {
            product: {
                select: {
                    id: true,
                    skuCode: true,
                    productName: true,
                    wineType: true,
                    country: true,
                },
            },
        },
        orderBy: { invoiceDate: 'desc' },
    })
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

    // Process migrated pre-Aug 2026 historical sales from Supabase
    const histInvoiceGroups = new Map<string, {
        id: string
        soNo: string
        createdAt: Date
        legalEntity: string | null
        customerName: string
        customerCode: string | null
        totalAmount: number
        totalBottles: number
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
    }>()

    for (const h of histCustomerSales) {
        const qty = Number(h.qty)
        const price = Number(h.unitPrice)
        const lineSpend = Number(h.totalAmount) || Math.round(qty * price)
        const invDate = new Date(h.invoiceDate)

        totalRevenue += lineSpend
        totalPaidAmount += lineSpend
        totalBottles += qty
        commercialRevenue += lineSpend
        commercialBottles += qty

        const invNoDisplay = h.invoiceNo ? `HĐ-${h.invoiceNo}` : (h.voucherNo || `HIST-${h.month}`)
        const grpKey = `${h.month}|${invNoDisplay}`
        const existingGrp = histInvoiceGroups.get(grpKey)
        if (existingGrp) {
            existingGrp.totalAmount += lineSpend
            existingGrp.totalBottles += qty
            existingGrp.lines.push({
                id: h.id,
                skuCode: h.product?.skuCode ?? h.skuCode,
                productName: h.product?.productName ?? h.productName ?? h.skuCode,
                wineType: h.product?.wineType ?? null,
                qtyOrdered: qty,
                unitPrice: price,
                lineDiscountPct: 0,
                lineTotal: lineSpend,
            })
        } else {
            histInvoiceGroups.set(grpKey, {
                id: h.id,
                soNo: invNoDisplay,
                createdAt: invDate,
                legalEntity: h.legalEntity ?? null,
                customerName: h.customerName,
                customerCode: h.customerCode ?? null,
                totalAmount: lineSpend,
                totalBottles: qty,
                lines: [{
                    id: h.id,
                    skuCode: h.product?.skuCode ?? h.skuCode,
                    productName: h.product?.productName ?? h.productName ?? h.skuCode,
                    wineType: h.product?.wineType ?? null,
                    qtyOrdered: qty,
                    unitPrice: price,
                    lineDiscountPct: 0,
                    lineTotal: lineSpend,
                }],
            })
        }

        const wt = h.product?.wineType || 'OTHER'
        const curWt = wineTypeMap.get(wt) ?? { bottles: 0, revenue: 0 }
        curWt.bottles += qty
        curWt.revenue += lineSpend
        wineTypeMap.set(wt, curWt)

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

        const pid = h.product?.id ?? `sku:${h.skuCode}`
        const pCurr = productMap.get(pid)
        if (pCurr) {
            pCurr.totalQty += qty
            pCurr.totalSpend += lineSpend
            if (invDate > new Date(pCurr.lastPurchasedAt)) {
                pCurr.lastUnitPrice = price
                pCurr.lastPurchasedAt = invDate
            }
        } else {
            productMap.set(pid, {
                productId: h.product?.id ?? '',
                skuCode: h.product?.skuCode ?? h.skuCode,
                name: h.product?.productName ?? h.productName ?? h.skuCode,
                wineType: h.product?.wineType ?? null,
                originCountry: h.product?.country ?? null,
                totalQty: qty,
                totalSpend: lineSpend,
                lastUnitPrice: price,
                lastPurchasedAt: invDate,
            })
        }
    }

    commercialCount += histInvoiceGroups.size
    for (const grp of histInvoiceGroups.values()) {
        const mKey = `${grp.createdAt.getFullYear()}-${String(grp.createdAt.getMonth() + 1).padStart(2, '0')}`
        const mLabel = `T${grp.createdAt.getMonth() + 1}/${String(grp.createdAt.getFullYear()).slice(-2)}`
        const mCurr = monthlyMap.get(mKey) ?? { month: mKey, label: mLabel, revenue: 0, bottles: 0, orders: 0 }
        mCurr.revenue += grp.totalAmount
        mCurr.bottles += grp.totalBottles
        mCurr.orders += 1
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

    const histFormattedOrders: CustomerHistorySOItem[] = Array.from(histInvoiceGroups.values()).map(grp => ({
        id: grp.id,
        soNo: grp.soNo,
        createdAt: grp.createdAt.toISOString(),
        orderType: 'STANDARD',
        totalAmount: Math.round(grp.totalAmount),
        paidAmount: Math.round(grp.totalAmount),
        unpaidAmount: 0,
        status: 'PAID',
        deliveryStatus: 'DELIVERED',
        salesRepName: customer.salesRep?.name ?? (grp.legalEntity || '—'),
        branchName: grp.customerCode && grp.customerCode !== customer.code ? `${grp.customerCode} - ${grp.customerName}` : null,
        totalBottles: grp.totalBottles,
        lineCount: grp.lines.length,
        shippingAddress: null,
        receiverName: customer.receiverName || null,
        receiverPhone: customer.receiverPhone || null,
        deliveryNotes: grp.legalEntity ? `Hóa đơn lịch sử trước T8/2026 (${grp.legalEntity})` : 'Hóa đơn lịch sử trước T8/2026',
        deliveryOrders: [],
        arInvoices: [],
        lines: grp.lines,
    }))

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
            totalOrders: formattedOrders.length + histFormattedOrders.length,
            totalBottles,
            lastOrderDate: formattedOrders[0]?.createdAt ?? histFormattedOrders[0]?.createdAt ?? null,
            lastOrderNo: formattedOrders[0]?.soNo ?? histFormattedOrders[0]?.soNo ?? null,
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
        orders: [...formattedOrders, ...histFormattedOrders],
        topProducts: topProducts.map(p => ({
            ...p,
            lastPurchasedAt: p.lastPurchasedAt.toISOString(),
        })),
        monthlyTrend,
    })
}


// ═══════════════════════════════════════════════════
// SKU 360° ANALYTICS & CUSTOMER BUYER DISTRIBUTION
// ═══════════════════════════════════════════════════

export interface DashboardProductSearchItem {
    id: string
    skuCode: string
    productName: string
    wineType: string
    country: string
    producerName: string
    totalStock: number
    wholesalePrice: number
    retailPrice: number
    activeBuyerCount: number
    totalSoldBottles: number
}

export async function searchProductsForDashboard(query: string = ''): Promise<DashboardProductSearchItem[]> {
    const allSkus = await cached('dashboard:sku-search-all-v2', async () => {
        const rows = await prisma.$queryRawUnsafe<Array<{
            id: string
            skuCode: string
            productName: string
            wineType: string
            country: string
            producerName: string | null
            wholesalePrice: any
            retailPrice: any
            totalStock: any
            liveBottles: any
            histBottles: any
            activeBuyerCount: any
        }>>(`
            WITH stock_agg AS (
                SELECT "productId", COALESCE(SUM("qtyAvailable"), 0) AS total_stock
                FROM stock_lots
                WHERE status = 'AVAILABLE' AND "qtyAvailable" > 0
                GROUP BY "productId"
            ),
            so_agg AS (
                SELECT sol."productId",
                       COALESCE(SUM(sol."qtyOrdered"), 0) AS live_bottles,
                       ARRAY_AGG(DISTINCT so."customerId") FILTER (WHERE so."customerId" IS NOT NULL) AS so_buyers
                FROM sales_order_lines sol
                JOIN sales_orders so ON sol."soId" = so.id
                WHERE so.status != 'CANCELLED'
                GROUP BY sol."productId"
            ),
            hist_agg AS (
                SELECT COALESCE(h."productId", p.id) AS prod_id,
                       COALESCE(SUM(h.qty), 0) AS hist_bottles,
                       ARRAY_AGG(DISTINCT COALESCE(h."customerId", h."customerCode", h."customerName")) AS hist_buyers
                FROM historical_customer_sku_sales h
                LEFT JOIN products p ON p."skuCode" = h."skuCode" AND p."deletedAt" IS NULL
                GROUP BY COALESCE(h."productId", p.id)
            ),
            rule_agg AS (
                SELECT "productId",
                       ARRAY_AGG(DISTINCT "customerId") AS rule_buyers
                FROM customer_price_rules
                WHERE status = 'APPROVED'
                GROUP BY "productId"
            )
            SELECT p.id,
                   p."skuCode",
                   p."productName",
                   p."wineType"::text AS "wineType",
                   p.country,
                   pr.name AS "producerName",
                   COALESCE(mp."wholesalePrice", 0) AS "wholesalePrice",
                   COALESCE(mp."retailPrice", 0) AS "retailPrice",
                   COALESCE(st.total_stock, 0) AS "totalStock",
                   COALESCE(sa.live_bottles, 0) AS "liveBottles",
                   COALESCE(ha.hist_bottles, 0) AS "histBottles",
                   (
                       SELECT COUNT(DISTINCT b)
                       FROM UNNEST(
                           COALESCE(sa.so_buyers, ARRAY[]::text[]) ||
                           COALESCE(ha.hist_buyers, ARRAY[]::text[]) ||
                           COALESCE(ra.rule_buyers, ARRAY[]::text[])
                       ) AS b
                       WHERE b IS NOT NULL
                   ) AS "activeBuyerCount"
            FROM products p
            LEFT JOIN producers pr ON pr.id = p."producerId"
            LEFT JOIN product_margin_prices mp ON mp."productId" = p.id
            LEFT JOIN stock_agg st ON st."productId" = p.id
            LEFT JOIN so_agg sa ON sa."productId" = p.id
            LEFT JOIN hist_agg ha ON ha.prod_id = p.id
            LEFT JOIN rule_agg ra ON ra."productId" = p.id
            WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE'
        `)

        const mapped: DashboardProductSearchItem[] = rows.map(r => {
            const liveB = Number(r.liveBottles || 0)
            const histB = Number(r.histBottles || 0)
            return {
                id: r.id,
                skuCode: r.skuCode,
                productName: r.productName,
                wineType: r.wineType,
                country: r.country,
                producerName: r.producerName ?? '—',
                totalStock: Number(r.totalStock || 0),
                wholesalePrice: Number(r.wholesalePrice || 0),
                retailPrice: Number(r.retailPrice || 0),
                activeBuyerCount: Number(r.activeBuyerCount || 0),
                totalSoldBottles: liveB + histB,
            }
        })

        mapped.sort((a, b) => {
            if (b.totalSoldBottles !== a.totalSoldBottles) return b.totalSoldBottles - a.totalSoldBottles
            if (b.activeBuyerCount !== a.activeBuyerCount) return b.activeBuyerCount - a.activeBuyerCount
            return b.totalStock - a.totalStock
        })

        return mapped
    }, 120_000)

    const q = query.trim().toLowerCase()
    if (!q) return allSkus.slice(0, 30)

    return allSkus
        .filter(item =>
            item.skuCode.toLowerCase().includes(q) ||
            item.productName.toLowerCase().includes(q) ||
            item.country.toLowerCase().includes(q) ||
            item.producerName.toLowerCase().includes(q)
        )
        .slice(0, 30)
}

export interface SkuReplenishmentAlertItem {
    id: string
    skuCode: string
    productName: string
    wineType: string
    country: string
    producerName: string
    unitsPerCase: number
    totalStock: number
    incomingQty: number
    activeBuyerCount: number
    sold6m: number
    sold12m: number
    avgMonthlySales: number
    mosCurrent: number
    mosWithIncoming: number
    estimatedRunoutDate: string | null
    suggestedReorderBottles: number
    suggestedReorderCases: number
    estimatedReorderCostVnd: number
    urgencyTier: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'PLAN_REORDER'
    urgencyLabelVi: string
    urgencyLabelEn: string
}

export async function getSkuReplenishmentAlerts(): Promise<SkuReplenishmentAlertItem[]> {
    return cached('dashboard:sku-replenishment-alerts-v1', async () => {
        const rows = await prisma.$queryRawUnsafe<Array<{
            id: string
            skuCode: string
            productName: string
            wineType: string
            country: string
            producerName: string | null
            unitsPerCase: any
            costPrice: any
            totalStock: any
            incomingQty: any
            so6m: any
            so12m: any
            soAll: any
            hist6m: any
            hist12m: any
            histAll: any
            activeBuyerCount: any
        }>>(`
            WITH stock_agg AS (
                SELECT "productId",
                       COALESCE(SUM("qtyAvailable"), 0) AS total_stock,
                       AVG(NULLIF("unitLandedCost", 0)) AS avg_lot_cost
                FROM stock_lots
                WHERE status = 'AVAILABLE' AND "qtyAvailable" > 0
                GROUP BY "productId"
            ),
            po_agg AS (
                SELECT pol."productId",
                       COALESCE(SUM(pol."qtyOrdered"), 0) AS incoming_qty
                FROM purchase_order_lines pol
                JOIN purchase_orders po ON pol."poId" = po.id
                WHERE po.status IN ('APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED')
                GROUP BY pol."productId"
            ),
            so_agg AS (
                SELECT sol."productId",
                       COALESCE(SUM(sol."qtyOrdered") FILTER (WHERE so."createdAt" >= NOW() - INTERVAL '6 months' AND COALESCE(so."orderType", 'STANDARD') NOT IN ('TASTING', 'SAMPLE')), 0) AS so_6m,
                       COALESCE(SUM(sol."qtyOrdered") FILTER (WHERE so."createdAt" >= NOW() - INTERVAL '12 months' AND COALESCE(so."orderType", 'STANDARD') NOT IN ('TASTING', 'SAMPLE')), 0) AS so_12m,
                       COALESCE(SUM(sol."qtyOrdered") FILTER (WHERE COALESCE(so."orderType", 'STANDARD') NOT IN ('TASTING', 'SAMPLE')), 0) AS so_all,
                       ARRAY_AGG(DISTINCT so."customerId") FILTER (WHERE so."customerId" IS NOT NULL) AS so_buyers
                FROM sales_order_lines sol
                JOIN sales_orders so ON sol."soId" = so.id
                WHERE so.status != 'CANCELLED'
                GROUP BY sol."productId"
            ),
            hist_agg AS (
                SELECT COALESCE(h."productId", p.id) AS prod_id,
                       COALESCE(SUM(h.qty) FILTER (WHERE h."invoiceDate" >= NOW() - INTERVAL '6 months'), 0) AS hist_6m,
                       COALESCE(SUM(h.qty) FILTER (WHERE h."invoiceDate" >= NOW() - INTERVAL '12 months'), 0) AS hist_12m,
                       COALESCE(SUM(h.qty), 0) AS hist_all,
                       ARRAY_AGG(DISTINCT COALESCE(h."customerId", h."customerCode", h."customerName")) AS hist_buyers
                FROM historical_customer_sku_sales h
                LEFT JOIN products p ON p."skuCode" = h."skuCode" AND p."deletedAt" IS NULL
                GROUP BY COALESCE(h."productId", p.id)
            ),
            imp_cost_agg AS (
                SELECT COALESCE(hi."productId", p.id) AS prod_id,
                       AVG(NULLIF(hi."landedCostVnd", 0)) FILTER (WHERE hi."importType" = 'DIRECT_IMPORT') AS avg_imp_cost
                FROM historical_sku_imports hi
                LEFT JOIN products p ON p."skuCode" = hi."skuCode" AND p."deletedAt" IS NULL
                GROUP BY COALESCE(hi."productId", p.id)
            )
            SELECT p.id,
                   p."skuCode",
                   p."productName",
                   p."wineType"::text AS "wineType",
                   p.country,
                   pr.name AS "producerName",
                   COALESCE(p."unitsPerCase", 6) AS "unitsPerCase",
                   COALESCE(ic.avg_imp_cost, st.avg_lot_cost, mp."costPrice", 0) AS "costPrice",
                   COALESCE(st.total_stock, 0) AS "totalStock",
                   COALESCE(pa.incoming_qty, 0) AS "incomingQty",
                   COALESCE(sa.so_6m, 0) AS "so6m",
                   COALESCE(sa.so_12m, 0) AS "so12m",
                   COALESCE(sa.so_all, 0) AS "soAll",
                   COALESCE(ha.hist_6m, 0) AS "hist6m",
                   COALESCE(ha.hist_12m, 0) AS "hist12m",
                   COALESCE(ha.hist_all, 0) AS "histAll",
                   (
                       SELECT COUNT(DISTINCT b)
                       FROM UNNEST(
                           COALESCE(sa.so_buyers, ARRAY[]::text[]) ||
                           COALESCE(ha.hist_buyers, ARRAY[]::text[])
                       ) AS b
                       WHERE b IS NOT NULL
                   ) AS "activeBuyerCount"
            FROM products p
            LEFT JOIN producers pr ON pr.id = p."producerId"
            LEFT JOIN product_margin_prices mp ON mp."productId" = p.id
            LEFT JOIN stock_agg st ON st."productId" = p.id
            LEFT JOIN po_agg pa ON pa."productId" = p.id
            LEFT JOIN so_agg sa ON sa."productId" = p.id
            LEFT JOIN hist_agg ha ON ha.prod_id = p.id
            LEFT JOIN imp_cost_agg ic ON ic.prod_id = p.id
            WHERE p."deletedAt" IS NULL AND p.status = 'ACTIVE'
        `)

        const now = new Date()
        const targetMosMonths = 6
        const leadTimeMonths = 1.5 // 45 days import lead time

        const items: SkuReplenishmentAlertItem[] = []

        for (const r of rows) {
            const totalStock = Number(r.totalStock || 0)
            const incomingQty = Number(r.incomingQty || 0)
            const sold6m = Number(r.so6m || 0) + Number(r.hist6m || 0)
            const sold12m = Number(r.so12m || 0) + Number(r.hist12m || 0)
            const soldAll = Number(r.soAll || 0) + Number(r.histAll || 0)
            const unitsPerCase = Math.max(1, Number(r.unitsPerCase || 6))
            const unitCost = Number(r.costPrice || 0)

            // Determine monthly velocity (prioritize 6M, fallback to 12M, fallback to 36M historical average)
            let avgMonthlySales = 0
            if (sold6m > 0) {
                avgMonthlySales = Math.round((sold6m / 6) * 10) / 10
            } else if (sold12m > 0) {
                avgMonthlySales = Math.round((sold12m / 12) * 10) / 10
            } else if (soldAll >= 12) {
                avgMonthlySales = Math.round((soldAll / 36) * 10) / 10
            }

            if (avgMonthlySales <= 0) continue

            const mosCurrent = Math.round((totalStock / avgMonthlySales) * 10) / 10
            const mosWithIncoming = Math.round(((totalStock + incomingQty) / avgMonthlySales) * 10) / 10

            // Only include SKUs whose current MOS (or MOS with incoming) is below the 6-month target
            if (mosCurrent >= targetMosMonths) continue

            const requiredStock = avgMonthlySales * (targetMosMonths + leadTimeMonths)
            const rawShortfall = Math.max(0, Math.ceil(requiredStock - (totalStock + incomingQty)))
            const suggestedReorderCases = rawShortfall > 0 ? Math.ceil(rawShortfall / unitsPerCase) : 0
            const suggestedReorderBottles = suggestedReorderCases * unitsPerCase

            if (suggestedReorderBottles <= 0 && totalStock > 0) continue

            let estimatedRunoutDate: string | null = null
            if (totalStock <= 0) {
                estimatedRunoutDate = now.toISOString()
            } else {
                const daysLeft = Math.round((totalStock / avgMonthlySales) * 30.44)
                const runout = new Date(now.getTime() + daysLeft * 86400000)
                estimatedRunoutDate = runout.toISOString()
            }

            let urgencyTier: SkuReplenishmentAlertItem['urgencyTier'] = 'PLAN_REORDER'
            let urgencyLabelVi = 'Cần bổ sung (<6T)'
            let urgencyLabelEn = 'Replenish (<6M)'

            if (totalStock <= 0) {
                urgencyTier = 'OUT_OF_STOCK'
                urgencyLabelVi = 'Đứt hàng (Tồn = 0)'
                urgencyLabelEn = 'Out of Stock (0)'
            } else if (mosCurrent < 2.0) {
                urgencyTier = 'CRITICAL'
                urgencyLabelVi = 'Đặt gấp (MOS < 2T)'
                urgencyLabelEn = 'Urgent (MOS < 2M)'
            } else if (mosCurrent < 3.5) {
                urgencyTier = 'LOW'
                urgencyLabelVi = 'Sắp chạm đáy (<3.5T)'
                urgencyLabelEn = 'Low Stock (<3.5M)'
            }

            items.push({
                id: r.id,
                skuCode: r.skuCode,
                productName: r.productName,
                wineType: r.wineType,
                country: r.country,
                producerName: r.producerName ?? '—',
                unitsPerCase,
                totalStock,
                incomingQty,
                activeBuyerCount: Number(r.activeBuyerCount || 0),
                sold6m,
                sold12m,
                avgMonthlySales,
                mosCurrent,
                mosWithIncoming,
                estimatedRunoutDate,
                suggestedReorderBottles,
                suggestedReorderCases,
                estimatedReorderCostVnd: Math.round(suggestedReorderBottles * unitCost),
                urgencyTier,
                urgencyLabelVi,
                urgencyLabelEn,
            })
        }

        const tierWeight: Record<SkuReplenishmentAlertItem['urgencyTier'], number> = {
            OUT_OF_STOCK: 1,
            CRITICAL: 2,
            LOW: 3,
            PLAN_REORDER: 4,
        }

        items.sort((a, b) => {
            if (tierWeight[a.urgencyTier] !== tierWeight[b.urgencyTier]) {
                return tierWeight[a.urgencyTier] - tierWeight[b.urgencyTier]
            }
            if (a.urgencyTier === 'OUT_OF_STOCK') {
                return b.avgMonthlySales - a.avgMonthlySales
            }
            if (a.mosCurrent !== b.mosCurrent) {
                return a.mosCurrent - b.mosCurrent
            }
            return b.avgMonthlySales - a.avgMonthlySales
        })

        return items
    }, 120_000)
}

export interface SkuCustomerBuyerItem {
    key: string
    customerId: string | null
    isLinkedCustomer: boolean
    customerCode: string
    customerName: string
    channel: string
    entityType: string
    parentName: string | null
    salesRepName: string | null
    buyerStatus: 'ACTIVE' | 'AT_RISK' | 'HISTORICAL_ONLY' | 'PRICE_RULE_ONLY'
    liveCommercialBottles: number
    liveTastingBottles: number
    historicalBottles: number
    totalBottles: number
    totalRevenue: number
    orderCount: number
    firstOrderDate: string | null
    lastOrderDate: string | null
    lastOrderNo: string | null
    lastUnitPrice: number | null
    avgUnitPrice: number | null
    specialPrice: number | null
    specialDiscountPct: number | null
    specialRuleEndDate: string | null
    daysSinceLastOrder: number | null
    averageCycleDays: number | null
}

export interface SkuOrderRecordItem {
    id: string
    docNo: string
    date: string
    recordSource: 'ERP_SO' | 'HISTORICAL_INVOICE'
    orderType: 'STANDARD' | 'TASTING' | 'SAMPLE' | 'HISTORICAL'
    legalEntity: string | null
    customerId: string | null
    customerCode: string
    customerName: string
    channel: string
    salesRepName: string
    qty: number
    unitPrice: number
    discountPct: number
    lineTotal: number
    status: string
    deliveryStatus: string
}

export interface SkuChannelBreakdownItem {
    channel: string
    label: string
    bottles: number
    revenue: number
    customerCount: number
    pct: number
}

export interface SkuMonthlyTrendItem {
    month: string
    label: string
    commercialBottles: number
    tastingBottles: number
    revenue: number
    buyerCount: number
}

export interface SkuImportRecordItem {
    id: string
    receiptDate: string
    month: string
    voucherNo: string
    declarationNo: string | null
    batchCode: string | null
    supplierName: string
    country: string | null
    legalEntity: string | null
    importType: 'DIRECT_IMPORT' | 'INTERNAL_TRANSFER' | 'RETURN_INBOUND' | 'ERP_GR'
    qtyCommercial: number
    qtyFoc: number
    qtyTotal: number
    currency: string
    foreignUnitPrice: number | null
    purchasePriceVnd: number
    landedCostVnd: number
    totalValueVnd: number
    source: string
}

export interface SkuStockLotItem {
    id: string
    lotNo: string
    warehouseName: string
    locationCode: string
    legalEntityName: string
    vintage: number | null
    receivedDate: string
    qtyReceived: number
    qtyAvailable: number
    unitLandedCost: number
    status: string
}

export interface SkuImportKpis {
    totalImportedBottles: number
    totalFocBottles: number
    totalInternalTransferBottles: number
    totalImportBatches: number
    totalImportValueVnd: number
    latestImportDate: string | null
    latestSupplierName: string | null
    latestLandedCostVnd: number | null
    minLandedCostVnd: number | null
    maxLandedCostVnd: number | null
    avgLandedCostVnd: number | null
}

export interface SkuMosCycleItem {
    cycleMonths: 3 | 6 | 12
    totalBottlesInCycle: number
    avgMonthlySales: number
    avgMonthlyTotalOutflow: number
    mosCurrentStock: number | null
    mosWithIncoming: number | null
    estimatedRunoutDate: string | null
    suggestedReorderBottles: number
    suggestedReorderCases: number
}

export interface SkuMosForecastInfo {
    riskStatus: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'OPTIMAL' | 'ABUNDANT' | 'OVERSTOCK' | 'NO_SALES'
    riskLabelVi: string
    riskLabelEn: string
    recommendationVi: string
    recommendationEn: string
    leadTimeDays: number
    targetMosMonths: number
    incomingQty: number
    incomingPoNo: string | null
    incomingEta: string | null
    cycles: {
        m3: SkuMosCycleItem
        m6: SkuMosCycleItem
        m12: SkuMosCycleItem
    }
}

export interface SkuAnalyticsResult {
    product: {
        id: string
        skuCode: string
        productName: string
        wineType: string
        country: string
        producerName: string
        abvPercent: number
        volumeMl: number
        unitsPerCase: number
        costPrice: number
        wholesalePrice: number
        retailPrice: number
        totalStock: number
        stockTT: number
        stockGVM: number
        stockOther: number
    }
    kpis: {
        totalBottles: number
        liveCommercialBottles: number
        liveTastingBottles: number
        historicalBottles: number
        totalRevenue: number
        avgSellingPrice: number
        totalBuyersCount: number
        activeBuyersCount: number
        specialRuleCustomerCount: number
        totalOrdersCount: number
    }
    importKpis: SkuImportKpis
    mosForecast: SkuMosForecastInfo
    customers: SkuCustomerBuyerItem[]
    orders: SkuOrderRecordItem[]
    imports: SkuImportRecordItem[]
    stockLots: SkuStockLotItem[]
    channelBreakdown: SkuChannelBreakdownItem[]
    monthlyTrend: SkuMonthlyTrendItem[]
}

export async function getProductAnalyticsForDashboard(
    productId: string,
    timeRange: 'ALL' | 'THIS_YEAR' | 'LAST_6_MONTHS' | 'THIS_MONTH' = 'ALL'
): Promise<SkuAnalyticsResult | null> {
    if (!productId) return null

    return cached(`dashboard:sku-360:${productId}:${timeRange}`, async () => {
        // Cache raw SKU dataset for 2 minutes so switching timeRange (ALL / THIS_YEAR / LAST_6_MONTHS / THIS_MONTH) takes 0 DB queries!
        const rawData = await cached(`dashboard:sku-360-raw:${productId}`, async () => {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    producer: { select: { name: true } },
                    marginPrice: { select: { costPrice: true, wholesalePrice: true, retailPrice: true } },
                    stockLots: {
                        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                        include: {
                            ownerEntity: { select: { name: true, code: true } },
                            location: { include: { warehouse: { select: { code: true, name: true } } } },
                        },
                        orderBy: { qtyAvailable: 'desc' },
                    },
                },
            })

            if (!product) return null

            const [allSoLines, allHistSales, priceRules, histMonthly, allHistImports, allGrLines, incomingPoLines] = await Promise.all([
                prisma.salesOrderLine.findMany({
                    where: {
                        productId: product.id,
                        so: { status: { not: 'CANCELLED' } },
                    },
                    include: {
                        so: {
                            include: {
                                customer: {
                                    include: {
                                        parent: { select: { id: true, code: true, name: true } },
                                        salesRep: { select: { name: true } },
                                    },
                                },
                                salesRep: { select: { name: true } },
                                legalEntity: { select: { name: true, code: true } },
                                deliveryOrders: { select: { status: true } },
                            },
                        },
                    },
                    orderBy: { so: { createdAt: 'desc' } },
                }),
                prisma.historicalCustomerSkuSale.findMany({
                    where: {
                        OR: [{ productId: product.id }, { skuCode: product.skuCode }],
                    },
                    include: {
                        customer: {
                            include: {
                                parent: { select: { id: true, code: true, name: true } },
                                salesRep: { select: { name: true } },
                                children: {
                                    select: {
                                        id: true,
                                        code: true,
                                        name: true,
                                        channel: true,
                                        entityType: true,
                                        salesRep: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { invoiceDate: 'desc' },
                }),
                prisma.customerPriceRule.findMany({
                    where: {
                        productId: product.id,
                        status: 'APPROVED',
                    },
                    include: {
                        customer: {
                            include: {
                                parent: { select: { id: true, code: true, name: true } },
                                salesRep: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.historicalMonthlySales.findMany({
                    where: { skuCode: product.skuCode },
                    orderBy: { month: 'asc' },
                }),
                prisma.historicalSkuImport.findMany({
                    where: {
                        OR: [{ productId: product.id }, { skuCode: product.skuCode }],
                    },
                    orderBy: { receiptDate: 'desc' },
                }),
                prisma.goodsReceiptLine.findMany({
                    where: { productId: product.id },
                    include: {
                        lot: { select: { lotNo: true, unitLandedCost: true } },
                        gr: {
                            include: {
                                warehouse: { select: { name: true, code: true } },
                                shipment: { include: { customsDecl: { select: { declarationNo: true } } } },
                                po: {
                                    include: {
                                        supplier: { select: { name: true, country: true } },
                                        lines: { where: { productId: product.id } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { gr: { createdAt: 'desc' } },
                }),
                prisma.purchaseOrderLine.findMany({
                    where: {
                        productId: product.id,
                        po: {
                            status: { in: ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] },
                        },
                    },
                    include: {
                        po: {
                            select: {
                                poNo: true,
                                estimatedDelivery: true,
                                supplier: { select: { leadTimeDays: true } },
                                shipments: { select: { etd: true, eta: true }, orderBy: { createdAt: 'desc' }, take: 1 },
                            },
                        },
                    },
                }),
            ])

            return { product, allSoLines, allHistSales, priceRules, histMonthly, allHistImports, allGrLines, incomingPoLines }
        }, 120_000)

        if (!rawData) return null
        const { product, allSoLines, allHistSales, priceRules, histMonthly, allHistImports, allGrLines, incomingPoLines } = rawData

        const now = new Date()
        let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined
        if (timeRange === 'THIS_MONTH') {
            dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) }
        } else if (timeRange === 'LAST_6_MONTHS') {
            dateFilter = { gte: subMonths(now, 6), lte: endOfMonth(now) }
        } else if (timeRange === 'THIS_YEAR') {
            dateFilter = { gte: startOfYear(now), lte: endOfYear(now) }
        }

        const inDateRange = (d: Date) => {
            if (!dateFilter) return true
            if (dateFilter.gte && d < dateFilter.gte) return false
            if (dateFilter.lte && d > dateFilter.lte) return false
            return true
        }

        const soLines = dateFilter ? allSoLines.filter(l => inDateRange(new Date(l.so.createdAt))) : allSoLines
        const histSales = dateFilter ? allHistSales.filter(h => inDateRange(new Date(h.invoiceDate))) : allHistSales
        const histImports = dateFilter ? allHistImports.filter(hi => inDateRange(new Date(hi.receiptDate))) : allHistImports
        const grLines = dateFilter ? allGrLines.filter(grl => inDateRange(new Date(grl.gr.createdAt))) : allGrLines
        const velocitySoLines = allSoLines
        const velocityHistSales = allHistSales

    // 1. Warehouse Stock Breakdown
    let totalStock = 0
    let stockTT = 0
    let stockGVM = 0
    let stockOther = 0

    for (const lot of product.stockLots) {
        const qty = Number(lot.qtyAvailable)
        totalStock += qty
        const whName = `${lot.location?.warehouse?.code ?? ''} ${lot.location?.warehouse?.name ?? ''}`.toUpperCase()
        if (whName.includes('THƯỜNG TÍN') || whName.includes('THUONG TIN') || whName.includes('TT') || whName.includes('THANH TRÌ')) {
            stockTT += qty
        } else if (whName.includes('GVM') || whName.includes('GIẢNG VÕ') || whName.includes('GIANG VO')) {
            stockGVM += qty
        } else {
            stockOther += qty
        }
    }

    const wholesalePrice = Number(product.marginPrice?.wholesalePrice ?? 0)
    const retailPrice = Number(product.marginPrice?.retailPrice ?? 0)
    const costPrice = Number(product.marginPrice?.costPrice ?? 0)
    const stdRefPrice = wholesalePrice > 0 ? wholesalePrice : retailPrice

    // 2. Map Customer Special Price Rules first
    const ruleByCustomerId = new Map<string, { specialPrice: number; discountPct: number; endDate: string | null }>()
    for (const r of priceRules) {
        const val = Number(r.value)
        let sp = val
        let discPct = 0
        if (r.ruleType === 'FIXED_DISCOUNT') {
            discPct = val
            sp = stdRefPrice > 0 ? Math.max(0, stdRefPrice * (1 - val / 100)) : 0
        } else {
            sp = val
            if (stdRefPrice > sp && stdRefPrice > 0) {
                discPct = Math.round(((stdRefPrice - sp) / stdRefPrice) * 100)
            }
        }
        ruleByCustomerId.set(r.customerId, {
            specialPrice: sp,
            discountPct: discPct,
            endDate: r.endDate ? r.endDate.toISOString() : null,
        })
    }

    // 3. Aggregate Buyers & Orders
    interface BuyerAcc {
        key: string
        customerId: string | null
        isLinkedCustomer: boolean
        customerCode: string
        customerName: string
        channel: string
        entityType: string
        parentName: string | null
        salesRepName: string | null
        liveCommercialBottles: number
        liveTastingBottles: number
        historicalBottles: number
        totalRevenue: number
        commercialBottlesForAvg: number
        orderDates: Date[]
        orderNos: Set<string>
        firstOrderDate: Date | null
        lastOrderDate: Date | null
        lastOrderNo: string | null
        lastUnitPrice: number | null
        specialPrice: number | null
        specialDiscountPct: number | null
        specialRuleEndDate: string | null
    }

    const buyerMap = new Map<string, BuyerAcc>()
    const orderRecords: SkuOrderRecordItem[] = []
    const monthlyMap = new Map<string, {
        month: string
        label: string
        commercialBottles: number
        tastingBottles: number
        revenue: number
        buyers: Set<string>
    }>()

    let liveCommercialBottles = 0
    let liveTastingBottles = 0
    let historicalBottles = 0
    let totalRevenue = 0
    let totalCommercialPriceWeighted = 0
    let totalCommercialBottlesWeighted = 0

    const ensureBuyer = (params: {
        key: string
        customerId: string | null
        isLinkedCustomer: boolean
        customerCode: string
        customerName: string
        channel: string
        entityType: string
        parentName: string | null
        salesRepName: string | null
        parentId?: string | null
    }): BuyerAcc => {
        const existing = buyerMap.get(params.key)
        if (existing) {
            if (!existing.salesRepName && params.salesRepName) existing.salesRepName = params.salesRepName
            if (!existing.parentName && params.parentName) existing.parentName = params.parentName
            return existing
        }
        const rule = (params.customerId && ruleByCustomerId.get(params.customerId))
            || (params.parentId && ruleByCustomerId.get(params.parentId))
            || null

        const created: BuyerAcc = {
            key: params.key,
            customerId: params.customerId,
            isLinkedCustomer: params.isLinkedCustomer,
            customerCode: params.customerCode,
            customerName: params.customerName,
            channel: params.channel || 'HORECA',
            entityType: params.entityType || 'RESTAURANT',
            parentName: params.parentName,
            salesRepName: params.salesRepName,
            liveCommercialBottles: 0,
            liveTastingBottles: 0,
            historicalBottles: 0,
            totalRevenue: 0,
            commercialBottlesForAvg: 0,
            orderDates: [],
            orderNos: new Set<string>(),
            firstOrderDate: null,
            lastOrderDate: null,
            lastOrderNo: null,
            lastUnitPrice: null,
            specialPrice: rule ? rule.specialPrice : null,
            specialDiscountPct: rule ? rule.discountPct : null,
            specialRuleEndDate: rule ? rule.endDate : null,
        }
        buyerMap.set(params.key, created)
        return created
    }

    // 3a. Process Live ERP SalesOrderLines (Aug 2026+)
    for (const line of soLines) {
        const so = line.so
        const cust = so.customer
        const key = cust.id
        const qty = Number(line.qtyOrdered)
        const price = Number(line.unitPrice)
        const lineDisc = Number(line.lineDiscountPct ?? 0)
        const orderDisc = Number((so as any).orderDiscount ?? 0)
        const netUnitPrice = price * (1 - lineDisc / 100) * Math.max(0, 1 - orderDisc / 100)
        const lineTotal = Math.round(qty * netUnitPrice)

        const orderTypeRaw = ((so as any).orderType || 'STANDARD') as 'STANDARD' | 'TASTING' | 'SAMPLE'
        const isTastingOrSample = orderTypeRaw === 'TASTING' || orderTypeRaw === 'SAMPLE'
        const orderDate = new Date(so.createdAt)

        const buyer = ensureBuyer({
            key,
            customerId: cust.id,
            isLinkedCustomer: true,
            customerCode: cust.code,
            customerName: cust.name,
            channel: cust.channel || so.channel || 'HORECA',
            entityType: cust.entityType || 'RESTAURANT',
            parentName: cust.parent ? `${cust.parent.code} - ${cust.parent.name}` : null,
            salesRepName: so.salesRep?.name ?? cust.salesRep?.name ?? null,
            parentId: cust.parentId,
        })

        if (isTastingOrSample) {
            liveTastingBottles += qty
            buyer.liveTastingBottles += qty
        } else {
            liveCommercialBottles += qty
            buyer.liveCommercialBottles += qty
            buyer.totalRevenue += lineTotal
            buyer.commercialBottlesForAvg += qty
            totalRevenue += lineTotal
            totalCommercialPriceWeighted += lineTotal
            totalCommercialBottlesWeighted += qty
        }

        buyer.orderNos.add(so.soNo)
        buyer.orderDates.push(orderDate)
        if (!buyer.firstOrderDate || orderDate < buyer.firstOrderDate) {
            buyer.firstOrderDate = orderDate
        }
        if (!buyer.lastOrderDate || orderDate >= buyer.lastOrderDate) {
            buyer.lastOrderDate = orderDate
            buyer.lastOrderNo = so.soNo
            if (!isTastingOrSample || buyer.lastUnitPrice === null) {
                buyer.lastUnitPrice = Math.round(netUnitPrice)
            }
        }

        // Monthly trend
        const mKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
        const mLabel = `T${orderDate.getMonth() + 1}/${String(orderDate.getFullYear()).slice(-2)}`
        const mItem = monthlyMap.get(mKey) ?? {
            month: mKey,
            label: mLabel,
            commercialBottles: 0,
            tastingBottles: 0,
            revenue: 0,
            buyers: new Set<string>(),
        }
        if (isTastingOrSample) {
            mItem.tastingBottles += qty
        } else {
            mItem.commercialBottles += qty
            mItem.revenue += lineTotal
        }
        mItem.buyers.add(key)
        monthlyMap.set(mKey, mItem)

        let deliveryStatus = 'UNDELIVERED'
        if (so.status === 'DELIVERED' || so.deliveryOrders.some(d => d.status === 'DELIVERED')) {
            deliveryStatus = 'DELIVERED'
        } else if (so.deliveryOrders.length > 0) {
            deliveryStatus = 'PREPARING'
        }

        orderRecords.push({
            id: line.id,
            docNo: so.soNo,
            date: orderDate.toISOString(),
            recordSource: 'ERP_SO',
            orderType: orderTypeRaw,
            legalEntity: so.legalEntity?.name ?? null,
            customerId: cust.id,
            customerCode: cust.code,
            customerName: cust.name,
            channel: cust.channel || so.channel || 'HORECA',
            salesRepName: so.salesRep?.name ?? cust.salesRep?.name ?? '—',
            qty,
            unitPrice: Math.round(netUnitPrice),
            discountPct: Math.max(lineDisc, orderDisc),
            lineTotal,
            status: so.status,
            deliveryStatus,
        })
    }

    // 3b. Process Migrated Historical Sales from Supabase (2021 - Jul 2026)
    for (const h of histSales) {
        const qty = Number(h.qty)
        const price = Number(h.unitPrice)
        const lineTotal = Number(h.totalAmount) || Math.round(qty * price)
        const invDate = new Date(h.invoiceDate)

        // If linked customer is a parent COMPANY that has exactly 1 child RESTAURANT, resolve to that child so it merges seamlessly with live ERP orders
        let resolvedCust = h.customer
        let parentLabel: string | null = h.customer?.parent ? `${h.customer.parent.code} - ${h.customer.parent.name}` : null
        let parentId: string | null = h.customer?.parentId ?? null

        if (resolvedCust && resolvedCust.entityType === 'COMPANY' && resolvedCust.children && resolvedCust.children.length === 1) {
            const singleChild = resolvedCust.children[0]
            parentLabel = `${resolvedCust.code} - ${resolvedCust.name}`
            parentId = resolvedCust.id
            resolvedCust = {
                ...resolvedCust,
                id: singleChild.id,
                code: singleChild.code,
                name: singleChild.name,
                channel: singleChild.channel,
                entityType: singleChild.entityType,
                salesRep: singleChild.salesRep ?? resolvedCust.salesRep,
            } as any
        }

        const key = resolvedCust ? resolvedCust.id : `hist:${h.customerCode || h.customerName}`
        const buyer = ensureBuyer({
            key,
            customerId: resolvedCust ? resolvedCust.id : null,
            isLinkedCustomer: Boolean(resolvedCust),
            customerCode: resolvedCust ? resolvedCust.code : (h.customerCode || 'HIST'),
            customerName: resolvedCust ? resolvedCust.name : h.customerName,
            channel: resolvedCust?.channel || h.channel || 'HORECA',
            entityType: resolvedCust?.entityType || 'RESTAURANT',
            parentName: parentLabel,
            salesRepName: resolvedCust?.salesRep?.name ?? null,
            parentId,
        })

        historicalBottles += qty
        buyer.historicalBottles += qty
        buyer.totalRevenue += lineTotal
        buyer.commercialBottlesForAvg += qty
        totalRevenue += lineTotal
        totalCommercialPriceWeighted += lineTotal
        totalCommercialBottlesWeighted += qty

        const docNo = h.invoiceNo ? `HĐ ${h.invoiceNo}` : (h.voucherNo || `HIST-${h.month}`)
        buyer.orderNos.add(`${h.month}-${docNo}`)
        buyer.orderDates.push(invDate)
        if (!buyer.firstOrderDate || invDate < buyer.firstOrderDate) {
            buyer.firstOrderDate = invDate
        }
        if (!buyer.lastOrderDate || invDate > buyer.lastOrderDate) {
            buyer.lastOrderDate = invDate
            buyer.lastOrderNo = docNo
            buyer.lastUnitPrice = Math.round(price)
        }

        const mKey = h.month
        const [yStr, mStr] = mKey.split('-')
        const mLabel = `T${parseInt(mStr, 10)}/${yStr.slice(-2)}`
        const mItem = monthlyMap.get(mKey) ?? {
            month: mKey,
            label: mLabel,
            commercialBottles: 0,
            tastingBottles: 0,
            revenue: 0,
            buyers: new Set<string>(),
        }
        mItem.commercialBottles += qty
        mItem.revenue += lineTotal
        mItem.buyers.add(key)
        monthlyMap.set(mKey, mItem)

        orderRecords.push({
            id: h.id,
            docNo,
            date: invDate.toISOString(),
            recordSource: 'HISTORICAL_INVOICE',
            orderType: 'HISTORICAL',
            legalEntity: h.legalEntity ?? null,
            customerId: resolvedCust ? resolvedCust.id : null,
            customerCode: resolvedCust ? resolvedCust.code : (h.customerCode || '—'),
            customerName: resolvedCust ? resolvedCust.name : h.customerName,
            channel: resolvedCust?.channel || h.channel || 'HORECA',
            salesRepName: resolvedCust?.salesRep?.name ?? '—',
            qty,
            unitPrice: Math.round(price),
            discountPct: 0,
            lineTotal: Math.round(lineTotal),
            status: 'PAID',
            deliveryStatus: 'DELIVERED',
        })
    }

    // 3c. Also include customers who have an approved CustomerPriceRule for this SKU even if they haven't ordered in the filtered period
    for (const r of priceRules) {
        const cust = r.customer
        if (!buyerMap.has(cust.id)) {
            ensureBuyer({
                key: cust.id,
                customerId: cust.id,
                isLinkedCustomer: true,
                customerCode: cust.code,
                customerName: cust.name,
                channel: cust.channel || 'HORECA',
                entityType: cust.entityType || 'RESTAURANT',
                parentName: cust.parent ? `${cust.parent.code} - ${cust.parent.name}` : null,
                salesRepName: cust.salesRep?.name ?? null,
                parentId: cust.parentId,
            })
        }
    }

    // 3d. Enrich monthlyTrend with any earlier months from HistoricalMonthlySales if timeRange === 'ALL'
    if (timeRange === 'ALL') {
        for (const hm of histMonthly) {
            if (!monthlyMap.has(hm.month)) {
                const salesQty = Number(hm.salesQty)
                const tastingQty = Number(hm.tastingQty)
                if (salesQty > 0 || tastingQty > 0) {
                    const [yStr, mStr] = hm.month.split('-')
                    monthlyMap.set(hm.month, {
                        month: hm.month,
                        label: `T${parseInt(mStr, 10)}/${yStr.slice(-2)}`,
                        commercialBottles: salesQty,
                        tastingBottles: tastingQty,
                        revenue: salesQty * stdRefPrice,
                        buyers: new Set<string>(),
                    })
                }
            }
        }
    }

    // 4. Finalize Buyer List & Status Classification
    let activeBuyersCount = 0
    const customers: SkuCustomerBuyerItem[] = Array.from(buyerMap.values()).map(b => {
        const totalBottles = b.liveCommercialBottles + b.liveTastingBottles + b.historicalBottles
        const daysSinceLastOrder = b.lastOrderDate
            ? Math.max(0, Math.floor((now.getTime() - b.lastOrderDate.getTime()) / 86400000))
            : null

        let averageCycleDays: number | null = null
        if (b.orderDates.length >= 2) {
            const sortedTs = b.orderDates
                .map(d => d.getTime())
                .sort((x, y) => x - y)
            // Deduplicate same-day invoices when computing cycle
            const uniqueDayTs: number[] = []
            for (const ts of sortedTs) {
                if (uniqueDayTs.length === 0 || (ts - uniqueDayTs[uniqueDayTs.length - 1]) >= 86400000) {
                    uniqueDayTs.push(ts)
                }
            }
            if (uniqueDayTs.length >= 2) {
                let sumDiff = 0
                for (let i = 1; i < uniqueDayTs.length; i++) {
                    sumDiff += (uniqueDayTs[i] - uniqueDayTs[i - 1]) / 86400000
                }
                averageCycleDays = Math.max(1, Math.round(sumDiff / (uniqueDayTs.length - 1)))
            }
        }

        let buyerStatus: 'ACTIVE' | 'AT_RISK' | 'HISTORICAL_ONLY' | 'PRICE_RULE_ONLY' = 'PRICE_RULE_ONLY'
        if (totalBottles === 0) {
            buyerStatus = 'PRICE_RULE_ONLY'
        } else if (b.liveCommercialBottles + b.liveTastingBottles > 0) {
            if (daysSinceLastOrder !== null && daysSinceLastOrder > 75) {
                buyerStatus = 'AT_RISK'
            } else {
                buyerStatus = 'ACTIVE'
                activeBuyersCount++
            }
        } else {
            // Only bought in historical pre-Aug 2026 ledger
            buyerStatus = 'HISTORICAL_ONLY'
        }

        const avgUnitPrice = b.commercialBottlesForAvg > 0
            ? Math.round(b.totalRevenue / b.commercialBottlesForAvg)
            : b.lastUnitPrice

        return {
            key: b.key,
            customerId: b.customerId,
            isLinkedCustomer: b.isLinkedCustomer,
            customerCode: b.customerCode,
            customerName: b.customerName,
            channel: b.channel,
            entityType: b.entityType,
            parentName: b.parentName,
            salesRepName: b.salesRepName,
            buyerStatus,
            liveCommercialBottles: b.liveCommercialBottles,
            liveTastingBottles: b.liveTastingBottles,
            historicalBottles: b.historicalBottles,
            totalBottles,
            totalRevenue: Math.round(b.totalRevenue),
            orderCount: b.orderNos.size,
            firstOrderDate: b.firstOrderDate ? b.firstOrderDate.toISOString() : null,
            lastOrderDate: b.lastOrderDate ? b.lastOrderDate.toISOString() : null,
            lastOrderNo: b.lastOrderNo,
            lastUnitPrice: b.lastUnitPrice,
            avgUnitPrice,
            specialPrice: b.specialPrice !== null ? Math.round(b.specialPrice) : null,
            specialDiscountPct: b.specialDiscountPct,
            specialRuleEndDate: b.specialRuleEndDate,
            daysSinceLastOrder,
            averageCycleDays,
        }
    })

    // Sort buyers: ACTIVE / highest totalBottles first, then PRICE_RULE_ONLY
    customers.sort((a, b) => {
        if (b.totalBottles !== a.totalBottles) return b.totalBottles - a.totalBottles
        if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue
        return (b.specialPrice ?? 0) - (a.specialPrice ?? 0)
    })

    // Sort orders newest first
    orderRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // 5. Channel Breakdown
    const CHANNEL_LABELS: Record<string, string> = {
        HORECA: 'Kênh Nhà Hàng / Khách Sạn (HORECA)',
        CORPORATE: 'Khách Doanh Nghiệp (B2B / Corporate)',
        WHOLESALE_DISTRIBUTOR: 'Đại Lý / Bán Buôn (Wholesale)',
        VIP_RETAIL: 'Khách Lẻ VIP',
        RETAIL: 'Khách Lẻ (Retail)',
        DIRECT_INDIVIDUAL: 'Khách Cá Nhân',
    }
    const chMap = new Map<string, { bottles: number; revenue: number; customers: Set<string> }>()
    for (const c of customers) {
        if (c.totalBottles <= 0) continue
        const ch = c.channel || 'HORECA'
        const cur = chMap.get(ch) ?? { bottles: 0, revenue: 0, customers: new Set<string>() }
        cur.bottles += c.totalBottles
        cur.revenue += c.totalRevenue
        cur.customers.add(c.key)
        chMap.set(ch, cur)
    }

    const totalAllBottles = liveCommercialBottles + liveTastingBottles + historicalBottles
    const channelBreakdown: SkuChannelBreakdownItem[] = Array.from(chMap.entries())
        .map(([ch, val]) => ({
            channel: ch,
            label: CHANNEL_LABELS[ch] ?? ch,
            bottles: val.bottles,
            revenue: Math.round(val.revenue),
            customerCount: val.customers.size,
            pct: totalAllBottles > 0 ? Math.round((val.bottles / totalAllBottles) * 100) : 0,
        }))
        .sort((a, b) => b.bottles - a.bottles)

    const monthlyTrend: SkuMonthlyTrendItem[] = Array.from(monthlyMap.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(m => ({
            month: m.month,
            label: m.label,
            commercialBottles: m.commercialBottles,
            tastingBottles: m.tastingBottles,
            revenue: Math.round(m.revenue),
            buyerCount: m.buyers.size,
        }))

    const avgSellingPrice = totalCommercialBottlesWeighted > 0
        ? Math.round(totalCommercialPriceWeighted / totalCommercialBottlesWeighted)
        : stdRefPrice

    // 6. Build Inbound / Import History & Stock Lots
    const imports: SkuImportRecordItem[] = []

    // 6a. Live ERP GoodsReceiptLines
    for (const grl of grLines) {
        const qtyTotal = Number(grl.qtyReceived)
        if (qtyTotal <= 0) continue
        const gr = grl.gr
        const po = gr.po
        const poLine = po?.lines?.[0]
        const isFoc = Boolean(poLine?.isFoc)
        const qtyCommercial = isFoc ? 0 : qtyTotal
        const qtyFoc = isFoc ? qtyTotal : 0
        const rDate = gr.confirmedAt ? new Date(gr.confirmedAt) : new Date(gr.createdAt)
        const mKey = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`
        const landedCost = Number(grl.lot?.unitLandedCost ?? costPrice ?? 0)
        const foreignPrice = poLine ? Number(poLine.unitPrice) : null
        const currency = (po as any)?.currency || 'USD'

        imports.push({
            id: `grl_${grl.id}`,
            receiptDate: rDate.toISOString(),
            month: mKey,
            voucherNo: gr.grNo,
            declarationNo: gr.shipment?.customsDecl?.declarationNo ?? po?.poNo ?? null,
            batchCode: grl.lot?.lotNo ?? null,
            supplierName: po?.supplier?.name ?? product.producer?.name ?? 'Nhà cung cấp ERP',
            country: po?.supplier?.country ?? product.country ?? null,
            legalEntity: gr.warehouse?.name ?? 'Thắng Ân',
            importType: 'ERP_GR',
            qtyCommercial,
            qtyFoc,
            qtyTotal,
            currency,
            foreignUnitPrice: foreignPrice,
            purchasePriceVnd: Math.round(landedCost),
            landedCostVnd: Math.round(landedCost),
            totalValueVnd: Math.round(qtyTotal * landedCost),
            source: 'ERP_GOODS_RECEIPT',
        })
    }

    // 6b. Migrated Historical SKU Imports from Supabase (2021 - 10/2026)
    for (const hi of histImports) {
        const qtyCommercial = Number(hi.qtyCommercial)
        const qtyFoc = Number(hi.qtyFoc)
        const qtyTotal = Number(hi.qtyTotal) || (qtyCommercial + qtyFoc)
        if (qtyTotal <= 0) continue
        const rDate = new Date(hi.receiptDate)
        const impType = (hi.importType || 'DIRECT_IMPORT') as 'DIRECT_IMPORT' | 'INTERNAL_TRANSFER' | 'RETURN_INBOUND'

        imports.push({
            id: hi.id,
            receiptDate: rDate.toISOString(),
            month: hi.month,
            voucherNo: hi.voucherNo || `IMP-${hi.month}`,
            declarationNo: hi.declarationNo ?? null,
            batchCode: hi.batchCode ?? null,
            supplierName: hi.supplierName,
            country: hi.country ?? product.country ?? null,
            legalEntity: hi.legalEntity ?? 'Thắng Ân',
            importType: impType,
            qtyCommercial,
            qtyFoc,
            qtyTotal,
            currency: hi.currency || 'VND',
            foreignUnitPrice: hi.foreignUnitPrice !== null ? Number(hi.foreignUnitPrice) : null,
            purchasePriceVnd: Math.round(Number(hi.purchasePriceVnd)),
            landedCostVnd: Math.round(Number(hi.landedCostVnd)),
            totalValueVnd: Math.round(Number(hi.totalValueVnd)),
            source: hi.source || 'HISTORICAL_IMPORT_LEDGER',
        })
    }

    imports.sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime())

    let totalImportedBottles = 0
    let totalFocBottles = 0
    let totalInternalTransferBottles = 0
    let totalImportBatches = 0
    let totalImportValueVnd = 0
    let latestImportDate: string | null = null
    let latestSupplierName: string | null = null
    let latestLandedCostVnd: number | null = null
    let minLandedCostVnd: number | null = null
    let maxLandedCostVnd: number | null = null
    let weightedCostSum = 0
    let weightedCostQty = 0

    for (const imp of imports) {
        if (imp.importType === 'INTERNAL_TRANSFER') {
            totalInternalTransferBottles += imp.qtyTotal
            continue
        }
        totalImportedBottles += imp.qtyTotal
        totalFocBottles += imp.qtyFoc
        totalImportBatches += 1
        totalImportValueVnd += imp.totalValueVnd

        if (!latestImportDate) {
            latestImportDate = imp.receiptDate
            latestSupplierName = imp.supplierName
            latestLandedCostVnd = imp.landedCostVnd > 0 ? imp.landedCostVnd : null
        }

        if (imp.landedCostVnd > 0 && imp.qtyTotal > 0) {
            if (minLandedCostVnd === null || imp.landedCostVnd < minLandedCostVnd) {
                minLandedCostVnd = imp.landedCostVnd
            }
            if (maxLandedCostVnd === null || imp.landedCostVnd > maxLandedCostVnd) {
                maxLandedCostVnd = imp.landedCostVnd
            }
            weightedCostSum += imp.landedCostVnd * imp.qtyTotal
            weightedCostQty += imp.qtyTotal
        }
    }

    const avgLandedCostVnd = weightedCostQty > 0
        ? Math.round(weightedCostSum / weightedCostQty)
        : (costPrice > 0 ? Math.round(costPrice) : null)

    const stockLots: SkuStockLotItem[] = product.stockLots.map(lot => ({
        id: lot.id,
        lotNo: lot.lotNo,
        warehouseName: lot.location?.warehouse?.name ?? 'Kho chính',
        locationCode: lot.location?.locationCode ?? '—',
        legalEntityName: (lot as any).ownerEntity?.name ?? 'Thắng Ân',
        vintage: lot.vintage ?? null,
        receivedDate: lot.receivedDate.toISOString(),
        qtyReceived: Number(lot.qtyReceived),
        qtyAvailable: Number(lot.qtyAvailable),
        unitLandedCost: Math.round(Number(lot.unitLandedCost)),
        status: lot.status,
    }))

    // 7. Compute MOS (Months of Supply) & Reorder Forecast (3M / 6M / 12M)
    const fullMonthlySalesMap = new Map<string, { commercial: number; tasting: number }>()
    for (const hm of histMonthly) {
        fullMonthlySalesMap.set(hm.month, {
            commercial: Number(hm.salesQty) || 0,
            tasting: Number(hm.tastingQty) || 0,
        })
    }
    const histCustMonthlyMap = new Map<string, number>()
    for (const hs of velocityHistSales) {
        histCustMonthlyMap.set(hs.month, (histCustMonthlyMap.get(hs.month) ?? 0) + Number(hs.qty))
    }
    for (const [mKey, cQty] of histCustMonthlyMap.entries()) {
        const cur = fullMonthlySalesMap.get(mKey)
        if (!cur || cQty > cur.commercial) {
            fullMonthlySalesMap.set(mKey, {
                commercial: cQty,
                tasting: cur?.tasting ?? 0,
            })
        }
    }
    for (const vl of velocitySoLines) {
        const d = new Date(vl.so.createdAt)
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const cur = fullMonthlySalesMap.get(mKey) ?? { commercial: 0, tasting: 0 }
        const q = Number(vl.qtyOrdered)
        const oType = (vl.so as any).orderType || 'STANDARD'
        if (oType === 'TASTING' || oType === 'SAMPLE') {
            cur.tasting += q
        } else {
            cur.commercial += q
        }
        fullMonthlySalesMap.set(mKey, cur)
    }

    // Build chronological last 12 months window ending at latest complete/active month (2026-10 / current month)
    const allRecordedMonths = Array.from(fullMonthlySalesMap.keys()).sort()
    const anchorMonth = allRecordedMonths.length > 0
        ? allRecordedMonths[allRecordedMonths.length - 1]
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [anchorY, anchorM] = anchorMonth.split('-').map(Number)
    const last12MonthKeys: string[] = []
    for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(anchorY, anchorM - 1 - i, 1))
        const mk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
        last12MonthKeys.push(mk)
    }

    let incomingQty = 0
    let incomingPoNo: string | null = null
    let incomingEta: string | null = null
    let leadTimeDays = 45
    for (const pol of incomingPoLines) {
        const q = Number(pol.qtyOrdered)
        if (q > 0) {
            incomingQty += q
            if (!incomingPoNo && pol.po?.poNo) incomingPoNo = pol.po.poNo
            const shipEta = pol.po?.shipments?.[0]?.eta || pol.po?.estimatedDelivery
            if (!incomingEta && shipEta) incomingEta = new Date(shipEta).toISOString()
            if (pol.po?.supplier?.leadTimeDays) leadTimeDays = pol.po.supplier.leadTimeDays
        }
    }

    const targetMosMonths = 6
    const unitsPerCase = Math.max(1, product.unitsPerCase || 6)

    const buildMosCycle = (cycleMonths: 3 | 6 | 12): SkuMosCycleItem => {
        const sliceKeys = last12MonthKeys.slice(-cycleMonths)
        let commSum = 0
        let tasteSum = 0
        for (const mk of sliceKeys) {
            const entry = fullMonthlySalesMap.get(mk)
            if (entry) {
                commSum += entry.commercial
                tasteSum += entry.tasting
            }
        }
        const avgMonthlySales = Number((commSum / cycleMonths).toFixed(1))
        const avgMonthlyTotalOutflow = Number(((commSum + tasteSum) / cycleMonths).toFixed(1))
        const mosCurrentStock = avgMonthlySales > 0 ? Number((totalStock / avgMonthlySales).toFixed(1)) : null
        const mosWithIncoming = avgMonthlySales > 0 ? Number(((totalStock + incomingQty) / avgMonthlySales).toFixed(1)) : null

        let estimatedRunoutDate: string | null = null
        if (totalStock <= 0) {
            estimatedRunoutDate = now.toISOString()
        } else if (avgMonthlySales > 0) {
            const daysRemaining = Math.round((totalStock / avgMonthlySales) * 30.4375)
            estimatedRunoutDate = new Date(now.getTime() + daysRemaining * 86400000).toISOString()
        }

        const targetBottles = Math.ceil(avgMonthlySales * targetMosMonths)
        const suggestedReorderBottles = Math.max(0, targetBottles - (totalStock + incomingQty))
        const suggestedReorderCases = Math.ceil(suggestedReorderBottles / unitsPerCase)

        return {
            cycleMonths,
            totalBottlesInCycle: commSum,
            avgMonthlySales,
            avgMonthlyTotalOutflow,
            mosCurrentStock,
            mosWithIncoming,
            estimatedRunoutDate,
            suggestedReorderBottles,
            suggestedReorderCases,
        }
    }

    const m3 = buildMosCycle(3)
    const m6 = buildMosCycle(6)
    const m12 = buildMosCycle(12)

    let riskStatus: SkuMosForecastInfo['riskStatus'] = 'OPTIMAL'
    let riskLabelVi = 'Tồn kho tối ưu (2 – 6 tháng)'
    let riskLabelEn = 'Optimal Stock (2 – 6M)'
    let recommendationVi = 'Tồn kho đủ đáp ứng nhu cầu tiêu thụ theo nhịp hiện tại.'
    let recommendationEn = 'Current inventory comfortably covers regular monthly demand.'

    if (totalStock <= 0) {
        riskStatus = 'OUT_OF_STOCK'
        riskLabelVi = 'Hết hàng tồn kho (Out of Stock)'
        riskLabelEn = 'Out of Stock (0 btls)'
        recommendationVi = m6.avgMonthlySales > 0
            ? `Đang đứt hàng! Tốc độ tiêu thụ 6T là ${m6.avgMonthlySales} chai/tháng — cần nhập bổ sung ngay ~${m6.suggestedReorderBottles.toLocaleString()} chai (${m6.suggestedReorderCases} thùng).`
            : 'Hiện không còn tồn kho tại các kho.'
        recommendationEn = m6.avgMonthlySales > 0
            ? `Out of stock! 6M velocity is ${m6.avgMonthlySales} btls/mo — reorder ~${m6.suggestedReorderBottles.toLocaleString()} btls (${m6.suggestedReorderCases} cases).`
            : 'Currently zero stock across all warehouses.'
    } else if (m6.avgMonthlySales <= 0 && m12.avgMonthlySales <= 0) {
        riskStatus = 'NO_SALES'
        riskLabelVi = 'Tồn chậm luân chuyển (Chưa phát sinh bán 12T)'
        riskLabelEn = 'Slow Moving (No Sales in 12M)'
        recommendationVi = `Đang tồn ${totalStock.toLocaleString()} chai nhưng chưa phát sinh sản lượng bán trong 12 tháng qua — ưu tiên chương trình đẩy hàng / by-the-glass.`
        recommendationEn = `${totalStock.toLocaleString()} btls in stock with zero sales in the last 12M — consider promotional push.`
    } else {
        const refMos = m6.mosCurrentStock ?? m12.mosCurrentStock ?? 0
        if (refMos < 2) {
            riskStatus = 'CRITICAL'
            riskLabelVi = 'Báo động thiếu hàng (MOS < 2 tháng)'
            riskLabelEn = 'Critical Low Stock (MOS < 2M)'
            recommendationVi = `Tồn kho chỉ đủ bán ~${refMos} tháng (Lead time nhập khẩu ~${leadTimeDays} ngày) — cần lên PO nhập gấp tối thiểu ${m6.suggestedReorderBottles.toLocaleString()} chai (${m6.suggestedReorderCases} thùng).`
            recommendationEn = `Only ~${refMos} months of supply left (Lead time ~${leadTimeDays}d) — urgent PO recommended for ${m6.suggestedReorderBottles.toLocaleString()} btls (${m6.suggestedReorderCases} cases).`
        } else if (refMos < 3.5) {
            riskStatus = 'LOW'
            riskLabelVi = 'Sắp chạm điểm đặt hàng (MOS 2 – 3.5 tháng)'
            riskLabelEn = 'Reorder Point Approaching (MOS 2 – 3.5M)'
            recommendationVi = `Tồn kho còn ~${refMos} tháng — nên chuẩn bị kế hoạch đặt hàng thêm ~${m6.suggestedReorderBottles.toLocaleString()} chai (${m6.suggestedReorderCases} thùng) để duy trì chuẩn 6 tháng.`
            recommendationEn = `~${refMos} months of supply remaining — plan next PO of ~${m6.suggestedReorderBottles.toLocaleString()} btls (${m6.suggestedReorderCases} cases).`
        } else if (refMos <= 6) {
            riskStatus = 'OPTIMAL'
            riskLabelVi = 'Tồn kho chuẩn an toàn (MOS 3.5 – 6 tháng)'
            riskLabelEn = 'Optimal Coverage (MOS 3.5 – 6M)'
            recommendationVi = `Tồn kho lý tưởng (~${refMos} tháng), cân bằng tốt giữa vốn lưu động và tốc độ lấy hàng của các nhà hàng.`
            recommendationEn = `Healthy stock coverage (~${refMos}M), well-balanced for current HORECA demand.`
        } else if (refMos <= 12) {
            riskStatus = 'ABUNDANT'
            riskLabelVi = 'Tồn kho dồi dào (MOS 6 – 12 tháng)'
            riskLabelEn = 'Abundant Stock (MOS 6 – 12M)'
            recommendationVi = `Đủ bán trong ~${refMos} tháng tới — chưa cần đặt nhập thêm, có thể mở rộng chào thêm nhà hàng mới.`
            recommendationEn = `~${refMos} months of supply on hand — no reorder needed; good candidate for new outlet placement.`
        } else {
            riskStatus = 'OVERSTOCK'
            riskLabelVi = 'Tồn kho cao / Dư thừa (MOS > 12 tháng)'
            riskLabelEn = 'Overstock (MOS > 12M)'
            recommendationVi = `Số tháng tồn kho cao (~${refMos} tháng) — tạm dừng nhập mới mã này và ưu tiên chính sách giá đặc biệt / combo đẩy tồn.`
            recommendationEn = `High inventory coverage (~${refMos}M) — pause reorders and prioritize sales push / special pricing.`
        }
    }

    return serialize({
        product: {
            id: product.id,
            skuCode: product.skuCode,
            productName: product.productName,
            wineType: product.wineType,
            country: product.country,
            producerName: product.producer?.name ?? '—',
            abvPercent: Number(product.abvPercent ?? 0),
            volumeMl: product.volumeMl,
            unitsPerCase: product.unitsPerCase,
            costPrice,
            wholesalePrice,
            retailPrice,
            totalStock,
            stockTT,
            stockGVM,
            stockOther,
        },
        kpis: {
            totalBottles: totalAllBottles,
            liveCommercialBottles,
            liveTastingBottles,
            historicalBottles,
            totalRevenue: Math.round(totalRevenue),
            avgSellingPrice,
            totalBuyersCount: customers.length,
            activeBuyersCount,
            specialRuleCustomerCount: priceRules.length,
            totalOrdersCount: orderRecords.length,
        },
        importKpis: {
            totalImportedBottles,
            totalFocBottles,
            totalInternalTransferBottles,
            totalImportBatches,
            totalImportValueVnd: Math.round(totalImportValueVnd),
            latestImportDate,
            latestSupplierName,
            latestLandedCostVnd,
            minLandedCostVnd,
            maxLandedCostVnd,
            avgLandedCostVnd,
        },
        mosForecast: {
            riskStatus,
            riskLabelVi,
            riskLabelEn,
            recommendationVi,
            recommendationEn,
            leadTimeDays,
            targetMosMonths,
            incomingQty,
            incomingPoNo,
            incomingEta,
            cycles: { m3, m6, m12 },
        },
        customers,
        orders: orderRecords,
        imports,
        stockLots,
        channelBreakdown,
        monthlyTrend,
    })
    }, 120_000)
}
