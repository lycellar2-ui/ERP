'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { cached, revalidateCache } from '@/lib/cache'
import { parseOrThrow, GoodsReceiptCreateSchema } from '@/lib/validations'

// ─── Types ────────────────────────────────────────
export type WarehouseRow = {
    id: string
    code: string
    name: string
    address: string | null
    locationCount: number
    lotCount: number
    totalStock: number // bottles
    createdAt: Date
}

export type StockLotRow = {
    id: string
    lotNo: string
    productId: string
    productName: string
    skuCode: string
    country: string
    vintage: number | null
    wineType: string
    locationCode: string
    warehouseId: string
    warehouseName: string
    qtyReceived: number
    qtyAvailable: number
    unitLandedCost: number
    receivedDate: Date
    status: string
}

export type LocationRow = {
    id: string
    locationCode: string
    zone: string
    rack: string | null
    bin: string | null
    type: string
    capacityCases: number | null
    tempControlled: boolean
    stockCount: number
    usedBottles: number
}

// ─── Warehouses ───────────────────────────────────
export async function getWarehouses(): Promise<WarehouseRow[]> {
    return cached('wms:warehouses', async () => {
        const warehouses = await prisma.warehouse.findMany({
            include: {
                locations: {
                    include: {
                        stockLots: {
                            where: { status: 'AVAILABLE' },
                            select: { qtyAvailable: true },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        return warehouses.map(w => {
            const lots = w.locations.flatMap(l => l.stockLots)
            return {
                id: w.id,
                code: w.code,
                name: w.name,
                address: w.address,
                locationCount: w.locations.length,
                lotCount: lots.length,
                totalStock: lots.reduce((s, l) => s + Number(l.qtyAvailable), 0),
                createdAt: w.createdAt,
            }
        })
    }) // end cached
}

// ─── Stock inventory view ─────────────────────────
export async function getStockInventory(filters: {
    warehouseId?: string
    search?: string
    wineType?: string
    status?: string
} = {}): Promise<StockLotRow[]> {
    const where: any = {}
    if (filters.warehouseId) {
        where.location = { warehouseId: filters.warehouseId }
    }
    if (filters.status) {
        where.status = filters.status
    } else {
        where.status = { in: ['AVAILABLE', 'RESERVED', 'QUARANTINE'] }
    }
    if (filters.search) {
        where.OR = [
            { lotNo: { contains: filters.search, mode: 'insensitive' } },
            { product: { productName: { contains: filters.search, mode: 'insensitive' } } },
            { product: { skuCode: { contains: filters.search, mode: 'insensitive' } } },
        ]
    }
    if (filters.wineType) {
        where.product = { ...where.product, wineType: filters.wineType }
    }

    const lots = await prisma.stockLot.findMany({
        where,
        include: {
            product: { select: { productName: true, skuCode: true, country: true, vintage: true, wineType: true } },
            location: {
                include: {
                    warehouse: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [{ status: 'asc' }, { receivedDate: 'desc' }],
        take: 200,
    })

    return lots.map(l => ({
        id: l.id,
        lotNo: l.lotNo,
        productId: l.productId,
        productName: l.product.productName,
        skuCode: l.product.skuCode,
        country: l.product.country,
        vintage: l.product.vintage,
        wineType: l.product.wineType,
        locationCode: l.location.locationCode,
        warehouseId: l.location.warehouse.id,
        warehouseName: l.location.warehouse.name,
        qtyReceived: Number(l.qtyReceived),
        qtyAvailable: Number(l.qtyAvailable),
        unitLandedCost: Number(l.unitLandedCost),
        receivedDate: l.receivedDate,
        status: l.status,
    }))
}

// ─── Locations in a warehouse ─────────────────────
export async function getLocations(warehouseId: string): Promise<LocationRow[]> {
    const locs = await prisma.location.findMany({
        where: { warehouseId },
        include: {
            stockLots: {
                where: { status: { in: ['AVAILABLE', 'RESERVED'] } },
                select: { qtyAvailable: true },
            },
        },
        orderBy: [{ zone: 'asc' }, { locationCode: 'asc' }],
    })

    return locs.map(l => ({
        id: l.id,
        locationCode: l.locationCode,
        zone: l.zone,
        rack: l.rack,
        bin: l.bin,
        type: l.type,
        capacityCases: l.capacityCases,
        tempControlled: l.tempControlled,
        stockCount: l.stockLots.length,
        usedBottles: l.stockLots.reduce((s, lot) => s + Number(lot.qtyAvailable), 0),
    }))
}

// ─── Create Warehouse ─────────────────────────────
const warehouseSchema = z.object({
    code: z.string().min(2),
    name: z.string().min(2),
    address: z.string().nullable().optional(),
})

export async function createWarehouse(input: z.infer<typeof warehouseSchema>) {
    const data = warehouseSchema.parse(input)
    await prisma.warehouse.create({ data })
    revalidateCache('wms')
    revalidatePath('/dashboard/warehouse')
    return { success: true }
}

// ─── Create Location ──────────────────────────────
const locationSchema = z.object({
    warehouseId: z.string().min(1),
    zone: z.string().min(1),
    rack: z.string().nullable().optional(),
    bin: z.string().nullable().optional(),
    type: z.enum(['STORAGE', 'RECEIVING', 'SHIPPING', 'QUARANTINE', 'VIRTUAL']).default('STORAGE'),
    capacityCases: z.number().int().nullable().optional(),
    tempControlled: z.boolean().default(false),
})

export async function createLocation(input: z.infer<typeof locationSchema>) {
    const data = locationSchema.parse(input)
    const locationCode = [data.zone, data.rack, data.bin].filter(Boolean).join('-').toUpperCase()
    await prisma.location.create({
        data: { ...data, locationCode },
    })
    revalidatePath('/dashboard/warehouse')
    return { success: true }
}

// ── Delete Location ───────────────────────────────
export async function deleteLocation(locationId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const loc = await prisma.location.findUnique({
            where: { id: locationId },
            include: { stockLots: { where: { qtyAvailable: { gt: 0 } }, select: { id: true } } },
        })
        if (!loc) return { success: false, error: 'Vị trí không tồn tại' }
        if (loc.stockLots.length > 0) {
            return { success: false, error: 'Không thể xóa — vị trí đang chứa hàng' }
        }
        await prisma.location.delete({ where: { id: locationId } })
        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Location Heatmap — Occupancy per Zone ─────────
export async function getLocationHeatmap(warehouseId: string) {
    const locations = await prisma.location.findMany({
        where: { warehouseId },
        include: {
            stockLots: {
                where: { status: { in: ['AVAILABLE', 'RESERVED'] }, qtyAvailable: { gt: 0 } },
                select: { qtyAvailable: true },
            },
        },
        orderBy: [{ zone: 'asc' }, { rack: 'asc' }, { bin: 'asc' }],
    })

    // Group by zone
    const zones: Record<string, {
        zone: string
        totalSlots: number
        usedSlots: number
        totalBottles: number
        totalCapacity: number
        locations: { code: string; bottles: number; capacity: number; pct: number }[]
    }> = {}

    for (const loc of locations) {
        if (!zones[loc.zone]) {
            zones[loc.zone] = { zone: loc.zone, totalSlots: 0, usedSlots: 0, totalBottles: 0, totalCapacity: 0, locations: [] }
        }
        const z = zones[loc.zone]
        const bottles = loc.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
        const capacity = loc.capacityCases ? loc.capacityCases * 6 : 100 // Default 100 bottles if no capacity
        const pct = capacity > 0 ? Math.min((bottles / capacity) * 100, 100) : 0

        z.totalSlots++
        if (bottles > 0) z.usedSlots++
        z.totalBottles += bottles
        z.totalCapacity += capacity
        z.locations.push({ code: loc.locationCode, bottles, capacity, pct: Math.round(pct) })
    }

    return Object.values(zones).map(z => ({
        ...z,
        occupancyPct: z.totalCapacity > 0 ? Math.round((z.totalBottles / z.totalCapacity) * 100) : 0,
    }))
}

// ─── WMS Stats ────────────────────────────────────
export async function getWMSStats() {
    return cached('wms:stats', async () => {
        const [warehouses, totalLots, availableBottles, reservedBottles, grCount] = await Promise.all([
            prisma.warehouse.count(),
            prisma.stockLot.count({ where: { status: 'AVAILABLE' } }),
            prisma.stockLot.aggregate({ where: { status: 'AVAILABLE' }, _sum: { qtyAvailable: true } }),
            prisma.stockLot.aggregate({ where: { status: 'RESERVED' }, _sum: { qtyAvailable: true } }),
            prisma.goodsReceipt.count(),
        ])

        return {
            warehouses,
            totalLots,
            availableBottles: Number(availableBottles._sum.qtyAvailable ?? 0),
            reservedBottles: Number(reservedBottles._sum.qtyAvailable ?? 0),
            grCount,
        }
    }) // end cached
}

// ═══════════════════════════════════════════════════
// GOODS RECEIPT — Nhập kho từ PO
// ═══════════════════════════════════════════════════

export type GoodsReceiptRow = {
    id: string
    grNo: string
    poNo: string
    poId: string
    warehouseName: string
    warehouseId: string
    status: string
    lineCount: number
    totalQtyReceived: number
    confirmedBy: string | null
    confirmedAt: Date | null
    createdAt: Date
}

export type GRLineInput = {
    productId: string
    qtyReceived: number
    locationId: string    // Target location for the new StockLot
    unitLandedCost?: number
}

// ── List Goods Receipts ───────────────────────────
export async function getGoodsReceipts(filters: {
    status?: string
    poId?: string
    warehouseId?: string
} = {}): Promise<GoodsReceiptRow[]> {
    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.poId) where.poId = filters.poId
    if (filters.warehouseId) where.warehouseId = filters.warehouseId

    const receipts = await prisma.goodsReceipt.findMany({
        where,
        include: {
            po: { select: { poNo: true } },
            warehouse: { select: { name: true } },
            confirmer: { select: { name: true } },
            lines: { select: { qtyReceived: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    return receipts.map(gr => ({
        id: gr.id,
        grNo: gr.grNo,
        poNo: gr.po.poNo,
        poId: gr.poId,
        warehouseName: gr.warehouse.name,
        warehouseId: gr.warehouseId,
        status: gr.status,
        lineCount: gr.lines.length,
        totalQtyReceived: gr.lines.reduce((s, l) => s + Number(l.qtyReceived), 0),
        confirmedBy: gr.confirmer?.name ?? null,
        confirmedAt: gr.confirmedAt,
        createdAt: gr.createdAt,
    }))
}

// ── Get POs ready for receiving ───────────────────
export async function getPOsForReceiving() {
    return prisma.purchaseOrder.findMany({
        where: { status: { in: ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] } },
        select: {
            id: true,
            poNo: true,
            supplier: { select: { name: true } },
            lines: {
                select: {
                    id: true,
                    productId: true,
                    product: { select: { productName: true, skuCode: true } },
                    qtyOrdered: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    })
}

// ── Create Goods Receipt from PO ──────────────────
export async function createGoodsReceipt(input: {
    poId: string
    warehouseId: string
    shipmentId?: string
    lines: GRLineInput[]
}): Promise<{ success: boolean; grId?: string; grNo?: string; error?: string }> {
    try {
        const validated = parseOrThrow(GoodsReceiptCreateSchema, input)
        const { poId, warehouseId, shipmentId, lines } = validated

        // Get PO to validate
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: { lines: true },
        })
        if (!po) return { success: false, error: 'PO không tồn tại' }
        if (!['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
            return { success: false, error: `PO status ${po.status} không cho phép nhập kho` }
        }

        // Generate GR number: GR-YYMM-NNNN
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const count = await prisma.goodsReceipt.count()
        const grNo = `GR-${yy}${mm}-${String(count + 1).padStart(4, '0')}`

        // Create GR + Lines + StockLots in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const gr = await tx.goodsReceipt.create({
                data: {
                    grNo,
                    poId,
                    warehouseId,
                    shipmentId: shipmentId ?? null,
                    status: 'DRAFT',
                },
            })

            // Create GR Lines + StockLots
            for (const line of lines) {
                const poLine = po.lines.find(l => l.productId === line.productId)
                const qtyExpected = poLine ? Number(poLine.qtyOrdered) : line.qtyReceived

                // Generate unique lot number
                const lotCount = await tx.stockLot.count()
                const lotNo = `LOT-${yy}${mm}-${String(lotCount + 1).padStart(5, '0')}`

                // Create StockLot
                const lot = await tx.stockLot.create({
                    data: {
                        lotNo,
                        productId: line.productId,
                        shipmentId: shipmentId ?? null,
                        locationId: line.locationId,
                        qtyReceived: line.qtyReceived,
                        qtyAvailable: line.qtyReceived,
                        unitLandedCost: line.unitLandedCost ?? 0,
                        receivedDate: now,
                        status: 'AVAILABLE',
                    },
                })

                // Create GR Line
                await tx.goodsReceiptLine.create({
                    data: {
                        grId: gr.id,
                        productId: line.productId,
                        lotId: lot.id,
                        qtyExpected,
                        qtyReceived: line.qtyReceived,
                        variance: line.qtyReceived - qtyExpected,
                    },
                })
            }

            return gr
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/procurement')
        return { success: true, grId: result.id, grNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Confirm Goods Receipt ─────────────────────────
export async function confirmGoodsReceipt(
    grId: string,
    confirmerId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let grNo = ''
        await prisma.$transaction(async (tx) => {
            const gr = await tx.goodsReceipt.update({
                where: { id: grId },
                data: {
                    status: 'CONFIRMED',
                    confirmedBy: confirmerId,
                    confirmedAt: new Date(),
                },
                include: { po: true },
            })
            grNo = gr.grNo

            // Check if all PO lines have been fully received
            const poLines = await tx.purchaseOrderLine.findMany({
                where: { poId: gr.poId },
            })
            const grLines = await tx.goodsReceiptLine.findMany({
                where: { gr: { poId: gr.poId, status: 'CONFIRMED' } },
            })

            const totalOrdered = poLines.reduce((s, l) => s + Number(l.qtyOrdered), 0)
            const totalReceived = grLines.reduce((s, l) => s + Number(l.qtyReceived), 0)

            // Update PO status
            const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
            await tx.purchaseOrder.update({
                where: { id: gr.poId },
                data: { status: newStatus as any },
            })
        })

        // Audit log
        logAudit({
            userId: confirmerId,
            action: 'CONFIRM',
            entityType: 'GoodsReceipt',
            entityId: grId,
            description: `Xác nhận nhập kho ${grNo}`,
        })

        // Auto journal entry: DR 156 / CR 331
        const { generateGoodsReceiptJournal } = await import('../finance/actions')
        generateGoodsReceiptJournal(grId, confirmerId).catch(() => { })

        // Auto-generate QR codes for stock lots
        const { generateQRCodesForGR } = await import('../qr-codes/actions')
        generateQRCodesForGR(grId).catch(() => { })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/procurement')
        revalidatePath('/dashboard/finance')
        revalidatePath('/dashboard/qr-codes')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// DELIVERY ORDER — Xuất kho từ SO
// ═══════════════════════════════════════════════════

export type DeliveryOrderRow = {
    id: string
    doNo: string
    soNo: string
    soId: string
    warehouseName: string
    warehouseId: string
    status: string
    lineCount: number
    totalQtyShipped: number
    createdAt: Date
}

export type DOLineInput = {
    productId: string
    lotId: string
    locationId: string
    qtyPicked: number
}

// ── List Delivery Orders ──────────────────────────
export async function getDeliveryOrders(filters: {
    status?: string
    soId?: string
    warehouseId?: string
} = {}): Promise<DeliveryOrderRow[]> {
    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.soId) where.soId = filters.soId
    if (filters.warehouseId) where.warehouseId = filters.warehouseId

    const orders = await prisma.deliveryOrder.findMany({
        where,
        include: {
            so: { select: { soNo: true } },
            warehouse: { select: { name: true } },
            lines: { select: { qtyShipped: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    return orders.map(d => ({
        id: d.id,
        doNo: d.doNo,
        soNo: d.so.soNo,
        soId: d.soId,
        warehouseName: d.warehouse.name,
        warehouseId: d.warehouseId,
        status: d.status,
        lineCount: d.lines.length,
        totalQtyShipped: d.lines.reduce((s, l) => s + Number(l.qtyShipped), 0),
        createdAt: d.createdAt,
    }))
}

// ── Get SOs ready for delivery ────────────────────
export async function getSOsForDelivery() {
    return prisma.salesOrder.findMany({
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED'] } },
        select: {
            id: true,
            soNo: true,
            customer: { select: { name: true } },
            lines: {
                select: {
                    id: true,
                    productId: true,
                    product: { select: { productName: true, skuCode: true } },
                    qtyOrdered: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    })
}

// ── Create Delivery Order from SO ─────────────────
export async function createDeliveryOrder(input: {
    soId: string
    warehouseId: string
    lines: DOLineInput[]
}): Promise<{ success: boolean; doId?: string; doNo?: string; error?: string }> {
    try {
        const { soId, warehouseId, lines } = input

        if (lines.length === 0) {
            return { success: false, error: 'Cần ít nhất 1 dòng xuất kho' }
        }

        // Validate SO
        const so = await prisma.salesOrder.findUnique({ where: { id: soId } })
        if (!so) return { success: false, error: 'SO không tồn tại' }
        if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
            return { success: false, error: `SO status ${so.status} không cho phép xuất kho` }
        }

        // Generate DO number
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const count = await prisma.deliveryOrder.count()
        const doNo = `DO-${yy}${mm}-${String(count + 1).padStart(4, '0')}`

        const result = await prisma.$transaction(async (tx) => {
            const deliveryOrder = await tx.deliveryOrder.create({
                data: {
                    doNo,
                    soId,
                    warehouseId,
                    status: 'DRAFT',
                },
            })

            for (const line of lines) {
                // Create DO line
                await tx.deliveryOrderLine.create({
                    data: {
                        doId: deliveryOrder.id,
                        productId: line.productId,
                        lotId: line.lotId,
                        locationId: line.locationId,
                        qtyPicked: line.qtyPicked,
                        qtyShipped: 0, // Will be set on confirm
                    },
                })

                // Reserve stock (reduce available)
                await tx.stockLot.update({
                    where: { id: line.lotId },
                    data: {
                        qtyAvailable: { decrement: line.qtyPicked },
                    },
                })
            }

            return deliveryOrder
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/sales')
        return { success: true, doId: result.id, doNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Confirm DO — Mark as shipped ──────────────────
export async function confirmDeliveryOrder(
    doId: string,
    confirmerId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let doNo = ''
        await prisma.$transaction(async (tx) => {
            // Set qtyShipped = qtyPicked per line
            const doLines = await tx.deliveryOrderLine.findMany({ where: { doId } })
            for (const line of doLines) {
                await tx.deliveryOrderLine.update({
                    where: { id: line.id },
                    data: { qtyShipped: line.qtyPicked },
                })
            }

            // Update DO status
            const deliveryOrder = await tx.deliveryOrder.update({
                where: { id: doId },
                data: { status: 'SHIPPED' },
            })
            doNo = deliveryOrder.doNo

            // Update SO status
            await tx.salesOrder.update({
                where: { id: deliveryOrder.soId },
                data: { status: 'DELIVERED' },
            })
        })

        // Audit log
        if (confirmerId) {
            logAudit({
                userId: confirmerId,
                action: 'CONFIRM',
                entityType: 'DeliveryOrder',
                entityId: doId,
                description: `Xuất kho ${doNo}`,
            })
        }

        // Auto COGS journal entry: DR 632 / CR 156
        const { generateDeliveryOrderCOGSJournal } = await import('../finance/actions')
        generateDeliveryOrderCOGSJournal(doId, confirmerId ?? 'system').catch(() => { })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// STOCK TRANSFER — Internal transfer between locations
// ═══════════════════════════════════════════════════

export async function transferStock(input: {
    lotId: string
    fromLocationId: string
    toLocationId: string
    qty: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        const lot = await prisma.stockLot.findUnique({ where: { id: input.lotId } })
        if (!lot) return { success: false, error: 'Lot không tồn tại' }
        if (Number(lot.qtyAvailable) < input.qty) {
            return { success: false, error: `Không đủ tồn (available: ${lot.qtyAvailable}, requested: ${input.qty})` }
        }

        await prisma.$transaction(async (tx) => {
            // Reduce from source lot
            await tx.stockLot.update({
                where: { id: input.lotId },
                data: { qtyAvailable: { decrement: input.qty } },
            })

            // Create new lot at destination (or update existing)
            const existingLot = await tx.stockLot.findFirst({
                where: {
                    productId: lot.productId,
                    locationId: input.toLocationId,
                    status: 'AVAILABLE',
                },
            })

            if (existingLot) {
                await tx.stockLot.update({
                    where: { id: existingLot.id },
                    data: {
                        qtyAvailable: { increment: input.qty },
                        qtyReceived: { increment: input.qty },
                    },
                })
            } else {
                const count = await tx.stockLot.count()
                await tx.stockLot.create({
                    data: {
                        lotNo: `TRF-${String(count + 1).padStart(6, '0')}`,
                        productId: lot.productId,
                        locationId: input.toLocationId,
                        shipmentId: lot.shipmentId,
                        qtyReceived: input.qty,
                        qtyAvailable: input.qty,
                        unitLandedCost: lot.unitLandedCost,
                        receivedDate: new Date(),
                        status: 'AVAILABLE',
                    },
                })
            }
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// CYCLE COUNT — Stock count sessions
// ═══════════════════════════════════════════════════

export async function getStockCountSessions(warehouseId?: string) {
    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId

    return prisma.stockCountSession.findMany({
        where,
        include: { _count: { select: { lines: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
}

export async function createStockCountSession(input: {
    warehouseId: string
    zone?: string
    type: 'FULL' | 'CYCLE' | 'SPOT'
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
        // Get all stock lots for this warehouse/zone
        const locationFilter: any = { warehouse: { id: input.warehouseId } }
        if (input.zone) locationFilter.zone = input.zone

        const locations = await prisma.location.findMany({
            where: locationFilter,
            select: {
                id: true,
                locationCode: true,
                stockLots: {
                    where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                    select: { productId: true, qtyAvailable: true },
                },
            },
        })

        const session = await prisma.stockCountSession.create({
            data: {
                warehouseId: input.warehouseId,
                zone: input.zone,
                type: input.type as any,
                status: 'DRAFT',
                lines: {
                    create: locations.flatMap(loc =>
                        loc.stockLots.map(lot => ({
                            productId: lot.productId,
                            locationCode: loc.locationCode,
                            qtySystem: lot.qtyAvailable,
                        }))
                    ),
                },
            },
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true, sessionId: session.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function recordCountLine(
    lineId: string,
    qtyActual: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const line = await prisma.stockCountLine.findUnique({ where: { id: lineId } })
        if (!line) return { success: false, error: 'Dòng kiểm kê không tồn tại' }

        const variance = qtyActual - Number(line.qtySystem)

        await prisma.stockCountLine.update({
            where: { id: lineId },
            data: { qtyActual, variance },
        })

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function completeStockCount(
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.stockCountSession.update({
            where: { id: sessionId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// FIFO — Auto select oldest lot for picking
// ═══════════════════════════════════════════════════

export async function pickByFIFO(input: {
    productId: string
    qtyNeeded: number
    warehouseId?: string
}): Promise<{ success: boolean; picks?: { lotId: string; lotNo: string; locationCode: string; qty: number }[]; error?: string }> {
    try {
        const where: any = {
            productId: input.productId,
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
        }
        if (input.warehouseId) {
            where.location = { warehouseId: input.warehouseId }
        }

        // FIFO: oldest receivedDate first
        const lots = await prisma.stockLot.findMany({
            where,
            include: { location: { select: { locationCode: true } } },
            orderBy: { receivedDate: 'asc' },
        })

        let remaining = input.qtyNeeded
        const picks: { lotId: string; lotNo: string; locationCode: string; qty: number }[] = []

        for (const lot of lots) {
            if (remaining <= 0) break
            const available = Number(lot.qtyAvailable)
            const pick = Math.min(available, remaining)
            picks.push({
                lotId: lot.id,
                lotNo: lot.lotNo,
                locationCode: lot.location.locationCode,
                qty: pick,
            })
            remaining -= pick
        }

        if (remaining > 0) {
            return { success: false, error: `Thiếu ${remaining} chai (tổng tồn không đủ)` }
        }

        return { success: true, picks }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// QUARANTINE — Quản lý hàng cách ly
// ═══════════════════════════════════════════════════

export async function moveToQuarantine(input: {
    lotId: string
    qty: number
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const lot = await prisma.stockLot.findUnique({ where: { id: input.lotId } })
        if (!lot) return { success: false, error: 'Lot không tồn tại' }
        if (Number(lot.qtyAvailable) < input.qty) {
            return { success: false, error: `Không đủ tồn (available: ${lot.qtyAvailable})` }
        }

        await prisma.$transaction(async (tx) => {
            // Reduce available qty
            if (input.qty >= Number(lot.qtyAvailable)) {
                // Move entire lot to quarantine
                await tx.stockLot.update({
                    where: { id: input.lotId },
                    data: { status: 'QUARANTINE', qtyAvailable: 0 },
                })
            } else {
                await tx.stockLot.update({
                    where: { id: input.lotId },
                    data: { qtyAvailable: { decrement: input.qty } },
                })
            }

            // Create quarantine lot
            const count = await tx.stockLot.count()
            await tx.stockLot.create({
                data: {
                    lotNo: `QRT-${String(count + 1).padStart(6, '0')}`,
                    productId: lot.productId,
                    locationId: lot.locationId,
                    shipmentId: lot.shipmentId,
                    qtyReceived: input.qty,
                    qtyAvailable: input.qty,
                    unitLandedCost: lot.unitLandedCost,
                    receivedDate: new Date(),
                    status: 'QUARANTINE',
                },
            })
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getQuarantinedLots() {
    return prisma.stockLot.findMany({
        where: { status: 'QUARANTINE', qtyAvailable: { gt: 0 } },
        include: {
            product: { select: { skuCode: true, productName: true } },
            location: { select: { locationCode: true, warehouse: { select: { name: true } } } },
        },
        orderBy: { receivedDate: 'desc' },
    })
}

export async function releaseFromQuarantine(
    lotId: string,
    action: 'RESTORE' | 'WRITE_OFF'
): Promise<{ success: boolean; error?: string; needsApproval?: boolean }> {
    try {
        const lot = await prisma.stockLot.findUnique({
            where: { id: lotId },
            include: { product: { select: { skuCode: true, productName: true } } },
        })
        if (!lot || lot.status !== 'QUARANTINE') {
            return { success: false, error: 'Lot không ở trạng thái Quarantine' }
        }

        if (action === 'RESTORE') {
            await prisma.stockLot.update({
                where: { id: lotId },
                data: { status: 'AVAILABLE' },
            })
        } else {
            // WRITE_OFF — check if high-value needs approval
            const writeOffQty = Number(lot.qtyAvailable)
            const writeOffValue = writeOffQty * Number(lot.unitLandedCost)
            const WRITE_OFF_THRESHOLD = 10_000_000 // 10M VND

            if (writeOffValue > WRITE_OFF_THRESHOLD) {
                try {
                    const { submitForApproval } = await import('@/lib/approval')
                    await submitForApproval({
                        docType: 'WRITE_OFF',
                        docId: lotId,
                        requestedBy: 'system',
                        docValue: writeOffValue,
                    })
                    return { success: true, needsApproval: true }
                } catch {
                    // If approval engine fails, proceed with direct write-off
                }
            }

            await prisma.stockLot.update({
                where: { id: lotId },
                data: { status: 'CONSUMED', qtyAvailable: 0 },
            })

            // Auto journal entry: DR 811 / CR 156
            if (writeOffQty > 0) {
                const { generateWriteOffJournal } = await import('../finance/actions')
                generateWriteOffJournal(lotId, writeOffQty, 'Quarantine write-off', 'system').catch(() => { })
            }
        }

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// WRITE-OFF — Ghi nhận hao hụt / bể vỡ
// ═══════════════════════════════════════════════════

export async function writeOffStock(input: {
    lotId: string
    qty: number
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const lot = await prisma.stockLot.findUnique({ where: { id: input.lotId } })
        if (!lot) return { success: false, error: 'Lot không tồn tại' }
        if (Number(lot.qtyAvailable) < input.qty) {
            return { success: false, error: `Không đủ tồn (available: ${lot.qtyAvailable})` }
        }

        const newAvailable = Number(lot.qtyAvailable) - input.qty
        await prisma.stockLot.update({
            where: { id: input.lotId },
            data: {
                qtyAvailable: newAvailable,
                status: newAvailable === 0 ? 'CONSUMED' : 'AVAILABLE',
            },
        })

        // Auto journal entry: DR 811 (Chi phí khác) / CR 156 (Hàng tồn kho)
        const { generateWriteOffJournal } = await import('../finance/actions')
        generateWriteOffJournal(input.lotId, input.qty, input.reason, 'system').catch(() => { })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// STOCK ADJUSTMENT — From cycle count variance
// ═══════════════════════════════════════════════════

export async function adjustStockFromCount(
    sessionId: string
): Promise<{ success: boolean; adjustedLines?: number; error?: string }> {
    try {
        const session = await prisma.stockCountSession.findUnique({
            where: { id: sessionId },
            include: { lines: true },
        })
        if (!session) return { success: false, error: 'Session không tồn tại' }
        if (session.status !== 'COMPLETED') {
            return { success: false, error: 'Phải hoàn tất kiểm kê trước khi điều chỉnh' }
        }

        let adjustedLines = 0

        for (const line of session.lines) {
            if (line.variance === null || Number(line.variance) === 0) continue

            // Find matching lot by product + location
            const lots = await prisma.stockLot.findMany({
                where: {
                    productId: line.productId,
                    location: { locationCode: line.locationCode },
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                },
                orderBy: { receivedDate: 'asc' },
            })

            if (lots.length === 0) continue

            const variance = Number(line.variance)
            if (variance < 0) {
                // Negative variance — reduce stock (shortage)
                let remaining = Math.abs(variance)
                for (const lot of lots) {
                    if (remaining <= 0) break
                    const available = Number(lot.qtyAvailable)
                    const reduce = Math.min(available, remaining)
                    await prisma.stockLot.update({
                        where: { id: lot.id },
                        data: { qtyAvailable: { decrement: reduce } },
                    })
                    remaining -= reduce
                }
            } else {
                // Positive variance — increase oldest lot
                await prisma.stockLot.update({
                    where: { id: lots[0].id },
                    data: { qtyAvailable: { increment: variance } },
                })
            }
            adjustedLines++
        }

        // Mark session as adjusted
        await prisma.stockCountSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED' }, // Could add an ADJUSTED status
        })

        revalidateCache('wms')
        revalidatePath('/dashboard/warehouse')
        return { success: true, adjustedLines }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// ENHANCED WMS STATS
// ═══════════════════════════════════════════════════

export async function getWMSFullStats() {
    const [
        warehouseCount,
        locationCount,
        stockLots,
        quarantinedCount,
        lowStockProducts,
        recentGRs,
        recentDOs,
    ] = await Promise.all([
        prisma.warehouse.count(),
        prisma.location.count(),

        prisma.stockLot.findMany({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            select: { qtyAvailable: true, unitLandedCost: true },
        }),

        prisma.stockLot.count({
            where: { status: 'QUARANTINE', qtyAvailable: { gt: 0 } },
        }),

        // Products with less than 12 bottles available
        prisma.stockLot.groupBy({
            by: ['productId'],
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
            having: { qtyAvailable: { _sum: { lt: 12 } } },
        }),

        prisma.goodsReceipt.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        }),

        prisma.deliveryOrder.count({
            where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        }),
    ])

    const totalQty = stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
    const totalValue = stockLots.reduce(
        (s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0
    )

    return {
        warehouseCount,
        locationCount,
        totalQty,
        totalValue,
        distinctSKUs: new Set(stockLots).size,
        quarantinedLots: quarantinedCount,
        lowStockAlerts: lowStockProducts.length,
        recentGRsThisWeek: recentGRs,
        recentDOsThisWeek: recentDOs,
    }
}

// ═══════════════════════════════════════════════════
// #25 — MOBILE SCANNER (PWA Backend)
// ═══════════════════════════════════════════════════

export type ScanResult = {
    found: boolean
    type: 'PRODUCT' | 'LOT' | 'LOCATION' | 'UNKNOWN'
    product?: {
        id: string
        skuCode: string
        productName: string
        wineType: string
        country: string
        vintage: number | null
    }
    stock?: {
        totalAvailable: number
        totalValue: number
        lots: { lotNo: string; location: string; qty: number; receivedDate: Date }[]
    }
    location?: {
        id: string
        locationCode: string
        zone: string
        warehouseName: string
        stockCount: number
    }
}

export async function scanBarcode(code: string): Promise<ScanResult> {
    const trimmed = code.trim()

    // 1. Try product lookup by SKU
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { skuCode: trimmed },
                { skuCode: { contains: trimmed, mode: 'insensitive' } },
            ],
            deletedAt: null,
        },
        select: {
            id: true, skuCode: true, productName: true, wineType: true,
            country: true, vintage: true,
        },
    })

    if (product) {
        const lots = await prisma.stockLot.findMany({
            where: { productId: product.id, status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            include: { location: { select: { locationCode: true } } },
            orderBy: { receivedDate: 'asc' },
        })
        const totalAvailable = lots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
        const totalValue = lots.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)

        return {
            found: true,
            type: 'PRODUCT',
            product: { ...product, wineType: product.wineType ?? 'OTHER', country: product.country ?? '' },
            stock: {
                totalAvailable,
                totalValue,
                lots: lots.map(l => ({
                    lotNo: l.lotNo,
                    location: l.location.locationCode,
                    qty: Number(l.qtyAvailable),
                    receivedDate: l.receivedDate,
                })),
            },
        }
    }

    // 2. Try lot lookup
    const lot = await prisma.stockLot.findFirst({
        where: { lotNo: trimmed },
        include: {
            product: { select: { id: true, skuCode: true, productName: true, wineType: true, country: true, vintage: true } },
            location: { select: { locationCode: true } },
        },
    })

    if (lot) {
        return {
            found: true,
            type: 'LOT',
            product: { ...lot.product, wineType: lot.product.wineType ?? 'OTHER', country: lot.product.country ?? '' },
            stock: {
                totalAvailable: Number(lot.qtyAvailable),
                totalValue: Number(lot.qtyAvailable) * Number(lot.unitLandedCost),
                lots: [{
                    lotNo: lot.lotNo,
                    location: lot.location.locationCode,
                    qty: Number(lot.qtyAvailable),
                    receivedDate: lot.receivedDate,
                }],
            },
        }
    }

    // 3. Try location lookup
    const location = await prisma.location.findFirst({
        where: { locationCode: trimmed },
        include: {
            warehouse: { select: { name: true } },
            stockLots: { where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } }, select: { id: true } },
        },
    })

    if (location) {
        return {
            found: true,
            type: 'LOCATION',
            location: {
                id: location.id,
                locationCode: location.locationCode,
                zone: location.zone,
                warehouseName: location.warehouse.name,
                stockCount: location.stockLots.length,
            },
        }
    }

    return { found: false, type: 'UNKNOWN' }
}

export async function quickStockCheck(productId: string) {
    const lots = await prisma.stockLot.findMany({
        where: { productId, status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
        include: { location: { include: { warehouse: { select: { name: true } } } } },
        orderBy: { receivedDate: 'asc' },
    })

    return {
        totalAvailable: lots.reduce((s, l) => s + Number(l.qtyAvailable), 0),
        locations: lots.map(l => ({
            lotNo: l.lotNo,
            warehouse: l.location.warehouse.name,
            location: l.location.locationCode,
            zone: l.location.zone,
            qty: Number(l.qtyAvailable),
            daysInStock: Math.floor((Date.now() - l.receivedDate.getTime()) / 86400000),
        })),
    }
}

// ═══════════════════════════════════════════════════
// GR VARIANCE REPORT — PO Ordered vs Actual Received
// ═══════════════════════════════════════════════════

export type GRVarianceRow = {
    grId: string
    grNo: string
    poNo: string
    supplierName: string
    warehouseName: string
    receivedDate: Date
    lines: {
        productId: string
        skuCode: string
        productName: string
        qtyOrdered: number
        qtyReceived: number
        variance: number
        variancePct: number
        status: 'OK' | 'SHORT' | 'SURPLUS'
    }[]
    totalOrdered: number
    totalReceived: number
    totalVariance: number
    hasIssues: boolean
}

export async function getGRVarianceReport(filters: {
    warehouseId?: string
    dateFrom?: string
    dateTo?: string
} = {}): Promise<{ success: boolean; rows?: GRVarianceRow[]; error?: string }> {
    try {
        const where: any = { status: 'CONFIRMED' }
        if (filters.warehouseId) where.warehouseId = filters.warehouseId
        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {}
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
            if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
        }

        const grs = await prisma.goodsReceipt.findMany({
            where,
            include: {
                po: {
                    select: {
                        poNo: true,
                        supplier: { select: { name: true } },
                        lines: { select: { productId: true, qtyOrdered: true } },
                    },
                },
                warehouse: { select: { name: true } },
                lines: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })

        const rows: GRVarianceRow[] = grs.map(gr => {
            // Build PO ordered map: productId → total ordered
            const orderedMap: Record<string, number> = {}
            for (const poLine of gr.po.lines) {
                orderedMap[poLine.productId] = (orderedMap[poLine.productId] ?? 0) + Number(poLine.qtyOrdered)
            }

            // Build GR lines with variance
            const allProductIds = new Set([...Object.keys(orderedMap), ...gr.lines.map(l => l.productId)])
            const lines: GRVarianceRow['lines'] = []
            let totalOrdered = 0
            let totalReceived = 0
            let hasIssues = false

            for (const pid of allProductIds) {
                const grLine = gr.lines.find(l => l.productId === pid)
                const qtyOrdered = orderedMap[pid] ?? 0
                const qtyReceived = grLine ? Number(grLine.qtyReceived) : 0
                const variance = qtyReceived - qtyOrdered
                const variancePct = qtyOrdered > 0 ? (variance / qtyOrdered) * 100 : 0
                const status = variance === 0 ? 'OK' : variance < 0 ? 'SHORT' : 'SURPLUS'

                if (status !== 'OK') hasIssues = true
                totalOrdered += qtyOrdered
                totalReceived += qtyReceived

                lines.push({
                    productId: pid,
                    skuCode: grLine?.product.skuCode ?? '—',
                    productName: grLine?.product.productName ?? '—',
                    qtyOrdered,
                    qtyReceived,
                    variance,
                    variancePct: Math.round(variancePct * 10) / 10,
                    status,
                })
            }

            return {
                grId: gr.id,
                grNo: gr.grNo,
                poNo: gr.po.poNo,
                supplierName: gr.po.supplier.name,
                warehouseName: gr.warehouse.name,
                receivedDate: gr.createdAt,
                lines: lines.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
                totalOrdered,
                totalReceived,
                totalVariance: totalReceived - totalOrdered,
                hasIssues,
            }
        })

        return { success: true, rows }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
