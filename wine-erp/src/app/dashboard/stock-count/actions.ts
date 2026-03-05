'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
    getStockCountSessions, createStockCountSession,
    recordCountLine, completeStockCount, adjustStockFromCount
} from '../warehouse/actions'

export { getStockCountSessions, createStockCountSession, recordCountLine, completeStockCount }

export type StockCountRow = {
    id: string; warehouseId: string; warehouseName: string
    zone: string | null; type: string; status: string
    lineCount: number; startedAt: Date | null
    completedAt: Date | null; createdAt: Date
    totalSystemQty: number; totalActualQty: number; totalVariance: number
}

export async function getStockCountList(): Promise<StockCountRow[]> {
    const sessions = await prisma.stockCountSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            lines: {
                select: { qtySystem: true, qtyActual: true, variance: true },
            },
        },
    })

    const warehouseIds = [...new Set(sessions.map(s => s.warehouseId))]
    const warehouses = await prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, name: true },
    })
    const whMap = new Map(warehouses.map(w => [w.id, w.name]))

    return sessions.map(s => ({
        id: s.id,
        warehouseId: s.warehouseId,
        warehouseName: whMap.get(s.warehouseId) ?? '?',
        zone: s.zone,
        type: s.type,
        status: s.status,
        lineCount: s.lines.length,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
        totalSystemQty: s.lines.reduce((sum, l) => sum + Number(l.qtySystem), 0),
        totalActualQty: s.lines.reduce((sum, l) => sum + Number(l.qtyActual ?? 0), 0),
        totalVariance: s.lines.reduce((sum, l) => sum + Number(l.variance ?? 0), 0),
    }))
}

export async function getStockCountDetail(sessionId: string) {
    const session = await prisma.stockCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
    })
    if (!session) return null

    const warehouse = await prisma.warehouse.findUnique({
        where: { id: session.warehouseId },
        select: { name: true },
    })

    // Join product info manually
    const productIds = [...new Set(session.lines.map(l => l.productId))]
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, skuCode: true, productName: true },
    })
    const pMap = new Map(products.map(p => [p.id, p]))

    return {
        ...session,
        warehouseName: warehouse?.name ?? '?',
        lines: session.lines.map(l => {
            const p = pMap.get(l.productId)
            return {
                id: l.id,
                productId: l.productId,
                skuCode: p?.skuCode ?? '',
                productName: p?.productName ?? '',
                locationCode: l.locationCode,
                qtySystem: Number(l.qtySystem),
                qtyActual: l.qtyActual !== null ? Number(l.qtyActual) : null,
                variance: l.variance !== null ? Number(l.variance) : null,
            }
        }),
    }
}

export async function getCountStats() {
    const [total, inProgress, completed] = await Promise.all([
        prisma.stockCountSession.count(),
        prisma.stockCountSession.count({ where: { status: 'DRAFT' } }),
        prisma.stockCountSession.count({ where: { status: 'COMPLETED' } }),
    ])
    return { total, inProgress, completed }
}

export async function startStockCount(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.stockCountSession.update({
            where: { id: sessionId },
            data: { status: 'IN_PROGRESS', startedAt: new Date() },
        })
        revalidatePath('/dashboard/stock-count')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getWarehouseOptions() {
    return prisma.warehouse.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
    })
}

export { adjustStockFromCount }
