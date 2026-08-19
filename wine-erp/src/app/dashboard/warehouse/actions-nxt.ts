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
    docType: 'GR' | 'DO' | 'ADJ' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'WRITE_OFF' | 'POS_SALE'
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

// ── 1. Warehouse NXT Summary Report (BẢNG NHẬP XUẤT TỒN CẢ KHO) ───────
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

    // 2. Fetch Aggregates using groupBy for performance
    const lotWarehouseFilter = warehouseId ? { location: { warehouseId } } : {}
    const doWarehouseFilter = warehouseId ? { warehouseId } : {}

    // A1. Opening Stock Lots received before fromDate (exclude transfer lots TRF-)
    const openingStockLots = await prisma.stockLot.groupBy({
        by: ['productId'],
        _sum: { qtyReceived: true },
        where: {
            receivedDate: { lt: fromDate },
            NOT: { lotNo: { startsWith: 'TRF-' } },
            ...lotWarehouseFilter,
        },
    })
    const openingLotMap = new Map<string, number>()
    openingStockLots.forEach(item => openingLotMap.set(item.productId, Number(item._sum.qtyReceived ?? 0)))

    // A2. Opening Transfer IN (ONLY if filtering a specific warehouse)
    const openingTrfInMap = new Map<string, number>()
    if (warehouseId) {
        const openingTrfIn = await prisma.transferOrderLine.groupBy({
            by: ['productId'],
            _sum: { qtyTransferred: true },
            where: {
                transferOrder: {
                    status: 'RECEIVED',
                    receivedAt: { lt: fromDate },
                    toWarehouseId: warehouseId,
                },
            },
        })
        openingTrfIn.forEach(item => openingTrfInMap.set(item.productId, Number(item._sum.qtyTransferred ?? 0)))
    }

    // B1. Opening DO (SHIPPED/DELIVERED before fromDate)
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

    // B1.1 Opening POS Sales (Channel DIRECT_INDIVIDUAL, status PAID/DELIVERED/INVOICED before fromDate)
    const openingPos = await prisma.salesOrderLine.groupBy({
        by: ['productId'],
        _sum: { qtyOrdered: true },
        where: {
            so: {
                channel: 'DIRECT_INDIVIDUAL',
                status: { in: ['PAID', 'DELIVERED', 'INVOICED'] },
                createdAt: { lt: fromDate },
            },
        },
    })
    const openingPosMap = new Map<string, number>()
    openingPos.forEach(item => openingPosMap.set(item.productId, Number(item._sum.qtyOrdered ?? 0)))

    // B2. Opening Transfer OUT (ONLY if filtering a specific warehouse)
    const openingTrfOutMap = new Map<string, number>()
    if (warehouseId) {
        const openingTrfOut = await prisma.transferOrderLine.groupBy({
            by: ['productId'],
            _sum: { qtyTransferred: true },
            where: {
                transferOrder: {
                    status: { in: ['IN_TRANSIT', 'RECEIVED'] },
                    confirmedAt: { lt: fromDate },
                    fromWarehouseId: warehouseId,
                },
            },
        })
        openingTrfOut.forEach(item => openingTrfOutMap.set(item.productId, Number(item._sum.qtyTransferred ?? 0)))
    }

    // C1. Period Stock Lots received (between fromDate and toDate, exclude TRF-)
    const periodStockLots = await prisma.stockLot.groupBy({
        by: ['productId'],
        _sum: { qtyReceived: true },
        where: {
            receivedDate: { gte: fromDate, lte: toDate },
            NOT: { lotNo: { startsWith: 'TRF-' } },
            ...lotWarehouseFilter,
        },
    })
    const periodLotMap = new Map<string, number>()
    periodStockLots.forEach(item => periodLotMap.set(item.productId, Number(item._sum.qtyReceived ?? 0)))

    // C2. Period Transfer IN (ONLY if filtering a specific warehouse)
    const periodTrfInMap = new Map<string, number>()
    if (warehouseId) {
        const periodTrfIn = await prisma.transferOrderLine.groupBy({
            by: ['productId'],
            _sum: { qtyTransferred: true },
            where: {
                transferOrder: {
                    status: 'RECEIVED',
                    receivedAt: { gte: fromDate, lte: toDate },
                    toWarehouseId: warehouseId,
                },
            },
        })
        periodTrfIn.forEach(item => periodTrfInMap.set(item.productId, Number(item._sum.qtyTransferred ?? 0)))
    }

    // D1. Period DO (SHIPPED/DELIVERED between fromDate and toDate)
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

    // D1.1 Period POS Sales (Channel DIRECT_INDIVIDUAL between fromDate and toDate)
    const periodPos = await prisma.salesOrderLine.groupBy({
        by: ['productId'],
        _sum: { qtyOrdered: true },
        where: {
            so: {
                channel: 'DIRECT_INDIVIDUAL',
                status: { in: ['PAID', 'DELIVERED', 'INVOICED'] },
                createdAt: { gte: fromDate, lte: toDate },
            },
        },
    })
    const periodPosMap = new Map<string, number>()
    periodPos.forEach(item => periodPosMap.set(item.productId, Number(item._sum.qtyOrdered ?? 0)))

    // D2. Period Transfer OUT (ONLY if filtering a specific warehouse)
    const periodTrfOutMap = new Map<string, number>()
    if (warehouseId) {
        const periodTrfOut = await prisma.transferOrderLine.groupBy({
            by: ['productId'],
            _sum: { qtyTransferred: true },
            where: {
                transferOrder: {
                    status: { in: ['IN_TRANSIT', 'RECEIVED'] },
                    confirmedAt: { gte: fromDate, lte: toDate },
                    fromWarehouseId: warehouseId,
                },
            },
        })
        periodTrfOut.forEach(item => periodTrfOutMap.set(item.productId, Number(item._sum.qtyTransferred ?? 0)))
    }

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
        const opIn = (openingLotMap.get(p.id) ?? 0) + (openingTrfInMap.get(p.id) ?? 0)
        const opOut = (openingDoMap.get(p.id) ?? 0) + (openingTrfOutMap.get(p.id) ?? 0) + (openingPosMap.get(p.id) ?? 0)
        const openingQty = Math.max(0, opIn - opOut)

        const inQty = (periodLotMap.get(p.id) ?? 0) + (periodTrfInMap.get(p.id) ?? 0)
        const outQty = (periodDoMap.get(p.id) ?? 0) + (periodTrfOutMap.get(p.id) ?? 0) + (periodPosMap.get(p.id) ?? 0)
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
    const lotWarehouseFilter = warehouseId ? { location: { warehouseId } } : {}
    const doWarehouseFilter = warehouseId ? { warehouseId } : {}

    const [opLots, opDo, opPos, opTrfIn, opTrfOut] = await Promise.all([
        prisma.stockLot.aggregate({
            where: {
                productId,
                receivedDate: { lt: fromDate },
                NOT: { lotNo: { startsWith: 'TRF-' } },
                ...lotWarehouseFilter,
            },
            _sum: { qtyReceived: true },
        }),
        prisma.deliveryOrderLine.aggregate({
            where: {
                productId,
                do: {
                    status: { in: ['SHIPPED', 'DELIVERED'] },
                    createdAt: { lt: fromDate },
                    ...doWarehouseFilter,
                },
            },
            _sum: { qtyShipped: true },
        }),
        prisma.salesOrderLine.aggregate({
            where: {
                productId,
                so: {
                    channel: 'DIRECT_INDIVIDUAL',
                    status: { in: ['PAID', 'DELIVERED', 'INVOICED'] },
                    createdAt: { lt: fromDate },
                },
            },
            _sum: { qtyOrdered: true },
        }),
        warehouseId
            ? prisma.transferOrderLine.aggregate({
                  where: {
                      productId,
                      transferOrder: {
                          status: 'RECEIVED',
                          receivedAt: { lt: fromDate },
                          toWarehouseId: warehouseId,
                      },
                  },
                  _sum: { qtyTransferred: true },
              })
            : Promise.resolve({ _sum: { qtyTransferred: null } }),
        warehouseId
            ? prisma.transferOrderLine.aggregate({
                  where: {
                      productId,
                      transferOrder: {
                          status: { in: ['IN_TRANSIT', 'RECEIVED'] },
                          confirmedAt: { lt: fromDate },
                          fromWarehouseId: warehouseId,
                      },
                  },
                  _sum: { qtyTransferred: true },
              })
            : Promise.resolve({ _sum: { qtyTransferred: null } }),
    ])

    const opIn = Number(opLots._sum.qtyReceived ?? 0) + Number(opTrfIn._sum?.qtyTransferred ?? 0)
    const opOut = Number(opDo._sum.qtyShipped ?? 0) + Number(opPos._sum?.qtyOrdered ?? 0) + Number(opTrfOut._sum?.qtyTransferred ?? 0)
    const openingBalance = Math.max(0, opIn - opOut)

    const movements: StockMovementRow[] = []

    // ── 2. Direct Stock Lots & GR Lines (NHẬP HÀNG) ────────
    if (movementType === 'ALL' || movementType === 'IN') {
        const periodLots = await prisma.stockLot.findMany({
            where: {
                productId,
                receivedDate: { gte: fromDate, lte: toDate },
                NOT: { lotNo: { startsWith: 'TRF-' } },
                ...lotWarehouseFilter,
            },
            include: {
                location: { include: { warehouse: { select: { id: true, name: true } } } },
            },
            orderBy: { receivedDate: 'asc' },
        })

        for (const lot of periodLots) {
            movements.push({
                id: `lot-${lot.id}`,
                date: lot.receivedDate,
                docType: 'GR',
                docNo: lot.lotNo,
                docId: lot.id,
                warehouseId: lot.location.warehouse.id,
                warehouseName: lot.location.warehouse.name,
                locationCode: lot.location.locationCode,
                lotNo: lot.lotNo,
                qtyIn: Number(lot.qtyReceived),
                qtyOut: 0,
                balance: 0,
                unitCost: Number(lot.unitLandedCost),
                reference: 'Nhập Lô / Nhập Kho',
                note: `Tồn khả dụng: ${Number(lot.qtyAvailable)}`,
            })
        }
    }

    // ── 3. Transfer IN Lines (NHẬP CHUYỂN KHO) ────
    if (movementType === 'ALL' || movementType === 'IN') {
        const trfInWhere: any = {
            productId,
            transferOrder: { status: 'RECEIVED' },
        }
        if (warehouseId) trfInWhere.transferOrder = { ...trfInWhere.transferOrder, toWarehouseId: warehouseId }
        trfInWhere.transferOrder.receivedAt = { gte: fromDate, lte: toDate }

        const trfInLines = await prisma.transferOrderLine.findMany({
            where: trfInWhere,
            include: {
                transferOrder: {
                    include: {
                        toWarehouse: { select: { id: true, name: true } },
                        fromWarehouse: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { transferOrder: { receivedAt: 'asc' } },
        })

        for (const line of trfInLines) {
            const lot = await prisma.stockLot.findFirst({
                where: { productId, location: { warehouseId: line.transferOrder.toWarehouseId } },
                select: { lotNo: true, unitLandedCost: true, location: { select: { locationCode: true } } },
                orderBy: { receivedDate: 'desc' },
            })

            // Only count qtyIn if filtering a specific warehouse; for 'All Warehouses', it is internal movement (qtyIn=0)
            const qtyInVal = warehouseId ? Number(line.qtyTransferred) : 0

            movements.push({
                id: `trf-in-${line.id}`,
                date: line.transferOrder.receivedAt ?? line.transferOrder.createdAt,
                docType: 'TRANSFER_IN',
                docNo: line.transferOrder.transferNo,
                docId: line.transferOrder.id,
                warehouseId: line.transferOrder.toWarehouse.id,
                warehouseName: line.transferOrder.toWarehouse.name,
                locationCode: lot?.location?.locationCode ?? '—',
                lotNo: lot?.lotNo ?? '—',
                qtyIn: qtyInVal,
                qtyOut: 0,
                balance: 0,
                unitCost: Number(lot?.unitLandedCost ?? 0),
                reference: `Nhận điều chuyển từ: ${line.transferOrder.fromWarehouse.name}`,
                note: warehouseId ? (line.transferOrder.notes || '') : `Luân chuyển nội bộ kho (${Number(line.qtyTransferred)} chai)`,
            })
        }
    }

    // ── 4. DO Lines (XUẤT BÁN HÀNG) ───────
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

    // ── 5. Transfer OUT Lines (XUẤT CHUYỂN KHO) ────
    if (movementType === 'ALL' || movementType === 'OUT') {
        const trfOutWhere: any = {
            productId,
            transferOrder: { status: { in: ['IN_TRANSIT', 'RECEIVED'] } },
        }
        if (warehouseId) trfOutWhere.transferOrder = { ...trfOutWhere.transferOrder, fromWarehouseId: warehouseId }
        trfOutWhere.transferOrder.confirmedAt = { gte: fromDate, lte: toDate }

        const trfOutLines = await prisma.transferOrderLine.findMany({
            where: trfOutWhere,
            include: {
                transferOrder: {
                    include: {
                        fromWarehouse: { select: { id: true, name: true } },
                        toWarehouse: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { transferOrder: { confirmedAt: 'asc' } },
        })

        for (const line of trfOutLines) {
            const lot = await prisma.stockLot.findFirst({
                where: { productId, location: { warehouseId: line.transferOrder.fromWarehouseId } },
                select: { lotNo: true, unitLandedCost: true, location: { select: { locationCode: true } } },
            })

            // Only count qtyOut if filtering a specific warehouse; for 'All Warehouses', it is internal movement (qtyOut=0)
            const qtyOutVal = warehouseId ? Number(line.qtyTransferred) : 0

            movements.push({
                id: `trf-out-${line.id}`,
                date: line.transferOrder.confirmedAt ?? line.transferOrder.createdAt,
                docType: 'TRANSFER_OUT',
                docNo: line.transferOrder.transferNo,
                docId: line.transferOrder.id,
                warehouseId: line.transferOrder.fromWarehouse.id,
                warehouseName: line.transferOrder.fromWarehouse.name,
                locationCode: lot?.location?.locationCode ?? '—',
                lotNo: lot?.lotNo ?? '—',
                qtyIn: 0,
                qtyOut: qtyOutVal,
                balance: 0,
                unitCost: Number(lot?.unitLandedCost ?? 0),
                reference: `Điều chuyển đến: ${line.transferOrder.toWarehouse.name}`,
                note: warehouseId ? (line.transferOrder.notes || '') : `Luân chuyển nội bộ kho (${Number(line.qtyTransferred)} chai)`,
            })
        }
    }

    // ── 6. Sort by date ──────────────────────────────
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // ── 7. Calculate step-by-step running balance ───
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
export async function getProductStockByLocation(productId: string, warehouseId?: string) {
    const lots = await prisma.stockLot.findMany({
        where: {
            productId,
            status: { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] },
            qtyAvailable: { gt: 0 },
            ...(warehouseId ? { location: { warehouseId } } : {}),
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
