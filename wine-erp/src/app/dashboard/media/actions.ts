'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { uploadFileToImgBB } from '@/lib/imgbb'

// ─── Types ────────────────────────────────────────

export type MediaItem = {
    id: string
    url: string
    thumbnailUrl: string | null
    mediumUrl: string | null
    mediaType: string
    isPrimary: boolean
    tags: string[]
    uploadedAt: Date
    product: {
        id: string
        productName: string
        skuCode: string
    }
}

export type MediaStats = {
    total: number
    byType: Record<string, number>
    productsWithMedia: number
    productsWithoutMedia: number
}

export type MediaFilters = {
    page?: number
    pageSize?: number
    search?: string
    mediaType?: string
    productId?: string
}

// ─── Get All Media ────────────────────────────────

export async function getAllMedia(
    filters: MediaFilters = {}
): Promise<{ items: MediaItem[]; total: number }> {
    const { page = 1, pageSize = 24, search, mediaType, productId } = filters

    const where: any = {}

    if (mediaType) where.mediaType = mediaType
    if (productId) where.productId = productId
    if (search) {
        where.product = {
            OR: [
                { productName: { contains: search, mode: 'insensitive' } },
                { skuCode: { contains: search, mode: 'insensitive' } },
            ],
        }
    }

    const [items, total] = await Promise.all([
        prisma.productMedia.findMany({
            where,
            include: {
                product: {
                    select: { id: true, productName: true, skuCode: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.productMedia.count({ where }),
    ])

    return {
        items: items.map(m => ({
            id: m.id,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            mediumUrl: m.mediumUrl,
            mediaType: m.mediaType,
            isPrimary: m.isPrimary,
            tags: m.tags,
            uploadedAt: m.uploadedAt,
            product: m.product,
        })),
        total,
    }
}

// ─── Stats ────────────────────────────────────────

export async function getMediaStats(): Promise<MediaStats> {
    return cached('media:stats', async () => {
        const [total, byType, productsWithMedia, totalProducts] = await Promise.all([
            prisma.productMedia.count(),
            prisma.productMedia.groupBy({
                by: ['mediaType'],
                _count: { id: true },
            }),
            prisma.productMedia.findMany({
                select: { productId: true },
                distinct: ['productId'],
            }),
            prisma.product.count({ where: { deletedAt: null } }),
        ])

        const typeMap: Record<string, number> = {}
        for (const row of byType) {
            typeMap[row.mediaType] = row._count.id
        }

        return {
            total,
            byType: typeMap,
            productsWithMedia: productsWithMedia.length,
            productsWithoutMedia: totalProducts - productsWithMedia.length,
        }
    }, 30_000)
}

// ─── Upload to specific product ───────────────────

export async function uploadMediaToProduct(
    productId: string,
    formData: FormData,
    mediaType: string = 'PRODUCT_MAIN'
): Promise<{ success: boolean; error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file || file.size === 0) return { success: false, error: 'Không có file' }
        if (file.size > 10 * 1024 * 1024) return { success: false, error: 'File quá lớn (max 10MB)' }
        if (!file.type.startsWith('image/')) return { success: false, error: 'Chỉ chấp nhận file ảnh' }

        const result = await uploadFileToImgBB(file)
        if (!result.success || !result.url) {
            return { success: false, error: result.error ?? 'Upload ImgBB thất bại' }
        }

        const existingCount = await prisma.productMedia.count({ where: { productId } })

        await prisma.productMedia.create({
            data: {
                productId,
                url: result.url,
                thumbnailUrl: result.thumbUrl ?? null,
                mediumUrl: result.mediumUrl ?? null,
                mediaType: mediaType as any,
                isPrimary: existingCount === 0,
            },
        })

        revalidateCache('media:stats')
        revalidateCache('products')
        revalidatePath('/dashboard/media')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Delete ───────────────────────────────────────

export async function deleteMedia(mediaId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const media = await prisma.productMedia.findUnique({
            where: { id: mediaId },
            select: { productId: true, isPrimary: true },
        })
        if (!media) return { success: false, error: 'Ảnh không tồn tại' }

        await prisma.productMedia.delete({ where: { id: mediaId } })

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

        revalidateCache('media:stats')
        revalidateCache('products')
        revalidatePath('/dashboard/media')
        revalidatePath('/dashboard/products')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Bulk Delete ──────────────────────────────────

export async function bulkDeleteMedia(
    mediaIds: string[]
): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
        const result = await prisma.productMedia.deleteMany({
            where: { id: { in: mediaIds } },
        })

        revalidateCache('media:stats')
        revalidateCache('products')
        revalidatePath('/dashboard/media')
        revalidatePath('/dashboard/products')
        return { success: true, deleted: result.count }
    } catch (err: any) {
        return { success: false, deleted: 0, error: err.message }
    }
}

// ─── Get products for selector ────────────────────

export async function getProductsForUpload(): Promise<{ id: string; name: string; sku: string }[]> {
    const products = await prisma.product.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, productName: true, skuCode: true },
        orderBy: { productName: 'asc' },
    })
    return products.map(p => ({ id: p.id, name: p.productName, sku: p.skuCode }))
}
