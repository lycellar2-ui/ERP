'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { parseOrThrow, GoodsReceiptCreateSchema } from '@/lib/validations'
import { getCurrentUser } from '@/lib/session'

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
    locationId: string
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

        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: { lines: true },
        })
        if (!po) return { success: false, error: 'PO không tồn tại' }
        if (!['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(po.status)) {
            return { success: false, error: `PO status ${po.status} không cho phép nhập kho` }
        }

        // Generate GR number: GR-YYMM-NNNN (atomic — collision-safe)
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const prefix = `GR-${yy}${mm}-`
        const lastGR = await prisma.goodsReceipt.findFirst({
            where: { grNo: { startsWith: prefix } },
            orderBy: { grNo: 'desc' },
            select: { grNo: true },
        })
        const nextSeq = lastGR ? parseInt(lastGR.grNo.slice(-4)) + 1 : 1
        const grNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

        const result = await prisma.$transaction(async (tx) => {
            const gr = await tx.goodsReceipt.create({
                data: {
                    grNo, poId, warehouseId,
                    shipmentId: shipmentId ?? null,
                    status: 'DRAFT',
                },
            })

            for (const line of lines) {
                const poLine = po.lines.find(l => l.productId === line.productId)
                const qtyExpected = poLine ? Number(poLine.qtyOrdered) : line.qtyReceived

                // Generate unique lot number (atomic — collision-safe)
                const lastLot = await tx.stockLot.findFirst({
                    orderBy: { lotNo: 'desc' },
                    select: { lotNo: true },
                })
                const nextLotSeq = lastLot ? parseInt(lastLot.lotNo.replace(/\D/g, '').slice(-5)) + 1 : 1
                const lotNo = `LOT-${yy}${mm}-${String(nextLotSeq).padStart(5, '0')}`

                const lot = await tx.stockLot.create({
                    data: {
                        lotNo, productId: line.productId,
                        shipmentId: shipmentId ?? null,
                        locationId: line.locationId,
                        qtyReceived: line.qtyReceived,
                        qtyAvailable: line.qtyReceived,
                        unitLandedCost: line.unitLandedCost ?? 0,
                        receivedDate: now, status: 'AVAILABLE',
                    },
                })

                await tx.goodsReceiptLine.create({
                    data: {
                        grId: gr.id, productId: line.productId,
                        lotId: lot.id, qtyExpected,
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
    _confirmerId?: string,
): Promise<{ success: boolean; error?: string }> {
    const user = await getCurrentUser()
    const confirmerId = user?.id ?? _confirmerId ?? 'system'
    try {
        let grNo = ''
        await prisma.$transaction(async (tx) => {
            const gr = await tx.goodsReceipt.update({
                where: { id: grId },
                data: { status: 'CONFIRMED', confirmedBy: confirmerId, confirmedAt: new Date() },
                include: { po: true },
            })
            grNo = gr.grNo

            const poLines = await tx.purchaseOrderLine.findMany({ where: { poId: gr.poId } })
            const grLines = await tx.goodsReceiptLine.findMany({
                where: { gr: { poId: gr.poId, status: 'CONFIRMED' } },
            })
            const totalOrdered = poLines.reduce((s, l) => s + Number(l.qtyOrdered), 0)
            const totalReceived = grLines.reduce((s, l) => s + Number(l.qtyReceived), 0)
            const newStatus = totalReceived >= totalOrdered ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
            await tx.purchaseOrder.update({ where: { id: gr.poId }, data: { status: newStatus as any } })
        })

        logAudit({ userId: confirmerId, action: 'CONFIRM', entityType: 'GoodsReceipt', entityId: grId, description: `Xác nhận nhập kho ${grNo}` })
        const { generateGoodsReceiptJournal } = await import('../finance/actions')
        generateGoodsReceiptJournal(grId, confirmerId).catch(() => { })
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

// ── GR Detail ──────────────────────────────────────
export async function getGRDetail(grId: string) {
    const gr = await prisma.goodsReceipt.findUnique({
        where: { id: grId },
        include: {
            po: { select: { poNo: true, supplier: { select: { name: true } } } },
            warehouse: { select: { name: true } },
            confirmer: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                    lot: { select: { lotNo: true, location: { select: { locationCode: true } } } },
                },
            },
        },
    })
    if (!gr) return null
    return {
        id: gr.id, grNo: gr.grNo, poNo: gr.po.poNo,
        supplierName: gr.po.supplier.name,
        warehouseName: gr.warehouse.name, status: gr.status,
        confirmedBy: gr.confirmer?.name ?? null,
        confirmedAt: gr.confirmedAt, createdAt: gr.createdAt,
        lines: gr.lines.map(l => ({
            id: l.id, productName: l.product.productName, skuCode: l.product.skuCode,
            lotNo: l.lot?.lotNo ?? '—', locationCode: l.lot?.location?.locationCode ?? '—',
            qtyExpected: Number(l.qtyExpected), qtyReceived: Number(l.qtyReceived), variance: Number(l.variance),
        })),
    }
}
