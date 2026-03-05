// Server Actions cho Products module — khớp với Prisma schema
'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────
export type ProductRow = {
    id: string
    skuCode: string
    productName: string
    vintage: number | null
    wineType: string
    format: string
    packagingType: string
    unitsPerCase: number
    abvPercent: number | null
    producerName: string
    producerCountry: string
    appellationName: string | null
    country: string
    barcodeEan: string | null
    classification: string | null
    status: string
    mediaCount: number
    totalStock: number
    createdAt: Date
}

export type ProductFilters = {
    search?: string
    wineType?: string
    status?: string
    country?: string
    page?: number
    pageSize?: number
}

// ─── List products ────────────────────────────────
export async function getProducts(filters: ProductFilters = {}): Promise<{
    rows: ProductRow[]
    total: number
}> {
    const { search, wineType, status, country, page = 1, pageSize = 20 } = filters

    const where: any = { deletedAt: null }
    if (search) {
        where.OR = [
            { skuCode: { contains: search, mode: 'insensitive' } },
            { productName: { contains: search, mode: 'insensitive' } },
        ]
    }
    if (wineType) where.wineType = wineType
    if (status) where.status = status
    if (country) where.country = country

    const [items, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                producer: { select: { name: true, country: true } },
                appellation: { select: { name: true } },
                media: { select: { id: true }, where: { mediaType: 'PRODUCT_MAIN' } },
                stockLots: { select: { qtyAvailable: true }, where: { status: 'AVAILABLE' } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.product.count({ where }),
    ])

    const rows: ProductRow[] = items.map((p) => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        vintage: p.vintage,
        wineType: p.wineType,
        format: p.format,
        packagingType: p.packagingType,
        unitsPerCase: p.unitsPerCase,
        abvPercent: p.abvPercent ? Number(p.abvPercent) : null,
        producerName: p.producer.name,
        producerCountry: p.producer.country,
        appellationName: p.appellation?.name ?? null,
        country: p.country,
        barcodeEan: p.barcodeEan,
        classification: p.classification,
        status: p.status,
        mediaCount: p.media.length,
        totalStock: p.stockLots.reduce((sum: number, l: { qtyAvailable: unknown }) => sum + Number(l.qtyAvailable), 0),
        createdAt: p.createdAt,
    }))

    return { rows, total }
}

// ─── Schema ───────────────────────────────────────
const productSchema = z.object({
    skuCode: z.string().min(3, 'SKU tối thiểu 3 ký tự'),
    productName: z.string().min(2, 'Tên sản phẩm bắt buộc'),
    producerId: z.string().min(1, 'Nhà sản xuất bắt buộc'),
    vintage: z.number().int().min(1800).max(2030).nullable().optional(),
    appellationId: z.string().nullable().optional(),
    country: z.string().min(2).max(2),
    abvPercent: z.number().min(0).max(100).nullable().optional(),
    volumeMl: z.number().int().optional().default(750),
    format: z.enum(['STANDARD', 'MAGNUM', 'JEROBOAM', 'METHUSELAH']).default('STANDARD'),
    packagingType: z.enum(['OWC', 'CARTON']).default('CARTON'),
    unitsPerCase: z.number().int().min(1).max(24).default(12),
    hsCode: z.string().optional().default('2204211000'),
    barcodeEan: z.string().nullable().optional(),
    wineType: z.enum(['RED', 'WHITE', 'ROSE', 'SPARKLING', 'FORTIFIED', 'DESSERT']),
    classification: z.string().nullable().optional(),
    tastingNotes: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'DISCONTINUED', 'ALLOCATION_ONLY']).default('ACTIVE'),
})

export type ProductInput = z.infer<typeof productSchema>

// ─── Create ───────────────────────────────────────
export async function createProduct(input: ProductInput) {
    const data = productSchema.parse(input)
    const product = await prisma.product.create({
        data: {
            skuCode: data.skuCode,
            productName: data.productName,
            producerId: data.producerId,
            vintage: data.vintage ?? null,
            appellationId: data.appellationId ?? null,
            country: data.country,
            abvPercent: data.abvPercent ?? 13.0,
            volumeMl: data.volumeMl ?? 750,
            format: data.format,
            packagingType: data.packagingType,
            unitsPerCase: data.unitsPerCase ?? 12,
            hsCode: data.hsCode ?? '2204211000',
            barcodeEan: data.barcodeEan ?? null,
            wineType: data.wineType,
            classification: data.classification ?? null,
            tastingNotes: data.tastingNotes ?? null,
            status: data.status,
        },
    })
    revalidatePath('/dashboard/products')
    return { success: true, id: product.id }
}

// ─── Update ───────────────────────────────────────
export async function updateProduct(id: string, input: Partial<ProductInput>) {
    await prisma.product.update({
        where: { id },
        data: {
            ...(input.skuCode && { skuCode: input.skuCode }),
            ...(input.productName && { productName: input.productName }),
            ...(input.producerId && { producerId: input.producerId }),
            vintage: input.vintage ?? undefined,
            appellationId: input.appellationId ?? undefined,
            ...(input.country && { country: input.country }),
            ...(input.abvPercent !== undefined && { abvPercent: input.abvPercent ?? 0 }),
            ...(input.format && { format: input.format }),
            ...(input.packagingType && { packagingType: input.packagingType }),
            ...(input.unitsPerCase && { unitsPerCase: input.unitsPerCase }),
            ...(input.barcodeEan !== undefined && { barcodeEan: input.barcodeEan }),
            ...(input.wineType && { wineType: input.wineType }),
            ...(input.classification !== undefined && { classification: input.classification }),
            ...(input.tastingNotes !== undefined && { tastingNotes: input.tastingNotes }),
            ...(input.status && { status: input.status }),
        },
    })
    revalidatePath('/dashboard/products')
    return { success: true }
}

// ─── Soft delete ──────────────────────────────────
export async function deleteProduct(id: string) {
    await prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
    })
    revalidatePath('/dashboard/products')
}

// ─── Reference data ───────────────────────────────
export async function getProducers() {
    return prisma.producer.findMany({
        select: { id: true, name: true, country: true },
        orderBy: { name: 'asc' },
    })
}

export async function getRegions() {
    return prisma.wineRegion.findMany({
        select: { id: true, name: true, country: true },
        orderBy: { name: 'asc' },
    })
}

export async function getAppellations(regionId?: string) {
    return prisma.appellation.findMany({
        where: regionId ? { regionId } : undefined,
        select: { id: true, name: true, regionId: true },
        orderBy: { name: 'asc' },
    })
}

// ═══════════════════════════════════════════════════
// PRICE LIST — CRUD
// ═══════════════════════════════════════════════════

export type PriceListRow = {
    id: string
    name: string
    channel: string
    effectiveDate: Date
    expiryDate: Date | null
    lineCount: number
    createdAt: Date
}

export type PriceListLineRow = {
    id: string
    priceListId: string
    productId: string
    productName: string
    skuCode: string
    unitPrice: number
    currency: string
}

// ── List price lists ──────────────────────────────
export async function getPriceLists(): Promise<PriceListRow[]> {
    const lists = await prisma.priceList.findMany({
        include: { lines: { select: { id: true } } },
        orderBy: { effectiveDate: 'desc' },
    })
    return lists.map(pl => ({
        id: pl.id,
        name: pl.name,
        channel: pl.channel,
        effectiveDate: pl.effectiveDate,
        expiryDate: pl.expiryDate,
        lineCount: pl.lines.length,
        createdAt: pl.createdAt,
    }))
}

// ── Get price list with lines ─────────────────────
export async function getPriceListDetail(id: string) {
    const pl = await prisma.priceList.findUnique({
        where: { id },
        include: {
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                },
                orderBy: { product: { productName: 'asc' } },
            },
        },
    })
    if (!pl) return null

    return {
        id: pl.id,
        name: pl.name,
        channel: pl.channel,
        effectiveDate: pl.effectiveDate,
        expiryDate: pl.expiryDate,
        lines: pl.lines.map(l => ({
            id: l.id,
            priceListId: l.priceListId,
            productId: l.productId,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            unitPrice: Number(l.unitPrice),
            currency: l.currency,
        })),
    }
}

// ── Create price list ─────────────────────────────
const priceListSchema = z.object({
    name: z.string().min(2, 'Tên bảng giá bắt buộc'),
    channel: z.enum(['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'DIRECT_INDIVIDUAL']),
    effectiveDate: z.string().min(1),
    expiryDate: z.string().nullable().optional(),
})

export type PriceListInput = z.infer<typeof priceListSchema>

export async function createPriceList(input: PriceListInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const data = priceListSchema.parse(input)
        const pl = await prisma.priceList.create({
            data: {
                name: data.name,
                channel: data.channel,
                effectiveDate: new Date(data.effectiveDate),
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            },
        })
        revalidatePath('/dashboard/products')
        return { success: true, id: pl.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Add/update line in price list ─────────────────
export async function upsertPriceListLine(
    priceListId: string,
    productId: string,
    unitPrice: number,
    currency: string = 'VND'
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.priceListLine.upsert({
            where: {
                priceListId_productId: { priceListId, productId },
            },
            create: { priceListId, productId, unitPrice, currency },
            update: { unitPrice, currency },
        })
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Delete price list line ────────────────────────
export async function deletePriceListLine(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.priceListLine.delete({ where: { id } })
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Delete price list ─────────────────────────────
export async function deletePriceList(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.priceListLine.deleteMany({ where: { priceListId: id } }),
            prisma.priceList.delete({ where: { id } }),
        ])
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
