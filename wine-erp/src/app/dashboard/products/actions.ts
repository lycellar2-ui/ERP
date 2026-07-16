// Server Actions cho Products module — khớp với Prisma schema
'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { getCurrentUser, requirePermission, hasPermission } from '@/lib/session'
import { logAudit, logAuditWithDiff } from '@/lib/audit'

// ─── Types ────────────────────────────────────────
export type ProductRow = {
    id: string
    skuCode: string
    productName: string
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
    // Instant detail drawer fields (from expanded v_product_rows view)
    volumeMl: number | null
    hsCode: string | null
    isAllocationEligible: boolean | null
    retailPrice: number | null
    wholesalePrice: number | null
    profile: {
        originDetail: string | null
        certification: string | null
        color: string | null
        aromas: string | null
        palate: string | null
        style: string | null
        servingTemp: string | null
        foodPairings: string | null
        bestSuitedFor: string | null
        grapes: string | null
    } | null
}

export type ProductFilters = {
    search?: string
    wineType?: string
    status?: string
    country?: string
    producerId?: string
    sortBy?: 'name' | 'abv' | 'stock' | 'created'
    sortDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

// ─── List products ────────────────────────────────
export async function getProducts(filters: ProductFilters = {}): Promise<{
    rows: ProductRow[]
    total: number
}> {
    const cacheKey = `products:list:${JSON.stringify(filters)}`
    return cached(cacheKey, async () => {
        const { search, wineType, status, country, producerId, sortBy, sortDir, page = 1, pageSize = 20 } = filters

        const where: any = {
            deletedAt: null,
        }

        if (search) {
            where.OR = [
                { skuCode: { contains: search, mode: 'insensitive' } },
                { productName: { contains: search, mode: 'insensitive' } },
                { barcodeEan: { contains: search, mode: 'insensitive' } },
                { producerName: { contains: search, mode: 'insensitive' } },
            ]
        }
        if (wineType) {
            where.wineType = wineType
        }
        if (status) {
            where.status = status
        }
        if (country) {
            where.country = country
        }

        if (producerId) {
            where.producerId = producerId
        }

        // Dynamic sort
        const orderBy: any = {}
        if (sortBy === 'name') {
            orderBy.productName = sortDir === 'asc' ? 'asc' : 'desc'
        } else if (sortBy === 'abv') {
            orderBy.abvPercent = sortDir === 'asc' ? 'asc' : 'desc'
        } else if (sortBy === 'stock') {
            orderBy.totalStock = sortDir === 'asc' ? 'asc' : 'desc'
        } else {
            orderBy.createdAt = sortDir === 'asc' ? 'asc' : 'desc'
        }

        const take = pageSize
        const skip = (page - 1) * pageSize

        const [rowsRes, total] = await Promise.all([
            prisma.productRowView.findMany({
                where,
                orderBy,
                take,
                skip,
                select: {
                    id: true,
                    skuCode: true,
                    productName: true,
                    wineType: true,
                    format: true,
                    packagingType: true,
                    unitsPerCase: true,
                    abvPercent: true,
                    producerName: true,
                    producerCountry: true,
                    appellationName: true,
                    country: true,
                    barcodeEan: true,
                    classification: true,
                    status: true,
                    mediaCount: true,
                    primaryImageUrl: true,
                    totalStock: true,
                    createdAt: true,
                    volumeMl: true,
                    hsCode: true,
                    isAllocationEligible: true,
                    retailPrice: true,
                    wholesalePrice: true,
                }
            }),
            prisma.productRowView.count({
                where,
            }),
        ])

        const rows: ProductRow[] = rowsRes.map((r) => {
            return {
                id: r.id,
                skuCode: r.skuCode,
                productName: r.productName,
                wineType: r.wineType,
                format: r.format,
                packagingType: r.packagingType,
                unitsPerCase: r.unitsPerCase,
                abvPercent: r.abvPercent,
                producerName: r.producerName,
                producerCountry: r.producerCountry,
                appellationName: r.appellationName,
                country: r.country,
                barcodeEan: r.barcodeEan,
                classification: r.classification,
                status: r.status,
                mediaCount: r.mediaCount,
                primaryImageUrl: r.primaryImageUrl,
                totalStock: r.totalStock,
                createdAt: r.createdAt,
                volumeMl: r.volumeMl ?? null,
                hsCode: r.hsCode ?? null,
                isAllocationEligible: r.isAllocationEligible ?? null,
                retailPrice: r.retailPrice ?? null,
                wholesalePrice: r.wholesalePrice ?? null,
                profile: null, // Skip heavy profile columns for listing to reduce wire transfer payload size
            }
        })

        return { rows, total }
    }, 30_000)
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
        // Count products that have NO available stock lots (efficient subquery)
        // Instead of loading ALL products + their lots and filtering in JS
        const [total, active, wineTypeCounts, withStockCount] = await Promise.all([
            prisma.product.count({ where: { deletedAt: null } }),
            prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            prisma.product.groupBy({
                by: ['wineType'],
                where: { deletedAt: null, status: 'ACTIVE' },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
            // Count active products that HAVE at least 1 available stock lot
            prisma.product.count({
                where: {
                    deletedAt: null,
                    status: 'ACTIVE',
                    stockLots: { some: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } } },
                },
            }),
        ])

        // outOfStock = active products minus those with stock
        const outOfStock = active - withStockCount

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
            profile: true,
        },
    })
    if (!p) return null
    return {
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName,
        producerId: p.producerId,
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
        profile: p.profile ? {
            originDetail: p.profile.originDetail,
            certification: p.profile.certification,
            color: p.profile.color,
            aromas: p.profile.aromas,
            palate: p.profile.palate,
            style: p.profile.style,
            servingTemp: p.profile.servingTemp,
            foodPairings: p.profile.foodPairings,
            bestSuitedFor: p.profile.bestSuitedFor,
            grapes: p.profile.grapes,
        } : null,
        status: p.status,
    }
}

// ─── Get unique countries from products ───────────
export async function getProductCountries(): Promise<{ code: string; count: number }[]> {
    return cached('products:countries', async () => {
        const result = await prisma.product.groupBy({
            by: ['country'],
            where: { deletedAt: null },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        })
        return result.map(r => ({ code: r.country, count: r._count.id }))
    }, 60_000) // 60s — reference data hiếm thay đổi
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
    supplierId: z.string().nullable().optional(),

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
    isAllocationEligible: z.boolean().optional().default(false),
    status: z.enum(['ACTIVE', 'DISCONTINUED', 'ALLOCATION_ONLY']).default('ACTIVE'),
    profile: z.object({
        originDetail: z.string().nullable().optional(),
        certification: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        aromas: z.string().nullable().optional(),
        palate: z.string().nullable().optional(),
        style: z.string().nullable().optional(),
        servingTemp: z.string().nullable().optional(),
        foodPairings: z.string().nullable().optional(),
        bestSuitedFor: z.string().nullable().optional(),
        grapes: z.string().nullable().optional(),
    }).optional().nullable(),
})

export type ProductInput = z.infer<typeof productSchema>

// ─── Create ───────────────────────────────────────
export async function createProduct(input: ProductInput) {
    try {
        await requirePermission('MDM', 'WRITE')
        const data = productSchema.parse(input)
        const product = await prisma.product.create({
            data: {
                skuCode: data.skuCode,
                productName: data.productName,
                producerId: data.producerId,
                supplierId: data.supplierId ?? null,

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
                isAllocationEligible: data.isAllocationEligible ?? false,
                status: data.status,
                profile: data.profile ? {
                    create: {
                        originDetail: data.profile.originDetail ?? null,
                        certification: data.profile.certification ?? null,
                        color: data.profile.color ?? null,
                        aromas: data.profile.aromas ?? null,
                        palate: data.profile.palate ?? null,
                        style: data.profile.style ?? null,
                        servingTemp: data.profile.servingTemp ?? null,
                        foodPairings: data.profile.foodPairings ?? null,
                        bestSuitedFor: data.profile.bestSuitedFor ?? null,
                        grapes: data.profile.grapes ?? null,
                    }
                } : undefined
            },
        })
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'Product', entityId: product.id, newValue: { skuCode: data.skuCode, productName: data.productName, wineType: data.wineType, country: data.country, status: data.status } })
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
    try {
        await requirePermission('MDM', 'WRITE')
        const data = productSchema.partial().parse(input)
        const oldProduct = await prisma.product.findUnique({
            where: { id },
            select: {
                skuCode: true,
                productName: true,
                status: true,
                abvPercent: true,
                volumeMl: true,
                wineType: true,
                country: true,
                classification: true,
                isAllocationEligible: true,
                hsCode: true,
                profile: { select: { id: true } }
            }
        })
        await prisma.product.update({
            where: { id },
            data: {
                ...(data.skuCode && { skuCode: data.skuCode }),
                ...(data.productName && { productName: data.productName }),
                ...(data.producerId && { producerId: data.producerId }),
                supplierId: data.supplierId !== undefined ? data.supplierId : undefined,

                appellationId: data.appellationId !== undefined ? data.appellationId : undefined,
                ...(data.country && { country: data.country }),
                abvPercent: data.abvPercent !== undefined ? (data.abvPercent ?? 13.0) : undefined,
                ...(data.format && { format: data.format }),
                ...(data.packagingType && { packagingType: data.packagingType }),
                ...(data.unitsPerCase && { unitsPerCase: data.unitsPerCase }),
                barcodeEan: data.barcodeEan !== undefined ? data.barcodeEan : undefined,
                ...(data.wineType && { wineType: data.wineType }),
                classification: data.classification !== undefined ? data.classification : undefined,
                ...(data.isAllocationEligible !== undefined && { isAllocationEligible: data.isAllocationEligible }),
                ...(data.hsCode && { hsCode: data.hsCode }),
                ...(data.status && { status: data.status }),
                ...(data.profile !== undefined && {
                    profile: data.profile ? {
                        upsert: {
                            create: {
                                originDetail: data.profile.originDetail ?? null,
                                certification: data.profile.certification ?? null,
                                color: data.profile.color ?? null,
                                aromas: data.profile.aromas ?? null,
                                palate: data.profile.palate ?? null,
                                style: data.profile.style ?? null,
                                servingTemp: data.profile.servingTemp ?? null,
                                foodPairings: data.profile.foodPairings ?? null,
                                bestSuitedFor: data.profile.bestSuitedFor ?? null,
                                grapes: data.profile.grapes ?? null,
                            },
                            update: {
                                originDetail: data.profile.originDetail ?? null,
                                certification: data.profile.certification ?? null,
                                color: data.profile.color ?? null,
                                aromas: data.profile.aromas ?? null,
                                palate: data.profile.palate ?? null,
                                style: data.profile.style ?? null,
                                servingTemp: data.profile.servingTemp ?? null,
                                foodPairings: data.profile.foodPairings ?? null,
                                bestSuitedFor: data.profile.bestSuitedFor ?? null,
                                grapes: data.profile.grapes ?? null,
                            }
                        }
                    } : (oldProduct?.profile ? { delete: true } : undefined)
                })
            },
        })
        const user = await getCurrentUser().catch(() => null)
        const oldPlain = oldProduct ? JSON.parse(JSON.stringify(oldProduct)) : null
        logAuditWithDiff({ userId: user?.id, userName: user?.name, action: 'UPDATE', entityType: 'Product', entityId: id, oldObj: oldPlain, newObj: { ...oldPlain, ...data } })
        revalidateCache('products')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Soft delete ──────────────────────────────────
export async function deleteProduct(id: string) {
    await requirePermission('MDM', 'WRITE')
    const product = await prisma.product.findUnique({ where: { id }, select: { skuCode: true, productName: true, status: true } })
    await prisma.product.update({
        where: { id },
        data: { deletedAt: new Date() },
    })
    const user = await getCurrentUser().catch(() => null)
    logAudit({ userId: user?.id, userName: user?.name, action: 'DELETE', entityType: 'Product', entityId: id, oldValue: { skuCode: product?.skuCode, productName: product?.productName, status: product?.status } })
    revalidateCache('products')
    revalidatePath('/dashboard/products')
}

// ─── Bulk import from Excel ──────────────────────
export type ImportResult = {
    success: number
    errors: { row: number; message: string }[]
    total: number
}

export async function bulkImportProducts(rows: Record<string, any>[]): Promise<ImportResult> {
    await requirePermission('MDM', 'WRITE')
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
    return cached('products:producers', async () => {
        return prisma.producer.findMany({
            select: { id: true, name: true, country: true },
            orderBy: { name: 'asc' },
        })
    }, 120_000) // 120s — reference data
}

export async function getSuppliers() {
    return cached('products:suppliers', async () => {
        return prisma.supplier.findMany({
            where: { deletedAt: null, status: 'ACTIVE' },
            select: { id: true, name: true, country: true },
            orderBy: { name: 'asc' },
        })
    }, 120_000) // 120s — reference data
}

export async function getRegions() {
    return cached('products:regions', async () => {
        return prisma.wineRegion.findMany({
            select: { id: true, name: true, country: true },
            orderBy: { name: 'asc' },
        })
    }, 120_000) // 120s — reference data
}

export async function getAppellations(regionId?: string) {
    return cached(`products:appellations:${regionId ?? 'all'}`, async () => {
        return prisma.appellation.findMany({
            where: regionId ? { regionId } : undefined,
            select: { id: true, name: true, regionId: true },
            orderBy: { name: 'asc' },
        })
    }, 120_000) // 120s — reference data
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
    return cached('products:priceLists', async () => {
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
    }, 60_000) // 60s
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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

/** Save media URL that was uploaded directly from client to ImgBB (bypasses Vercel payload limit) */
export async function saveProductMediaUrl(
    productId: string,
    urls: { url: string; thumbUrl?: string; mediumUrl?: string },
    mediaType: string = 'PRODUCT_MAIN'
): Promise<{ success: boolean; media?: ProductMediaRow; error?: string }> {
    try {
        await requirePermission('MDM', 'WRITE')
        if (!urls.url) return { success: false, error: 'URL ảnh bắt buộc' }

        const existingCount = await prisma.productMedia.count({ where: { productId } })

        const media = await prisma.productMedia.create({
            data: {
                productId,
                url: urls.url,
                thumbnailUrl: urls.thumbUrl ?? null,
                mediumUrl: urls.mediumUrl ?? null,
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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

export async function getProductEditDetails(id: string) {
    return cached(`products:details:edit:${id}`, async () => {
        const [p, media, awards] = await Promise.all([
            prisma.product.findUnique({
                where: { id },
                include: {
                    producer: { select: { id: true, name: true } },
                    appellation: { select: { id: true, name: true } },
                    profile: true,
                },
            }),
            prisma.productMedia.findMany({
                where: { productId: id },
                orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
            }),
            prisma.productAward.findMany({
                where: { productId: id },
                orderBy: [{ awardedYear: 'desc' }, { source: 'asc' }],
            })
        ])

        if (!p) return null

        return {
            product: {
                id: p.id,
                skuCode: p.skuCode,
                productName: p.productName,
                producerId: p.producerId,
                supplierId: p.supplierId,

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
                profile: p.profile ? {
                    originDetail: p.profile.originDetail,
                    certification: p.profile.certification,
                    color: p.profile.color,
                    aromas: p.profile.aromas,
                    palate: p.profile.palate,
                    style: p.profile.style,
                    servingTemp: p.profile.servingTemp,
                    foodPairings: p.profile.foodPairings,
                    bestSuitedFor: p.profile.bestSuitedFor,
                    grapes: p.profile.grapes,
                } : null,
                status: p.status,
            },
            media: media.map(m => ({
                id: m.id,
                url: m.url,
                thumbnailUrl: m.thumbnailUrl,
                mediaType: m.mediaType,
                isPrimary: m.isPrimary,
                tags: m.tags,
                uploadedAt: m.uploadedAt,
            })),
            awards: awards.map(a => ({
                id: a.id,
                source: a.source,
                score: a.score ? Number(a.score) : null,
                medal: a.medal,
                medalLabel: a.medal ? MEDAL_LABEL[a.medal] ?? a.medal : null,
                vintage: a.vintage,
                awardedYear: a.awardedYear,
            }))
        }
    }, 60_000)
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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

export type ProductStockLotViewRow = {
    id: string
    lotNo: string
    qtyAvailable: number
    receivedDate: Date
    status: string
    vintage: number | null
    locationCode: string
    warehouseName: string
}

export type ProductViewDetails = {
    id: string
    skuCode: string
    productName: string

    country: string
    abvPercent: number | null
    volumeMl: number
    format: string
    packagingType: string
    unitsPerCase: number
    hsCode: string
    barcodeEan: string | null
    wineType: string
    classification: string | null
    profile: {
        originDetail: string | null
        certification: string | null
        color: string | null
        aromas: string | null
        palate: string | null
        style: string | null
        servingTemp: string | null
        foodPairings: string | null
        bestSuitedFor: string | null
        grapes: string | null
    } | null
    status: string
    isAllocationEligible: boolean
    producerName: string
    appellationName: string | null
    retailPrice: number | null
    wholesalePrice: number | null
    media: { id: string; url: string; isPrimary: boolean }[]
    awards: { id: string; source: string; score: number | null; medal: string | null; medalLabel: string | null; vintage: number | null; awardedYear: number | null }[]
    stockLots: ProductStockLotViewRow[]
}

export async function getProductViewDetails(id: string): Promise<ProductViewDetails | null> {
    const cacheKey = `products:details:${id}`
    return cached(cacheKey, async () => {
        const [p, mediaRes, awardsRes, stockRes] = await Promise.all([
            prisma.productDetailView.findUnique({
                where: { id },
            }),
            prisma.productMedia.findMany({
                where: { productId: id },
                select: { id: true, url: true, isPrimary: true },
                orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
            }),
            prisma.productAward.findMany({
                where: { productId: id },
                select: { id: true, source: true, score: true, medal: true, vintage: true, awardedYear: true },
                orderBy: [{ awardedYear: 'desc' }, { source: 'asc' }],
            }),
            prisma.stockLot.findMany({
                where: { productId: id, qtyAvailable: { gt: 0 } },
                include: {
                    location: {
                        include: {
                            warehouse: true
                        }
                    }
                },
                orderBy: { receivedDate: 'desc' }
            })
        ])

        if (!p || p.deletedAt) return null

        const MEDAL_LABEL: Record<string, string> = {
            GOLD: 'Huy chương Vàng',
            SILVER: 'Huy chương Bạc',
            BRONZE: 'Huy chương Đồng',
            COMMENDED: 'Được tuyên dương',
            TROPHY: 'Cúp vô địch'
        }

        return {
            id: p.id,
            skuCode: p.skuCode,
            productName: p.productName,

            country: p.country,
            abvPercent: p.abvPercent,
            volumeMl: p.volumeMl,
            format: p.format,
            packagingType: p.packagingType,
            unitsPerCase: p.unitsPerCase,
            hsCode: p.hsCode,
            barcodeEan: p.barcodeEan,
            wineType: p.wineType,
            classification: p.classification,
            status: p.status,
            isAllocationEligible: p.isAllocationEligible,
            producerName: p.producerName,
            appellationName: p.appellationName,
            retailPrice: p.retailPrice,
            wholesalePrice: p.wholesalePrice,
            profile: p.grapes || p.servingTemp || p.originDetail || p.certification || p.color || p.style || p.aromas || p.palate || p.foodPairings || p.bestSuitedFor ? {
                originDetail: p.originDetail ?? null,
                certification: p.certification ?? null,
                color: p.color ?? null,
                aromas: p.aromas ?? null,
                palate: p.palate ?? null,
                style: p.style ?? null,
                servingTemp: p.servingTemp ?? null,
                foodPairings: p.foodPairings ?? null,
                bestSuitedFor: p.bestSuitedFor ?? null,
                grapes: p.grapes ?? null,
            } : null,
            media: mediaRes.map(m => ({
                id: m.id,
                url: m.url,
                isPrimary: m.isPrimary
            })),
            awards: awardsRes.map(a => ({
                id: a.id,
                source: a.source,
                score: a.score ? Number(a.score) : null,
                medal: a.medal,
                medalLabel: a.medal ? MEDAL_LABEL[a.medal] ?? a.medal : null,
                vintage: a.vintage,
                awardedYear: a.awardedYear
            })),
            stockLots: stockRes.map(l => ({
                id: l.id,
                lotNo: l.lotNo,
                qtyAvailable: Number(l.qtyAvailable),
                receivedDate: l.receivedDate,
                status: l.status,
                vintage: l.vintage ?? null,
                locationCode: l.location.locationCode,
                warehouseName: l.location.warehouse.name
            }))
        }
    }, 30_000)
}

// ── Combined product page data fetching ──
export async function getProductsPageData(filters: ProductFilters = {}) {
    const [user, productsRes, stats, countries, producers] = await Promise.all([
        getCurrentUser().catch(() => null),
        getProducts(filters).catch(() => ({ rows: [] as ProductRow[], total: 0 })),
        getProductStats().catch(() => ({ total: 0, active: 0, outOfStock: 0, topTypes: [] })),
        getProductCountries().catch(() => []),
        getProducers().catch(() => []),
    ])
    
    const canEdit = user ? hasPermission(user, 'MDM', 'WRITE') : false
    
    return {
        rows: productsRes.rows,
        total: productsRes.total,
        stats,
        countries,
        producers,
        canEdit,
    }
}


