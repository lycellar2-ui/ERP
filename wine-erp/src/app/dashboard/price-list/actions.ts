'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { getCurrentUser } from '@/lib/session'

export type PriceListRow = {
    id: string
    name: string
    channel: string
    effectiveDate: Date
    expiryDate: Date | null
    itemCount: number
    createdAt: Date
}

export type PriceListLineRow = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitPrice: number
    currency: string
}

// ── List Price Lists ─────────────────────────────
export async function getPriceLists(): Promise<PriceListRow[]> {
    const lists = await prisma.priceList.findMany({
        include: { _count: { select: { lines: true } } },
        orderBy: { createdAt: 'desc' },
    })

    return lists.map(pl => ({
        id: pl.id,
        name: pl.name,
        channel: pl.channel,
        effectiveDate: pl.effectiveDate,
        expiryDate: pl.expiryDate,
        itemCount: pl._count.lines,
        createdAt: pl.createdAt,
    }))
}

// ── Get Price List Detail ────────────────────────
export async function getPriceListDetail(id: string) {
    const pl = await prisma.priceList.findUnique({
        where: { id },
        include: {
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } },
                },
                orderBy: { product: { productName: 'asc' } },
            },
        },
    })
    if (!pl) return null

    return {
        ...pl,
        lines: pl.lines.map(l => ({
            id: l.id,
            productId: l.productId,
            skuCode: l.product.skuCode,
            productName: l.product.productName,
            unitPrice: Number(l.unitPrice),
            currency: l.currency,
        })),
    }
}

// ── Create Price List ────────────────────────────
export async function createPriceList(input: {
    name: string
    channel: string
    effectiveDate: string
    expiryDate?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const pl = await prisma.priceList.create({
            data: {
                name: input.name,
                channel: input.channel as any,
                effectiveDate: new Date(input.effectiveDate),
                expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
            },
        })
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'PriceList', entityId: pl.id, newValue: { name: input.name, channel: input.channel, effectiveDate: input.effectiveDate } })
        revalidatePath('/dashboard/price-list')
        return { success: true, id: pl.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Add/Update line in price list ────────────────
export async function upsertPriceListLine(input: {
    priceListId: string
    productId: string
    unitPrice: number
    currency?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await prisma.priceListLine.findUnique({
            where: { priceListId_productId: { priceListId: input.priceListId, productId: input.productId } },
        })

        const user = await getCurrentUser().catch(() => null)
        if (existing) {
            const oldPrice = Number(existing.unitPrice)
            await prisma.priceListLine.update({
                where: { id: existing.id },
                data: { unitPrice: input.unitPrice, currency: input.currency ?? 'VND' },
            })
            if (oldPrice !== input.unitPrice) {
                const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { skuCode: true, productName: true } })
                logAudit({ userId: user?.id, userName: user?.name, action: 'UPDATE', entityType: 'PriceListLine', entityId: existing.id, oldValue: { unitPrice: oldPrice, sku: product?.skuCode }, newValue: { unitPrice: input.unitPrice, sku: product?.skuCode, productName: product?.productName } })
            }
        } else {
            await prisma.priceListLine.create({
                data: {
                    priceListId: input.priceListId,
                    productId: input.productId,
                    unitPrice: input.unitPrice,
                    currency: input.currency ?? 'VND',
                },
            })
        }

        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Remove line from price list ──────────────────
export async function removePriceListLine(lineId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const line = await prisma.priceListLine.findUnique({ where: { id: lineId }, include: { product: { select: { skuCode: true, productName: true } } } })
        await prisma.priceListLine.delete({ where: { id: lineId } })
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'DELETE', entityType: 'PriceListLine', entityId: lineId, oldValue: { unitPrice: line ? Number(line.unitPrice) : null, sku: line?.product?.skuCode, productName: line?.product?.productName } })
        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get price for a product by channel ───────────
export async function getProductPrice(productId: string, channel: string): Promise<number | null> {
    const now = new Date()
    const priceList = await prisma.priceList.findFirst({
        where: {
            channel: channel as any,
            effectiveDate: { lte: now },
            OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        include: {
            lines: {
                where: { productId },
                take: 1,
            },
        },
        orderBy: { effectiveDate: 'desc' },
    })

    if (!priceList || priceList.lines.length === 0) return null
    return Number(priceList.lines[0].unitPrice)
}

// ── Get products for adding to price list ────────
export async function getProductsForPriceList() {
    return prisma.product.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, skuCode: true, productName: true, wineType: true, volumeMl: true },
        orderBy: { productName: 'asc' },
    })
}

// ── Delete Price List ────────────────────────────
export async function deletePriceList(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const pl = await prisma.priceList.findUnique({ where: { id }, include: { _count: { select: { lines: true } } } })
        // Delete all lines first, then the list
        await prisma.$transaction([
            prisma.priceListLine.deleteMany({ where: { priceListId: id } }),
            prisma.priceList.delete({ where: { id } }),
        ])
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'DELETE', entityType: 'PriceList', entityId: id, oldValue: { name: pl?.name, channel: pl?.channel, lineCount: pl?._count?.lines } })
        revalidatePath('/dashboard/price-list')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Price History for a product ──────────────────
export async function getProductPriceHistory(productId: string) {
    const lines = await prisma.priceListLine.findMany({
        where: { productId },
        include: {
            priceList: { select: { name: true, channel: true, effectiveDate: true, expiryDate: true } },
        },
        orderBy: { priceList: { effectiveDate: 'desc' } },
    })

    return lines.map(l => ({
        priceListName: l.priceList.name,
        channel: l.priceList.channel,
        unitPrice: Number(l.unitPrice),
        currency: l.currency,
        effectiveDate: l.priceList.effectiveDate,
        expiryDate: l.priceList.expiryDate,
        isActive: l.priceList.effectiveDate <= new Date() &&
            (!l.priceList.expiryDate || l.priceList.expiryDate >= new Date()),
    }))
}

// ── Bulk update prices (% increase/decrease) ────
export async function bulkUpdatePrices(priceListId: string, adjustPct: number): Promise<{ success: boolean; updated: number; error?: string }> {
    try {
        const lines = await prisma.priceListLine.findMany({ where: { priceListId }, include: { product: { select: { skuCode: true } } } })
        const multiplier = 1 + adjustPct / 100
        const user = await getCurrentUser().catch(() => null)
        const priceList = await prisma.priceList.findUnique({ where: { id: priceListId }, select: { name: true } })

        const priceChanges: { sku: string; oldPrice: number; newPrice: number }[] = []
        for (const line of lines) {
            const oldPrice = Number(line.unitPrice)
            const newPrice = Math.round(oldPrice * multiplier)
            await prisma.priceListLine.update({
                where: { id: line.id },
                data: { unitPrice: newPrice },
            })
            priceChanges.push({ sku: line.product.skuCode, oldPrice, newPrice })
        }

        // Log bulk price change as a single critical audit event
        logAudit({
            userId: user?.id, userName: user?.name,
            action: 'UPDATE', entityType: 'PriceList_BulkUpdate', entityId: priceListId,
            oldValue: { priceListName: priceList?.name, adjustPct, totalLines: lines.length, sample: priceChanges.slice(0, 10) },
            newValue: { adjustPct, multiplier, updatedCount: lines.length, allChanges: priceChanges },
        })

        revalidatePath('/dashboard/price-list')
        return { success: true, updated: lines.length }
    } catch (err: any) {
        return { success: false, updated: 0, error: err.message }
    }
}
