'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { serialize } from '@/lib/serialize'
import { requireAuth } from '@/lib/session'

export type ReturnOrderRow = {
    id: string; returnNo: string; soNo: string; soId: string
    customerName: string; customerId: string; reason: string
    status: string; totalAmount: number; lineCount: number
    createdAt: Date; creditNoteNo: string | null
}

// ── List return orders ─────────────────────────────
export async function getReturnOrders(): Promise<ReturnOrderRow[]> {
    return cached('returns:list', async () => {
        const orders = await prisma.returnOrder.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                so: { select: { soNo: true } },
                customer: { select: { name: true } },
                lines: { select: { id: true } },
                creditNote: { select: { creditNoteNo: true } },
            },
        })

        return orders.map(o => ({
            id: o.id,
            returnNo: o.returnNo,
            soNo: o.so.soNo,
            soId: o.soId,
            customerName: o.customer.name,
            customerId: o.customerId,
            reason: o.reason,
            status: o.status,
            totalAmount: Number(o.totalAmount),
            lineCount: o.lines.length,
            createdAt: o.createdAt,
            creditNoteNo: o.creditNote?.creditNoteNo ?? null,
        }))
    }) // end cached
}

// ── Create return order ──────────────────────────
export async function createReturnOrder(input: {
    soId: string
    reason: string
    lines: { productId: string; qtyReturned: number; unitPrice: number; reason?: string; condition?: string }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()
        const so = await prisma.salesOrder.findUnique({
            where: { id: input.soId },
            select: { soNo: true, customerId: true },
        })
        if (!so) return { success: false, error: 'SO not found' }

        const lastRet = await prisma.returnOrder.findFirst({
            where: { returnNo: { startsWith: 'RET-' } },
            orderBy: { returnNo: 'desc' },
            select: { returnNo: true }
        })
        let nextSeq = 1
        if (lastRet) {
            const parts = lastRet.returnNo.split('-')
            const parsed = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(parsed)) nextSeq = parsed + 1
        }
        const returnNo = `RET-${String(nextSeq).padStart(6, '0')}`
        const totalAmount = input.lines.reduce((s, l) => s + l.qtyReturned * l.unitPrice, 0)

        await prisma.returnOrder.create({
            data: {
                returnNo,
                soId: input.soId,
                customerId: so.customerId,
                reason: input.reason,
                totalAmount,
                lines: {
                    create: input.lines.map(l => ({
                        productId: l.productId,
                        qtyReturned: l.qtyReturned,
                        unitPrice: l.unitPrice,
                        reason: l.reason ?? null,
                        condition: l.condition ?? 'GOOD',
                    })),
                },
            },
        })

        revalidateCache('returns')
        revalidatePath('/dashboard/returns')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Approve return → Create credit note + Quarantine stock ──────────
export async function approveReturnOrder(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAuth()
        const ro = await prisma.returnOrder.findUnique({
            where: { id },
            include: {
                lines: { include: { product: { select: { skuCode: true, productName: true } } } },
                so: { select: { soNo: true, legalEntityId: true } },
            },
        })
        if (!ro) return { success: false, error: 'Return order not found' }
        if (ro.status !== 'DRAFT' && ro.status !== 'PENDING_INSPECTION') {
            return { success: false, error: 'Can only approve DRAFT or PENDING_INSPECTION' }
        }

        await prisma.$transaction(async (tx) => {
            const lastCN = await tx.creditNote.findFirst({
                where: { creditNoteNo: { startsWith: 'CN-' } },
                orderBy: { creditNoteNo: 'desc' },
                select: { creditNoteNo: true }
            })
            let nextCNSeq = 1
            if (lastCN) {
                const parts = lastCN.creditNoteNo.split('-')
                const parsed = parseInt(parts[parts.length - 1], 10)
                if (!isNaN(parsed)) nextCNSeq = parsed + 1
            }
            const creditNoteNo = `CN-${String(nextCNSeq).padStart(6, '0')}`

            // 1. Update return order status
            await tx.returnOrder.update({
                where: { id },
                data: { status: 'APPROVED', approvedAt: new Date() },
            })

            // 2. Create Credit Note
            await tx.creditNote.create({
                data: {
                    creditNoteNo,
                    returnOrderId: id,
                    customerId: ro.customerId,
                    amount: ro.totalAmount,
                    status: 'ISSUED',
                    issuedAt: new Date(),
                },
            })

            let qrtLocation = await tx.location.findFirst({ where: { type: 'QUARANTINE' } })
            if (!qrtLocation) {
                qrtLocation = await tx.location.findFirst({ orderBy: { locationCode: 'asc' } })
            }
            if (!qrtLocation) {
                throw new Error('Hệ thống chưa có bất kỳ vị trí kho nào để lưu giữ hàng trả lại.')
            }

            // 3. WMS: Create QUARANTINE stock lots for returned items
            for (const line of ro.lines) {
                // Find original lot for this product to get warehouse/location/cost info
                const originalLot = await tx.stockLot.findFirst({
                    where: { productId: line.productId, status: { in: ['AVAILABLE', 'RESERVED'] } },
                    orderBy: { receivedDate: 'desc' },
                    select: { locationId: true, shipmentId: true, unitLandedCost: true, ownerEntityId: true },
                })

                const lastQrtLot = await tx.stockLot.findFirst({
                    where: { lotNo: { startsWith: 'QRT-RET-' } },
                    orderBy: { lotNo: 'desc' },
                    select: { lotNo: true }
                })
                let nextQrtSeq = 1
                if (lastQrtLot) {
                    const parts = lastQrtLot.lotNo.split('-')
                    const parsed = parseInt(parts[parts.length - 1], 10)
                    if (!isNaN(parsed)) nextQrtSeq = parsed + 1
                }
                const lotNo = `QRT-RET-${String(nextQrtSeq).padStart(6, '0')}`

                await tx.stockLot.create({
                    data: {
                        lotNo,
                        ownerEntityId: originalLot?.ownerEntityId ?? ro.so.legalEntityId,
                        productId: line.productId,
                        locationId: originalLot?.locationId ?? qrtLocation.id,
                        shipmentId: originalLot?.shipmentId ?? null,
                        qtyReceived: line.qtyReturned,
                        qtyAvailable: line.qtyReturned,
                        unitLandedCost: originalLot?.unitLandedCost ?? line.unitPrice,
                        receivedDate: new Date(),
                        status: 'QUARANTINE',
                    },
                })
            }
        })

        revalidatePath('/dashboard/returns')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Stats ─────────────────────────────────────────
export async function getReturnStats() {
    return cached('returns:stats', async () => {
        const [total, pending, approved, totalValue] = await Promise.all([
            prisma.returnOrder.count(),
            prisma.returnOrder.count({ where: { status: { in: ['DRAFT', 'PENDING_INSPECTION'] } } }),
            prisma.returnOrder.count({ where: { status: 'APPROVED' } }),
            prisma.creditNote.aggregate({ _sum: { amount: true } }),
        ])
        return { total, pending, approved, totalCredited: Number(totalValue._sum.amount ?? 0) }
    }) // end cached
}

// ── SO options ────────────────────────────────────
export async function getSOOptionsForReturn() {
    const raw = await prisma.salesOrder.findMany({
        where: { status: { in: ['DELIVERED', 'INVOICED', 'PAID'] } },
        select: { id: true, soNo: true, customerId: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
    return serialize(raw)
}

// ── Product options from SO lines ─────────────────
export async function getSOLinesForReturn(soId: string) {
    const raw = await prisma.salesOrderLine.findMany({
        where: { soId },
        select: {
            productId: true,
            qtyOrdered: true,
            unitPrice: true,
            product: { select: { skuCode: true, productName: true } },
        },
    })
    return serialize(raw)
}
