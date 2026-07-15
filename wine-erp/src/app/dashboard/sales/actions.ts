'use server'

import { prisma } from '@/lib/db'
import { cached, revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { generateSoNo } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { submitForApproval } from '@/lib/approval'
import { notifySOApprovalRequired, notifySOCreated, notifySOPendingAdmin, notifySOPendingCEO, notifySOPendingAccounting, notifySOConfirmed } from '@/lib/notifications'
import { SOCreateSchema, parseOrThrow } from '@/lib/validations'
import { serialize } from '@/lib/serialize'
import { requireAuth, getCurrentUser, hasRole } from '@/lib/session'

export type SOStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PENDING_ACCOUNTING' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'INVOICED' | 'PAID' | 'CANCELLED'
export type SalesChannel = 'HORECA' | 'WHOLESALE_DISTRIBUTOR' | 'VIP_RETAIL' | 'DIRECT_INDIVIDUAL' | 'CORPORATE' | 'RETAIL'

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
    legalEntityName: string | null
    legalEntityCode: string | null
    lineCount: number
    notes: string | null
    createdAt: Date
    approvalStep?: number | null
}

export interface SOLineCreate {
    productId: string
    qtyOrdered: number
    unitPrice: number
    lineDiscountPct?: number
    priceSource?: string
}

export interface SOCreateInput {
    customerId: string
    salesRepId: string
    channel: SalesChannel
    paymentTerm: string
    shippingAddressId?: string
    orderDiscount?: number
    notes?: string
    legalEntityId: string
    lines: SOLineCreate[]
}

// ── Fetch list (with sort, date range) ────────────
export async function getSalesOrders(filters: {
    status?: SOStatus
    search?: string
    page?: number
    pageSize?: number
    sortBy?: 'createdAt' | 'totalAmount' | 'soNo'
    sortDir?: 'asc' | 'desc'
    dateFrom?: string
    dateTo?: string
} = {}): Promise<{ rows: SalesOrderRow[]; total: number }> {
    const { status, search, page = 1, pageSize = 20, sortBy = 'createdAt', sortDir = 'desc', dateFrom, dateTo } = filters

    const user = await getCurrentUser()
    const userId = user?.id ?? 'anonymous'
    const cacheKey = `sales:orders:list:${userId}:${status || 'all'}:${search || 'none'}:${page}:${pageSize}:${sortBy}:${sortDir}:${dateFrom || 'none'}:${dateTo || 'none'}`

    const fetchData = async () => {
        const skip = (page - 1) * pageSize
        
        const params: any[] = []
        let paramIndex = 1
        const conditions: string[] = []

        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            conditions.push(`so."salesRepId" = $${paramIndex++}`)
            params.push(user.id)
        }

        if (status) {
            conditions.push(`so.status = $${paramIndex++}`)
            params.push(status)
        }

        if (search) {
            conditions.push(`(so."soNo" ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`)
            params.push(`%${search}%`)
            paramIndex++
        }

        if (dateFrom) {
            conditions.push(`so."createdAt" >= $${paramIndex++}`)
            params.push(new Date(dateFrom))
        }
        if (dateTo) {
            conditions.push(`so."createdAt" <= $${paramIndex++}`)
            params.push(new Date(dateTo + 'T23:59:59.999Z'))
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        // Sort validation
        const validSortFields = ['createdAt', 'totalAmount', 'soNo']
        const validSortDirs = ['asc', 'desc']
        
        const validatedSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
        const validatedSortDir = validSortDirs.includes(sortDir.toLowerCase()) ? sortDir.toLowerCase() : 'desc'

        let sortCol = `so."createdAt"`
        if (validatedSortBy === 'totalAmount') sortCol = `so."totalAmount"`
        if (validatedSortBy === 'soNo') sortCol = `so."soNo"`

        const limitIndex = paramIndex++
        const offsetIndex = paramIndex++
        const queryParams = [...params, pageSize, skip]

        const query = `
            SELECT so.id, so."soNo", so."totalAmount", so.channel, so.status, so."paymentTerm", so."orderDiscount", NULL as notes, so."createdAt", 
                   c.name as customer_name, c.code as customer_code,
                   u.name as sales_rep_name,
                   le.name as legal_entity_name, le.code as legal_entity_code,
                   (SELECT COUNT(*)::int FROM sales_order_lines sol WHERE sol."soId" = so.id) as line_count
            FROM sales_orders so
            JOIN customers c ON c.id = so."customerId"
            JOIN users u ON u.id = so."salesRepId"
            JOIN legal_entities le ON le.id = so."legalEntityId"
            ${whereClause}
            ORDER BY ${sortCol} ${validatedSortDir}
            LIMIT $${limitIndex} OFFSET $${offsetIndex}
        `

        let countQuery = ''
        if (search) {
            countQuery = `
                SELECT COUNT(*)::int as total
                FROM sales_orders so
                JOIN customers c ON c.id = so."customerId"
                ${whereClause}
            `
        } else {
            countQuery = `
                SELECT COUNT(*)::int as total
                FROM sales_orders so
                ${whereClause}
            `
        }

        const [orders, countResult] = await Promise.all([
            prisma.$queryRawUnsafe<any[]>(query, ...queryParams),
            prisma.$queryRawUnsafe<any[]>(countQuery, ...params),
        ])

        const total = countResult[0]?.total ?? 0

        const orderIds = orders.map((o: any) => o.id)
        const approvalRequests = await prisma.approvalRequest.findMany({
            where: { docType: 'SALES_ORDER', docId: { in: orderIds }, status: 'PENDING' },
            select: { docId: true, currentStep: true }
        })
        const approvalMap = Object.fromEntries(approvalRequests.map(r => [r.docId, r.currentStep]))

        return {
            rows: orders.map((o: any) => ({
                id: o.id,
                soNo: o.soNo,
                customerName: o.customer_name,
                customerCode: o.customer_code,
                channel: o.channel as SalesChannel,
                status: o.status as SOStatus,
                totalAmount: Number(o.totalAmount),
                orderDiscount: Number(o.orderDiscount),
                paymentTerm: o.paymentTerm,
                salesRepName: o.sales_rep_name,
                legalEntityName: o.legal_entity_name,
                legalEntityCode: o.legal_entity_code,
                lineCount: o.line_count,
                notes: null,
                createdAt: o.createdAt,
                approvalStep: approvalMap[o.id] ?? null,
            })),
            total,
        }
    }

    return cached(cacheKey, fetchData, 30_000)
}

// ── Fetch single SO detail ───────────────────────
export async function getSalesOrderDetail(id: string) {
    const user = await requireAuth()
    const raw = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { id: true, name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: {
                        include: {
                            media: {
                                where: { isPrimary: true },
                                select: { url: true }
                            },
                            profile: {
                                select: { grapes: true }
                            }
                        }
                    },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
    if (!raw) return null

    if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
        if (raw.salesRepId !== user.id) {
            throw new Error('Bạn không có quyền xem đơn hàng của Sales khác.')
        }
    }

    const approvalReq = await prisma.approvalRequest.findFirst({
        where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' },
        select: { currentStep: true }
    })

    return serialize({
        ...raw,
        approvalStep: approvalReq?.currentStep ?? null
    })
}

// ── Combined detail + margin (single server action, 2 queries instead of N+1) ──
export async function getSalesOrderDetailWithMargin(id: string): Promise<{
    detail: Awaited<ReturnType<typeof getSalesOrderDetail>>
    margin: SOMarginData | null
}> {
    const user = await requireAuth()
    const detail = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { id: true, name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: {
                        include: {
                            media: {
                                where: { isPrimary: true },
                                select: { url: true }
                            },
                            profile: {
                                select: { grapes: true }
                            }
                        }
                    },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
    if (!detail) return { detail: null, margin: null }

    if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
        if (detail.salesRepId !== user.id) {
            throw new Error('Bạn không có quyền xem đơn hàng của Sales khác.')
        }
    }

    const canSeeMargin = hasRole(user, 'CEO', 'Kế Toán', 'KE_TOAN', 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN')

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
            priceSource: l.priceSource ?? null,
        }
    })

    const totalMargin = totalRevenue - totalCOGS
    const totalMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    const approvalReq = await prisma.approvalRequest.findFirst({
        where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' },
        select: { currentStep: true }
    })

    return serialize({
        detail: {
            ...detail,
            approvalStep: approvalReq?.currentStep ?? null
        },
        margin: canSeeMargin ? { lines: marginLines, totalRevenue, totalCOGS, totalMargin, totalMarginPct, hasNegativeMargin } : null,
    })
}

export async function getSalesOrderDetailWithMarginAndTimeline(id: string): Promise<{
    detail: Awaited<ReturnType<typeof getSalesOrderDetailWithMargin>>['detail']
    margin: SOMarginData | null
    timeline: SOTimelineEvent[]
}> {
    const [detailAndMargin, timeline] = await Promise.all([
        getSalesOrderDetailWithMargin(id),
        getSOTimeline(id)
    ])
    return {
        ...detailAndMargin,
        timeline
    }
}


// ── Customers for dropdown ───────────────────────
export async function getCustomersForSO() {
    return cached('sales:customers', async () => {
        return prisma.customer.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: {
                id: true,
                name: true,
                code: true,
                creditLimit: true,
                creditHold: true,
                paymentTerm: true,
                channel: true,
                parentId: true,
                parent: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        creditLimit: true,
                        creditHold: true,
                    }
                }
            },
            orderBy: { name: 'asc' },
        })
    }, 60_000)
}

// ── Products with stock for SO lines ─────────────
export async function getProductsWithStock() {
    return cached('products:with-stock', async () => {
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: {
                id: true, skuCode: true, productName: true, wineType: true, country: true,
                stockLots: { where: { status: 'AVAILABLE' }, select: { qtyAvailable: true } },
            },
            orderBy: { productName: 'asc' },
        })

        return products.map((p) => {
            return {
                id: p.id,
                skuCode: p.skuCode,
                productName: p.productName,
                wineType: p.wineType,
                country: p.country,
                listPrice: 0,
                totalStock: p.stockLots.reduce((sum: number, l: any) => sum + Number(l.qtyAvailable), 0),
                costPrice: 0,
                retailPrice: 0,
                wholesalePrice: 0,
                primaryImageUrl: null,
                supplierName: "Ly's Cellars",
            }
        })
    }, 60_000)
}

// ── Get available vintages in stock for products ──
export async function getAvailableVintagesForProducts(productIds: string[]): Promise<Record<string, number[]>> {
    const lots = await prisma.stockLot.findMany({
        where: {
            productId: { in: productIds },
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
            vintage: { not: null }
        },
        select: {
            productId: true,
            vintage: true
        }
    })
    
    const map: Record<string, number[]> = {}
    for (const lot of lots) {
        if (lot.vintage === null) continue
        const pid = lot.productId
        if (!map[pid]) {
            map[pid] = []
        }
        if (!map[pid].includes(lot.vintage)) {
            map[pid].push(lot.vintage)
        }
    }
    
    // Sort vintages ascending
    for (const key of Object.keys(map)) {
        map[key].sort((a, b) => a - b)
    }
    
    return map
}

// ── Batch load prices by channel for SO creation ─
export async function getProductPricesForChannel(channel: string): Promise<Record<string, number>> {
    return cached(`pricing:channel:${channel}`, async () => {
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
    }, 60_000)
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
    const cust = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { parentId: true },
    })

    let targetCustomerIds = [customerId]

    if (cust?.parentId) {
        const siblingCusts = await prisma.customer.findMany({
            where: { OR: [{ id: cust.parentId }, { parentId: cust.parentId }] },
            select: { id: true }
        })
        targetCustomerIds = siblingCusts.map(c => c.id)
    } else {
        const childCusts = await prisma.customer.findMany({
            where: { parentId: customerId },
            select: { id: true }
        })
        if (childCusts.length > 0) {
            targetCustomerIds = [customerId, ...childCusts.map(c => c.id)]
        }
    }

    const result = await prisma.aRInvoice.aggregate({
        where: { customerId: { in: targetCustomerIds }, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
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
        const user = await requireAuth()
        // --- 0. Validate input ---
        parseOrThrow(SOCreateSchema, input)

        let salesRepId = input.salesRepId
        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            salesRepId = user.id
        }

        // --- 1. Check allocation quotas BEFORE creating ---
        const quotaWarnings: string[] = []
        const quotaChecks: { lineIdx: number; quotaId: string; campaignId: string; qty: number }[] = []

        for (let i = 0; i < input.lines.length; i++) {
            const line = input.lines[i]
            const check = await checkAllocationQuota({
                productId: line.productId,
                salesRepId: salesRepId,
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
            select: { creditLimit: true, name: true, parentId: true, parent: { select: { id: true, creditLimit: true, name: true } } },
        })

        // Auto credit limit enforcement
        if (customer) {
            let checkCustomerId = input.customerId
            let creditLimit = Number(customer.creditLimit)
            let targetCustomerName = customer.name

            if (customer.parent) {
                checkCustomerId = customer.parent.id
                creditLimit = Number(customer.parent.creditLimit)
                targetCustomerName = customer.parent.name
            }

            if (creditLimit > 0) {
                const arBalance = await getCustomerARBalance(checkCustomerId)

                const newOrderAmount = input.lines.reduce((sum, l) => {
                    const lineTotal = l.qtyOrdered * l.unitPrice
                    const discount = lineTotal * ((l.lineDiscountPct ?? 0) / 100)
                    return sum + lineTotal - discount
                }, 0) * (1 - (input.orderDiscount ?? 0) / 100)

                const projectedBalance = arBalance + newOrderAmount

                if (projectedBalance > creditLimit) {
                    return {
                        success: false,
                        error: `⚠️ Vượt hạn mức tín dụng (${customer.parent ? 'Nhóm Khách Hàng Cha: ' + targetCustomerName : 'Khách Hàng: ' + targetCustomerName})!\n` +
                            `• Hạn mức: ${creditLimit.toLocaleString('vi-VN')} ₫\n` +
                            `• Công nợ gộp hiện tại: ${arBalance.toLocaleString('vi-VN')} ₫\n` +
                            `• Đơn mới: ${Math.round(newOrderAmount).toLocaleString('vi-VN')} ₫\n` +
                            `• Tổng dự kiến: ${Math.round(projectedBalance).toLocaleString('vi-VN')} ₫\n` +
                            `Cần thu nợ thêm ${Math.round(projectedBalance - creditLimit).toLocaleString('vi-VN')} ₫ trước khi tạo đơn.`,
                    }
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
                salesRepId: salesRepId,
                channel: input.channel,
                paymentTerm: input.paymentTerm,
                shippingAddressId: input.shippingAddressId ?? null,
                orderDiscount: input.orderDiscount ?? 0,
                totalAmount: finalAmount,
                status: 'DRAFT',
                legalEntityId: input.legalEntityId,
                notes: input.notes ?? null,
                lines: {
                    create: input.lines.map((l, idx) => {
                        const qc = quotaChecks.find(q => q.lineIdx === idx)
                        return {
                            productId: l.productId,
                            qtyOrdered: l.qtyOrdered,
                            unitPrice: l.unitPrice,
                            lineDiscountPct: l.lineDiscountPct ?? 0,
                            priceSource: l.priceSource ?? null,
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
            await logAudit({ userId: salesRepId, action: 'CREATE', entityType: 'SalesOrder', entityId: so.id, newValue: { soNo, channel: input.channel, totalAmount: finalAmount } })
        } catch { /* silent */ }

        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/allocation')
        revalidateCache('sales')
        return { success: true, soId: so.id, soNo: so.soNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Update Sales Order (DRAFT only) ──────────────
export interface SOUpdateInput {
    soId: string
    customerId: string
    channel: SalesChannel
    paymentTerm: string
    orderDiscount?: number
    notes?: string
    legalEntityId: string
    lines: SOLineCreate[]
}

export async function updateSalesOrder(input: SOUpdateInput): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id: input.soId },
            select: { status: true, salesRepId: true, soNo: true },
        })
        if (!so) return { success: false, error: 'SO không tồn tại' }
        if (so.status !== 'DRAFT') return { success: false, error: `Chỉ có thể sửa SO ở trạng thái DRAFT (hiện tại: ${so.status})` }

        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (so.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền sửa đơn hàng của Sales khác.' }
            }
        }

        if (!input.lines || input.lines.length === 0) return { success: false, error: 'Cần ít nhất 1 dòng sản phẩm' }

        const totalAmount = input.lines.reduce((sum, l) => {
            const lineTotal = l.qtyOrdered * l.unitPrice
            const discount = lineTotal * ((l.lineDiscountPct ?? 0) / 100)
            return sum + lineTotal - discount
        }, 0)
        const finalAmount = totalAmount * (1 - (input.orderDiscount ?? 0) / 100)

        // Credit check
        const customer = await prisma.customer.findUnique({
            where: { id: input.customerId },
            select: { creditLimit: true, parentId: true, parent: { select: { id: true, creditLimit: true } } },
        })
        if (customer) {
            let checkCustomerId = input.customerId
            let creditLimit = Number(customer.creditLimit)
            if (customer.parent) {
                checkCustomerId = customer.parent.id
                creditLimit = Number(customer.parent.creditLimit)
            }
            if (creditLimit > 0) {
                const arBalance = await getCustomerARBalance(checkCustomerId)
                if (arBalance + finalAmount > creditLimit) {
                    return { success: false, error: `Vượt hạn mức tín dụng! AR: ${arBalance.toLocaleString('vi-VN')}₫ + Đơn: ${Math.round(finalAmount).toLocaleString('vi-VN')}₫ > Limit: ${creditLimit.toLocaleString('vi-VN')}₫` }
                }
            }
        }

        await prisma.$transaction([
            // Delete old lines
            prisma.salesOrderLine.deleteMany({ where: { soId: input.soId } }),
            // Update SO header
            prisma.salesOrder.update({
                where: { id: input.soId },
                data: {
                    customerId: input.customerId,
                    channel: input.channel,
                    paymentTerm: input.paymentTerm,
                    orderDiscount: input.orderDiscount ?? 0,
                    totalAmount: finalAmount,
                    legalEntityId: input.legalEntityId,
                    notes: input.notes ?? null,
                },
            }),
            // Create new lines
            ...input.lines.map(l => prisma.salesOrderLine.create({
                data: {
                    soId: input.soId,
                    productId: l.productId,
                    qtyOrdered: l.qtyOrdered,
                    unitPrice: l.unitPrice,
                    lineDiscountPct: l.lineDiscountPct ?? 0,
                    priceSource: l.priceSource ?? null,
                },
            })),
        ])

        await logAudit({ userId: so.salesRepId, action: 'UPDATE', entityType: 'SalesOrder', entityId: input.soId, newValue: { channel: input.channel, totalAmount: finalAmount, lineCount: input.lines.length } }).catch(() => { })
        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Confirm SO (with Approval Engine integration) ─
const SO_APPROVAL_THRESHOLD = 100_000_000 // 100M VND → cần CEO duyệt
const DISCOUNT_APPROVAL_THRESHOLD = 15 // > 15% discount → cần CEO duyệt

export async function confirmSalesOrder(id: string): Promise<{ success: boolean; error?: string; needsApproval?: boolean }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { 
                totalAmount: true, 
                salesRepId: true, 
                soNo: true, 
                status: true, 
                orderDiscount: true, 
                customer: { select: { name: true } },
                salesRep: { select: { name: true } },
                lines: { select: { qtyOrdered: true, unitPrice: true, lineDiscountPct: true } } 
            },
        })
        if (!so) return { success: false, error: 'SO not found' }
        if (so.status !== 'DRAFT') return { success: false, error: `Không thể xác nhận SO ở trạng thái ${so.status}` }

        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (so.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền xác nhận đơn hàng của Sales khác.' }
            }
        }

        const amount = Number(so.totalAmount)

        // ALL orders confirmed by Sales go to PENDING_APPROVAL for Sale Admin/Manager approval
        await prisma.salesOrder.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } })

        // Submit to Approval Engine (starts at step 1: Sales Admin/Manager)
        await submitForApproval({
            docType: 'SALES_ORDER',
            docId: id,
            docValue: amount,
            requestedBy: so.salesRepId,
        })

        // Log audit
        await logAudit({
            userId: so.salesRepId,
            action: 'CONFIRM',
            entityType: 'SalesOrder',
            entityId: id,
            newValue: { status: 'PENDING_APPROVAL' }
        }).catch(() => { })

        // Trigger notifications asynchronously to Sales Admin and Manager (Chờ duyệt cấp 1)
        ;(async () => {
            try {
                const admins = await prisma.user.findMany({
                    where: {
                        roles: {
                            some: {
                                role: { name: { in: ['Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR'] } }
                            }
                        },
                        status: 'ACTIVE'
                    },
                    select: { email: true }
                })
                const emails = admins.map(u => u.email)
                if (emails.length > 0) {
                    await notifySOPendingAdmin({
                        soNo: so.soNo,
                        customerName: so.customer.name,
                        totalAmount: amount,
                        salesRepName: so.salesRep.name,
                        recipientEmails: emails
                    })
                }
            } catch (notifyErr) {
                console.error('[Notification Error]', notifyErr)
            }
        })()

        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true, needsApproval: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── CEO/Admin Approve PENDING_APPROVAL ─────
export async function approveSalesOrder(
    id: string, 
    vintages?: { lineId: string; vintage: number }[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { 
                status: true, 
                soNo: true, 
                salesRepId: true, 
                totalAmount: true,
                orderDiscount: true,
                customer: { select: { name: true } },
                salesRep: { select: { name: true } },
                lines: { select: { id: true, qtyOrdered: true, unitPrice: true, lineDiscountPct: true } }
            },
        })
        if (!so) return { success: false, error: 'SO not found' }
        if (so.status !== 'PENDING_APPROVAL') return { success: false, error: `SO không ở trạng thái Chờ Duyệt (hiện: ${so.status})` }

        const amount = Number(so.totalAmount)

        // Find the active approval request for this SO
        const approvalReq = await prisma.approvalRequest.findFirst({
            where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' },
            include: { template: { include: { steps: { orderBy: { stepOrder: 'asc' } } } } }
        })

        if (!approvalReq) {
            return { success: false, error: 'Không tìm thấy yêu cầu duyệt của đơn hàng này' }
        }

        const isCEO = hasRole(user, 'CEO')
        const isSaleAdminOrMgr = hasRole(user, 'Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR')

        if (!isCEO && !isSaleAdminOrMgr) {
            return { success: false, error: 'Bạn không có quyền duyệt đơn hàng này' }
        }

        // Save selected vintages to SalesOrderLine
        if (vintages && vintages.length > 0) {
            for (const item of vintages) {
                await prisma.salesOrderLine.update({
                    where: { id: item.lineId },
                    data: { vintage: item.vintage }
                })
            }
        }

        // Log approval step
        await prisma.approvalLog.create({
            data: {
                requestId: approvalReq.id,
                step: approvalReq.currentStep,
                action: 'APPROVE',
                approvedBy: user.id,
                comment: 'Sale Admin phê duyệt'
            }
        })

        // Mark approval request as APPROVED completely
        await prisma.approvalRequest.update({
            where: { id: approvalReq.id },
            data: { status: 'APPROVED' }
        })

        // Transition SO directly to PENDING_ACCOUNTING
        await prisma.salesOrder.update({
            where: { id },
            data: { status: 'PENDING_ACCOUNTING' }
        })

        await logAudit({
            userId: user.id,
            action: 'APPROVE',
            entityType: 'SalesOrder',
            entityId: id,
            newValue: { step: approvalReq.currentStep, status: 'PENDING_ACCOUNTING' }
        }).catch(() => { })

        // Notify Accountant
        ;(async () => {
            try {
                const accountants = await prisma.user.findMany({
                    where: {
                        roles: {
                            some: { role: { name: { in: ['Kế Toán', 'KE_TOAN'] } } }
                        },
                        status: 'ACTIVE'
                    },
                    select: { email: true }
                })
                const acctEmails = accountants.map(u => u.email)
                if (acctEmails.length > 0) {
                    await notifySOPendingAccounting({
                        soNo: so.soNo,
                        customerName: so.customer.name,
                        totalAmount: amount,
                        salesRepName: so.salesRep.name,
                        recipientEmails: acctEmails
                    })
                }
            } catch (notifyErr) {
                console.error('[Notification Error]', notifyErr)
            }
        })()

        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── CEO/Admin Reject PENDING_APPROVAL → CANCELLED ──────
export async function rejectSalesOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { status: true, soNo: true, totalAmount: true },
        })
        if (!so) return { success: false, error: 'SO not found' }
        if (so.status !== 'PENDING_APPROVAL') return { success: false, error: `SO không ở trạng thái Chờ Duyệt (hiện: ${so.status})` }

        const isCEO = hasRole(user, 'CEO')
        const isSaleAdminOrMgr = hasRole(user, 'Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR')

        if (!isCEO && !isSaleAdminOrMgr) {
            return { success: false, error: 'Bạn không có quyền từ chối đơn hàng này' }
        }

        // Find active approval request
        const approvalReq = await prisma.approvalRequest.findFirst({
            where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' }
        })

        if (approvalReq) {
            // Log rejection
            await prisma.approvalLog.create({
                data: {
                    requestId: approvalReq.id,
                    step: approvalReq.currentStep,
                    action: 'REJECT',
                    approvedBy: user.id,
                    comment: 'Từ chối phê duyệt đơn hàng'
                }
            })

            // Mark approval request as REJECTED
            await prisma.approvalRequest.update({
                where: { id: approvalReq.id },
                data: { status: 'REJECTED' }
            })
        }

        await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
        await logAudit({ userId: user.id, action: 'REJECT', entityType: 'SalesOrder', entityId: id, newValue: { status: 'CANCELLED', soNo: so.soNo, amount: Number(so.totalAmount) } }).catch(() => { })
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// LEGAL ENTITY — Pháp Nhân
// ═══════════════════════════════════════════════════

export type LegalEntityRow = {
    id: string
    code: string
    name: string
    taxId: string | null
    address: string | null
}

export async function getLegalEntities(): Promise<LegalEntityRow[]> {
    return cached('legal-entities', async () => {
        const entities = await prisma.legalEntity.findMany({
            orderBy: { name: 'asc' },
        })
        return entities.map(e => ({
            id: e.id,
            code: e.code,
            name: e.name,
            taxId: e.taxId,
            address: e.address,
        }))
    }, 120_000)
}

// ═══════════════════════════════════════════════════
// ACCOUNTING APPROVAL — Kế Toán Duyệt Đơn
// ═══════════════════════════════════════════════════

// ── Accounting Approve: PENDING_ACCOUNTING → CONFIRMED ──
// Kế toán có thể thay đổi pháp nhân trước khi duyệt
export async function accountingApproveSO(id: string, legalEntityId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { 
                status: true, 
                soNo: true, 
                totalAmount: true, 
                legalEntityId: true,
                salesRepId: true,
                customer: { select: { name: true } },
                salesRep: { select: { name: true, email: true } }
            },
        })
        if (!so) return { success: false, error: 'SO không tồn tại' }
        if (so.status !== 'PENDING_ACCOUNTING') return { success: false, error: `SO không ở trạng thái Chờ KT Duyệt (hiện: ${so.status})` }

        const updateData: any = { status: 'CONFIRMED' }
        if (legalEntityId && legalEntityId !== so.legalEntityId) {
            updateData.legalEntityId = legalEntityId
        }

        await prisma.salesOrder.update({ where: { id }, data: updateData })
        await logAudit({
            action: 'ACCOUNTING_APPROVE',
            entityType: 'SalesOrder',
            entityId: id,
            newValue: {
                status: 'CONFIRMED',
                soNo: so.soNo,
                amount: Number(so.totalAmount),
                legalEntityId: legalEntityId || so.legalEntityId,
                entityChanged: legalEntityId && legalEntityId !== so.legalEntityId,
            },
        }).catch(() => { })

        // Trigger notifications asynchronously to Warehouse (Thủ kho) and Sales Rep
        ;(async () => {
            try {
                // Find Thủ Kho
                const warehouseKeepers = await prisma.user.findMany({
                    where: {
                        roles: {
                            some: { role: { name: { in: ['Thủ Kho', 'THU_KHO'] } } }
                        },
                        status: 'ACTIVE'
                    },
                    select: { email: true }
                })
                const keeperEmails = warehouseKeepers.map(u => u.email)
                
                // Recipient list includes both warehouse keepers and the sales rep who created the order
                const recipientEmails = [...new Set([...keeperEmails, so.salesRep.email])]

                if (recipientEmails.length > 0) {
                    await notifySOConfirmed({
                        soNo: so.soNo,
                        customerName: so.customer.name,
                        totalAmount: Number(so.totalAmount),
                        salesRepName: so.salesRep.name,
                        recipientEmails: recipientEmails
                    })
                }
            } catch (notifyErr) {
                console.error('[Notification Error]', notifyErr)
            }
        })()

        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Accounting Reject: PENDING_ACCOUNTING → DRAFT (trả về cho sales sửa) ──
export async function accountingRejectSO(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { status: true, soNo: true, totalAmount: true },
        })
        if (!so) return { success: false, error: 'SO không tồn tại' }
        if (so.status !== 'PENDING_ACCOUNTING') return { success: false, error: `SO không ở trạng thái Chờ KT Duyệt (hiện: ${so.status})` }

        await prisma.salesOrder.update({ where: { id }, data: { status: 'DRAFT' } })
        await logAudit({
            action: 'ACCOUNTING_REJECT',
            entityType: 'SalesOrder',
            entityId: id,
            newValue: {
                status: 'DRAFT',
                soNo: so.soNo,
                reason: reason || 'KT từ chối — trả về DRAFT để sửa',
            },
        }).catch(() => { })

        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        revalidateCache('dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Internal: Advance SO status (called by event hooks, NOT by UI) ──
// Used by: confirmDeliveryOrder → PARTIALLY_DELIVERED/DELIVERED
//          createARInvoice → INVOICED
//          recordPayment → PAID
// DO NOT expose this to client components directly.
export async function advanceSalesOrderStatus(id: string, toStatus: SOStatus): Promise<{ success: boolean; error?: string }> {
    const allowed: Record<string, SOStatus[]> = {
        PENDING_ACCOUNTING: ['CONFIRMED'],
        CONFIRMED: ['PARTIALLY_DELIVERED', 'DELIVERED'],
        PARTIALLY_DELIVERED: ['DELIVERED'],
        DELIVERED: ['INVOICED'],
        INVOICED: ['PAID'],
    }
    try {
        const so = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true, soNo: true } })
        if (!so) return { success: false, error: 'Không tìm thấy SO' }
        if (!allowed[so.status]?.includes(toStatus)) {
            return { success: false, error: `Không thể chuyển từ ${so.status} → ${toStatus}` }
        }
        await prisma.salesOrder.update({ where: { id }, data: { status: toStatus } })

        try {
            await logAudit({
                action: 'STATUS_CHANGE',
                entityType: 'SalesOrder',
                entityId: id,
                description: `SO ${so.soNo}: ${so.status} → ${toStatus} (auto)`,
                newValue: { from: so.status, to: toStatus, trigger: 'event_driven' },
            })
        } catch { /* silent */ }

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
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { salesRepId: true },
        })
        if (!so) return { success: false, error: 'SO không tồn tại' }

        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (so.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền huỷ đơn hàng của Sales khác.' }
            }
        }

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
    const user = await getCurrentUser()
    const isSalesRep = user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')
    const cacheKey = isSalesRep ? `sales:stats:${user.id}` : 'sales:stats:all'

    return cached(cacheKey, async () => {
        const where: any = {
            status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        }
        const groupWhere: any = {}

        if (isSalesRep) {
            where.salesRepId = user.id
            groupWhere.salesRepId = user.id
        }

        const [totals, byStatus] = await Promise.all([
            prisma.salesOrder.aggregate({
                where,
                _sum: { totalAmount: true },
                _count: true,
            }),
            prisma.salesOrder.groupBy({
                by: ['status'],
                where: groupWhere,
                _count: true
            }),
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
    priceSource?: string | null
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
    const user = await requireAuth()
    if (!hasRole(user, 'CEO', 'Kế Toán', 'KE_TOAN', 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN')) {
        return null
    }

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
            priceSource: l.priceSource ?? null,
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

// ═══════════════════════════════════════════════════
// FIFO PICK LIST SUGGESTION — SO → DO Auto-suggest
// ═══════════════════════════════════════════════════

export type PickSuggestionLine = {
    productId: string
    productName: string
    skuCode: string
    qtyOrdered: number
    picks: { lotId: string; lotNo: string; locationCode: string; qty: number; receivedDate: string }[]
    isFullyAllocated: boolean
    shortfall: number
}

export type PickListSuggestion = {
    soId: string
    soNo: string
    customerName: string
    lines: PickSuggestionLine[]
    allFullyAllocated: boolean
    totalShortfall: number
}

export async function suggestPickListForSO(soId: string): Promise<{ success: boolean; suggestion?: PickListSuggestion; error?: string }> {
    try {
        const so = await prisma.salesOrder.findUnique({
            where: { id: soId },
            include: {
                customer: { select: { name: true } },
                lines: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
        })
        if (!so) return { success: false, error: 'SO not found' }
        if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
            return { success: false, error: `SO trạng thái ${so.status} — chỉ hỗ trợ CONFIRMED / PARTIALLY_DELIVERED` }
        }

        const lines: PickSuggestionLine[] = []
        let totalShortfall = 0

        for (const soLine of so.lines) {
            const qtyNeeded = Number(soLine.qtyOrdered)

            // FIFO: oldest receivedDate first
            const lots = await prisma.stockLot.findMany({
                where: {
                    productId: soLine.productId,
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                },
                include: { location: { select: { locationCode: true } } },
                orderBy: { receivedDate: 'asc' },
            })

            let remaining = qtyNeeded
            const picks: PickSuggestionLine['picks'] = []

            for (const lot of lots) {
                if (remaining <= 0) break
                const available = Number(lot.qtyAvailable)
                const pick = Math.min(available, remaining)
                picks.push({
                    lotId: lot.id,
                    lotNo: lot.lotNo,
                    locationCode: lot.location.locationCode,
                    qty: pick,
                    receivedDate: lot.receivedDate.toISOString().slice(0, 10),
                })
                remaining -= pick
            }

            const shortfall = Math.max(0, remaining)
            totalShortfall += shortfall

            lines.push({
                productId: soLine.productId,
                productName: soLine.product.productName,
                skuCode: soLine.product.skuCode,
                qtyOrdered: qtyNeeded,
                picks,
                isFullyAllocated: shortfall === 0,
                shortfall,
            })
        }

        return {
            success: true,
            suggestion: {
                soId,
                soNo: so.soNo,
                customerName: so.customer.name,
                lines,
                allFullyAllocated: totalShortfall === 0,
                totalShortfall,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// ENHANCED SO FEATURES — Timeline, Clone, Export
// ═══════════════════════════════════════════════════

// ── SO Timeline (audit trail) ─────────────────────
export type SOTimelineEvent = {
    id: string
    action: string
    description: string | null
    userName: string | null
    createdAt: Date
}

export async function getSOTimeline(soId: string): Promise<SOTimelineEvent[]> {
    const so = await prisma.salesOrder.findUnique({ where: { id: soId }, select: { soNo: true } })
    if (!so) return []

    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { entityType: 'SalesOrder', entityId: soId },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, action: true, userName: true, createdAt: true, newValue: true },
    })

    return logs.map(l => {
        const nv = l.newValue as Record<string, any> | null
        const desc = nv?.description ?? nv?.trigger ?? `${l.action} ${so.soNo}`
        return {
            id: l.id,
            action: l.action,
            description: typeof desc === 'string' ? desc : JSON.stringify(desc),
            userName: l.userName,
            createdAt: l.createdAt,
        }
    })
}

// ── Clone SO (create DRAFT copy) ──────────────────
export async function cloneSalesOrder(sourceId: string): Promise<{ success: boolean; soId?: string; soNo?: string; error?: string }> {
    try {
        const user = await requireAuth()
        const source = await prisma.salesOrder.findUnique({
            where: { id: sourceId },
            include: { lines: true },
        })
        if (!source) return { success: false, error: 'SO không tồn tại' }

        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (source.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền sao chép đơn hàng của Sales khác.' }
            }
        }

        // Generate unique SO number
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const prefix = `SO-${yy}${mm}-`
        const last = await prisma.salesOrder.findFirst({
            where: { soNo: { startsWith: prefix } },
            orderBy: { soNo: 'desc' },
            select: { soNo: true },
        })
        const seq = last ? parseInt(last.soNo.slice(-4)) + 1 : 1
        const soNo = `${prefix}${String(seq).padStart(4, '0')}`

        const newSO = await prisma.salesOrder.create({
            data: {
                soNo,
                customerId: source.customerId,
                salesRepId: source.salesRepId,
                channel: source.channel,
                paymentTerm: source.paymentTerm,
                shippingAddressId: source.shippingAddressId,
                orderDiscount: source.orderDiscount,
                totalAmount: source.totalAmount,
                status: 'DRAFT',
                legalEntityId: source.legalEntityId,
                lines: {
                    create: source.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                        lineDiscountPct: l.lineDiscountPct,
                    })),
                },
            },
        })

        logAudit({
            action: 'CREATE',
            entityType: 'SalesOrder',
            entityId: newSO.id,
            description: `Clone ${source.soNo} → ${soNo}`,
        })

        revalidatePath('/dashboard/sales')
        revalidateCache('sales')
        return { success: true, soId: newSO.id, soNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Export SO list (CSV data) ─────────────────────
export async function exportSalesOrdersCSV(filters: {
    status?: SOStatus
    dateFrom?: string
    dateTo?: string
} = {}): Promise<{ csv: string }> {
    const user = await requireAuth()
    const { status, dateFrom, dateTo } = filters
    const where: any = {}

    if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
        where.salesRepId = user.id
    }
    if (status) where.status = status
    if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const orders = await prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: {
            customer: { select: { name: true, code: true } },
            salesRep: { select: { name: true } },
            _count: { select: { lines: true } },
        },
    })

    const header = 'Số SO,Khách Hàng,Mã KH,Kênh,Doanh Số,CK %,Thanh Toán,Sales Rep,Trạng Thái,Sp,Ngày Tạo'
    const rows = orders.map(o => {
        const cols = [
            o.soNo,
            `"${o.customer.name}"`,
            o.customer.code,
            o.channel,
            Number(o.totalAmount),
            Number(o.orderDiscount),
            o.paymentTerm,
            `"${o.salesRep.name}"`,
            o.status,
            o._count.lines,
            o.createdAt.toISOString().split('T')[0],
        ]
        return cols.join(',')
    })

    return { csv: [header, ...rows].join('\n') }
}

// ── Status counts for quick filter tabs ───────────
export async function getSOStatusCounts(): Promise<Record<string, number>> {
    const user = await getCurrentUser()
    const isSalesRep = user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')
    const cacheKey = isSalesRep ? `sales:status-counts:${user.id}` : 'sales:status-counts:all'

    return cached(cacheKey, async () => {
        const where: any = {}
        if (isSalesRep) where.salesRepId = user.id

        const counts = await prisma.salesOrder.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
        })
        const result: Record<string, number> = { ALL: 0 }
        for (const c of counts) {
            result[c.status] = c._count._all
            result.ALL += c._count._all
        }
        return result
    }, 30_000)
}

// ── Combined page data fetching for dashboard and tabs ──
export async function getSalesPageData(filters: {
    status?: SOStatus
    search?: string
    page?: number
    pageSize?: number
    sortBy?: 'createdAt' | 'totalAmount' | 'soNo'
    sortDir?: 'asc' | 'desc'
    dateFrom?: string
    dateTo?: string
} = {}) {
    const [ordersResult, stats, statusCounts] = await Promise.all([
        getSalesOrders(filters),
        getSalesStats(),
        getSOStatusCounts(),
    ])
    return {
        rows: ordersResult.rows,
        total: ordersResult.total,
        stats,
        statusCounts,
    }
}

// ── Delete Sales Order (DRAFT only) ──────────────
export async function deleteSalesOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id },
            select: { status: true, salesRepId: true, soNo: true }
        })
        if (!so) return { success: false, error: 'Đơn hàng không tồn tại' }
        if (so.status !== 'DRAFT') {
            return { success: false, error: 'Chỉ có thể xóa đơn hàng ở trạng thái Nháp (DRAFT)' }
        }

        if (hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (so.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền xóa đơn hàng của Sales khác.' }
            }
        }

        // Release allocation quotas linked to this SO if any
        const soLines = await prisma.salesOrderLine.findMany({
            where: { soId: id },
            include: { allocationLogs: { where: { action: 'USE' } } },
        })

        for (const line of soLines) {
            for (const log of line.allocationLogs) {
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

        // Perform cascading delete in database transaction
        await prisma.$transaction([
            prisma.salesOrderLine.deleteMany({ where: { soId: id } }),
            prisma.salesOrder.delete({ where: { id } })
        ])

        try {
            await logAudit({ userId: user.id, action: 'DELETE', entityType: 'SalesOrder', entityId: id, newValue: { soNo: so.soNo } })
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

