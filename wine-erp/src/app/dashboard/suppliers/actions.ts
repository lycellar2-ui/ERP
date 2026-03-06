'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'

export type SupplierRow = {
    id: string
    code: string
    name: string
    type: string
    country: string
    taxId: string | null
    tradeAgreement: string | null
    coFormType: string | null
    paymentTerm: string | null
    defaultCurrency: string
    incoterms: string | null
    leadTimeDays: number
    status: string
    poCount: number
    createdAt: Date
}

export async function getSuppliers(params?: {
    search?: string; type?: string; status?: string; country?: string; page?: number; pageSize?: number
}): Promise<{ rows: SupplierRow[]; total: number }> {
    const { search, type, status, country, page = 1, pageSize = 25 } = params ?? {}
    const where: any = { deletedAt: null }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ]
    }
    if (type) where.type = type
    if (status) where.status = status
    if (country) where.country = country

    const [items, total] = await Promise.all([
        prisma.supplier.findMany({
            where,
            include: { purchaseOrders: { select: { id: true } } },
            orderBy: { name: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.supplier.count({ where }),
    ])

    return {
        rows: items.map(s => ({
            id: s.id, code: s.code, name: s.name, type: s.type,
            country: s.country, taxId: s.taxId,
            tradeAgreement: s.tradeAgreement, coFormType: s.coFormType,
            paymentTerm: s.paymentTerm, defaultCurrency: s.defaultCurrency,
            incoterms: s.incoterms, leadTimeDays: s.leadTimeDays ?? 45,
            status: s.status, poCount: s.purchaseOrders.length,
            createdAt: s.createdAt,
        })),
        total,
    }
}

const supplierSchema = z.object({
    code: z.string().min(3, 'Mã NCC bắt buộc'),
    name: z.string().min(2, 'Tên NCC bắt buộc'),
    type: z.enum(['WINERY', 'NEGOCIANT', 'DISTRIBUTOR', 'LOGISTICS', 'FORWARDER', 'CUSTOMS_BROKER']),
    country: z.string().min(2).max(2),
    taxId: z.string().nullable().optional(),
    tradeAgreement: z.string().nullable().optional(),
    coFormType: z.string().nullable().optional(),
    paymentTerm: z.string().nullable().optional(),
    defaultCurrency: z.string().default('USD'),
    incoterms: z.string().nullable().optional(),
    leadTimeDays: z.number().int().default(45),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export async function createSupplier(input: SupplierInput) {
    const data = supplierSchema.parse(input)
    await prisma.supplier.create({
        data: {
            code: data.code,
            name: data.name,
            type: data.type,
            country: data.country,
            taxId: data.taxId ?? null,
            tradeAgreement: data.tradeAgreement ?? null,
            coFormType: data.coFormType ?? null,
            paymentTerm: data.paymentTerm ?? null,
            defaultCurrency: data.defaultCurrency,
            incoterms: data.incoterms ?? null,
            leadTimeDays: data.leadTimeDays,
            status: data.status,
        },
    })
    revalidatePath('/dashboard/suppliers')
    return { success: true }
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
    await prisma.supplier.update({ where: { id }, data: input as any })
    revalidatePath('/dashboard/suppliers')
    return { success: true }
}

// ── Soft delete supplier ──────────────────────────
export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const activePOs = await prisma.purchaseOrder.count({
            where: { supplierId: id, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
        })
        if (activePOs > 0) {
            return { success: false, error: `Không thể xoá. NCC đang có ${activePOs} đơn hàng chưa hoàn tất.` }
        }

        await prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'INACTIVE' },
        })
        revalidateCache('suppliers')
        revalidatePath('/dashboard/suppliers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Bulk import from Excel ──────────────────────────
export type ImportResult = {
    success: number
    errors: { row: number; message: string }[]
    total: number
}

export async function bulkImportSuppliers(rows: Record<string, any>[]): Promise<ImportResult> {
    const result: ImportResult = { success: 0, errors: [], total: rows.length }
    if (rows.length > 500) {
        result.errors.push({ row: 0, message: 'Tối đa 500 dòng mỗi lần import' })
        return result
    }

    const validTypes = ['WINERY', 'NEGOCIANT', 'DISTRIBUTOR', 'LOGISTICS', 'FORWARDER', 'CUSTOMS_BROKER']
    const typeMap: Record<string, string> = {
        'Winery': 'WINERY', 'Négociant': 'NEGOCIANT', 'Distributor': 'DISTRIBUTOR',
        'Logistics': 'LOGISTICS', 'Forwarder': 'FORWARDER', 'Customs Broker': 'CUSTOMS_BROKER',
    }

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
            const code = String(r['Mã NCC'] ?? r['code'] ?? '').trim()
            const name = String(r['Tên NCC'] ?? r['name'] ?? '').trim()
            if (!code || !name) { result.errors.push({ row: i + 2, message: 'Thiếu Mã NCC hoặc Tên NCC' }); continue }

            const rawType = String(r['Loại'] ?? r['type'] ?? 'WINERY').trim()
            const supplierType = typeMap[rawType] ?? rawType
            if (!validTypes.includes(supplierType)) {
                result.errors.push({ row: i + 2, message: `Loại NCC không hợp lệ: ${rawType}` }); continue
            }

            const country = String(r['Quốc Gia'] ?? r['country'] ?? '').trim()
            if (!country || country.length !== 2) {
                result.errors.push({ row: i + 2, message: 'Quốc gia phải là mã 2 ký tự (FR, IT, US...)' }); continue
            }

            const existing = await prisma.supplier.findFirst({ where: { code, deletedAt: null } })
            if (existing) { result.errors.push({ row: i + 2, message: `Mã NCC '${code}' đã tồn tại — bỏ qua` }); continue }

            await prisma.supplier.create({
                data: {
                    code,
                    name,
                    type: supplierType as any,
                    country: country.toUpperCase(),
                    taxId: r['MST'] ?? r['taxId'] ?? null,
                    tradeAgreement: r['Hiệp Định'] ?? r['tradeAgreement'] ?? null,
                    paymentTerm: r['Thanh Toán'] ?? r['paymentTerm'] ?? null,
                    defaultCurrency: r['Tiền Tệ'] ?? r['currency'] ?? 'USD',
                    incoterms: r['Incoterms'] ?? r['incoterms'] ?? null,
                    leadTimeDays: Number(r['Lead Time'] ?? r['leadTimeDays'] ?? 45),
                    status: 'ACTIVE',
                },
            })
            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success > 0) {
        revalidatePath('/dashboard/suppliers')
    }
    return result
}

// ═══════════════════════════════════════════════════
// #31 — SUPPLIER SCORECARD
// ═══════════════════════════════════════════════════

export type SupplierScorecard = {
    supplierId: string
    supplierName: string
    totalPOs: number
    onTimeDeliveries: number
    lateDeliveries: number
    onTimeRate: number
    avgLeadTimeDays: number
    qualityScore: number
    overallScore: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export async function getSupplierScorecard(supplierId: string): Promise<SupplierScorecard | null> {
    const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, name: true, leadTimeDays: true },
    })
    if (!supplier) return null

    const pos = await prisma.purchaseOrder.findMany({
        where: { supplierId, status: 'RECEIVED' },
        select: { estimatedDelivery: true, createdAt: true, receivedAt: true },
    })

    let onTime = 0
    let late = 0
    let totalLeadDays = 0

    for (const po of pos) {
        const received = po.receivedAt ?? new Date()
        const estimated = po.estimatedDelivery
        if (estimated && received <= estimated) onTime++
        else late++

        const leadDays = Math.floor((received.getTime() - po.createdAt.getTime()) / 86400000)
        totalLeadDays += leadDays
    }

    const totalPOs = pos.length
    const onTimeRate = totalPOs > 0 ? (onTime / totalPOs) * 100 : 0
    const avgLeadTimeDays = totalPOs > 0 ? Math.round(totalLeadDays / totalPOs) : supplier.leadTimeDays

    // Quality: based on complaint tickets linked to products from this supplier
    const complaints = await prisma.complaintTicket.count({
        where: { type: 'QUALITY' },
    })
    const qualityScore = Math.max(0, 100 - complaints * 5)

    const overallScore = Math.round(onTimeRate * 0.5 + qualityScore * 0.3 + Math.min(100, (1 - Math.max(0, avgLeadTimeDays - 30) / 90) * 100) * 0.2)
    const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F'

    return {
        supplierId,
        supplierName: supplier.name,
        totalPOs,
        onTimeDeliveries: onTime,
        lateDeliveries: late,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        avgLeadTimeDays,
        qualityScore,
        overallScore,
        grade,
    }
}

export async function getAllSupplierScorecards(): Promise<SupplierScorecard[]> {
    const suppliers = await prisma.supplier.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
    })

    const scorecards: SupplierScorecard[] = []
    for (const s of suppliers) {
        const sc = await getSupplierScorecard(s.id)
        if (sc) scorecards.push(sc)
    }
    return scorecards.sort((a, b) => b.overallScore - a.overallScore)
}

// ═══════════════════════════════════════════════════
// #32 — DUPLICATE DETECTION
// ═══════════════════════════════════════════════════

export type DuplicateCandidate = {
    type: 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER'
    itemA: { id: string; code: string; name: string }
    itemB: { id: string; code: string; name: string }
    similarity: number
    field: string
}

function strSimilarity(a: string, b: string): number {
    const aLow = a.toLowerCase().trim()
    const bLow = b.toLowerCase().trim()
    if (aLow === bLow) return 100
    if (aLow.includes(bLow) || bLow.includes(aLow)) return 85

    // Simple Dice coefficient on bigrams
    const bigrams = (s: string) => {
        const set = new Set<string>()
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
        return set
    }
    const bgA = bigrams(aLow)
    const bgB = bigrams(bLow)
    let inter = 0
    bgA.forEach(b => { if (bgB.has(b)) inter++ })
    return Math.round((2 * inter) / (bgA.size + bgB.size) * 100)
}

export async function detectDuplicates(): Promise<DuplicateCandidate[]> {
    const [products, customers, suppliers] = await Promise.all([
        prisma.product.findMany({
            where: { deletedAt: null },
            select: { id: true, skuCode: true, productName: true },
        }),
        prisma.customer.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true },
        }),
        prisma.supplier.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true },
        }),
    ])

    const dupes: DuplicateCandidate[] = []
    const threshold = 75

    // Check products
    for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
            const a = products[i], b = products[j]
            const nameSim = strSimilarity(a.productName, b.productName)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'PRODUCT',
                    itemA: { id: a.id, code: a.skuCode, name: a.productName },
                    itemB: { id: b.id, code: b.skuCode, name: b.productName },
                    similarity: nameSim,
                    field: 'productName',
                })
            }
            const codeSim = strSimilarity(a.skuCode, b.skuCode)
            if (codeSim >= 90 && codeSim < 100) {
                dupes.push({
                    type: 'PRODUCT',
                    itemA: { id: a.id, code: a.skuCode, name: a.productName },
                    itemB: { id: b.id, code: b.skuCode, name: b.productName },
                    similarity: codeSim,
                    field: 'skuCode',
                })
            }
        }
    }

    // Check customers
    for (let i = 0; i < customers.length; i++) {
        for (let j = i + 1; j < customers.length; j++) {
            const a = customers[i], b = customers[j]
            const nameSim = strSimilarity(a.name, b.name)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'CUSTOMER',
                    itemA: { id: a.id, code: a.code, name: a.name },
                    itemB: { id: b.id, code: b.code, name: b.name },
                    similarity: nameSim,
                    field: 'name',
                })
            }
        }
    }

    // Check suppliers
    for (let i = 0; i < suppliers.length; i++) {
        for (let j = i + 1; j < suppliers.length; j++) {
            const a = suppliers[i], b = suppliers[j]
            const nameSim = strSimilarity(a.name, b.name)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'SUPPLIER',
                    itemA: { id: a.id, code: a.code, name: a.name },
                    itemB: { id: b.id, code: b.code, name: b.name },
                    similarity: nameSim,
                    field: 'name',
                })
            }
        }
    }

    return dupes.sort((a, b) => b.similarity - a.similarity)
}
