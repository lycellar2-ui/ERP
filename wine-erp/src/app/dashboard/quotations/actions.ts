'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { randomUUID } from 'crypto'

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED'

export type QuotationRow = {
    id: string
    quotationNo: string
    customerName: string
    customerCode: string
    channel: string
    salesRepName: string
    totalAmount: number
    status: QuotationStatus
    validUntil: Date
    lineCount: number
    createdAt: Date
    publicToken: string | null
    viewCount: number
    firstViewedAt: Date | null
    lastViewedAt: Date | null
    sentAt: Date | null
    sentMethod: string | null
    customerEmail: string | null
    orderDiscount: number
    vatIncluded: boolean
}

// ── List quotations ─────────────────────────────
export async function getQuotations(filters: { search?: string; status?: string } = {}): Promise<QuotationRow[]> {
    const cacheKey = `quotations:list:${filters.search ?? ''}:${filters.status ?? ''}`
    return cached(cacheKey, async () => {
        const where: any = {}
        if (filters.status) where.status = filters.status
        if (filters.search) {
            where.OR = [
                { quotationNo: { contains: filters.search, mode: 'insensitive' } },
                { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            ]
        }

        const rows = await prisma.salesQuotation.findMany({
            where,
            include: {
                customer: { select: { name: true, code: true } },
                salesRep: { select: { name: true } },
                _count: { select: { lines: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return rows.map(r => ({
            id: r.id,
            quotationNo: r.quotationNo,
            customerName: r.customer.name,
            customerCode: r.customer.code,
            channel: r.channel,
            salesRepName: r.salesRep.name,
            totalAmount: Number(r.totalAmount),
            status: r.status as QuotationStatus,
            validUntil: r.validUntil,
            lineCount: r._count.lines,
            createdAt: r.createdAt,
            publicToken: r.publicToken,
            viewCount: r.viewCount,
            firstViewedAt: r.firstViewedAt,
            lastViewedAt: r.lastViewedAt,
            sentAt: r.sentAt,
            sentMethod: r.sentMethod,
            customerEmail: r.customerEmail,
            orderDiscount: Number(r.orderDiscount),
            vatIncluded: r.vatIncluded,
        }))
    }) // end cached
}

// ── Get detail ───────────────────────────────────
export async function getQuotationDetail(id: string) {
    return prisma.salesQuotation.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, channel: true, paymentTerm: true, contacts: { select: { email: true, phone: true }, take: 1 } } },
            salesRep: { select: { name: true, email: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            skuCode: true, productName: true, wineType: true, volumeMl: true,
                            vintage: true, country: true, abvPercent: true, tastingNotes: true, classification: true,
                            producer: { select: { name: true } },
                            appellation: { select: { name: true, region: { select: { name: true } } } },
                            media: { where: { isPrimary: true }, select: { url: true, thumbnailUrl: true }, take: 1 },
                            awards: { select: { source: true, score: true, medal: true }, take: 3 },
                        },
                    },
                },
            },
        },
    })
}

// ── Create quotation ────────────────────────────
export async function createQuotation(input: {
    customerId: string
    salesRepId: string
    channel: string
    paymentTerm: string
    validUntil: string
    orderDiscount?: number
    notes?: string
    terms?: string
    vatIncluded?: boolean
    deliveryTerms?: string
    companyName?: string
    contactPerson?: string
    customerEmail?: string
    customerPhone?: string
    pdfStyle?: string
    lines: { productId: string; qtyOrdered: number; unitPrice: number; lineDiscountPct?: number }[]
}): Promise<{ success: boolean; id?: string; quotationNo?: string; error?: string }> {
    try {
        const count = await prisma.salesQuotation.count()
        const quotationNo = `QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`

        const totalAmount = input.lines.reduce((sum, l) => {
            const lineTotal = l.qtyOrdered * l.unitPrice * (1 - (l.lineDiscountPct ?? 0) / 100)
            return sum + lineTotal
        }, 0)

        const finalAmount = totalAmount * (1 - (input.orderDiscount ?? 0) / 100)

        const qt = await prisma.salesQuotation.create({
            data: {
                quotationNo,
                customerId: input.customerId,
                salesRepId: input.salesRepId,
                channel: input.channel as any,
                paymentTerm: input.paymentTerm,
                validUntil: new Date(input.validUntil),
                orderDiscount: input.orderDiscount ?? 0,
                totalAmount: finalAmount,
                notes: input.notes,
                terms: input.terms,
                vatIncluded: input.vatIncluded ?? false,
                deliveryTerms: input.deliveryTerms,
                companyName: input.companyName,
                contactPerson: input.contactPerson,
                customerEmail: input.customerEmail,
                customerPhone: input.customerPhone,
                pdfStyle: input.pdfStyle ?? 'professional',
                publicToken: randomUUID(),
                status: 'DRAFT',
                lines: {
                    create: input.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                        lineDiscountPct: l.lineDiscountPct ?? 0,
                    })),
                },
            },
        })

        revalidateCache('quotations')
        revalidatePath('/dashboard/quotations')
        return { success: true, id: qt.id, quotationNo: qt.quotationNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Update quotation (DRAFT only) ───────────────
export async function updateQuotation(id: string, input: {
    customerId?: string
    channel?: string
    paymentTerm?: string
    validUntil?: string
    orderDiscount?: number
    notes?: string
    terms?: string
    vatIncluded?: boolean
    deliveryTerms?: string
    companyName?: string
    contactPerson?: string
    customerEmail?: string
    customerPhone?: string
    pdfStyle?: string
    lines?: { productId: string; qtyOrdered: number; unitPrice: number; lineDiscountPct?: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({ where: { id } })
        if (!qt) return { success: false, error: 'Không tìm thấy báo giá' }
        if (qt.status !== 'DRAFT') return { success: false, error: 'Chỉ có thể sửa báo giá ở trạng thái Nháp' }

        const updateData: any = {}
        if (input.customerId) updateData.customerId = input.customerId
        if (input.channel) updateData.channel = input.channel
        if (input.paymentTerm) updateData.paymentTerm = input.paymentTerm
        if (input.validUntil) updateData.validUntil = new Date(input.validUntil)
        if (input.orderDiscount !== undefined) updateData.orderDiscount = input.orderDiscount
        if (input.notes !== undefined) updateData.notes = input.notes
        if (input.terms !== undefined) updateData.terms = input.terms
        if (input.vatIncluded !== undefined) updateData.vatIncluded = input.vatIncluded
        if (input.deliveryTerms !== undefined) updateData.deliveryTerms = input.deliveryTerms
        if (input.companyName !== undefined) updateData.companyName = input.companyName
        if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson
        if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail
        if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone
        if (input.pdfStyle) updateData.pdfStyle = input.pdfStyle

        if (input.lines) {
            const totalAmount = input.lines.reduce((sum, l) => {
                return sum + l.qtyOrdered * l.unitPrice * (1 - (l.lineDiscountPct ?? 0) / 100)
            }, 0)
            updateData.totalAmount = totalAmount * (1 - (input.orderDiscount ?? Number(qt.orderDiscount)) / 100)

            // Delete old lines and recreate
            await prisma.salesQuotationLine.deleteMany({ where: { quotationId: id } })
            await prisma.salesQuotationLine.createMany({
                data: input.lines.map(l => ({
                    quotationId: id,
                    productId: l.productId,
                    qtyOrdered: l.qtyOrdered,
                    unitPrice: l.unitPrice,
                    lineDiscountPct: l.lineDiscountPct ?? 0,
                })),
            })
        }

        await prisma.salesQuotation.update({ where: { id }, data: updateData })

        revalidateCache('quotations')
        revalidatePath('/dashboard/quotations')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Update status ────────────────────────────────
export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.salesQuotation.update({ where: { id }, data: { status: status as any } })
        revalidateCache('quotations')
        revalidatePath('/dashboard/quotations')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Send quotation (generate token + email) ─────
export async function sendQuotation(id: string, method: 'EMAIL' | 'LINK' | 'ZALO'): Promise<{
    success: boolean; publicUrl?: string; error?: string
}> {
    try {
        const qt = await prisma.salesQuotation.findUnique({
            where: { id },
            include: {
                customer: { select: { name: true, contacts: { select: { email: true }, take: 1 } } },
                salesRep: { select: { name: true, email: true } },
            },
        })
        if (!qt) return { success: false, error: 'Báo giá không tồn tại' }

        // Ensure token exists
        let token = qt.publicToken
        if (!token) {
            token = randomUUID()
            await prisma.salesQuotation.update({ where: { id }, data: { publicToken: token } })
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const publicUrl = `${baseUrl}/verify/quotation/${token}`

        // Update status and tracking
        await prisma.salesQuotation.update({
            where: { id },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                sentMethod: method,
            },
        })

        // Send email if method is EMAIL
        if (method === 'EMAIL') {
            const recipientEmail = qt.customerEmail || qt.customer.contacts?.[0]?.email
            if (recipientEmail) {
                const { notifyQuotationSent } = await import('@/lib/notifications')
                await notifyQuotationSent({
                    quotationNo: qt.quotationNo,
                    customerName: qt.customer.name,
                    totalAmount: Number(qt.totalAmount),
                    salesRepName: qt.salesRep.name,
                    recipientEmail,
                    publicUrl,
                    validUntil: qt.validUntil.toLocaleDateString('vi-VN'),
                })
            }
        }

        revalidateCache('quotations')
        revalidatePath('/dashboard/quotations')
        return { success: true, publicUrl }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Convert Quotation → Sales Order ─────────────
export async function convertQuotationToSO(quotationId: string): Promise<{ success: boolean; soNo?: string; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({
            where: { id: quotationId },
            include: { lines: true },
        })
        if (!qt) return { success: false, error: 'Quotation không tồn tại' }
        if (qt.status === 'CONVERTED') return { success: false, error: 'Quotation đã được chuyển thành SO' }
        if (qt.status === 'CANCELLED' || qt.status === 'EXPIRED') {
            return { success: false, error: 'Quotation đã hủy hoặc hết hạn' }
        }

        const soCount = await prisma.salesOrder.count()
        const soNo = `SO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(soCount + 1).padStart(3, '0')}`

        const so = await prisma.salesOrder.create({
            data: {
                soNo,
                customerId: qt.customerId,
                salesRepId: qt.salesRepId,
                channel: qt.channel,
                paymentTerm: qt.paymentTerm,
                orderDiscount: qt.orderDiscount,
                totalAmount: qt.totalAmount,
                status: 'DRAFT',
                lines: {
                    create: qt.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                        lineDiscountPct: l.lineDiscountPct,
                    })),
                },
            },
        })

        await prisma.salesQuotation.update({
            where: { id: quotationId },
            data: { status: 'CONVERTED', convertedSoId: so.id },
        })

        revalidatePath('/dashboard/quotations')
        revalidatePath('/dashboard/sales')
        return { success: true, soNo: so.soNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Quotation stats ─────────────────────────────
export async function getQuotationStats() {
    return cached('quotations:stats', async () => {
        const byStatus = await prisma.salesQuotation.groupBy({
            by: ['status'],
            _count: true,
            _sum: { totalAmount: true },
        })
        const map = Object.fromEntries(byStatus.map(s => [s.status, { count: s._count, amount: Number(s._sum.totalAmount ?? 0) }]))
        return {
            total: byStatus.reduce((s, r) => s + r._count, 0),
            draft: map['DRAFT']?.count ?? 0,
            sent: map['SENT']?.count ?? 0,
            accepted: map['ACCEPTED']?.count ?? 0,
            converted: map['CONVERTED']?.count ?? 0,
            totalValue: byStatus.reduce((s, r) => s + Number(r._sum.totalAmount ?? 0), 0),
        }
    }) // end cached
}

// ── Auto-expire quotations past validUntil ──────
export async function autoExpireQuotations(): Promise<{ success: boolean; expired: number; error?: string }> {
    try {
        const now = new Date()
        const result = await prisma.salesQuotation.updateMany({
            where: {
                status: { in: ['DRAFT', 'SENT'] },
                validUntil: { lt: now },
            },
            data: { status: 'EXPIRED' },
        })
        if (result.count > 0) {
            revalidatePath('/dashboard/quotations')
        }
        return { success: true, expired: result.count }
    } catch (err: any) {
        return { success: false, expired: 0, error: err.message }
    }
}

// ── Duplicate quotation ─────────────────────────
export async function duplicateQuotation(quotationId: string): Promise<{ success: boolean; quotationNo?: string; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({
            where: { id: quotationId },
            include: { lines: true },
        })
        if (!qt) return { success: false, error: 'Quotation không tồn tại' }

        const count = await prisma.salesQuotation.count()
        const quotationNo = `QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`

        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 30)

        await prisma.salesQuotation.create({
            data: {
                quotationNo,
                customerId: qt.customerId,
                salesRepId: qt.salesRepId,
                channel: qt.channel,
                paymentTerm: qt.paymentTerm,
                validUntil,
                orderDiscount: qt.orderDiscount,
                totalAmount: qt.totalAmount,
                notes: qt.notes ? `[Sao chép từ ${qt.quotationNo}] ${qt.notes}` : `Sao chép từ ${qt.quotationNo}`,
                terms: qt.terms,
                deliveryTerms: qt.deliveryTerms,
                vatIncluded: qt.vatIncluded,
                companyName: qt.companyName,
                contactPerson: qt.contactPerson,
                customerEmail: qt.customerEmail,
                customerPhone: qt.customerPhone,
                pdfStyle: qt.pdfStyle,
                publicToken: randomUUID(),
                status: 'DRAFT',
                lines: {
                    create: qt.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                        lineDiscountPct: l.lineDiscountPct,
                    })),
                },
            },
        })

        revalidatePath('/dashboard/quotations')
        return { success: true, quotationNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Export quotation to Excel ───────────────────
export async function exportQuotationExcel(quotationId: string): Promise<{ success: boolean; base64?: string; filename?: string; error?: string }> {
    try {
        const qt = await prisma.salesQuotation.findUnique({
            where: { id: quotationId },
            include: {
                customer: { select: { name: true, code: true } },
                salesRep: { select: { name: true } },
                lines: { include: { product: { select: { skuCode: true, productName: true, wineType: true, volumeMl: true } } } },
            },
        })
        if (!qt) return { success: false, error: 'Quotation không tồn tại' }

        const { generateExcelBuffer } = await import('@/lib/excel')
        const rows = qt.lines.map((l, i) => ({
            stt: i + 1,
            skuCode: l.product.skuCode,
            productName: l.product.productName,
            wineType: l.product.wineType,
            volumeMl: l.product.volumeMl,
            qty: Number(l.qtyOrdered),
            unitPrice: Number(l.unitPrice),
            discount: Number(l.lineDiscountPct),
            lineTotal: Number(l.qtyOrdered) * Number(l.unitPrice) * (1 - Number(l.lineDiscountPct) / 100),
        }))

        const buffer = await generateExcelBuffer({
            sheetName: qt.quotationNo,
            title: `BÁO GIÁ ${qt.quotationNo} — ${qt.customer.name}`,
            columns: [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Mã SKU', key: 'skuCode', width: 15 },
                { header: 'Tên sản phẩm', key: 'productName', width: 30 },
                { header: 'Loại', key: 'wineType', width: 12 },
                { header: 'ml', key: 'volumeMl', width: 8 },
                { header: 'SL', key: 'qty', width: 8, numFmt: '#,##0' },
                { header: 'Đơn giá', key: 'unitPrice', width: 15, numFmt: '#,##0' },
                { header: 'CK %', key: 'discount', width: 8, numFmt: '0.0' },
                { header: 'Thành tiền', key: 'lineTotal', width: 18, numFmt: '#,##0' },
            ],
            rows,
        })

        return {
            success: true,
            base64: Buffer.from(buffer).toString('base64'),
            filename: `${qt.quotationNo}.xlsx`,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

