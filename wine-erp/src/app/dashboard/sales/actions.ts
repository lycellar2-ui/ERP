'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { generateSoNo } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { submitForApproval } from '@/lib/approval'

export type SOStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'INVOICED' | 'PAID' | 'CANCELLED'
export type SalesChannel = 'HORECA' | 'WHOLESALE_DISTRIBUTOR' | 'VIP_RETAIL' | 'DIRECT_INDIVIDUAL'

export interface SalesOrderRow {
    id: string
    soNo: string
    customerName: string
    customerCode: string
    channel: SalesChannel
    status: SOStatus
    totalAmount: number
    orderDiscount: number
    paymentTerm: string
    salesRepName: string
    lineCount: number
    createdAt: Date
}

export interface SOLineCreate {
    productId: string
    qtyOrdered: number
    unitPrice: number
    lineDiscountPct?: number
}

export interface SOCreateInput {
    customerId: string
    salesRepId: string
    channel: SalesChannel
    paymentTerm: string
    shippingAddressId?: string
    orderDiscount?: number
    notes?: string
    lines: SOLineCreate[]
}

// ── Fetch list ────────────────────────────────────
export async function getSalesOrders(filters: {
    status?: SOStatus
    search?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: SalesOrderRow[]; total: number }> {
    const { status, search, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: any = {}
    if (status) where.status = status
    if (search) {
        where.OR = [
            { soNo: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
            { customer: { code: { contains: search, mode: 'insensitive' } } },
        ]
    }

    const [orders, total] = await Promise.all([
        prisma.salesOrder.findMany({
            where, skip, take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { name: true, code: true } },
                salesRep: { select: { name: true } },
                _count: { select: { lines: true } },
            },
        }),
        prisma.salesOrder.count({ where }),
    ])

    return {
        rows: orders.map((o) => ({
            id: o.id,
            soNo: o.soNo,
            customerName: o.customer.name,
            customerCode: o.customer.code,
            channel: o.channel as SalesChannel,
            status: o.status as SOStatus,
            totalAmount: Number(o.totalAmount),
            orderDiscount: Number(o.orderDiscount),
            paymentTerm: o.paymentTerm,
            salesRepName: o.salesRep.name,
            lineCount: o._count.lines,
            createdAt: o.createdAt,
        })),
        total,
    }
}

// ── Fetch single SO detail ───────────────────────
export async function getSalesOrderDetail(id: string) {
    return prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true, wineType: true, country: true } },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
}

// ── Combined detail + margin (single server action, 2 queries instead of N+1) ──
export async function getSalesOrderDetailWithMargin(id: string): Promise<{
    detail: Awaited<ReturnType<typeof getSalesOrderDetail>>
    margin: SOMarginData | null
}> {
    const detail = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true, wineType: true, country: true } },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
    if (!detail) return { detail: null, margin: null }

    // Single batch query for ALL product costs (eliminates N+1)
    const productIds = [...new Set(detail.lines.map(l => l.productId))]
    const allLots = await prisma.stockLot.findMany({
        where: { productId: { in: productIds }, qtyAvailable: { gt: 0 } },
        select: { productId: true, qtyAvailable: true, unitLandedCost: true },
    })

    // Build cost map from batch result
    const costMap: Record<string, number> = {}
    for (const pid of productIds) {
        const lots = allLots.filter(l => l.productId === pid)
        const totalQty = lots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
        const totalValue = lots.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)
        costMap[pid] = totalQty > 0 ? totalValue / totalQty : 0
    }

    let totalRevenue = 0
    let totalCOGS = 0
    let hasNegativeMargin = false

    const marginLines: SOMarginLine[] = detail.lines.map(l => {
        const qty = Number(l.qtyOrdered)
        const unitPrice = Number(l.unitPrice)
        const discPct = Number(l.lineDiscountPct)
        const revenue = qty * unitPrice * (1 - discPct / 100)
        const avgCost = costMap[l.productId] ?? 0
        const cogs = qty * avgCost
        const margin = revenue - cogs
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
        const isNegative = margin < 0

        if (isNegative) hasNegativeMargin = true
        totalRevenue += revenue
        totalCOGS += cogs

        return {
            lineId: l.id,
            productId: l.productId,
            skuCode: l.product.skuCode,
            productName: l.product.productName,
            qty, unitPrice, lineDiscountPct: discPct,
            revenue, avgCost, cogs, margin, marginPct, isNegative,
        }
    })

    const totalMargin = totalRevenue - totalCOGS
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    return {
        detail,
        margin: { lines: marginLines, totalRevenue, totalCOGS, totalMargin, totalMarginPct, hasNegativeMargin },
    }
}

// ── Customers for dropdown ───────────────────────
export async function getCustomersForSO() {
    return cached('sales:customers', async () => {
        return prisma.customer.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true },
            orderBy: { name: 'asc' },
        })
    }, 60_000)
}

// ── Products with stock for SO lines ─────────────
export async function getProductsWithStock() {
    const products = await prisma.product.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: {
            id: true, skuCode: true, productName: true, wineType: true, country: true,
            stockLots: { where: { status: 'AVAILABLE' }, select: { qtyAvailable: true } },
        },
        orderBy: { productName: 'asc' },
    })

    return products.map((p) => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        wineType: p.wineType,
        country: p.country,
        listPrice: 0,
        totalStock: p.stockLots.reduce((sum: number, l: any) => sum + Number(l.qtyAvailable), 0),
    }))
}

// ── Batch load prices by channel for SO creation ─
export async function getProductPricesForChannel(channel: string): Promise<Record<string, number>> {
    const now = new Date()
    const priceList = await prisma.priceList.findFirst({
        where: {
            channel: channel as any,
            effectiveDate: { lte: now },
            OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        include: { lines: { select: { productId: true, unitPrice: true } } },
        orderBy: { effectiveDate: 'desc' },
    })
    if (!priceList) return {}
    return Object.fromEntries(priceList.lines.map(l => [l.productId, Number(l.unitPrice)]))
}

// ── Get active allocation campaigns for products ─
export async function getActiveAllocationsForProducts(productIds: string[]): Promise<{
    productId: string; campaignName: string; campaignId: string; remaining: number
}[]> {
    const now = new Date()
    const campaigns = await prisma.allocationCampaign.findMany({
        where: {
            productId: { in: productIds },
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
        },
        include: {
            product: { select: { id: true } },
            quotas: { select: { qtyAllocated: true, qtySold: true } },
        },
    })
    return campaigns.map(c => {
        const totalAllocated = c.quotas.reduce((s, q) => s + Number(q.qtyAllocated), 0)
        const totalSold = c.quotas.reduce((s, q) => s + Number(q.qtySold), 0)
        return {
            productId: c.productId,
            campaignName: c.name,
            campaignId: c.id,
            remaining: totalAllocated - totalSold,
        }
    })
}

// ── Get AR outstanding for customer (credit check) ─
export async function getCustomerARBalance(customerId: string): Promise<number> {
    const result = await prisma.aRInvoice.aggregate({
        where: { customerId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { amount: true },
    })
    return Number(result._sum?.amount ?? 0)
}

// ── Users (sales reps) ───────────────────────────
export async function getSalesReps() {
    return cached('sales:reps', async () => {
        return prisma.user.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        })
    }, 120_000)
}

// ── Create Sales Order ───────────────────────────
export async function createSalesOrder(input: SOCreateInput): Promise<{ success: boolean; soId?: string; soNo?: string; error?: string; quotaWarnings?: string[] }> {
    try {
        // --- 1. Check allocation quotas BEFORE creating ---
        const quotaWarnings: string[] = []
        const quotaChecks: { lineIdx: number; quotaId: string; campaignId: string; qty: number }[] = []

        for (let i = 0; i < input.lines.length; i++) {
            const line = input.lines[i]
            const check = await checkAllocationQuota({
                productId: line.productId,
                salesRepId: input.salesRepId,
                customerId: input.customerId,
                channel: input.channel,
                qtyRequested: line.qtyOrdered,
            })

            if (!check.allowed && check.quotaId) {
                quotaWarnings.push(`Dòng ${i + 1}: ${check.reason}`)
            }

            if (check.quotaId && check.campaignId) {
                quotaChecks.push({ lineIdx: i, quotaId: check.quotaId, campaignId: check.campaignId, qty: line.qtyOrdered })
            }
        }

        // If there are quota violations, block creation
        if (quotaWarnings.length > 0) {
            return { success: false, error: `Vượt quota phân bổ:\n${quotaWarnings.join('\n')}`, quotaWarnings }
        }

        // --- 2. Credit Hold Check ---
        const customer = await prisma.customer.findUnique({
            where: { id: input.customerId },
            select: { creditLimit: true, name: true },
        })

        // Auto credit limit enforcement
        if (customer && Number(customer.creditLimit) > 0) {
            const arBalance = await getCustomerARBalance(input.customerId)

            const newOrderAmount = input.lines.reduce((sum, l) => {
                const lineTotal = l.qtyOrdered * l.unitPrice
                const discount = lineTotal * ((l.lineDiscountPct ?? 0) / 100)
                return sum + lineTotal - discount
            }, 0) * (1 - (input.orderDiscount ?? 0) / 100)

            const creditLimit = Number(customer.creditLimit)
            const projectedBalance = arBalance + newOrderAmount

            if (projectedBalance > creditLimit) {
                return {
                    success: false,
                    error: `⚠️ Vượt hạn mức tín dụng!\n` +
                        `• Hạn mức: ${creditLimit.toLocaleString('vi-VN')} ₫\n` +
                        `• Công nợ hiện tại: ${arBalance.toLocaleString('vi-VN')} ₫\n` +
                        `• Đơn mới: ${Math.round(newOrderAmount).toLocaleString('vi-VN')} ₫\n` +
                        `• Tổng dự kiến: ${Math.round(projectedBalance).toLocaleString('vi-VN')} ₫\n` +
                        `Cần thu nợ thêm ${Math.round(projectedBalance - creditLimit).toLocaleString('vi-VN')} ₫ trước khi tạo đơn.`,
                }
            }
        }

        // --- 3. Create the SO ---
        const count = await prisma.salesOrder.count()
        const soNo = generateSoNo(count + 1)

        const totalAmount = input.lines.reduce((sum, l) => {
            const lineTotal = l.qtyOrdered * l.unitPrice
            const discount = lineTotal * ((l.lineDiscountPct ?? 0) / 100)
            return sum + lineTotal - discount
        }, 0)

        const finalAmount = totalAmount * (1 - (input.orderDiscount ?? 0) / 100)

        const so = await prisma.salesOrder.create({
            data: {
                soNo,
                customerId: input.customerId,
                salesRepId: input.salesRepId,
                channel: input.channel,
                paymentTerm: input.paymentTerm,
                shippingAddressId: input.shippingAddressId ?? null,
                orderDiscount: input.orderDiscount ?? 0,
                totalAmount: finalAmount,
                status: 'DRAFT',
                lines: {
                    create: input.lines.map((l, idx) => {
                        const qc = quotaChecks.find(q => q.lineIdx === idx)
                        return {
                            productId: l.productId,
                            qtyOrdered: l.qtyOrdered,
                            unitPrice: l.unitPrice,
                            lineDiscountPct: l.lineDiscountPct ?? 0,
                            ...(qc ? { allocationCampaignId: qc.campaignId } : {}),
                        }
                    }),
                },
            },
            include: { lines: { select: { id: true, productId: true } } },
        })

        // --- 4. Consume allocation quotas ---
        for (const qc of quotaChecks) {
            const soLine = so.lines.find(l => l.productId === input.lines[qc.lineIdx].productId)
            if (soLine) {
                await consumeAllocationQuota({ quotaId: qc.quotaId, soLineId: soLine.id, qtyUsed: qc.qty })
            }
        }

        // --- 5. Audit log ---
        try {
            await logAudit({ userId: input.salesRepId, action: 'CREATE', entityType: 'SalesOrder', entityId: so.id, newValue: { soNo, channel: input.channel, totalAmount: finalAmount } })
        } catch { /* silent */ }

        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/allocation')
        revalidateCache('sales')
        return { success: true, soId: so.id, soNo: so.soNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Confirm SO (with Approval Engine integration) ─
const SO_APPROVAL_THRESHOLD = 100_000_000 // 100M VND → cần CEO duyệt

export async function confirmSalesOrder(id: string): Promise<{ success: boolean; error?: string; needsApproval?: boolean }> {
    try {
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { totalAmount: true, salesRepId: true, soNo: true, status: true },
        })
        if (!so) return { success: false, error: 'SO not found' }
        if (so.status !== 'DRAFT') return { success: false, error: `Không thể xác nhận SO ở trạng thái ${so.status}` }

        const amount = Number(so.totalAmount)

        // If above threshold, route to Approval Engine
        if (amount >= SO_APPROVAL_THRESHOLD) {
            await prisma.salesOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } })
            const result = await submitForApproval({
                docType: 'SALES_ORDER',
                docId: id,
                docValue: amount,
                requestedBy: so.salesRepId,
            })
            if (!result.success) {
                // Fallback: still mark as PENDING_APPROVAL
                await logAudit({ userId: so.salesRepId, action: 'STATUS_CHANGE', entityType: 'SalesOrder', entityId: id, newValue: { status: 'PENDING_APPROVAL', reason: 'Above threshold, approval engine failed' } }).catch(() => { })
            }
            revalidatePath('/dashboard/sales')
            revalidatePath('/dashboard')
            revalidateCache('sales')
            revalidateCache('dashboard')
            return { success: true, needsApproval: true }
        }

        // Direct confirm for small orders
        await prisma.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED' } })
        await logAudit({ userId: so.salesRepId, action: 'CONFIRM', entityType: 'SalesOrder', entityId: id, newValue: { status: 'CONFIRMED' } }).catch(() => { })
        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Advance SO status ────────────────────────────
// Valid transitions: CONFIRMED→PARTIALLY_DELIVERED→DELIVERED→INVOICED→PAID
export async function advanceSalesOrderStatus(id: string, toStatus: SOStatus): Promise<{ success: boolean; error?: string }> {
    const allowed: Record<string, SOStatus[]> = {
        CONFIRMED: ['PARTIALLY_DELIVERED', 'DELIVERED'],
        PARTIALLY_DELIVERED: ['DELIVERED'],
        DELIVERED: ['INVOICED'],
        INVOICED: ['PAID'],
    }
    try {
        const so = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true } })
        if (!so) return { success: false, error: 'Không tìm thấy SO' }
        if (!allowed[so.status]?.includes(toStatus)) {
            return { success: false, error: `Không thể chuyển từ ${so.status} → ${toStatus}` }
        }
        await prisma.salesOrder.update({ where: { id }, data: { status: toStatus } })
        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Cancel SO — also releases allocation quotas ─
export async function cancelSalesOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Release allocation quotas linked to this SO
        const soLines = await prisma.salesOrderLine.findMany({
            where: { soId: id },
            include: { allocationLogs: { where: { action: 'USE' } } },
        })

        for (const line of soLines) {
            for (const log of line.allocationLogs) {
                // Decrement qtySold and create RELEASE log
                await prisma.$transaction([
                    prisma.allocationQuota.update({
                        where: { id: log.quotaId },
                        data: { qtySold: { decrement: Number(log.qtyUsed) } },
                    }),
                    prisma.allocationLog.create({
                        data: {
                            quotaId: log.quotaId,
                            soLineId: line.id,
                            qtyUsed: Number(log.qtyUsed),
                            action: 'RELEASE',
                        },
                    }),
                ])
            }
        }

        await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } })

        try {
            await logAudit({ action: 'UPDATE', entityType: 'SalesOrder', entityId: id, newValue: { status: 'CANCELLED', quotaReleased: true } })
        } catch { /* silent */ }

        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/allocation')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Sales stats ─────────────────────────────────
export async function getSalesStats() {
    return cached('sales:stats', async () => {
        const [totals, byStatus] = await Promise.all([
            prisma.salesOrder.aggregate({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
                },
                _sum: { totalAmount: true },
                _count: true,
            }),
            prisma.salesOrder.groupBy({ by: ['status'], _count: true }),
        ])

        const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]))
        return {
            monthRevenue: Number(totals._sum.totalAmount ?? 0),
            monthOrders: totals._count,
            pendingApproval: statusMap['PENDING_APPROVAL'] ?? 0,
            draft: statusMap['DRAFT'] ?? 0,
            confirmed: statusMap['CONFIRMED'] ?? 0,
        }
    }, 30_000)
}

// ── SO Margin analysis (per line COGS vs selling price)
export type SOMarginLine = {
    lineId: string
    productId: string
    skuCode: string
    productName: string
    qty: number
    unitPrice: number
    lineDiscountPct: number
    revenue: number
    avgCost: number
    cogs: number
    margin: number
    marginPct: number
    isNegative: boolean
}

export type SOMarginData = {
    lines: SOMarginLine[]
    totalRevenue: number
    totalCOGS: number
    totalMargin: number
    totalMarginPct: number
    hasNegativeMargin: boolean
}

export async function getSOMarginData(soId: string): Promise<SOMarginData | null> {
    const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } },
                },
            },
        },
    })
    if (!so) return null

    const productIds = [...new Set(so.lines.map(l => l.productId))]

    // Get weighted average cost per product from available stock lots
    const costData = await Promise.all(
        productIds.map(async pid => {
            const lots = await prisma.stockLot.findMany({
                where: { productId: pid, qtyAvailable: { gt: 0 } },
                select: { qtyAvailable: true, unitLandedCost: true },
            })
            const totalQty = lots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
            const totalValue = lots.reduce(
                (s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0
            )
            return { productId: pid, avgCost: totalQty > 0 ? totalValue / totalQty : 0 }
        })
    )
    const costMap = Object.fromEntries(costData.map(c => [c.productId, c.avgCost]))

    let totalRevenue = 0
    let totalCOGS = 0
    let hasNegativeMargin = false

    const lines: SOMarginLine[] = so.lines.map(l => {
        const qty = Number(l.qtyOrdered)
        const unitPrice = Number(l.unitPrice)
        const discPct = Number(l.lineDiscountPct)
        const revenue = qty * unitPrice * (1 - discPct / 100)
        const avgCost = costMap[l.productId] ?? 0
        const cogs = qty * avgCost
        const margin = revenue - cogs
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
        const isNegative = margin < 0

        if (isNegative) hasNegativeMargin = true
        totalRevenue += revenue
        totalCOGS += cogs

        return {
            lineId: l.id,
            productId: l.productId,
            skuCode: l.product.skuCode,
            productName: l.product.productName,
            qty,
            unitPrice,
            lineDiscountPct: discPct,
            revenue,
            avgCost,
            cogs,
            margin,
            marginPct,
            isNegative,
        }
    })

    const totalMargin = totalRevenue - totalCOGS
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    return { lines, totalRevenue, totalCOGS, totalMargin, totalMarginPct, hasNegativeMargin }
}

// ═══════════════════════════════════════════════════
// ALLOCATION ENGINE — Campaign quota management
// ═══════════════════════════════════════════════════

export type AllocationCampaignRow = {
    id: string
    name: string
    productName: string
    skuCode: string
    productId: string
    totalQty: number
    allocatedQty: number
    soldQty: number
    remainingQty: number
    unit: string
    status: string
    startDate: Date
    endDate: Date
    quotaCount: number
}

export type AllocationQuotaRow = {
    id: string
    campaignId: string
    targetType: string
    targetId: string
    targetLabel: string
    qtyAllocated: number
    qtySold: number
    qtyRemaining: number
}

// ── List Campaigns ────────────────────────────────
export async function getAllocationCampaigns(): Promise<AllocationCampaignRow[]> {
    const campaigns = await prisma.allocationCampaign.findMany({
        include: {
            product: { select: { productName: true, skuCode: true } },
            quotas: { select: { qtyAllocated: true, qtySold: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return campaigns.map(c => {
        const allocatedQty = c.quotas.reduce((s, q) => s + Number(q.qtyAllocated), 0)
        const soldQty = c.quotas.reduce((s, q) => s + Number(q.qtySold), 0)
        return {
            id: c.id,
            name: c.name,
            productName: c.product.productName,
            skuCode: c.product.skuCode,
            productId: c.productId,
            totalQty: Number(c.totalQty),
            allocatedQty,
            soldQty,
            remainingQty: Number(c.totalQty) - allocatedQty,
            unit: c.unit,
            status: c.status,
            startDate: c.startDate,
            endDate: c.endDate,
            quotaCount: c.quotas.length,
        }
    })
}

// ── Create Campaign ───────────────────────────────
export async function createAllocationCampaign(input: {
    name: string
    productId: string
    totalQty: number
    unit?: 'CASE' | 'BOTTLE'
    startDate: string
    endDate: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const campaign = await prisma.allocationCampaign.create({
            data: {
                name: input.name,
                productId: input.productId,
                totalQty: input.totalQty,
                unit: (input.unit ?? 'CASE') as any,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
                status: 'ACTIVE',
            },
        })
        revalidatePath('/dashboard/sales')
        return { success: true, id: campaign.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get campaign quotas ───────────────────────────
export async function getCampaignQuotas(campaignId: string): Promise<AllocationQuotaRow[]> {
    const quotas = await prisma.allocationQuota.findMany({
        where: { campaignId },
    })

    // Resolve target labels
    const result: AllocationQuotaRow[] = []
    for (const q of quotas) {
        let targetLabel = q.targetId
        if (q.targetType === 'SALES_REP') {
            const user = await prisma.user.findUnique({ where: { id: q.targetId }, select: { name: true } })
            targetLabel = user?.name ?? q.targetId
        } else if (q.targetType === 'CUSTOMER') {
            const cust = await prisma.customer.findUnique({ where: { id: q.targetId }, select: { name: true } })
            targetLabel = cust?.name ?? q.targetId
        }

        result.push({
            id: q.id,
            campaignId: q.campaignId,
            targetType: q.targetType,
            targetId: q.targetId,
            targetLabel,
            qtyAllocated: Number(q.qtyAllocated),
            qtySold: Number(q.qtySold),
            qtyRemaining: Number(q.qtyAllocated) - Number(q.qtySold),
        })
    }
    return result
}

// ── Add/Update Quota ──────────────────────────────
export async function upsertAllocationQuota(input: {
    campaignId: string
    targetType: 'SALES_REP' | 'CUSTOMER' | 'CHANNEL'
    targetId: string
    qtyAllocated: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        // Check campaign total not exceeded
        const campaign = await prisma.allocationCampaign.findUnique({
            where: { id: input.campaignId },
            include: { quotas: true },
        })
        if (!campaign) return { success: false, error: 'Campaign không tồn tại' }

        const currentAllocated = campaign.quotas.reduce((s, q) => s + Number(q.qtyAllocated), 0)
        const existingQuota = campaign.quotas.find(
            q => q.targetType === input.targetType && q.targetId === input.targetId
        )
        const diff = input.qtyAllocated - (existingQuota ? Number(existingQuota.qtyAllocated) : 0)

        if (currentAllocated + diff > Number(campaign.totalQty)) {
            return { success: false, error: `Vượt quá tổng quota (${Number(campaign.totalQty)}). Còn lại: ${Number(campaign.totalQty) - currentAllocated}` }
        }

        if (existingQuota) {
            await prisma.allocationQuota.update({
                where: { id: existingQuota.id },
                data: { qtyAllocated: input.qtyAllocated },
            })
        } else {
            await prisma.allocationQuota.create({
                data: {
                    campaignId: input.campaignId,
                    targetType: input.targetType as any,
                    targetId: input.targetId,
                    qtyAllocated: input.qtyAllocated,
                    qtySold: 0,
                },
            })
        }

        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Check Quota before SO creation ────────────────
export async function checkAllocationQuota(input: {
    productId: string
    salesRepId: string
    customerId: string
    channel: string
    qtyRequested: number
}): Promise<{ allowed: boolean; availableQty: number; campaignId?: string; quotaId?: string; reason?: string }> {
    // Find active campaigns for this product
    const now = new Date()
    const campaigns = await prisma.allocationCampaign.findMany({
        where: {
            productId: input.productId,
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
        },
        include: { quotas: true },
    })

    if (campaigns.length === 0) {
        return { allowed: true, availableQty: input.qtyRequested, reason: 'Không có campaign allocation cho sản phẩm này' }
    }

    // Check quotas across all active campaigns
    for (const campaign of campaigns) {
        // Check by sales rep
        const repQuota = campaign.quotas.find(
            q => q.targetType === 'SALES_REP' && q.targetId === input.salesRepId
        )
        if (repQuota) {
            const available = Number(repQuota.qtyAllocated) - Number(repQuota.qtySold)
            return {
                allowed: input.qtyRequested <= available,
                availableQty: available,
                campaignId: campaign.id,
                quotaId: repQuota.id,
                reason: input.qtyRequested > available ? `Quota còn ${available}, yêu cầu ${input.qtyRequested}` : undefined,
            }
        }

        // Check by customer
        const custQuota = campaign.quotas.find(
            q => q.targetType === 'CUSTOMER' && q.targetId === input.customerId
        )
        if (custQuota) {
            const available = Number(custQuota.qtyAllocated) - Number(custQuota.qtySold)
            return {
                allowed: input.qtyRequested <= available,
                availableQty: available,
                campaignId: campaign.id,
                quotaId: custQuota.id,
                reason: input.qtyRequested > available ? `Quota còn ${available}, yêu cầu ${input.qtyRequested}` : undefined,
            }
        }

        // Check by channel
        const chanQuota = campaign.quotas.find(
            q => q.targetType === 'CHANNEL' && q.targetId === input.channel
        )
        if (chanQuota) {
            const available = Number(chanQuota.qtyAllocated) - Number(chanQuota.qtySold)
            return {
                allowed: input.qtyRequested <= available,
                availableQty: available,
                campaignId: campaign.id,
                quotaId: chanQuota.id,
                reason: input.qtyRequested > available ? `Quota còn ${available}, yêu cầu ${input.qtyRequested}` : undefined,
            }
        }
    }

    return { allowed: true, availableQty: input.qtyRequested, reason: 'Không có quota giới hạn cho đối tượng này' }
}

// ── Consume quota when SO is confirmed ────────────
export async function consumeAllocationQuota(input: {
    quotaId: string
    soLineId: string
    qtyUsed: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.allocationQuota.update({
                where: { id: input.quotaId },
                data: { qtySold: { increment: input.qtyUsed } },
            }),
            prisma.allocationLog.create({
                data: {
                    quotaId: input.quotaId,
                    soLineId: input.soLineId,
                    qtyUsed: input.qtyUsed,
                    action: 'USE',
                },
            }),
        ])
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

