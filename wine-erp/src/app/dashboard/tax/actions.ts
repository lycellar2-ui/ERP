'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────
export interface TaxRateRow {
    id: string
    hsCode: string
    countryOfOrigin: string
    tradeAgreement: string
    importTaxRate: number
    sctRate: number
    vatRate: number
    effectiveDate: Date
    expiryDate: Date | null
    requiresCo: boolean
    coFormType: string | null
    notes: string | null
}

// ─── List / Search ────────────────────────────────
export async function getTaxRates(filters: {
    hsCode?: string
    country?: string
    agreement?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: TaxRateRow[]; total: number }> {
    const { hsCode, country, agreement, page = 1, pageSize = 50 } = filters
    const where: any = {}
    if (hsCode) where.hsCode = { contains: hsCode, mode: 'insensitive' }
    if (country) where.countryOfOrigin = { contains: country, mode: 'insensitive' }
    if (agreement) where.tradeAgreement = agreement

    const [rates, total] = await Promise.all([
        prisma.taxRate.findMany({
            where,
            orderBy: [{ hsCode: 'asc' }, { tradeAgreement: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.taxRate.count({ where }),
    ])

    return {
        rows: rates.map(r => ({
            id: r.id,
            hsCode: r.hsCode,
            countryOfOrigin: r.countryOfOrigin,
            tradeAgreement: r.tradeAgreement,
            importTaxRate: Number(r.importTaxRate),
            sctRate: Number(r.sctRate),
            vatRate: Number(r.vatRate),
            effectiveDate: r.effectiveDate,
            expiryDate: r.expiryDate,
            requiresCo: r.requiresCo,
            coFormType: r.coFormType,
            notes: r.notes ?? null,
        })),
        total,
    }
}

// ─── Schema validation ────────────────────────────
const taxRateSchema = z.object({
    hsCode: z.string().min(4, 'HS Code tối thiểu 4 ký tự'),
    countryOfOrigin: z.string().min(2, 'Quốc gia bắt buộc'),
    tradeAgreement: z.enum(['EVFTA', 'MFN', 'AANZFTA', 'VCFTA', 'VKFTA', 'ASEAN']),
    importTaxRate: z.number().min(0).max(100),
    sctRate: z.number().min(0).max(100),
    vatRate: z.number().min(0).max(100).default(10),
    effectiveDate: z.string().min(1, 'Ngày hiệu lực bắt buộc'),
    expiryDate: z.string().nullable().optional(),
    requiresCo: z.boolean().default(false),
    coFormType: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
})

export type TaxRateInput = z.infer<typeof taxRateSchema>

// ─── Create ───────────────────────────────────────
export async function createTaxRate(input: TaxRateInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const data = taxRateSchema.parse(input)
        const rate = await prisma.taxRate.create({
            data: {
                hsCode: data.hsCode,
                countryOfOrigin: data.countryOfOrigin,
                tradeAgreement: data.tradeAgreement,
                importTaxRate: data.importTaxRate,
                sctRate: data.sctRate,
                vatRate: data.vatRate,
                effectiveDate: new Date(data.effectiveDate),
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                requiresCo: data.requiresCo,
                coFormType: data.coFormType ?? null,
                notes: data.notes ?? null,
            },
        })
        revalidatePath('/dashboard/tax')
        return { success: true, id: rate.id }
    } catch (err: any) {
        if (err.name === 'ZodError') {
            return { success: false, error: err.errors[0]?.message ?? 'Dữ liệu không hợp lệ' }
        }
        return { success: false, error: err.message }
    }
}

// ─── Update ───────────────────────────────────────
export async function updateTaxRate(
    id: string,
    input: Partial<TaxRateInput>
): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: any = { ...input }
        if (input.effectiveDate) updateData.effectiveDate = new Date(input.effectiveDate)
        if (input.expiryDate) updateData.expiryDate = new Date(input.expiryDate)
        if (input.expiryDate === null) updateData.expiryDate = null

        await prisma.taxRate.update({ where: { id }, data: updateData })
        revalidatePath('/dashboard/tax')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Delete ───────────────────────────────────────
export async function deleteTaxRate(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.taxRate.delete({ where: { id } })
        revalidatePath('/dashboard/tax')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Stats ────────────────────────────────────────
export async function getTaxStats() {
    const [total, evfta, mfn, withCo] = await Promise.all([
        prisma.taxRate.count(),
        prisma.taxRate.count({ where: { tradeAgreement: 'EVFTA' } }),
        prisma.taxRate.count({ where: { tradeAgreement: 'MFN' } }),
        prisma.taxRate.count({ where: { requiresCo: true } }),
    ])
    return { total, evfta, mfn, withCo }
}

// ═══════════════════════════════════════════════════
// TAX ENGINE — Auto-lookup & calculate tax
// ═══════════════════════════════════════════════════

export interface TaxEngineInput {
    countryOfOrigin: string
    hsCode: string
    abvPercent: number    // ABV% → determines SCT rate (35% < 20°, 65% >= 20°)
    cifUsd: number
    exchangeRate: number
    qty: number
}

export interface TaxEngineResult {
    // Tax rates found
    tradeAgreement: string
    importTaxRate: number
    sctRate: number       // Auto-selected from ABV
    vatRate: number
    requiresCo: boolean
    coFormType: string | null
    // Calculations
    cifVnd: number
    importTax: number
    sct: number
    vat: number
    totalTax: number
    totalLandedCost: number
    unitLandedCost: number
    effectiveTaxRate: number
    // Meta
    rateSource: 'db' | 'fallback'
    rateId: string | null
}

/**
 * Tax Engine API — Core business logic
 * 
 * 1. Lookup tax rate from DB by country + HS code
 * 2. Auto-select SCT rate: 35% if ABV < 20°, 65% if ABV >= 20°
 * 3. Calculate: CIF → Import Tax → TTĐB → VAT → Landed Cost
 */
export async function calculateTaxEngine(input: TaxEngineInput): Promise<{
    success: boolean
    result?: TaxEngineResult
    error?: string
}> {
    try {
        const { countryOfOrigin, hsCode, abvPercent, cifUsd, exchangeRate, qty } = input

        // Step 1: Find best matching tax rate from DB
        const now = new Date()
        const dbRate = await prisma.taxRate.findFirst({
            where: {
                hsCode: { contains: hsCode.substring(0, 4), mode: 'insensitive' },
                countryOfOrigin: { contains: countryOfOrigin, mode: 'insensitive' },
                effectiveDate: { lte: now },
                OR: [
                    { expiryDate: null },
                    { expiryDate: { gt: now } },
                ],
            },
            orderBy: [
                { tradeAgreement: 'asc' }, // Prefer FTA over MFN
                { effectiveDate: 'desc' },
            ],
        })

        // Step 2: Determine SCT rate from ABV
        // Vietnamese law: < 20° ABV → 35%, >= 20° ABV → 65%
        const sctRate = abvPercent >= 20 ? 65 : 35

        // Step 3: Use DB rate or fallback
        const importTaxRate = dbRate ? Number(dbRate.importTaxRate) : 50 // MFN default
        const vatRate = dbRate ? Number(dbRate.vatRate) : 10
        const tradeAgreement = dbRate?.tradeAgreement ?? 'MFN'

        // Step 4: Calculate landed cost
        const cifVnd = cifUsd * exchangeRate
        const importTax = cifVnd * (importTaxRate / 100)
        const sct = (cifVnd + importTax) * (sctRate / 100)
        const vat = (cifVnd + importTax + sct) * (vatRate / 100)
        const totalTax = importTax + sct + vat
        const totalLandedCost = cifVnd + totalTax
        const unitLandedCost = qty > 0 ? totalLandedCost / qty : 0

        return {
            success: true,
            result: {
                tradeAgreement,
                importTaxRate,
                sctRate,
                vatRate,
                requiresCo: dbRate?.requiresCo ?? false,
                coFormType: dbRate?.coFormType ?? null,
                cifVnd: Math.round(cifVnd),
                importTax: Math.round(importTax),
                sct: Math.round(sct),
                vat: Math.round(vat),
                totalTax: Math.round(totalTax),
                totalLandedCost: Math.round(totalLandedCost),
                unitLandedCost: Math.round(unitLandedCost),
                effectiveTaxRate: cifVnd > 0 ? (totalTax / cifVnd) * 100 : 0,
                rateSource: dbRate ? 'db' : 'fallback',
                rateId: dbRate?.id ?? null,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// MARKET PRICE TRACKING
// ═══════════════════════════════════════════════════

export type MarketPriceRow = {
    id: string
    productName: string
    skuCode: string
    productId: string
    price: number
    currency: string
    source: string
    priceDate: Date
    enteredByName: string
    createdAt: Date
}

export async function getMarketPrices(filters: {
    productId?: string
    source?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: MarketPriceRow[]; total: number }> {
    const { productId, source, page = 1, pageSize = 50 } = filters
    const where: any = {}
    if (productId) where.productId = productId
    if (source) where.source = source

    const [prices, total] = await Promise.all([
        prisma.marketPrice.findMany({
            where,
            include: {
                product: { select: { productName: true, skuCode: true } },
                enteredByUser: { select: { name: true } },
            },
            orderBy: { priceDate: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.marketPrice.count({ where }),
    ])

    return {
        rows: prices.map(p => ({
            id: p.id,
            productName: p.product.productName,
            skuCode: p.product.skuCode,
            productId: p.productId,
            price: Number(p.price),
            currency: p.currency,
            source: p.source,
            priceDate: p.priceDate,
            enteredByName: p.enteredByUser.name,
            createdAt: p.createdAt,
        })),
        total,
    }
}

export async function createMarketPrice(input: {
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
        revalidatePath('/dashboard/tax')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Get price history for a product (for chart)
export async function getProductPriceHistory(productId: string) {
    return prisma.marketPrice.findMany({
        where: { productId },
        select: {
            price: true,
            currency: true,
            source: true,
            priceDate: true,
        },
        orderBy: { priceDate: 'asc' },
        take: 100,
    })
}

// Suggest minimum sell price based on landed cost + target margin
export async function suggestMinSellPrice(productId: string, targetMarginPct: number = 25) {
    const lots = await prisma.stockLot.findMany({
        where: { productId, status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
        select: { unitLandedCost: true, qtyAvailable: true },
    })

    const totalQty = lots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
    if (totalQty === 0) return { unitLandedCost: 0, minSellPrice: 0, targetMarginPct }

    const weightedCost = lots.reduce((s, l) => s + Number(l.unitLandedCost) * Number(l.qtyAvailable), 0) / totalQty
    const minSellPrice = weightedCost / (1 - targetMarginPct / 100)

    return {
        unitLandedCost: Math.round(weightedCost),
        minSellPrice: Math.round(minSellPrice),
        targetMarginPct,
    }
}

// ═══════════════════════════════════════════════════
// BULK UPLOAD TAX RATES FROM EXCEL
// ═══════════════════════════════════════════════════

export type BulkTaxRow = {
    hsCode: string
    countryOfOrigin: string
    tradeAgreement: string
    importTaxRate: number
    sctRate: number
    vatRate: number
    effectiveDate: string
    expiryDate?: string | null
    requiresCo?: boolean
    coFormType?: string | null
    notes?: string | null
}

export async function importTaxRatesFromExcel(
    rows: BulkTaxRow[]
): Promise<{ success: boolean; imported: number; updated: number; errors: string[] }> {
    const errors: string[] = []
    let imported = 0
    let updated = 0

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const lineNo = i + 1

        // Validate required fields
        if (!row.hsCode || row.hsCode.length < 4) {
            errors.push(`Dòng ${lineNo}: HS Code không hợp lệ (tối thiểu 4 ký tự)`)
            continue
        }
        if (!row.countryOfOrigin) {
            errors.push(`Dòng ${lineNo}: Thiếu quốc gia`)
            continue
        }
        if (row.importTaxRate < 0 || row.sctRate < 0 || row.vatRate < 0) {
            errors.push(`Dòng ${lineNo}: Thuế suất không thể âm`)
            continue
        }

        try {
            const existing = await prisma.taxRate.findFirst({
                where: {
                    hsCode: row.hsCode,
                    countryOfOrigin: row.countryOfOrigin,
                    tradeAgreement: row.tradeAgreement || 'MFN',
                },
            })

            if (existing) {
                await prisma.taxRate.update({
                    where: { id: existing.id },
                    data: {
                        importTaxRate: row.importTaxRate,
                        sctRate: row.sctRate,
                        vatRate: row.vatRate,
                        effectiveDate: new Date(row.effectiveDate),
                        expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
                        requiresCo: row.requiresCo ?? false,
                        coFormType: row.coFormType ?? null,
                        notes: row.notes ?? null,
                    },
                })
                updated++
            } else {
                await prisma.taxRate.create({
                    data: {
                        hsCode: row.hsCode,
                        countryOfOrigin: row.countryOfOrigin,
                        tradeAgreement: row.tradeAgreement || 'MFN',
                        importTaxRate: row.importTaxRate,
                        sctRate: row.sctRate,
                        vatRate: row.vatRate,
                        effectiveDate: new Date(row.effectiveDate),
                        expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
                        requiresCo: row.requiresCo ?? false,
                        coFormType: row.coFormType ?? null,
                        notes: row.notes ?? null,
                    },
                })
                imported++
            }
        } catch (err: any) {
            errors.push(`Dòng ${lineNo}: ${err.message}`)
        }
    }

    revalidatePath('/dashboard/tax')
    return { success: errors.length === 0, imported, updated, errors }
}

// Parse Excel buffer to BulkTaxRow array (client calls this after reading file)
export async function parseTaxExcelTemplate(): Promise<{
    headers: string[]
    sampleRow: Record<string, string>
}> {
    return {
        headers: [
            'hsCode', 'countryOfOrigin', 'tradeAgreement', 'importTaxRate',
            'sctRate', 'vatRate', 'effectiveDate', 'expiryDate',
            'requiresCo', 'coFormType', 'notes',
        ],
        sampleRow: {
            hsCode: '2204.21',
            countryOfOrigin: 'France',
            tradeAgreement: 'EVFTA',
            importTaxRate: '10',
            sctRate: '35',
            vatRate: '10',
            effectiveDate: '2026-01-01',
            expiryDate: '',
            requiresCo: 'true',
            coFormType: 'EUR.1',
            notes: 'Wine < 2L',
        },
    }
}
