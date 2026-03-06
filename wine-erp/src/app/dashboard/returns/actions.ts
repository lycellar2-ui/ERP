'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

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
        const so = await prisma.salesOrder.findUnique({
            where: { id: input.soId },
            select: { soNo: true, customerId: true },
        })
        if (!so) return { success: false, error: 'SO not found' }

        const count = await prisma.returnOrder.count()
        const returnNo = `RET-${String(count + 1).padStart(6, '0')}`
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
        const ro = await prisma.returnOrder.findUnique({
            where: { id },
            include: {
                lines: { include: { product: { select: { skuCode: true, productName: true } } } },
                so: { select: { soNo: true } },
            },
        })
        if (!ro) return { success: false, error: 'Return order not found' }
        if (ro.status !== 'DRAFT' && ro.status !== 'PENDING_INSPECTION') {
            return { success: false, error: 'Can only approve DRAFT or PENDING_INSPECTION' }
        }

        const count = await prisma.creditNote.count()
        const creditNoteNo = `CN-${String(count + 1).padStart(6, '0')}`

        await prisma.$transaction(async (tx) => {
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

            const qrtLocation = await tx.location.findFirst({ where: { type: 'QUARANTINE' } })

            // 3. WMS: Create QUARANTINE stock lots for returned items
            for (const line of ro.lines) {
                // Find original lot for this product to get warehouse/location/cost info
                const originalLot = await tx.stockLot.findFirst({
                    where: { productId: line.productId, status: { in: ['AVAILABLE', 'RESERVED'] } },
                    orderBy: { receivedDate: 'desc' },
                    select: { locationId: true, shipmentId: true, unitLandedCost: true },
                })

                const lotCount = await tx.stockLot.count()
                await tx.stockLot.create({
                    data: {
                        lotNo: `QRT-RET-${String(lotCount + 1).padStart(6, '0')}`,
                        productId: line.productId,
                        locationId: originalLot?.locationId ?? qrtLocation?.id ?? 'UNKNOWN_LOC',
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
    return prisma.salesOrder.findMany({
        where: { status: { in: ['DELIVERED', 'INVOICED', 'PAID'] } },
        select: { id: true, soNo: true, customerId: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
}

// ── Product options from SO lines ─────────────────
export async function getSOLinesForReturn(soId: string) {
    return prisma.salesOrderLine.findMany({
        where: { soId },
        select: {
            productId: true,
            qtyOrdered: true,
            unitPrice: true,
            product: { select: { skuCode: true, productName: true } },
        },
    })
}
