'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type MarketPriceRow = {
    id: string
    productId: string
    skuCode: string
    productName: string
    marketPrice: number
    currency: string
    source: string
    priceDate: Date
    landedCost: number | null
    listPrice: number | null
    marginGap: number | null   // (marketPrice - landedCost) / marketPrice * 100
    isBelowCost: boolean
}

export async function getMarketPrices(): Promise<MarketPriceRow[]> {
    // Get latest market price per product
    const prices = await prisma.marketPrice.findMany({
        orderBy: { priceDate: 'desc' },
        include: {
            product: {
                select: {
                    skuCode: true, productName: true,
                    priceLines: {
                        select: { unitPrice: true },
                        take: 1,
                    },
                },
            },
        },
        take: 200,
    })

    // Get avg landed cost per product from StockLots
    const productIds = [...new Set(prices.map(p => p.productId))]
    const costData = await prisma.stockLot.groupBy({
        by: ['productId'],
        where: {
            productId: { in: productIds },
            status: 'AVAILABLE',
            qtyAvailable: { gt: 0 },
        },
        _avg: { unitLandedCost: true },
    })
    const costMap = new Map(costData.map(c => [c.productId, Number(c._avg.unitLandedCost ?? 0)]))

    // Deduplicate: keep only latest per product
    const seen = new Set<string>()
    const result: MarketPriceRow[] = []

    for (const p of prices) {
        if (seen.has(p.productId)) continue
        seen.add(p.productId)

        const mp = Number(p.price)
        const lc = costMap.get(p.productId) ?? null
        const lp = p.product.priceLines.length > 0 ? Number(p.product.priceLines[0].unitPrice) : null
        const marginGap = lc && mp > 0 ? ((mp - lc) / mp) * 100 : null
        const isBelowCost = lc !== null && lp !== null && lp < lc

        result.push({
            id: p.id,
            productId: p.productId,
            skuCode: p.product.skuCode,
            productName: p.product.productName,
            marketPrice: mp,
            currency: p.currency,
            source: p.source,
            priceDate: p.priceDate,
            landedCost: lc,
            listPrice: lp,
            marginGap,
            isBelowCost,
        })
    }

    return result
}

export async function addMarketPrice(input: {
    productId: string
    price: number
    currency?: string
    source: string
    priceDate: string
    enteredBy: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.marketPrice.create({
            data: {
                productId: input.productId,
                price: input.price,
                currency: input.currency ?? 'VND',
                source: input.source,
                priceDate: new Date(input.priceDate),
                enteredBy: input.enteredBy,
            },
        })
        revalidatePath('/dashboard/market-price')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getMarketPriceStats() {
    const [total, belowCost, sources] = await Promise.all([
        prisma.marketPrice.count(),
        // Count products where list price < landed cost
        prisma.product.count({
            where: {
                marketPrices: { some: {} },
            },
        }),
        prisma.marketPrice.groupBy({
            by: ['source'],
            _count: true,
        }),
    ])

    return {
        totalEntries: total,
        trackedProducts: belowCost,
        sourceBreakdown: sources.map(s => ({ source: s.source, count: s._count })),
    }
}

export async function getProductOptions() {
    return prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true },
        orderBy: { skuCode: 'asc' },
        take: 200,
    })
}
