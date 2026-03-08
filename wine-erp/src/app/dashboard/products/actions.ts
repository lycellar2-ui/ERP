// Server Actions cho Products module — khớp với Prisma schema
'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth } from '@/lib/session'

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
    primaryImageUrl: string | null
    totalStock: number
    createdAt: Date
}

export type ProductFilters = {
    search?: string
    wineType?: string
    status?: string
    country?: string
    vintage?: number
    producerId?: string
    sortBy?: 'name' | 'vintage' | 'abv' | 'stock' | 'created'
    sortDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

// ─── List products ────────────────────────────────
export async function getProducts(filters: ProductFilters = {}): Promise<{
    rows: ProductRow[]
    total: number
}> {
    const { search, wineType, status, country, vintage, producerId, sortBy, sortDir, page = 1, pageSize = 20 } = filters
    const cacheKey = `products:list:${page}:${pageSize}:${search ?? ''}:${wineType ?? ''}:${status ?? ''}:${country ?? ''}:${vintage ?? ''}:${producerId ?? ''}:${sortBy ?? ''}:${sortDir ?? ''}`
    return cached(cacheKey, async () => {

        const where: any = { deletedAt: null }
        if (search) {
            where.OR = [
                { skuCode: { contains: search, mode: 'insensitive' } },
                { productName: { contains: search, mode: 'insensitive' } },
                { barcodeEan: { contains: search, mode: 'insensitive' } },
                { producer: { name: { contains: search, mode: 'insensitive' } } },
            ]
        }
        if (wineType) where.wineType = wineType
        if (status) where.status = status
        if (country) where.country = country
        if (vintage) where.vintage = vintage
        if (producerId) where.producerId = producerId

        // Dynamic sort
        const sortMap: Record<string, any> = {
            name: { productName: sortDir ?? 'asc' },
            vintage: { vintage: sortDir ?? 'desc' },
            abv: { abvPercent: sortDir ?? 'desc' },
            created: { createdAt: sortDir ?? 'desc' },
        }
        const orderBy = sortBy && sortBy !== 'stock' ? sortMap[sortBy] ?? { createdAt: 'desc' } : { createdAt: 'desc' }

        const [items, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    producer: { select: { name: true, country: true } },
                    appellation: { select: { name: true } },
                    media: { select: { id: true, url: true, isPrimary: true }, orderBy: { isPrimary: 'desc' } },
                    stockLots: { select: { qtyAvailable: true }, where: { status: 'AVAILABLE' } },
                },
                orderBy,
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
            primaryImageUrl: p.media.find((m: any) => m.isPrimary)?.url ?? p.media[0]?.url ?? null,
            totalStock: p.stockLots.reduce((sum: number, l: { qtyAvailable: unknown }) => sum + Number(l.qtyAvailable), 0),
            createdAt: p.createdAt,
        }))

        return { rows, total }
    }) // end cached
}

// ─── Product Stats (aggregated from DB) ───────────
export type ProductStats = {
    total: number
    active: number
    outOfStock: number
    topTypes: { type: string; label: string; count: number }[]
}

export async function getProductStats(): Promise<ProductStats> {
    return cached('products:stats', async () => {
        const [total, active, wineTypeCounts, productsWithStock] = await Promise.all([
            prisma.product.count({ where: { deletedAt: null } }),
            prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            prisma.product.groupBy({
                by: ['wineType'],
                where: { deletedAt: null, status: 'ACTIVE' },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            // Products with zero stock (active only)
            prisma.product.findMany({
                where: { deletedAt: null, status: 'ACTIVE' },
                select: {
                    id: true,
                    stockLots: {
                        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                        select: { qtyAvailable: true },
                    },
                },
            }),
        ])

        const outOfStock = productsWithStock.filter(
            p => p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0) === 0
        ).length

        const typeLabels: Record<string, string> = {
            RED: 'Đỏ', WHITE: 'Trắng', ROSE: 'Rosé',
            SPARKLING: 'Sâm panh', FORTIFIED: 'Fortified', DESSERT: 'Dessert',
        }

        const topTypes = wineTypeCounts
            .slice(0, 3)
            .map(t => ({
                type: t.wineType,
                label: typeLabels[t.wineType] ?? t.wineType,
                count: t._count.id,
            }))

        return { total, active, outOfStock, topTypes }
    }, 30_000) // 30s cache
}

// ─── Get product by ID (for edit mode) ────────────
export async function getProductById(id: string) {
    const p = await prisma.product.findUnique({
        where: { id },
        include: {
            producer: { select: { id: true, name: true } },
            appellation: { select: { id: true, name: true } },
        },
    })
    if (!p) return null
    return {
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        producerId: p.producerId,
        vintage: p.vintage,
        appellationId: p.appellationId,
        country: p.country,
        abvPercent: p.abvPercent ? Number(p.abvPercent) : null,
        volumeMl: p.volumeMl,
        format: p.format,
        packagingType: p.packagingType,
        unitsPerCase: p.unitsPerCase,
        hsCode: p.hsCode,
        barcodeEan: p.barcodeEan,
        wineType: p.wineType,
        storageTempMin: p.storageTempMin ? Number(p.storageTempMin) : null,
        storageTempMax: p.storageTempMax ? Number(p.storageTempMax) : null,
        isAllocationEligible: p.isAllocationEligible,
        classification: p.classification,
        tastingNotes: p.tastingNotes,
        status: p.status,
    }
}

// ─── Get unique countries from products ───────────
export async function getProductCountries(): Promise<{ code: string; count: number }[]> {
    const result = await prisma.product.groupBy({
        by: ['country'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
    })
    return result.map(r => ({ code: r.country, count: r._count.id }))
}

// ─── Get unique vintages from products ────────────
export async function getProductVintages(): Promise<number[]> {
    const result = await prisma.product.groupBy({
        by: ['vintage'],
        where: { deletedAt: null, vintage: { not: null } },
        orderBy: { vintage: 'desc' },
    })
    return result.map(r => r.vintage!).filter(Boolean)
}

// ─── Create producer inline ───────────────────────
export async function createProducerInline(name: string, country: string): Promise<{ id: string; name: string }> {
    const producer = await prisma.producer.create({
        data: { name, country },
        select: { id: true, name: true },
    })
    return producer
}

// ─── Export products to JSON (for Excel conversion) ─
export async function exportProductsData() {
    const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            producer: { select: { name: true, country: true } },
            appellation: { select: { name: true } },
            stockLots: { select: { qtyAvailable: true }, where: { status: 'AVAILABLE' } },
            awards: { select: { source: true, score: true, medal: true }, orderBy: { source: 'asc' } },
        },
        orderBy: { productName: 'asc' },
    })
    return products.map(p => ({
        SKU: p.skuCode,
        'Tên SP': p.productName,
        'Nhà SX': p.producer.name,
        Vintage: p.vintage ?? '',
        Loại: p.wineType,
        'Quốc Gia': p.country,
        ABV: p.abvPercent ? Number(p.abvPercent) : '',
        'Dung Tích': p.volumeMl,
        'Đóng Gói': p.packagingType,
        'Chai/Thùng': p.unitsPerCase,
        Barcode: p.barcodeEan ?? '',
        Classification: p.classification ?? '',
        'HS Code': p.hsCode,
        'Vùng': p.appellation?.name ?? '',
        'Tồn Kho': p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0),
        'Trạng Thái': p.status,
        'Giải Thưởng': p.awards.map(a => `${a.source}${a.score ? ` ${a.score}pt` : ''}${a.medal ? ` ${a.medal}` : ''}`).join('; '),
    }))
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
    hsCode: z.string().min(1, 'HS Code bắt buộc').default('2204211000'),
    barcodeEan: z.string().nullable().optional(),
    wineType: z.enum(['RED', 'WHITE', 'ROSE', 'SPARKLING', 'FORTIFIED', 'DESSERT']),
    classification: z.string().nullable().optional(),
    tastingNotes: z.string().nullable().optional(),
    isAllocationEligible: z.boolean().optional().default(false),
    status: z.enum(['ACTIVE', 'DISCONTINUED', 'ALLOCATION_ONLY']).default('ACTIVE'),
})

export type ProductInput = z.infer<typeof productSchema>

// ─── Create ───────────────────────────────────────
export async function createProduct(input: ProductInput) {
    try {
        await requireAuth()
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
                hsCode: data.hsCode,
                barcodeEan: data.barcodeEan ?? null,
                wineType: data.wineType,
                classification: data.classification ?? null,
                tastingNotes: data.tastingNotes ?? null,
                isAllocationEligible: data.isAllocationEligible ?? false,
                status: data.status,
            },
        })
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true, id: product.id }
    } catch (err: any) {
        if (err?.issues) {
            const msgs = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            return { success: false, error: `Validation: ${msgs}` }
        }
        if (err?.code === 'P2002') {
            return { success: false, error: 'SKU đã tồn tại. Vui lòng chọn mã SKU khác.' }
        }
        return { success: false, error: err.message ?? 'Lỗi tạo sản phẩm không xác định' }
    }
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
            ...(input.isAllocationEligible !== undefined && { isAllocationEligible: input.isAllocationEligible }),
            ...(input.hsCode && { hsCode: input.hsCode }),
            ...(input.status && { status: input.status }),
        },
    })
    revalidateCache('products')
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

// ─── Bulk import from Excel ──────────────────────
export type ImportResult = {
    success: number
    errors: { row: number; message: string }[]
    total: number
}

export async function bulkImportProducts(rows: Record<string, any>[]): Promise<ImportResult> {
    const result: ImportResult = { success: 0, errors: [], total: rows.length }
    if (rows.length > 500) {
        result.errors.push({ row: 0, message: 'Tối đa 500 dòng mỗi lần import' })
        return result
    }

    const validWineTypes = ['RED', 'WHITE', 'ROSE', 'SPARKLING', 'FORTIFIED', 'DESSERT']
    const wineTypeMap: Record<string, string> = {
        'Đỏ': 'RED', 'Trắng': 'WHITE', 'Rosé': 'ROSE', 'Sâm panh': 'SPARKLING',
        'Red': 'RED', 'White': 'WHITE',
    }

    // Cache producers for reuse
    const producerCache = new Map<string, string>()
    const producers = await prisma.producer.findMany({ select: { id: true, name: true } })
    producers.forEach(p => producerCache.set(p.name.toLowerCase(), p.id))

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
            const sku = String(r['SKU'] ?? r['skuCode'] ?? '').trim()
            const name = String(r['Tên SP'] ?? r['productName'] ?? '').trim()
            if (!sku || !name) { result.errors.push({ row: i + 2, message: 'Thiếu SKU hoặc Tên SP' }); continue }

            // Check duplicate SKU
            const existing = await prisma.product.findFirst({ where: { skuCode: sku, deletedAt: null } })
            if (existing) { result.errors.push({ row: i + 2, message: `SKU '${sku}' đã tồn tại — bỏ qua` }); continue }

            // Wine type
            const rawType = String(r['Loại'] ?? r['wineType'] ?? 'RED').trim()
            const wineType = wineTypeMap[rawType] ?? rawType
            if (!validWineTypes.includes(wineType)) {
                result.errors.push({ row: i + 2, message: `Loại rượu không hợp lệ: ${rawType}` }); continue
            }

            // Producer
            const producerName = String(r['Nhà SX'] ?? r['producerName'] ?? '').trim()
            if (!producerName) { result.errors.push({ row: i + 2, message: 'Thiếu Nhà SX' }); continue }
            let producerId = producerCache.get(producerName.toLowerCase())
            if (!producerId) {
                const country = String(r['Quốc Gia'] ?? r['country'] ?? 'FR').trim().toUpperCase()
                const newProducer = await prisma.producer.create({ data: { name: producerName, country } })
                producerId = newProducer.id
                producerCache.set(producerName.toLowerCase(), producerId)
            }

            const country = String(r['Quốc Gia'] ?? r['country'] ?? 'FR').trim().toUpperCase()

            await prisma.product.create({
                data: {
                    skuCode: sku,
                    productName: name,
                    producerId,
                    vintage: r['Vintage'] ? Number(r['Vintage']) : null,
                    country,
                    abvPercent: r['ABV'] ? Number(r['ABV']) : 13.0,
                    volumeMl: Number(r['Dung Tích'] ?? r['volumeMl'] ?? 750),
                    format: (['STANDARD', 'MAGNUM', 'JEROBOAM', 'METHUSELAH'].includes(r['Format'] ?? 'STANDARD') ? r['Format'] : 'STANDARD') as any,
                    packagingType: (['OWC', 'CARTON'].includes(r['Đóng Gói'] ?? 'CARTON') ? r['Đóng Gói'] : 'CARTON') as any,
                    unitsPerCase: Number(r['Chai/Thùng'] ?? r['unitsPerCase'] ?? 12),
                    hsCode: '2204211000',
                    barcodeEan: r['Barcode'] ?? r['barcodeEan'] ?? null,
                    wineType: wineType as any,
                    classification: r['Classification'] ?? null,
                    status: 'ACTIVE',
                },
            })
            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success > 0) {
        revalidateCache('products')
        revalidatePath('/dashboard/products')
    }
    return result
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
        revalidateCache('products')
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
        revalidateCache('products')
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
        revalidateCache('products')
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
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// PRODUCT MEDIA — Upload, List, Delete, Primary
// ═══════════════════════════════════════════════════

export type ProductMediaRow = {
    id: string
    url: string
    thumbnailUrl: string | null
    mediaType: string
    isPrimary: boolean
    tags: string[]
    uploadedAt: Date
}

export async function getProductMedia(productId: string): Promise<ProductMediaRow[]> {
    const media = await prisma.productMedia.findMany({
        where: { productId },
        orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
    })
    return media.map(m => ({
        id: m.id,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        mediaType: m.mediaType,
        isPrimary: m.isPrimary,
        tags: m.tags,
        uploadedAt: m.uploadedAt,
    }))
}

export async function uploadProductMedia(
    productId: string,
    formData: FormData,
    mediaType: string = 'PRODUCT_MAIN'
): Promise<{ success: boolean; media?: ProductMediaRow; error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file || file.size === 0) return { success: false, error: 'Không có file' }
        if (file.size > 10 * 1024 * 1024) return { success: false, error: 'File quá lớn (max 10MB)' }
        if (!file.type.startsWith('image/')) return { success: false, error: 'Chỉ chấp nhận file ảnh' }

        // Upload to ImgBB
        const result = await uploadFileToImgBB(file)
        if (!result.success || !result.url) {
            return { success: false, error: result.error ?? 'Upload ImgBB thất bại' }
        }

        // Check if this is the first media → auto-set as primary
        const existingCount = await prisma.productMedia.count({ where: { productId } })

        const media = await prisma.productMedia.create({
            data: {
                productId,
                url: result.url,
                thumbnailUrl: result.thumbUrl ?? null,
                mediumUrl: result.mediumUrl ?? null,
                mediaType: mediaType as any,
                isPrimary: existingCount === 0,
            },
        })

        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return {
            success: true,
            media: {
                id: media.id,
                url: media.url,
                thumbnailUrl: media.thumbnailUrl,
                mediaType: media.mediaType,
                isPrimary: media.isPrimary,
                tags: media.tags,
                uploadedAt: media.uploadedAt,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteProductMedia(
    mediaId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const media = await prisma.productMedia.findUnique({
            where: { id: mediaId },
            select: { productId: true, isPrimary: true },
        })
        if (!media) return { success: false, error: 'Media not found' }

        await prisma.productMedia.delete({ where: { id: mediaId } })

        // If deleted was primary, set next as primary
        if (media.isPrimary) {
            const next = await prisma.productMedia.findFirst({
                where: { productId: media.productId },
                orderBy: { uploadedAt: 'asc' },
            })
            if (next) {
                await prisma.productMedia.update({
                    where: { id: next.id },
                    data: { isPrimary: true },
                })
            }
        }

        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function setPrimaryMedia(
    mediaId: string,
    productId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.productMedia.updateMany({
                where: { productId },
                data: { isPrimary: false },
            }),
            prisma.productMedia.update({
                where: { id: mediaId },
                data: { isPrimary: true },
            }),
        ])
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// PRODUCT AWARDS & SCORES
// ═══════════════════════════════════════════════════

const MEDAL_LABEL: Record<string, string> = {
    GOLD: '🥇 Gold',
    SILVER: '🥈 Silver',
    BRONZE: '🥉 Bronze',
    DOUBLE_GOLD: '🏆 Double Gold',
}

export type ProductAwardRow = {
    id: string
    source: string
    score: number | null
    medal: string | null
    medalLabel: string | null
    vintage: number | null
    awardedYear: number | null
}

export async function getProductAwards(productId: string): Promise<ProductAwardRow[]> {
    const awards = await prisma.productAward.findMany({
        where: { productId },
        orderBy: [{ awardedYear: 'desc' }, { source: 'asc' }],
    })
    return awards.map(a => ({
        id: a.id,
        source: a.source,
        score: a.score ? Number(a.score) : null,
        medal: a.medal,
        medalLabel: a.medal ? MEDAL_LABEL[a.medal] ?? a.medal : null,
        vintage: a.vintage,
        awardedYear: a.awardedYear,
    }))
}

export async function addProductAward(input: {
    productId: string
    source: string
    score?: number
    medal?: string
    vintage?: number
    awardedYear?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.productAward.create({
            data: {
                productId: input.productId,
                source: input.source,
                score: input.score ?? null,
                medal: (input.medal as any) ?? null,
                vintage: input.vintage ?? null,
                awardedYear: input.awardedYear ?? null,
            },
        })
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteProductAward(awardId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.productAward.delete({ where: { id: awardId } })
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Product Image Upload (ImgBB) ─────────────────
import { uploadFileToImgBB } from '@/lib/imgbb'

export async function uploadProductImage(
    productId: string,
    formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const file = formData.get('image') as File
        if (!file || file.size === 0) return { success: false, error: 'Không có file' }
        if (file.size > 10 * 1024 * 1024) return { success: false, error: 'File quá lớn (max 10MB)' }
        if (!file.type.startsWith('image/')) return { success: false, error: 'Chỉ chấp nhận file ảnh' }

        const result = await uploadFileToImgBB(file)
        if (!result.success) return { success: false, error: result.error }

        // Check if product already has a primary image
        const existing = await prisma.productMedia.findFirst({
            where: { productId, isPrimary: true },
        })

        if (existing) {
            // Update existing primary image
            await prisma.productMedia.update({
                where: { id: existing.id },
                data: {
                    url: result.url!,
                    thumbnailUrl: result.thumbUrl ?? null,
                    mediumUrl: result.mediumUrl ?? null,
                },
            })
        } else {
            // Create new primary image
            await prisma.productMedia.create({
                data: {
                    productId,
                    mediaType: 'PRODUCT_MAIN',
                    url: result.url!,
                    thumbnailUrl: result.thumbUrl ?? null,
                    mediumUrl: result.mediumUrl ?? null,
                    isPrimary: true,
                },
            })
        }

        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true, url: result.url }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteProductImage(
    productId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.productMedia.deleteMany({
            where: { productId, isPrimary: true },
        })
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getProductImage(
    productId: string
): Promise<string | null> {
    const media = await prisma.productMedia.findFirst({
        where: { productId, isPrimary: true },
        select: { url: true },
    })
    return media?.url ?? null
}
