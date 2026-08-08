'use server'

import { prisma } from '@/lib/db'
import { cached } from '@/lib/cache'
import { SampleOriginType, SampleTxType, SampleReason } from '@prisma/client'

// ═══════════════════════════════════════════════════
// SAMPLE WINE INVENTORY — Server Actions
// ═══════════════════════════════════════════════════

export interface SampleProductItem {
    id: string
    sampleCode: string
    productId: string | null
    skuCode?: string
    productName: string
    wineType: string | null
    vintage: number | null
    country: string | null
    producer: string | null
    volumeMl: number | null
    originType: SampleOriginType
    estimatedValue: number
    qtyOnHand: number
    unit: string
    notes: string | null
    createdAt: Date
    updatedAt: Date
    transactionCount?: number
}

export interface SampleInventoryStats {
    totalProducts: number
    totalFormalQty: number
    totalInformalQty: number
    totalEstimatedValue: number
    monthlyOutboundQty: number
}

export interface SampleTransactionItem {
    id: string
    docNo: string
    type: SampleTxType
    reason: SampleReason
    sampleProductId: string
    sampleProductCode: string
    sampleProductName: string
    originType: SampleOriginType
    qty: number
    unitCost: number
    recipient: string | null
    requestedBy: string | null
    performedAt: Date
    notes: string | null
}

// ── 1. Fetch Sample Products ──────────────────────────
export async function getSampleProducts(filters?: {
    search?: string
    originType?: string
    hasSku?: boolean
    hideZeroStock?: boolean
}): Promise<SampleProductItem[]> {
    const where: any = {}

    if (filters?.search) {
        where.OR = [
            { sampleCode: { contains: filters.search, mode: 'insensitive' } },
            { productName: { contains: filters.search, mode: 'insensitive' } },
            { producer: { contains: filters.search, mode: 'insensitive' } },
            { product: { skuCode: { contains: filters.search, mode: 'insensitive' } } },
        ]
    }

    if (filters?.originType && filters.originType !== 'ALL') {
        where.originType = filters.originType as SampleOriginType
    }

    if (filters?.hasSku !== undefined) {
        if (filters.hasSku) {
            where.productId = { not: null }
        } else {
            where.productId = null
        }
    }

    if (filters?.hideZeroStock) {
        where.qtyOnHand = { gt: 0 }
    }

    const items = await prisma.sampleProduct.findMany({
        where,
        include: {
            product: { select: { skuCode: true } },
            _count: { select: { transactions: true } },
        },
        orderBy: { updatedAt: 'desc' },
    })

    return items.map(p => ({
        id: p.id,
        sampleCode: p.sampleCode,
        productId: p.productId,
        skuCode: p.product?.skuCode,
        productName: p.productName,
        wineType: p.wineType,
        vintage: p.vintage,
        country: p.country,
        producer: p.producer,
        volumeMl: p.volumeMl,
        originType: p.originType,
        estimatedValue: Number(p.estimatedValue),
        qtyOnHand: Number(p.qtyOnHand),
        unit: p.unit,
        notes: p.notes,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        transactionCount: p._count.transactions,
    }))
}

// ── 2. Get Sample Inventory KPI Stats ────────────────
export async function getSampleInventoryStats(): Promise<SampleInventoryStats> {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [products, monthlyOutbound] = await Promise.all([
        prisma.sampleProduct.findMany({
            select: {
                originType: true,
                qtyOnHand: true,
                estimatedValue: true,
            },
        }),
        prisma.sampleTransaction.aggregate({
            where: {
                type: 'OUTBOUND',
                performedAt: { gte: firstDayOfMonth },
            },
            _sum: { qty: true },
        }),
    ])

    let totalFormalQty = 0
    let totalInformalQty = 0
    let totalEstimatedValue = 0

    for (const p of products) {
        const qty = Number(p.qtyOnHand)
        const val = Number(p.estimatedValue)
        if (p.originType === 'FORMAL') {
            totalFormalQty += qty
        } else {
            totalInformalQty += qty
        }
        totalEstimatedValue += qty * val
    }

    return {
        totalProducts: products.length,
        totalFormalQty,
        totalInformalQty,
        totalEstimatedValue,
        monthlyOutboundQty: Number(monthlyOutbound._sum.qty ?? 0),
    }
}

// ── 3. Create Sample Product ────────────────────────
export async function createSampleProduct(data: {
    productId?: string
    skuCode?: string
    productName: string
    wineType?: string
    vintage?: number
    country?: string
    producer?: string
    volumeMl?: number
    originType: 'FORMAL' | 'INFORMAL'
    estimatedValue?: number
    initialQty?: number
    notes?: string
}) {
    const year = new Date().getFullYear()
    const count = await prisma.sampleProduct.count()
    const sampleCode = `SMP-${year}-${String(count + 1).padStart(4, '0')}`

    const initialQty = Number(data.initialQty ?? 0)

    const sampleProd = await prisma.sampleProduct.create({
        data: {
            sampleCode,
            productId: data.productId || null,
            productName: data.productName,
            wineType: data.wineType || null,
            vintage: data.vintage || null,
            country: data.country || null,
            producer: data.producer || null,
            volumeMl: data.volumeMl || 750,
            originType: data.originType as SampleOriginType,
            estimatedValue: data.estimatedValue || 0,
            qtyOnHand: initialQty,
            notes: data.notes || null,
        },
    })

    // If initial Qty > 0, record Initial Inbound Transaction
    if (initialQty > 0) {
        const txCount = await prisma.sampleTransaction.count()
        const docNo = `SMR-${year}-${String(txCount + 1).padStart(4, '0')}`

        await prisma.sampleTransaction.create({
            data: {
                docNo,
                type: 'INBOUND',
                reason: data.originType === 'FORMAL' ? 'FORMAL_IMPORT' : 'SUPPLIER_SAMPLE',
                sampleProductId: sampleProd.id,
                qty: initialQty,
                unitCost: data.estimatedValue || 0,
                notes: 'Nhập kho ban đầu khi khởi tạo mã mẫu',
            },
        })
    }

    return sampleProd
}

// ── 4. Create Sample Transaction (Inbound / Outbound) 
export async function createSampleTransaction(data: {
    sampleProductId: string
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT'
    reason: SampleReason
    qty: number
    unitCost?: number
    recipient?: string
    requestedBy?: string
    notes?: string
}) {
    const { sampleProductId, type, reason, qty, unitCost = 0, recipient, requestedBy, notes } = data

    if (qty <= 0) throw new Error('Số lượng giao dịch phải lớn hơn 0')

    const sampleProd = await prisma.sampleProduct.findUnique({
        where: { id: sampleProductId },
    })

    if (!sampleProd) throw new Error('Không tìm thấy thông tin hàng mẫu')

    const currentQty = Number(sampleProd.qtyOnHand)

    if (type === 'OUTBOUND' && qty > currentQty) {
        throw new Error(`Số lượng xuất (${qty}) vượt quá tồn kho hàng mẫu hiện tại (${currentQty})`)
    }

    // Auto-generate docNo
    const year = new Date().getFullYear()
    const txCount = await prisma.sampleTransaction.count()
    const prefix = type === 'INBOUND' ? 'SMR' : type === 'OUTBOUND' ? 'SMO' : 'SMA'
    const docNo = `${prefix}-${year}-${String(txCount + 1).padStart(4, '0')}`

    // Calculate new qtyOnHand
    let newQty = currentQty
    if (type === 'INBOUND') {
        newQty = currentQty + qty
    } else if (type === 'OUTBOUND') {
        newQty = currentQty - qty
    } else if (type === 'ADJUSTMENT') {
        newQty = qty // Set direct qty for adjustment
    }

    // Database Transaction
    const [transaction] = await prisma.$transaction([
        prisma.sampleTransaction.create({
            data: {
                docNo,
                type: type as SampleTxType,
                reason,
                sampleProductId,
                qty,
                unitCost,
                recipient: recipient || null,
                requestedBy: requestedBy || null,
                notes: notes || null,
            },
        }),
        prisma.sampleProduct.update({
            where: { id: sampleProductId },
            data: { qtyOnHand: newQty },
        }),
    ])

    return transaction
}

// ── 5. Fetch Sample Transactions History ──────────────
export async function getSampleTransactions(filters?: {
    sampleProductId?: string
    type?: string
    reason?: string
    search?: string
}): Promise<SampleTransactionItem[]> {
    const where: any = {}

    if (filters?.sampleProductId) {
        where.sampleProductId = filters.sampleProductId
    }

    if (filters?.type && filters.type !== 'ALL') {
        where.type = filters.type as SampleTxType
    }

    if (filters?.reason && filters.reason !== 'ALL') {
        where.reason = filters.reason as SampleReason
    }

    if (filters?.search) {
        where.OR = [
            { docNo: { contains: filters.search, mode: 'insensitive' } },
            { recipient: { contains: filters.search, mode: 'insensitive' } },
            { requestedBy: { contains: filters.search, mode: 'insensitive' } },
            { sampleProduct: { productName: { contains: filters.search, mode: 'insensitive' } } },
            { sampleProduct: { sampleCode: { contains: filters.search, mode: 'insensitive' } } },
        ]
    }

    const txs = await prisma.sampleTransaction.findMany({
        where,
        include: {
            sampleProduct: {
                select: {
                    sampleCode: true,
                    productName: true,
                    originType: true,
                },
            },
        },
        orderBy: { performedAt: 'desc' },
        take: 100,
    })

    return txs.map(t => ({
        id: t.id,
        docNo: t.docNo,
        type: t.type,
        reason: t.reason,
        sampleProductId: t.sampleProductId,
        sampleProductCode: t.sampleProduct.sampleCode,
        sampleProductName: t.sampleProduct.productName,
        originType: t.sampleProduct.originType,
        qty: Number(t.qty),
        unitCost: Number(t.unitCost),
        recipient: t.recipient,
        requestedBy: t.requestedBy,
        performedAt: t.performedAt,
        notes: t.notes,
    }))
}
