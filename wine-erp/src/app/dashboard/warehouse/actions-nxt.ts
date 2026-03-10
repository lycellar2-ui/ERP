'use server'

import { prisma } from '@/lib/db'
import { cached } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// NHẬP - XUẤT - TỒN — Stock Movement Report
// ═══════════════════════════════════════════════════

export interface StockMovementRow {
    id: string
    date: Date
    docType: 'GR' | 'DO' | 'ADJ' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WRITE_OFF'
    docNo: string
    docId: string
    warehouseId: string
    warehouseName: string
    locationCode: string
    lotNo: string
    qtyIn: number
    qtyOut: number
    balance: number // running balance — calculated client-side or in-query
    unitCost: number
    reference: string // PO/SO number or reason
    note: string
}

export interface NXTSummary {
    openingBalance: number
    totalIn: number
    totalOut: number
    closingBalance: number
    totalValue: number
    movementCount: number
}

export interface ProductOption {
    id: string
    skuCode: string
    productName: string
    wineType: string
    country: string
    vintage: number | null
}

// ── Get products for search/select ────────────────
export async function getProductSearchOptions(search?: string): Promise<ProductOption[]> {
    return cached(`nxt-product-search:${search ?? ''}`, async () => {
        const where: any = {}
        if (search) {
            where.OR = [
                { skuCode: { contains: search, mode: 'insensitive' } },
                { productName: { contains: search, mode: 'insensitive' } },
            ]
        }
        const products = await prisma.product.findMany({
            where,
            select: {
                id: true, skuCode: true, productName: true,
                wineType: true, country: true, vintage: true,
            },
            take: 30,
            orderBy: { skuCode: 'asc' },
        })
        return products.map(p => ({
            id: p.id,
            skuCode: p.skuCode,
            productName: p.productName,
            wineType: p.wineType,
            country: p.country,
            vintage: p.vintage,
        }))
    }, 30_000)
}

// ── Stock Movement Report — per product ───────────
export async function getStockMovements(filters: {
    productId: string
    warehouseId?: string
    dateFrom?: string
    dateTo?: string
    movementType?: 'ALL' | 'IN' | 'OUT'
}): Promise<{ movements: StockMovementRow[]; summary: NXTSummary }> {
    const { productId, warehouseId, dateFrom, dateTo, movementType = 'ALL' } = filters

    if (!productId) {
        return {
            movements: [],
            summary: { openingBalance: 0, totalIn: 0, totalOut: 0, closingBalance: 0, totalValue: 0, movementCount: 0 },
        }
    }

    const movements: StockMovementRow[] = []

    // ── 1. GR Lines (NHẬP) — GoodsReceiptLine ────────
    if (movementType === 'ALL' || movementType === 'IN') {
        const grWhere: any = {
            productId,
            gr: { status: 'CONFIRMED' },
        }
        if (warehouseId) grWhere.gr = { ...grWhere.gr, warehouseId }
        if (dateFrom || dateTo) {
            grWhere.gr.confirmedAt = {}
            if (dateFrom) grWhere.gr.confirmedAt.gte = new Date(dateFrom)
            if (dateTo) grWhere.gr.confirmedAt.lte = new Date(dateTo + 'T23:59:59')
        }

        const grLines = await prisma.goodsReceiptLine.findMany({
            where: grWhere,
            include: {
                gr: {
                    include: {
                        warehouse: { select: { id: true, name: true } },
                        po: { select: { poNo: true } },
                    },
                },
                lot: { select: { lotNo: true, unitLandedCost: true, location: { select: { locationCode: true } } } },
            },
            orderBy: { gr: { confirmedAt: 'asc' } },
        })

        for (const line of grLines) {
            movements.push({
                id: `gr-${line.id}`,
                date: line.gr.confirmedAt ?? line.gr.createdAt,
                docType: 'GR',
                docNo: line.gr.grNo,
                docId: line.gr.id,
                warehouseId: line.gr.warehouse.id,
                warehouseName: line.gr.warehouse.name,
                locationCode: line.lot?.location?.locationCode ?? '—',
                lotNo: line.lot?.lotNo ?? '—',
                qtyIn: Number(line.qtyReceived),
                qtyOut: 0,
                balance: 0,
                unitCost: Number(line.lot?.unitLandedCost ?? 0),
                reference: `PO: ${line.gr.po.poNo}`,
                note: `Variance: ${Number(line.variance)}`,
            })
        }
    }

    // ── 2. DO Lines (XUẤT) — DeliveryOrderLine ───────
    if (movementType === 'ALL' || movementType === 'OUT') {
        const doWhere: any = {
            productId,
            do: { status: { in: ['SHIPPED', 'DELIVERED'] } },
        }
        if (warehouseId) doWhere.do = { ...doWhere.do, warehouseId }
        if (dateFrom || dateTo) {
            doWhere.do.createdAt = {}
            if (dateFrom) doWhere.do.createdAt.gte = new Date(dateFrom)
            if (dateTo) doWhere.do.createdAt.lte = new Date(dateTo + 'T23:59:59')
        }

        const doLines = await prisma.deliveryOrderLine.findMany({
            where: doWhere,
            include: {
                do: {
                    include: {
                        warehouse: { select: { id: true, name: true } },
                        so: { select: { soNo: true } },
                    },
                },
                lot: { select: { lotNo: true, unitLandedCost: true } },
                location: { select: { locationCode: true } },
            },
            orderBy: { do: { createdAt: 'asc' } },
        })

        for (const line of doLines) {
            movements.push({
                id: `do-${line.id}`,
                date: line.do.createdAt,
                docType: 'DO',
                docNo: line.do.doNo,
                docId: line.do.id,
                warehouseId: line.do.warehouse.id,
                warehouseName: line.do.warehouse.name,
                locationCode: line.location?.locationCode ?? '—',
                lotNo: line.lot?.lotNo ?? '—',
                qtyIn: 0,
                qtyOut: Number(line.qtyShipped),
                balance: 0,
                unitCost: Number(line.lot?.unitLandedCost ?? 0),
                reference: `SO: ${line.do.so.soNo}`,
                note: '',
            })
        }
    }

    // ── 3. Sort by date ──────────────────────────────
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // ── 4. Calculate running balance ─────────────────
    let balance = 0
    let totalIn = 0
    let totalOut = 0

    for (const m of movements) {
        totalIn += m.qtyIn
        totalOut += m.qtyOut
        balance += m.qtyIn - m.qtyOut
        m.balance = balance
    }

    // ── 5. Current stock for this product ────────────
    const currentStockAgg = await prisma.stockLot.aggregate({
        where: {
            productId,
            status: { in: ['AVAILABLE', 'RESERVED'] },
            ...(warehouseId ? { location: { warehouseId } } : {}),
        },
        _sum: { qtyAvailable: true },
    })
    const currentStock = Number(currentStockAgg._sum.qtyAvailable ?? 0)

    // Get avg unit cost
    const avgCost = movements.length > 0
        ? movements.reduce((sum, m) => sum + m.unitCost, 0) / movements.length
        : 0

    const summary: NXTSummary = {
        openingBalance: 0, // For filtered date range, this is approximate
        totalIn,
        totalOut,
        closingBalance: currentStock,
        totalValue: currentStock * avgCost,
        movementCount: movements.length,
    }

    return { movements, summary }
}

// ── Get current stock by location for a product ───
export async function getProductStockByLocation(productId: string) {
    const lots = await prisma.stockLot.findMany({
        where: {
            productId,
            status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] },
            qtyAvailable: { gt: 0 },
        },
        include: {
            location: {
                include: { warehouse: { select: { id: true, name: true } } },
            },
        },
        orderBy: { receivedDate: 'desc' },
    })

    return lots.map(l => ({
        lotNo: l.lotNo,
        locationCode: l.location.locationCode,
        zone: l.location.zone,
        rack: l.location.rack,
        bin: l.location.bin,
        warehouseId: l.location.warehouse.id,
        warehouseName: l.location.warehouse.name,
        qtyAvailable: Number(l.qtyAvailable),
        unitCost: Number(l.unitLandedCost),
        status: l.status,
        receivedDate: l.receivedDate,
    }))
}
