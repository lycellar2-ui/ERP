'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

export type TransferOrderRow = {
    id: string; transferNo: string
    fromWarehouse: string; fromWarehouseId: string
    toWarehouse: string; toWarehouseId: string
    status: string; notes: string | null; lineCount: number
    totalQty: number; createdAt: Date
}

// ── List ──────────────────────────────────────────
export async function getTransferOrders(): Promise<TransferOrderRow[]> {
    return cached('transfers:list', async () => {
        const orders = await prisma.transferOrder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
                lines: { select: { qtyTransferred: true } },
            },
        })
        return orders.map(o => ({
            id: o.id,
            transferNo: o.transferNo,
            fromWarehouse: o.fromWarehouse.name,
            fromWarehouseId: o.fromWarehouseId,
            toWarehouse: o.toWarehouse.name,
            toWarehouseId: o.toWarehouseId,
            status: o.status,
            notes: o.notes,
            lineCount: o.lines.length,
            totalQty: o.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0),
            createdAt: o.createdAt,
        }))
    }) // end cached
}

// ── Stats ─────────────────────────────────────────
export async function getTransferStats() {
    return cached('transfers:stats', async () => {
        const [total, inTransit, completed] = await Promise.all([
            prisma.transferOrder.count(),
            prisma.transferOrder.count({ where: { status: 'IN_TRANSIT' } }),
            prisma.transferOrder.count({ where: { status: 'RECEIVED' } }),
        ])
        return { total, inTransit, completed }
    }) // end cached
}

// ── Create ────────────────────────────────────────
export async function createTransferOrder(input: {
    fromWarehouseId: string; toWarehouseId: string; notes?: string
    lines: { productId: string; qtyTransferred: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (input.fromWarehouseId === input.toWarehouseId)
            return { success: false, error: 'Kho xuất và kho nhận phải khác nhau' }

        const now = new Date()
        const prefix = `TO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`
        const count = await prisma.transferOrder.count()
        const transferNo = `${prefix}-${String(count + 1).padStart(4, '0')}`

        await prisma.transferOrder.create({
            data: {
                transferNo,
                fromWarehouseId: input.fromWarehouseId,
                toWarehouseId: input.toWarehouseId,
                notes: input.notes ?? null,
                lines: {
                    create: input.lines.map(l => ({
                        productId: l.productId,
                        qtyTransferred: l.qtyTransferred,
                    })),
                },
            },
        })
        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Advance Status ────────────────────────────────
export async function advanceTransferStatus(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const to = await prisma.transferOrder.findUnique({
            where: { id },
            include: { lines: { include: { product: { select: { skuCode: true } } } } },
        })
        if (!to) return { success: false, error: 'Not found' }

        const nextMap: Record<string, string> = {
            'DRAFT': 'CONFIRMED',
            'CONFIRMED': 'IN_TRANSIT',
            'IN_TRANSIT': 'RECEIVED',
        }
        const next = nextMap[to.status]
        if (!next) return { success: false, error: 'Không thể chuyển trạng thái' }

        if (next === 'CONFIRMED') {
            // Decrement source warehouse stock (FIFO)
            for (const line of to.lines) {
                let remaining = Number(line.qtyTransferred)
                const lots = await prisma.stockLot.findMany({
                    where: {
                        productId: line.productId,
                        status: 'AVAILABLE',
                        qtyAvailable: { gt: 0 },
                        location: { warehouseId: to.fromWarehouseId },
                    },
                    orderBy: { receivedDate: 'asc' },
                })

                for (const lot of lots) {
                    if (remaining <= 0) break
                    const take = Math.min(Number(lot.qtyAvailable), remaining)
                    await prisma.stockLot.update({
                        where: { id: lot.id },
                        data: { qtyAvailable: { decrement: take } },
                    })
                    remaining -= take
                }
                if (remaining > 0) {
                    return { success: false, error: `Không đủ tồn kho cho ${line.product.skuCode} (thiếu ${remaining})` }
                }
            }
        }

        if (next === 'RECEIVED') {
            // Create stock lots in destination warehouse
            const destLocation = await prisma.location.findFirst({
                where: { warehouseId: to.toWarehouseId },
                orderBy: { locationCode: 'asc' },
            })
            if (!destLocation) return { success: false, error: 'Kho nhận chưa có location' }

            for (const line of to.lines) {
                // Get the source lots used for FIFO picking and their costs
                const sourceLots = await prisma.stockLot.findMany({
                    where: {
                        productId: line.productId,
                        status: 'AVAILABLE',
                        qtyAvailable: { gt: 0 },
                        location: { warehouseId: to.fromWarehouseId },
                    },
                    orderBy: { receivedDate: 'asc' },
                    take: 1,
                })
                const avgLandedCost = sourceLots.length > 0
                    ? Number(sourceLots[0].unitLandedCost)
                    : 0

                const lotCount = await prisma.stockLot.count()
                await prisma.stockLot.create({
                    data: {
                        lotNo: `TRF-${String(lotCount + 1).padStart(6, '0')}`,
                        productId: line.productId,
                        locationId: destLocation.id,
                        qtyReceived: line.qtyTransferred,
                        qtyAvailable: line.qtyTransferred,
                        unitLandedCost: avgLandedCost,
                        receivedDate: new Date(),
                        status: 'AVAILABLE',
                    },
                })
            }
        }

        const data: any = { status: next }
        if (next === 'CONFIRMED') data.confirmedAt = new Date()
        if (next === 'RECEIVED') data.receivedAt = new Date()

        await prisma.transferOrder.update({ where: { id }, data })
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Options ───────────────────────────────────────
export async function getTransferOptions() {
    return cached('transfers:options', async () => {
        const [warehouses, products] = await Promise.all([
            prisma.warehouse.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
            prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { id: true, skuCode: true, productName: true }, orderBy: { skuCode: 'asc' } }),
        ])
        return { warehouses, products }
    }) // end cached
}

// ── Cancel ──────────────────────────────────────
export async function cancelTransferOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const to = await prisma.transferOrder.findUnique({ where: { id } })
        if (!to) return { success: false, error: 'Not found' }
        if (to.status !== 'DRAFT') return { success: false, error: 'Chỉ có thể hủy lệnh ở trạng thái Nháp' }
        await prisma.transferOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
        revalidateCache('transfers')
        revalidatePath('/dashboard/transfers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Detail ─────────────────────────────────────
export async function getTransferDetail(id: string) {
    const to = await prisma.transferOrder.findUnique({
        where: { id },
        include: {
            fromWarehouse: { select: { name: true, code: true } },
            toWarehouse: { select: { name: true, code: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                },
            },
        },
    })
    if (!to) return null
    return {
        id: to.id,
        transferNo: to.transferNo,
        fromWarehouse: `${to.fromWarehouse.code} — ${to.fromWarehouse.name}`,
        toWarehouse: `${to.toWarehouse.code} — ${to.toWarehouse.name}`,
        status: to.status,
        notes: to.notes,
        confirmedAt: to.confirmedAt,
        receivedAt: to.receivedAt,
        createdAt: to.createdAt,
        lines: to.lines.map(l => ({
            id: l.id,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            qtyTransferred: Number(l.qtyTransferred),
            qtyReceived: Number(l.qtyReceived),
        })),
    }
}
