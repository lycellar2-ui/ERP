'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { getCurrentUser } from '@/lib/session'
import { cached, revalidateCache } from '@/lib/cache'

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
    return cached('priceList:list', async () => {
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
    }, 60_000) // 60s cache
}

// ── Helper: Sync ProductMarginPrice when Wholesale/Retail channel price changes ──
async function syncMarginPriceFromChannel(
    channel: string,
    productId: string,
    skuCode: string,
    unitPrice: number
) {
    if (channel !== 'WHOLESALE_DISTRIBUTOR' && channel !== 'DIRECT_INDIVIDUAL') return
    const existing = await prisma.productMarginPrice.findUnique({ where: { productId } })
    const costPrice = Number(existing?.costPrice ?? 0)
    const wholesalePrice = channel === 'WHOLESALE_DISTRIBUTOR' ? unitPrice : Number(existing?.wholesalePrice ?? 0)
    const retailPrice = channel === 'DIRECT_INDIVIDUAL' ? unitPrice : Number(existing?.retailPrice ?? 0)

    await prisma.productMarginPrice.upsert({
        where: { productId },
        create: {
            productId,
            skuCode,
            costPrice,
            wholesalePrice,
            retailPrice,
        },
        update: {
            skuCode,
            ...(channel === 'WHOLESALE_DISTRIBUTOR' ? { wholesalePrice } : {}),
            ...(channel === 'DIRECT_INDIVIDUAL' ? { retailPrice } : {}),
        },
    })
}

// ── Get Price List Detail ────────────────────────
export async function getPriceListDetail(id: string) {
    const [pl, activeProducts] = await Promise.all([
        prisma.priceList.findUnique({
            where: { id },
            include: {
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true } },
                    },
                    orderBy: { product: { productName: 'asc' } },
                },
            },
        }),
        prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, skuCode: true, productName: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        }),
    ])
    if (!pl) return null

    const pricedProductIds = new Set(pl.lines.map(l => l.productId))
    const unpricedProducts = activeProducts
        .filter(p => !pricedProductIds.has(p.id))
        .map(p => ({
            productId: p.id,
            skuCode: p.skuCode,
            productName: p.productName,
            createdAt: p.createdAt,
        }))

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
        unpricedProducts,
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
        revalidateCache('priceList')
        revalidateCache('pricing')
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
        const [existing, priceList, product] = await Promise.all([
            prisma.priceListLine.findUnique({
                where: { priceListId_productId: { priceListId: input.priceListId, productId: input.productId } },
            }),
            prisma.priceList.findUnique({
                where: { id: input.priceListId },
                select: { id: true, channel: true, name: true },
            }),
            prisma.product.findUnique({
                where: { id: input.productId },
                select: { id: true, skuCode: true, productName: true },
            }),
        ])
        if (!priceList || !product) {
            return { success: false, error: 'Không tìm thấy bảng giá hoặc sản phẩm' }
        }

        const user = await getCurrentUser().catch(() => null)
        if (existing) {
            const oldPrice = Number(existing.unitPrice)
            await prisma.priceListLine.update({
                where: { id: existing.id },
                data: { unitPrice: input.unitPrice, currency: input.currency ?? 'VND' },
            })
            if (oldPrice !== input.unitPrice) {
                logAudit({ userId: user?.id, userName: user?.name, action: 'UPDATE', entityType: 'PriceListLine', entityId: existing.id, oldValue: { unitPrice: oldPrice, sku: product.skuCode }, newValue: { unitPrice: input.unitPrice, sku: product.skuCode, productName: product.productName } })
            }
        } else {
            const created = await prisma.priceListLine.create({
                data: {
                    priceListId: input.priceListId,
                    productId: input.productId,
                    unitPrice: input.unitPrice,
                    currency: input.currency ?? 'VND',
                },
            })
            logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'PriceListLine', entityId: created.id, newValue: { unitPrice: input.unitPrice, sku: product.skuCode, productName: product.productName, priceListName: priceList.name } })
        }

        await syncMarginPriceFromChannel(priceList.channel, product.id, product.skuCode, input.unitPrice)

        revalidateCache('priceList')
        revalidateCache('products')
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/products')
        revalidatePath('/dashboard/sales')
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
    return cached('priceList:products', async () => {
        return prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, skuCode: true, productName: true, wineType: true, volumeMl: true },
            orderBy: { productName: 'asc' },
        })
    }, 120_000) // 120s — reference data
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

        revalidateCache('priceList')
        revalidateCache('products')
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/products')
        revalidatePath('/dashboard/sales')
        return { success: true, updated: lines.length }
    } catch (err: any) {
        return { success: false, updated: 0, error: err.message }
    }
}

// ── Export all active SKUs with current price for Excel template / bulk update ──
export async function exportPriceListExcelData(priceListId: string) {
    const [pl, activeProducts] = await Promise.all([
        prisma.priceList.findUnique({
            where: { id: priceListId },
            include: {
                lines: {
                    select: { productId: true, unitPrice: true },
                },
            },
        }),
        prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, skuCode: true, productName: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        }),
    ])
    if (!pl) return []

    const priceMap = new Map(pl.lines.map(l => [l.productId, Number(l.unitPrice)]))

    // Put unpriced SKUs first so staff can immediately fill prices for newly created SKUs
    const sorted = [...activeProducts].sort((a, b) => {
        const hasA = priceMap.has(a.id) ? 1 : 0
        const hasB = priceMap.has(b.id) ? 1 : 0
        if (hasA !== hasB) return hasA - hasB
        return a.skuCode.localeCompare(b.skuCode)
    })

    return sorted.map(p => {
        const currentPrice = priceMap.get(p.id)
        return {
            SKU: p.skuCode,
            'Tên Sản Phẩm': p.productName,
            'Giá Bán (VND)': currentPrice !== undefined ? currentPrice : '',
            'Trạng Thái': currentPrice !== undefined ? 'Đã có giá' : 'Chưa có giá',
        }
    })
}

function parseUploadedPrice(val: any): number | null {
    if (val === undefined || val === null || val === '') return null
    if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? Math.round(val) : null
    let str = String(val).trim()
    if (!str) return null
    str = str.replace(/[₫đVNDvnd\s]/g, '')
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, '')
    } else if (/^\d{1,3}(,\d{3})+$/.test(str)) {
        str = str.replace(/,/g, '')
    } else {
        str = str.replace(/,/g, '')
    }
    const num = Number(str)
    return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

// ── Bulk Import / Update SKU prices into a Price List from Excel ──
export async function bulkImportPriceListLines(
    priceListId: string,
    rows: Record<string, any>[]
): Promise<{ success: number; errors: { row: number; message: string }[]; total: number }> {
    const result = { success: 0, errors: [] as { row: number; message: string }[], total: rows.length }
    if (rows.length > 1000) {
        result.errors.push({ row: 0, message: 'Tối đa 1000 dòng mỗi lần upload' })
        return result
    }

    const priceList = await prisma.priceList.findUnique({
        where: { id: priceListId },
        select: { id: true, name: true, channel: true },
    })
    if (!priceList) {
        result.errors.push({ row: 0, message: 'Không tìm thấy bảng giá' })
        return result
    }

    const allProducts = await prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true, skuCode: true, productName: true },
    })
    const skuMap = new Map(allProducts.map(p => [p.skuCode.trim().toLowerCase(), p]))

    const changes: { sku: string; unitPrice: number }[] = []

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
            const rawSku = String(
                r['SKU'] ?? r['Mã SKU'] ?? r['Mã hàng'] ?? r['Mã SP'] ?? r['skuCode'] ?? ''
            ).trim()
            if (!rawSku) continue

            const rawPrice =
                r['Giá Bán (VND)'] ??
                r['Giá Bán'] ??
                r['Giá Niêm Yết'] ??
                r['Giá Bán Buôn'] ??
                r['Giá Wholesale'] ??
                r['Giá Mới'] ??
                r['Đơn giá'] ??
                r['unitPrice'] ??
                r['price']

            // If price cell is empty in a template export, skip silently so staff can fill only new SKUs
            if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') {
                continue
            }

            const unitPrice = parseUploadedPrice(rawPrice)
            if (unitPrice === null || unitPrice <= 0) {
                result.errors.push({ row: i + 2, message: `SKU '${rawSku}': Giá bán không hợp lệ (${rawPrice})` })
                continue
            }

            const product = skuMap.get(rawSku.toLowerCase())
            if (!product) {
                result.errors.push({ row: i + 2, message: `SKU '${rawSku}' không tồn tại trong Danh mục Sản phẩm` })
                continue
            }

            await prisma.priceListLine.upsert({
                where: {
                    priceListId_productId: {
                        priceListId: priceList.id,
                        productId: product.id,
                    },
                },
                create: {
                    priceListId: priceList.id,
                    productId: product.id,
                    unitPrice,
                    currency: 'VND',
                },
                update: {
                    unitPrice,
                    currency: 'VND',
                },
            })

            await syncMarginPriceFromChannel(priceList.channel, product.id, product.skuCode, unitPrice)

            changes.push({ sku: product.skuCode, unitPrice })
            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success === 0 && result.errors.length === 0) {
        result.errors.push({ row: 0, message: 'Không tìm thấy dòng nào có dữ liệu Giá Bán (VND) hợp lệ để cập nhật' })
    }

    if (result.success > 0) {
        const user = await getCurrentUser().catch(() => null)
        logAudit({
            userId: user?.id,
            userName: user?.name,
            action: 'UPDATE',
            entityType: 'PriceList_ExcelImport',
            entityId: priceList.id,
            newValue: {
                priceListName: priceList.name,
                channel: priceList.channel,
                updatedCount: result.success,
                sampleChanges: changes.slice(0, 20),
            },
        })
        revalidateCache('priceList')
        revalidateCache('products')
        revalidateCache('pricing')
        revalidatePath('/dashboard/price-list')
        revalidatePath('/dashboard/products')
        revalidatePath('/dashboard/sales')
    }

    return result
}
