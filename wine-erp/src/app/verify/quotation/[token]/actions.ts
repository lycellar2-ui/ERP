'use server'

import { prisma } from '@/lib/db'

// Get quotation by public token + track view
export async function getQuotationByToken(token: string) {
    const qt = await prisma.salesQuotation.findUnique({
        where: { publicToken: token },
        include: {
            customer: { select: { name: true, code: true, channel: true } },
            salesRep: { select: { name: true, email: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            skuCode: true,
                            productName: true,
                            wineType: true,
                            volumeMl: true,
                            vintage: true,
                            country: true,
                            abvPercent: true,
                            tastingNotes: true,
                            classification: true,
                            format: true,
                            packagingType: true,
                            producer: { select: { name: true } },
                            appellation: { select: { name: true, region: { select: { name: true } } } },
                            media: {
                                where: { isPrimary: true },
                                select: { url: true, thumbnailUrl: true },
                                take: 1,
                            },
                            awards: {
                                select: { source: true, score: true, medal: true, vintage: true },
                                take: 3,
                            },
                        },
                    },
                },
            },
        },
    })

    if (!qt) return null

    // Track view (fire-and-forget)
    prisma.salesQuotation.update({
        where: { id: qt.id },
        data: {
            viewCount: { increment: 1 },
            lastViewedAt: new Date(),
            ...(qt.firstViewedAt ? {} : { firstViewedAt: new Date() }),
        },
    }).catch(() => { })

    return qt
}

// Customer accepts quotation from public page
export async function acceptQuotationPublic(token: string): Promise<{ success: boolean; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({ where: { publicToken: token } })
        if (!qt) return { success: false, error: 'Báo giá không tồn tại' }
        if (qt.status !== 'DRAFT' && qt.status !== 'SENT') {
            return { success: false, error: 'Báo giá không còn hiệu lực' }
        }
        if (qt.validUntil < new Date()) {
            return { success: false, error: 'Báo giá đã hết hạn' }
        }

        await prisma.salesQuotation.update({
            where: { id: qt.id },
            data: { status: 'ACCEPTED' },
        })

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Customer rejects quotation from public page
export async function rejectQuotationPublic(token: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({ where: { publicToken: token } })
        if (!qt) return { success: false, error: 'Báo giá không tồn tại' }

        await prisma.salesQuotation.update({
            where: { id: qt.id },
            data: { status: 'CANCELLED', rejectedReason: reason },
        })

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
