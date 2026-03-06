'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'

// ─── Types ────────────────────────────────────────
export type PORow = {
    id: string
    poNo: string
    supplierName: string
    supplierId: string
    currency: string
    exchangeRate: number
    status: string
    totalAmount: number
    lineCount: number
    totalQty: number
    createdAt: Date
    signatureUrl?: string | null
    documents?: { id: string; name: string; fileUrl: string; uploadedAt: Date }[]
}

export type PODetail = PORow & {
    lines: {
        id: string
        productId: string
        productName: string
        skuCode: string
        qtyOrdered: number
        unitPrice: number
        uom: string
        lineTotal: number
    }[]
}

// ─── POStatus enum ────────────────────────────────
// DRAFT | PENDING_APPROVAL | APPROVED | IN_TRANSIT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED

// ─── Seed system user if needed ──────────────────
async function getOrCreateSystemUser(): Promise<string> {
    const existing = await prisma.user.findFirst({
        where: { email: 'system@wine-erp.vn' },
        select: { id: true },
    })
    if (existing) return existing.id

    // Need a department first
    let dept = await prisma.department.findFirst({ select: { id: true } })
    if (!dept) {
        dept = await prisma.department.create({ data: { name: 'System' } })
    }

    const user = await prisma.user.create({
        data: {
            email: 'system@wine-erp.vn',
            name: 'System Admin',
            passwordHash: 'not-used',
            deptId: dept.id,
            status: 'ACTIVE',
        },
    })
    return user.id
}

// ─── List POs ─────────────────────────────────────
export async function getPurchaseOrders(filters: {
    search?: string
    status?: string
    supplierId?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: PORow[]; total: number }> {
    const { search, status, supplierId, page = 1, pageSize = 20 } = filters
    const cacheKey = `procurement:list:${page}:${pageSize}:${search ?? ''}:${status ?? ''}:${supplierId ?? ''}`
    return cached(cacheKey, async () => {

        const where: any = {}
        if (search) {
            where.OR = [
                { poNo: { contains: search, mode: 'insensitive' } },
                { supplier: { name: { contains: search, mode: 'insensitive' } } },
            ]
        }
        if (status) where.status = status
        if (supplierId) where.supplierId = supplierId

        const [items, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    supplier: { select: { name: true } },
                    lines: { select: { qtyOrdered: true, unitPrice: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.purchaseOrder.count({ where }),
        ])

        const rows = items.map(po => ({
            id: po.id,
            poNo: po.poNo,
            supplierName: po.supplier.name,
            supplierId: po.supplierId,
            currency: po.currency,
            exchangeRate: Number(po.exchangeRate),
            status: po.status,
            totalAmount: po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0),
            lineCount: po.lines.length,
            totalQty: po.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0),
            createdAt: po.createdAt,
        }))

        return { rows, total }
    }) // end cached
}

// ─── Get single PO with lines ─────────────────────
export async function getPODetail(id: string): Promise<PODetail | null> {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                },
            },
            documents: { orderBy: { uploadedAt: 'desc' } },
        },
    })
    if (!po) return null

    const lines = po.lines.map(l => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.productName,
        skuCode: l.product.skuCode,
        qtyOrdered: Number(l.qtyOrdered),
        unitPrice: Number(l.unitPrice),
        uom: l.uom,
        lineTotal: Number(l.qtyOrdered) * Number(l.unitPrice),
    }))

    return {
        id: po.id,
        poNo: po.poNo,
        supplierName: po.supplier.name,
        supplierId: po.supplierId,
        currency: po.currency,
        exchangeRate: Number(po.exchangeRate),
        status: po.status,
        totalAmount: lines.reduce((s, l) => s + l.lineTotal, 0),
        lineCount: lines.length,
        totalQty: lines.reduce((s, l) => s + l.qtyOrdered, 0),
        createdAt: po.createdAt,
        signatureUrl: po.signatureUrl,
        documents: po.documents,
        lines,
    }
}

// ─── Schema ───────────────────────────────────────
const poLineSchema = z.object({
    productId: z.string().min(1),
    qtyOrdered: z.number().positive(),
    unitPrice: z.number().positive(),
    uom: z.string().default('BOTTLE'),
})

const createPOSchema = z.object({
    supplierId: z.string().min(1, 'Chọn nhà cung cấp'),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
    exchangeRate: z.number().positive().default(25000),
    lines: z.array(poLineSchema).min(1, 'Cần ít nhất 1 dòng sản phẩm'),
})

export type CreatePOInput = z.infer<typeof createPOSchema>

// ─── Create PO ────────────────────────────────────
export async function createPurchaseOrder(input: CreatePOInput) {
    const data = createPOSchema.parse(input)
    const userId = await getOrCreateSystemUser()

    // Generate PO number: PO-YYMM-NNNN
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const count = await prisma.purchaseOrder.count()
    const poNo = `PO-${yy}${mm}-${String(count + 1).padStart(4, '0')}`

    const po = await prisma.purchaseOrder.create({
        data: {
            poNo,
            supplierId: data.supplierId,
            currency: data.currency,
            exchangeRate: data.exchangeRate,
            status: 'DRAFT',
            createdBy: userId,
            lines: {
                create: data.lines.map(l => ({
                    productId: l.productId,
                    qtyOrdered: l.qtyOrdered,
                    unitPrice: l.unitPrice,
                    uom: l.uom,
                })),
            },
        },
    })

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true, id: po.id, poNo: po.poNo }
}

// ─── Update PO status ─────────────────────────────
export async function updatePOStatus(id: string, status: string) {
    await prisma.purchaseOrder.update({
        where: { id },
        data: { status: status as any },
    })
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// ─── Stats for dashboard ──────────────────────────
export async function getPOStats() {
    return cached('procurement:stats', async () => {
        const [total, draft, approved, inTransit] = await Promise.all([
            prisma.purchaseOrder.count(),
            prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
            prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
            prisma.purchaseOrder.count({ where: { status: 'IN_TRANSIT' } }),
        ])
        return { total, draft, approved, inTransit }
    }) // end cached
}

// ─── Upload Documents & E-Sign ──────────────────────
import { uploadFile } from '@/lib/storage'

export async function uploadPODocument(poId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Chưa chọn file PO' }

        const uploadRes = await uploadFile(formData, 'po')
        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload failed' }
        }

        const doc = await prisma.pODocument.create({
            data: {
                poId,
                name: file.name,
                fileUrl: uploadRes.url,
            }
        })

        revalidateCache('procurement')
        revalidatePath('/dashboard/procurement')
        return { success: true, document: doc }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function signPO(poId: string, signatureUrl: string) {
    try {
        await prisma.purchaseOrder.update({
            where: { id: poId },
            data: { signatureUrl, status: 'APPROVED' },
        })
        revalidateCache('procurement')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── PO Variance Report (PO vs Actual Received) ────
export async function getPOVarianceReport(filters: {
    supplierId?: string
    dateFrom?: string
    dateTo?: string
} = {}) {
    const where: any = { status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } }
    if (filters.supplierId) where.supplierId = filters.supplierId
    if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
    }

    const pos = await prisma.purchaseOrder.findMany({
        where,
        include: {
            supplier: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    // Get goods receipts for these POs
    const poIds = pos.map(p => p.id)
    const grs = await prisma.goodsReceipt.findMany({
        where: { poId: { in: poIds }, status: 'CONFIRMED' },
        include: {
            lines: { select: { productId: true, qtyReceived: true } },
        },
    })

    // Aggregate actual received qty per PO×product
    const actualMap = new Map<string, number>()
    for (const gr of grs) {
        for (const line of gr.lines) {
            const key = `${gr.poId}::${line.productId}`
            actualMap.set(key, (actualMap.get(key) ?? 0) + Number(line.qtyReceived))
        }
    }

    const rows = []
    let totalOrdered = 0
    let totalReceived = 0

    for (const po of pos) {
        for (const line of po.lines) {
            const key = `${po.id}::${line.productId}`
            const ordered = Number(line.qtyOrdered)
            const received = actualMap.get(key) ?? 0
            const variance = received - ordered
            const variancePct = ordered > 0 ? ((variance / ordered) * 100) : 0

            totalOrdered += ordered
            totalReceived += received

            rows.push({
                poNo: po.poNo,
                supplierName: po.supplier.name,
                skuCode: line.product.skuCode,
                productName: line.product.productName,
                ordered,
                received,
                variance,
                variancePct: Math.round(variancePct * 10) / 10,
                unitPrice: Number(line.unitPrice),
                valueDiff: Math.round(variance * Number(line.unitPrice) * 100) / 100,
            })
        }
    }

    return {
        rows,
        summary: {
            totalOrdered,
            totalReceived,
            overallVariance: totalReceived - totalOrdered,
            overallVariancePct: totalOrdered > 0 ? Math.round(((totalReceived - totalOrdered) / totalOrdered) * 1000) / 10 : 0,
            poCount: pos.length,
        },
    }
}

// ─── PO Tax Engine: CIF → NK → TTĐB → VAT ────────
export async function calculatePOTax(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
            supplier: { select: { country: true } },
            lines: {
                include: {
                    product: { select: { hsCode: true, country: true, abvPercent: true, skuCode: true, productName: true } },
                },
            },
        },
    })
    if (!po) return null

    // Get applicable tax rates
    const taxRates = await prisma.taxRate.findMany({
        where: { effectiveDate: { lte: new Date() } },
        orderBy: { effectiveDate: 'desc' },
    })

    const lines = po.lines.map(line => {
        const hsCode = line.product.hsCode ?? ''
        const country = line.product.country ?? po.supplier.country ?? ''

        const rate = taxRates.find(t => t.hsCode === hsCode && t.countryOfOrigin === country)
            ?? taxRates.find(t => t.hsCode === hsCode)

        const qty = Number(line.qtyOrdered)
        const cifValue = qty * Number(line.unitPrice) * Number(po.exchangeRate)

        const importTaxRate = rate ? Number(rate.importTaxRate) / 100 : 0
        const sctRate = rate ? Number(rate.sctRate) / 100 : 0.35
        const vatRate = rate ? Number(rate.vatRate) / 100 : 0.10

        const importDuty = cifValue * importTaxRate
        const sctBase = cifValue + importDuty
        const sct = sctBase * sctRate
        const vatBase = sctBase + sct
        const vat = vatBase * vatRate

        return {
            skuCode: line.product.skuCode,
            productName: line.product.productName,
            qty,
            unitPrice: Number(line.unitPrice),
            cifValue: Math.round(cifValue),
            importTaxRate: importTaxRate * 100,
            importDuty: Math.round(importDuty),
            sctRate: sctRate * 100,
            sct: Math.round(sct),
            vatRate: vatRate * 100,
            vat: Math.round(vat),
            totalTax: Math.round(importDuty + sct + vat),
            landedPerUnit: Math.round((cifValue + importDuty + sct + vat) / qty),
        }
    })

    return {
        poNo: po.poNo,
        exchangeRate: Number(po.exchangeRate),
        currency: po.currency,
        lines,
        totals: {
            cifValue: lines.reduce((s, l) => s + l.cifValue, 0),
            importDuty: lines.reduce((s, l) => s + l.importDuty, 0),
            sct: lines.reduce((s, l) => s + l.sct, 0),
            vat: lines.reduce((s, l) => s + l.vat, 0),
            totalTax: lines.reduce((s, l) => s + l.totalTax, 0),
        },
    }
}

// ─── Import PO from parsed Excel data ─────────────
export async function importPOFromExcel(data: {
    supplierId: string
    currency: string
    exchangeRate: number
    contractId?: string
    lines: { productId: string; qtyOrdered: number; unitPrice: number }[]
}): Promise<{ success: boolean; poId?: string; error?: string }> {
    try {
        if (!data.lines.length) return { success: false, error: 'Không có dòng sản phẩm' }

        const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } })
        if (!supplier) return { success: false, error: 'Nhà cung cấp không tồn tại' }

        // Validate contract if provided
        if (data.contractId) {
            const contract = await prisma.contract.findUnique({ where: { id: data.contractId } })
            if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }
            if (contract.status !== 'ACTIVE') return { success: false, error: 'Hợp đồng không active' }
        }

        const userId = await getOrCreateSystemUser()
        const count = await prisma.purchaseOrder.count()
        const poNo = `PO-${String(count + 1).padStart(6, '0')}`

        const po = await prisma.purchaseOrder.create({
            data: {
                poNo,
                supplierId: data.supplierId,
                contractId: data.contractId ?? null,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                status: 'DRAFT',
                createdBy: userId,
                lines: {
                    create: data.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                    })),
                },
            },
        })

        revalidateCache('procurement')
        revalidatePath('/dashboard/procurement')
        return { success: true, poId: po.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// MULTI-CURRENCY VND CONVERSION
// ═══════════════════════════════════════════════════

export type POCurrencyBreakdown = {
    poId: string
    poNo: string
    currency: string
    exchangeRate: number
    totalForeign: number
    totalVND: number
    lines: {
        skuCode: string
        productName: string
        qty: number
        unitPriceForeign: number
        unitPriceVND: number
        lineTotalForeign: number
        lineTotalVND: number
    }[]
}

// Convert a specific PO to VND breakdown
export async function convertPOToVND(poId: string): Promise<{ success: boolean; data?: POCurrencyBreakdown; error?: string }> {
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                supplier: { select: { name: true } },
                lines: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
        })
        if (!po) return { success: false, error: 'PO không tồn tại' }

        const rate = Number(po.exchangeRate)
        const lines = po.lines.map(l => {
            const qty = Number(l.qtyOrdered)
            const unitPriceForeign = Number(l.unitPrice)
            return {
                skuCode: l.product.skuCode,
                productName: l.product.productName,
                qty,
                unitPriceForeign,
                unitPriceVND: Math.round(unitPriceForeign * rate),
                lineTotalForeign: qty * unitPriceForeign,
                lineTotalVND: Math.round(qty * unitPriceForeign * rate),
            }
        })

        return {
            success: true,
            data: {
                poId: po.id,
                poNo: po.poNo,
                currency: po.currency,
                exchangeRate: rate,
                totalForeign: lines.reduce((s, l) => s + l.lineTotalForeign, 0),
                totalVND: lines.reduce((s, l) => s + l.lineTotalVND, 0),
                lines,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Exchange Rate Summary across all POs
export async function getExchangeRateSummary(): Promise<{
    currencies: { currency: string; avgRate: number; minRate: number; maxRate: number; poCount: number; totalForeignValue: number; totalVNDValue: number }[]
}> {
    const result = await cached('procurement:fx-summary', async () => {
        const pos = await prisma.purchaseOrder.findMany({
            where: { status: { not: 'CANCELLED' } },
            select: {
                currency: true,
                exchangeRate: true,
                lines: { select: { qtyOrdered: true, unitPrice: true } },
            },
        })

        const map = new Map<string, { rates: number[]; totalForeign: number; count: number }>()
        for (const po of pos) {
            const rate = Number(po.exchangeRate)
            const totalFg = po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0)
            const entry = map.get(po.currency) ?? { rates: [], totalForeign: 0, count: 0 }
            entry.rates.push(rate)
            entry.totalForeign += totalFg
            entry.count++
            map.set(po.currency, entry)
        }

        const currencies = Array.from(map.entries()).map(([currency, data]) => ({
            currency,
            avgRate: Math.round(data.rates.reduce((a, b) => a + b, 0) / data.rates.length),
            minRate: Math.min(...data.rates),
            maxRate: Math.max(...data.rates),
            poCount: data.count,
            totalForeignValue: Math.round(data.totalForeign * 100) / 100,
            totalVNDValue: Math.round(data.totalForeign * (data.rates.reduce((a, b) => a + b, 0) / data.rates.length)),
        }))

        return { currencies }
    }, 120_000) // 2 min cache
    // Strip Prisma Decimal objects for Next.js client serialization
    return JSON.parse(JSON.stringify(result))
}
