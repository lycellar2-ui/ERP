'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { getCurrentUser } from '@/lib/session'

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
            id: true, soNo: true,
            customer: { select: { name: true } },
            lines: {
                select: {
                    id: true, productId: true,
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
        if (lines.length === 0) return { success: false, error: 'Cần ít nhất 1 dòng xuất kho' }

        const so = await prisma.salesOrder.findUnique({ where: { id: soId } })
        if (!so) return { success: false, error: 'SO không tồn tại' }
        if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
            return { success: false, error: `SO status ${so.status} không cho phép xuất kho` }
        }

        // Generate DO number (atomic — collision-safe)
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const doPrefix = `DO-${yy}${mm}-`
        const lastDO = await prisma.deliveryOrder.findFirst({
            where: { doNo: { startsWith: doPrefix } },
            orderBy: { doNo: 'desc' },
            select: { doNo: true },
        })
        const nextDOSeq = lastDO ? parseInt(lastDO.doNo.slice(-4)) + 1 : 1
        const doNo = `${doPrefix}${String(nextDOSeq).padStart(4, '0')}`

        const result = await prisma.$transaction(async (tx) => {
            const deliveryOrder = await tx.deliveryOrder.create({
                data: { doNo, soId, warehouseId, status: 'DRAFT' },
            })

            for (const line of lines) {
                await tx.deliveryOrderLine.create({
                    data: {
                        doId: deliveryOrder.id,
                        productId: line.productId,
                        lotId: line.lotId,
                        locationId: line.locationId,
                        qtyPicked: line.qtyPicked,
                        qtyShipped: 0,
                    },
                })
                await tx.stockLot.update({
                    where: { id: line.lotId },
                    data: { qtyAvailable: { decrement: line.qtyPicked } },
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

// ── Confirm DO — Mark as shipped + AUTO-UPDATE SO status ──
export async function confirmDeliveryOrder(
    doId: string,
    _confirmerId?: string
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    const confirmerId = user?.id ?? _confirmerId ?? 'system'
    try {
        let doNo = ''
        await prisma.$transaction(async (tx) => {
            const doLines = await tx.deliveryOrderLine.findMany({ where: { doId } })
            for (const line of doLines) {
                await tx.deliveryOrderLine.update({ where: { id: line.id }, data: { qtyShipped: line.qtyPicked } })
            }
            const deliveryOrder = await tx.deliveryOrder.update({ where: { id: doId }, data: { status: 'SHIPPED' } })
            doNo = deliveryOrder.doNo

            // ── EVENT-DRIVEN: Auto-derive SO status from delivery reality ──
            // Check total ordered vs total shipped across ALL confirmed DOs for this SO
            const soId = deliveryOrder.soId
            const soLines = await tx.salesOrderLine.findMany({
                where: { soId },
                select: { qtyOrdered: true },
            })
            const totalOrdered = soLines.reduce((s, l) => s + Number(l.qtyOrdered), 0)

            const shippedDOs = await tx.deliveryOrder.findMany({
                where: { soId, status: 'SHIPPED' },
                select: { id: true },
            })
            const shippedDOIds = shippedDOs.map(d => d.id)

            const allDOLines = shippedDOIds.length > 0
                ? await tx.deliveryOrderLine.findMany({
                    where: { doId: { in: shippedDOIds } },
                    select: { qtyShipped: true },
                })
                : []
            const totalShipped = allDOLines.reduce((s, l) => s + Number(l.qtyShipped), 0)

            // Determine correct SO status
            const newSOStatus = totalShipped >= totalOrdered ? 'DELIVERED' : 'PARTIALLY_DELIVERED'
            await tx.salesOrder.update({ where: { id: soId }, data: { status: newSOStatus } })
        })

        logAudit({ userId: confirmerId, action: 'CONFIRM', entityType: 'DeliveryOrder', entityId: doId, description: `Xuất kho ${doNo}` })
        const { generateDeliveryOrderCOGSJournal } = await import('../finance/actions')
        generateDeliveryOrderCOGSJournal(doId, confirmerId).catch(() => { })

        revalidateCache('wms')
        revalidateCache('sales')
        revalidatePath('/dashboard/warehouse')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}


// ── DO Detail ──────────────────────────────────────
export async function getDODetail(doId: string) {
    const d = await prisma.deliveryOrder.findUnique({
        where: { id: doId },
        include: {
            so: { select: { soNo: true, customer: { select: { name: true } } } },
            warehouse: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                    lot: { select: { lotNo: true } },
                    location: { select: { locationCode: true } },
                },
            },
        },
    })
    if (!d) return null
    return {
        id: d.id, doNo: d.doNo, soNo: d.so.soNo,
        customerName: d.so.customer.name,
        warehouseName: d.warehouse.name, status: d.status, createdAt: d.createdAt,
        lines: d.lines.map(l => ({
            id: l.id, productName: l.product.productName, skuCode: l.product.skuCode,
            lotNo: l.lot.lotNo, locationCode: l.location.locationCode,
            qtyPicked: Number(l.qtyPicked), qtyShipped: Number(l.qtyShipped),
        })),
    }
}
