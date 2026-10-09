'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { PosmCategory, PosmTxType, PosmReason } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// POSM & MARKETING COLLATERAL INVENTORY — Server Actions
// Master Data Vật Phẩm Tiếp Thị & Quản Lý Kho POSM Độc Lập
// ═══════════════════════════════════════════════════════════════

export interface PosmProductItem {
    id: string
    posmCode: string
    name: string
    category: PosmCategory
    unit: string
    brand: string | null
    imageUrl: string | null
    costPrice: number
    qtyOnHand: number
    minStockAlert: number
    location: string | null
    status: string
    notes: string | null
    createdAt: Date
    updatedAt: Date
    transactionCount?: number
    isLowStock?: boolean
}

export interface PosmStats {
    totalItems: number
    totalOnHandQty: number
    totalInventoryValue: number
    lowStockAlertCount: number
    monthlyOutboundQty: number
}

export interface PosmTransactionItem {
    id: string
    docNo: string
    type: PosmTxType
    reason: PosmReason
    posmProductId: string
    posmProductCode: string
    posmProductName: string
    category: PosmCategory
    unit: string
    qty: number
    unitCost: number
    totalCost: number
    recipient: string | null
    requestedBy: string | null
    performedAt: Date
    notes: string | null
}

// ── 1. Fetch POSM Master Data / Products ──────────────────────
export async function getPosmProducts(filters?: {
    search?: string
    category?: string
    lowStockOnly?: boolean
    status?: string
}): Promise<PosmProductItem[]> {
    const where: any = {}

    if (filters?.search) {
        where.OR = [
            { posmCode: { contains: filters.search, mode: 'insensitive' } },
            { name: { contains: filters.search, mode: 'insensitive' } },
            { brand: { contains: filters.search, mode: 'insensitive' } },
            { location: { contains: filters.search, mode: 'insensitive' } },
        ]
    }

    if (filters?.category && filters.category !== 'ALL') {
        where.category = filters.category as PosmCategory
    }

    if (filters?.status && filters.status !== 'ALL') {
        where.status = filters.status
    }

    const items = await prisma.posmProduct.findMany({
        where,
        include: {
            _count: { select: { transactions: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { posmCode: 'asc' }],
    })

    const results: PosmProductItem[] = items.map(p => {
        const qtyOnHand = Number(p.qtyOnHand)
        const minStockAlert = Number(p.minStockAlert)
        const isLowStock = minStockAlert > 0 && qtyOnHand <= minStockAlert

        return {
            id: p.id,
            posmCode: p.posmCode,
            name: p.name,
            category: p.category,
            unit: p.unit,
            brand: p.brand,
            imageUrl: p.imageUrl,
            costPrice: Number(p.costPrice),
            qtyOnHand,
            minStockAlert,
            location: p.location,
            status: p.status,
            notes: p.notes,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            transactionCount: p._count.transactions,
            isLowStock,
        }
    })

    if (filters?.lowStockOnly) {
        return results.filter(r => r.isLowStock)
    }

    return results
}

// ── 2. Get POSM Dashboard Stats ───────────────────────────────
export async function getPosmStats(): Promise<PosmStats> {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [products, monthlyOutbound] = await Promise.all([
        prisma.posmProduct.findMany({
            select: {
                qtyOnHand: true,
                costPrice: true,
                minStockAlert: true,
            },
        }),
        prisma.posmTransaction.aggregate({
            where: {
                type: 'OUTBOUND',
                performedAt: { gte: firstDayOfMonth },
            },
            _sum: { qty: true },
        }),
    ])

    let totalOnHandQty = 0
    let totalInventoryValue = 0
    let lowStockAlertCount = 0

    for (const p of products) {
        const qty = Number(p.qtyOnHand)
        const cost = Number(p.costPrice)
        const minAlert = Number(p.minStockAlert)

        totalOnHandQty += qty
        totalInventoryValue += qty * cost
        if (minAlert > 0 && qty <= minAlert) {
            lowStockAlertCount += 1
        }
    }

    return {
        totalItems: products.length,
        totalOnHandQty,
        totalInventoryValue,
        lowStockAlertCount,
        monthlyOutboundQty: Number(monthlyOutbound._sum.qty ?? 0),
    }
}

// ── 3. Create POSM Master Data Item ───────────────────────────
export async function createPosmProduct(data: {
    name: string
    category: PosmCategory
    unit: string
    brand?: string
    imageUrl?: string
    costPrice?: number
    minStockAlert?: number
    location?: string
    initialQty?: number
    notes?: string
}) {
    await requireAuth()
    const year = new Date().getFullYear()
    const prefix = `POSM-${year}-`

    const lastItem = await prisma.posmProduct.findFirst({
        where: { posmCode: { startsWith: prefix } },
        orderBy: { posmCode: 'desc' },
        select: { posmCode: true },
    })

    const nextSeq = lastItem ? parseInt(lastItem.posmCode.slice(-4), 10) + 1 : 1
    const posmCode = `${prefix}${String(nextSeq).padStart(4, '0')}`

    const initialQty = Number(data.initialQty ?? 0)
    const costPrice = Number(data.costPrice ?? 0)

    const item = await prisma.posmProduct.create({
        data: {
            posmCode,
            name: data.name.trim(),
            category: data.category,
            unit: data.unit.trim() || 'Cái',
            brand: data.brand?.trim() || null,
            imageUrl: data.imageUrl?.trim() || null,
            costPrice,
            qtyOnHand: initialQty,
            minStockAlert: Number(data.minStockAlert ?? 0),
            location: data.location?.trim() || null,
            notes: data.notes?.trim() || null,
        },
    })

    // If initialQty > 0, generate initial inbound receipt
    if (initialQty > 0) {
        const pirPrefix = `PIR-${year}-`
        const lastTx = await prisma.posmTransaction.findFirst({
            where: { docNo: { startsWith: pirPrefix } },
            orderBy: { docNo: 'desc' },
            select: { docNo: true },
        })
        const nextTxSeq = lastTx ? parseInt(lastTx.docNo.slice(-4), 10) + 1 : 1
        const docNo = `${pirPrefix}${String(nextTxSeq).padStart(4, '0')}`

        await prisma.posmTransaction.create({
            data: {
                docNo,
                type: 'INBOUND',
                reason: 'PURCHASE_INBOUND',
                posmProductId: item.id,
                qty: initialQty,
                unitCost: costPrice,
                totalCost: initialQty * costPrice,
                notes: 'Nhập kho ban đầu khi khởi tạo Master Data POSM',
            },
        })
    }

    return item
}

// ── 4. Update POSM Master Data Item ───────────────────────────
export async function updatePosmProduct(id: string, data: {
    name?: string
    category?: PosmCategory
    unit?: string
    brand?: string
    imageUrl?: string
    costPrice?: number
    minStockAlert?: number
    location?: string
    status?: string
    notes?: string
}) {
    await requireAuth()

    return prisma.posmProduct.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            category: data.category,
            unit: data.unit?.trim(),
            brand: data.brand?.trim() ?? null,
            imageUrl: data.imageUrl?.trim() ?? null,
            costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
            minStockAlert: data.minStockAlert !== undefined ? Number(data.minStockAlert) : undefined,
            location: data.location?.trim() ?? null,
            status: data.status,
            notes: data.notes?.trim() ?? null,
        },
    })
}

// ── 5. Delete POSM Item (Only allowed if no transactions) ──────
export async function deletePosmProduct(id: string) {
    await requireAuth()

    const txCount = await prisma.posmTransaction.count({ where: { posmProductId: id } })
    if (txCount > 0) {
        throw new Error(`Không thể xóa vật phẩm POSM này vì đã có ${txCount} giao dịch nhập/xuất kho. Vui lòng chuyển trạng thái sang DISCONTINUED.`)
    }

    return prisma.posmProduct.delete({ where: { id } })
}

// ── 6. Create POSM Transaction (Inbound / Outbound / Adjust) ──
export async function createPosmTransaction(data: {
    posmProductId: string
    type: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT'
    reason: PosmReason
    qty: number
    unitCost?: number
    recipient?: string
    requestedBy?: string
    notes?: string
    allowDeficit?: boolean // Chấp nhận xuất kho khi thiếu tồn (theo Socratic Gate)
}) {
    await requireAuth()
    const { posmProductId, type, reason, qty, unitCost = 0, recipient, requestedBy, notes, allowDeficit = true } = data

    if (qty <= 0) throw new Error('Số lượng giao dịch phải lớn hơn 0')

    const year = new Date().getFullYear()
    const prefix = type === 'INBOUND' ? `PIR-${year}-` : type === 'OUTBOUND' ? `PIO-${year}-` : `PAD-${year}-`

    return prisma.$transaction(async (tx) => {
        const item = await tx.posmProduct.findUnique({
            where: { id: posmProductId },
        })

        if (!item) throw new Error('Không tìm thấy vật phẩm POSM')

        const currentQty = Number(item.qtyOnHand)
        const cost = unitCost > 0 ? unitCost : Number(item.costPrice)

        if (type === 'OUTBOUND' && qty > currentQty && !allowDeficit) {
            throw new Error(`Số lượng xuất (${qty}) vượt quá tồn kho hiện tại (${currentQty} ${item.unit})`)
        }

        // Auto-generate docNo
        const lastTx = await tx.posmTransaction.findFirst({
            where: { docNo: { startsWith: prefix } },
            orderBy: { docNo: 'desc' },
            select: { docNo: true },
        })
        const nextSeq = lastTx ? parseInt(lastTx.docNo.slice(-4), 10) + 1 : 1
        const docNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

        // Calculate new qtyOnHand
        let newQty = currentQty
        if (type === 'INBOUND') {
            newQty = currentQty + qty
        } else if (type === 'OUTBOUND') {
            newQty = currentQty - qty
        } else if (type === 'ADJUSTMENT') {
            newQty = qty
        }

        const totalCost = qty * cost

        const transaction = await tx.posmTransaction.create({
            data: {
                docNo,
                type: type as PosmTxType,
                reason,
                posmProductId,
                qty,
                unitCost: cost,
                totalCost,
                recipient: recipient?.trim() || null,
                requestedBy: requestedBy?.trim() || null,
                notes: notes?.trim() || null,
            },
        })

        await tx.posmProduct.update({
            where: { id: posmProductId },
            data: { qtyOnHand: newQty },
        })

        return transaction
    })
}

// ── 7. Fetch POSM Transactions History ────────────────────────
export async function getPosmTransactions(filters?: {
    posmProductId?: string
    type?: string
    reason?: string
    search?: string
    limit?: number
}): Promise<PosmTransactionItem[]> {
    const where: any = {}

    if (filters?.posmProductId) {
        where.posmProductId = filters.posmProductId
    }

    if (filters?.type && filters.type !== 'ALL') {
        where.type = filters.type as PosmTxType
    }

    if (filters?.reason && filters.reason !== 'ALL') {
        where.reason = filters.reason as PosmReason
    }

    if (filters?.search) {
        where.OR = [
            { docNo: { contains: filters.search, mode: 'insensitive' } },
            { recipient: { contains: filters.search, mode: 'insensitive' } },
            { requestedBy: { contains: filters.search, mode: 'insensitive' } },
            { notes: { contains: filters.search, mode: 'insensitive' } },
            { posmProduct: { name: { contains: filters.search, mode: 'insensitive' } } },
            { posmProduct: { posmCode: { contains: filters.search, mode: 'insensitive' } } },
        ]
    }

    const items = await prisma.posmTransaction.findMany({
        where,
        include: {
            posmProduct: {
                select: {
                    posmCode: true,
                    name: true,
                    category: true,
                    unit: true,
                },
            },
        },
        orderBy: { performedAt: 'desc' },
        take: filters?.limit ?? 100,
    })

    return items.map(tx => ({
        id: tx.id,
        docNo: tx.docNo,
        type: tx.type,
        reason: tx.reason,
        posmProductId: tx.posmProductId,
        posmProductCode: tx.posmProduct.posmCode,
        posmProductName: tx.posmProduct.name,
        category: tx.posmProduct.category,
        unit: tx.posmProduct.unit,
        qty: Number(tx.qty),
        unitCost: Number(tx.unitCost),
        totalCost: Number(tx.totalCost),
        recipient: tx.recipient,
        requestedBy: tx.requestedBy,
        performedAt: tx.performedAt,
        notes: tx.notes,
    }))
}
