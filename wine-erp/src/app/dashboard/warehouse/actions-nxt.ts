'use server'

import { prisma } from '@/lib/db'
import { cached } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// NHẬP - XUẤT - TỒN — Stock Movement & Inventory Summary
// ═══════════════════════════════════════════════════

export interface WarehouseNXTItem {
    productId: string
    skuCode: string
    productName: string
    wineType: string
    country: string
    unit: string
    openingQty: number
    openingValue: number
    inQty: number
    inValue: number
    outQty: number
    outValue: number
    closingQty: number
    closingValue: number
    unitCost: number
}

export interface WarehouseNXTSummary {
    totalProducts: number
    totalOpeningQty: number
    totalOpeningValue: number
    totalInQty: number
    totalInValue: number
    totalOutQty: number
    totalOutValue: number
    totalClosingQty: number
    totalClosingValue: number
}

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
    balance: number // running balance
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
}

// Helper: Robust Date Range Parser (Avoids UTC Timezone Shift)
function parseDateRange(dateFromStr?: string, dateToStr?: string) {
    let fromDate: Date
    let toDate: Date

    if (dateFromStr) {
        const [y, m, d] = dateFromStr.split('-').map(Number)
        fromDate = new Date(y, m - 1, d, 0, 0, 0, 0)
    } else {
        const now = new Date()
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    }

    if (dateToStr) {
        const [y, m, d] = dateToStr.split('-').map(Number)
        toDate = new Date(y, m - 1, d, 23, 59, 59, 999)
    } else {
        toDate = new Date()
        toDate.setHours(23, 59, 59, 999)
    }

    return { fromDate, toDate }
}

// ── 1. Warehouse NXT Summary Report (Bảng Nhập Xuất Tồn Cả Kho) ───────
export async function getWarehouseNXTReport(filters: {
    warehouseId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    wineType?: string
    hideZeroStock?: boolean
}): Promise<{ items: WarehouseNXTItem[]; summary: WarehouseNXTSummary }> {
    const { warehouseId, dateFrom, dateTo, search, wineType, hideZeroStock = false } = filters

    const { fromDate, toDate } = parseDateRange(dateFrom, dateTo)

    // 1. Fetch matching products
    const productWhere: any = {}
    if (search) {
        productWhere.OR = [
            { skuCode: { contains: search, mode: 'insensitive' } },
            { productName: { contains: search, mode: 'insensitive' } },
        ]
    }
    if (wineType && wineType !== 'ALL') {
        productWhere.wineType = wineType
    }

    const products = await prisma.product.findMany({
        where: productWhere,
        select: {
            id: true,
            skuCode: true,
            productName: true,
            wineType: true,
            country: true,
        },
        orderBy: { skuCode: 'asc' },
    })

    if (products.length === 0) {
        return {
            items: [],
            summary: {
                totalProducts: 0,
                totalOpeningQty: 0,
                totalOpeningValue: 0,
                totalInQty: 0,
                totalInValue: 0,
                totalOutQty: 0,
                totalOutValue: 0,
                totalClosingQty: 0,
                totalClosingValue: 0,
            },
        }
    }

    // 2. Fetch Aggregates using groupBy for extreme performance
    const grWarehouseFilter = warehouseId ? { warehouseId } : {}
    const doWarehouseFilter = warehouseId ? { warehouseId } : {}

    // A. Opening GR (CONFIRMED before fromDate)
    const openingGr = await prisma.goodsReceiptLine.groupBy({
        by: ['productId'],
        _sum: { qtyReceived: true },
        where: {
            gr: {
                status: 'CONFIRMED',
                confirmedAt: { lt: fromDate },
                ...grWarehouseFilter,
            },
        },
    })
    const openingGrMap = new Map<string, number>()
    openingGr.forEach(item => openingGrMap.set(item.productId, Number(item._sum.qtyReceived ?? 0)))

    // B. Opening DO (SHIPPED/DELIVERED before fromDate)
    const openingDo = await prisma.deliveryOrderLine.groupBy({
        by: ['productId'],
        _sum: { qtyShipped: true },
        where: {
            do: {
                status: { in: ['SHIPPED', 'DELIVERED'] },
                createdAt: { lt: fromDate },
                ...doWarehouseFilter,
            },
        },
    })
    const openingDoMap = new Map<string, number>()
    openingDo.forEach(item => openingDoMap.set(item.productId, Number(item._sum.qtyShipped ?? 0)))

    // C. Period GR (CONFIRMED between fromDate and toDate)
    const periodGr = await prisma.goodsReceiptLine.groupBy({
        by: ['productId'],
        _sum: { qtyReceived: true },
        where: {
            gr: {
                status: 'CONFIRMED',
                confirmedAt: { gte: fromDate, lte: toDate },
                ...grWarehouseFilter,
            },
        },
    })
    const periodGrMap = new Map<string, number>()
    periodGr.forEach(item => periodGrMap.set(item.productId, Number(item._sum.qtyReceived ?? 0)))

    // D. Period DO (SHIPPED/DELIVERED between fromDate and toDate)
    const periodDo = await prisma.deliveryOrderLine.groupBy({
        by: ['productId'],
        _sum: { qtyShipped: true },
        where: {
            do: {
                status: { in: ['SHIPPED', 'DELIVERED'] },
                createdAt: { gte: fromDate, lte: toDate },
                ...doWarehouseFilter,
            },
        },
    })
    const periodDoMap = new Map<string, number>()
    periodDo.forEach(item => periodDoMap.set(item.productId, Number(item._sum.qtyShipped ?? 0)))

    // E. Avg Landed Cost per Product from stock lots
    const landedCosts = await prisma.stockLot.groupBy({
        by: ['productId'],
        _avg: { unitLandedCost: true },
        where: {
            status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] },
            ...(warehouseId ? { location: { warehouseId } } : {}),
        },
    })
    const landedCostMap = new Map<string, number>()
    landedCosts.forEach(item => landedCostMap.set(item.productId, Number(item._avg.unitLandedCost ?? 0)))

    // 3. Assemble report rows
    const items: WarehouseNXTItem[] = []
    let totalOpeningQty = 0
    let totalOpeningValue = 0
    let totalInQty = 0
    let totalInValue = 0
    let totalOutQty = 0
    let totalOutValue = 0
    let totalClosingQty = 0
    let totalClosingValue = 0

    for (const p of products) {
        const opIn = openingGrMap.get(p.id) ?? 0
        const opOut = openingDoMap.get(p.id) ?? 0
        const openingQty = Math.max(0, opIn - opOut)

        const inQty = periodGrMap.get(p.id) ?? 0
        const outQty = periodDoMap.get(p.id) ?? 0
        const closingQty = Math.max(0, openingQty + inQty - outQty)

        // Skip zero stock / zero activity products if requested
        if (hideZeroStock && openingQty === 0 && inQty === 0 && outQty === 0 && closingQty === 0) {
            continue
        }

        const unitCost = landedCostMap.get(p.id) || 0
        const openingValue = openingQty * unitCost
        const inValue = inQty * unitCost
        const outValue = outQty * unitCost
        const closingValue = closingQty * unitCost

        items.push({
            productId: p.id,
            skuCode: p.skuCode,
            productName: p.productName,
            wineType: p.wineType,
            country: p.country,
            unit: 'Chai',
            openingQty,
            openingValue,
            inQty,
            inValue,
            outQty,
            outValue,
            closingQty,
            closingValue,
            unitCost,
        })

        totalOpeningQty += openingQty
        totalOpeningValue += openingValue
        totalInQty += inQty
        totalInValue += inValue
        totalOutQty += outQty
        totalOutValue += outValue
        totalClosingQty += closingQty
        totalClosingValue += closingValue
    }

    const summary: WarehouseNXTSummary = {
        totalProducts: items.length,
        totalOpeningQty,
        totalOpeningValue,
        totalInQty,
        totalInValue,
        totalOutQty,
        totalOutValue,
        totalClosingQty,
        totalClosingValue,
    }

    return { items, summary }
}

// ── 2. Get products for search/select ────────────────
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
                wineType: true, country: true,
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
        }))
    }, 30_000)
}

// ── 3. Stock Movement Detail Ledger — per product ─────
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

    const { fromDate, toDate } = parseDateRange(dateFrom, dateTo)

    // 1. Calculate Opening Balance before fromDate
    const [opGr, opDo] = await Promise.all([
        prisma.goodsReceiptLine.aggregate({
            where: {
                productId,
                gr: {
                    status: 'CONFIRMED',
                    confirmedAt: { lt: fromDate },
                    ...(warehouseId ? { warehouseId } : {}),
                },
            },
            _sum: { qtyReceived: true },
        }),
        prisma.deliveryOrderLine.aggregate({
            where: {
                productId,
                do: {
                    status: { in: ['SHIPPED', 'DELIVERED'] },
                    createdAt: { lt: fromDate },
                    ...(warehouseId ? { warehouseId } : {}),
                },
            },
            _sum: { qtyShipped: true },
        }),
    ])
    const opIn = Number(opGr._sum.qtyReceived ?? 0)
    const opOut = Number(opDo._sum.qtyShipped ?? 0)
    const openingBalance = Math.max(0, opIn - opOut)

    const movements: StockMovementRow[] = []

    // ── 2. GR Lines (NHẬP) ────────
    if (movementType === 'ALL' || movementType === 'IN') {
        const grWhere: any = {
            productId,
            gr: { status: 'CONFIRMED' },
        }
        if (warehouseId) grWhere.gr = { ...grWhere.gr, warehouseId }
        grWhere.gr.confirmedAt = { gte: fromDate, lte: toDate }

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
                reference: line.gr.po?.poNo ? `PO: ${line.gr.po.poNo}` : 'Nhập Kho',
                note: `Chênh lệch: ${Number(line.variance)}`,
            })
        }
    }

    // ── 3. DO Lines (XUẤT) ───────
    if (movementType === 'ALL' || movementType === 'OUT') {
        const doWhere: any = {
            productId,
            do: { status: { in: ['SHIPPED', 'DELIVERED'] } },
        }
        if (warehouseId) doWhere.do = { ...doWhere.do, warehouseId }
        doWhere.do.createdAt = { gte: fromDate, lte: toDate }

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
                reference: line.do.so?.soNo ? `SO: ${line.do.so.soNo}` : 'Xuất Kho',
                note: '',
            })
        }
    }

    // ── 4. Sort by date ──────────────────────────────
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // ── 5. Calculate step-by-step running balance ───
    let currentBal = openingBalance
    let totalIn = 0
    let totalOut = 0

    for (const m of movements) {
        totalIn += m.qtyIn
        totalOut += m.qtyOut
        currentBal += m.qtyIn - m.qtyOut
        m.balance = currentBal
    }

    const closingBalance = openingBalance + totalIn - totalOut

    // Get product landed cost fallback if movements in period is 0
    let avgCost = 0
    if (movements.length > 0) {
        avgCost = movements.reduce((sum, m) => sum + m.unitCost, 0) / movements.length
    } else {
        const lotAgg = await prisma.stockLot.aggregate({
            where: { productId, status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] } },
            _avg: { unitLandedCost: true },
        })
        avgCost = Number(lotAgg._avg.unitLandedCost ?? 0)
    }

    const summary: NXTSummary = {
        openingBalance,
        totalIn,
        totalOut,
        closingBalance,
        totalValue: closingBalance * avgCost,
        movementCount: movements.length,
    }

    return { movements, summary }
}

// ── 4. Get current stock by location for a product ───
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
