'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────
export type DeclarationRow = {
    id: string
    type: string
    periodYear: number
    periodMonth: number | null
    status: string
    fileUrl: string | null
    submittedAt: Date | null
    createdAt: Date
}

// ─── List declarations ────────────────────────────
export async function getDeclarations(filters: {
    type?: string
    year?: number
    status?: string
} = {}): Promise<{ rows: DeclarationRow[]; total: number }> {
    const where: any = {}
    if (filters.type) where.type = filters.type
    if (filters.year) where.periodYear = filters.year
    if (filters.status) where.status = filters.status

    const [rows, total] = await Promise.all([
        prisma.taxDeclaration.findMany({
            where,
            orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
            take: 50,
        }),
        prisma.taxDeclaration.count({ where }),
    ])

    return {
        rows: rows.map(r => ({
            id: r.id,
            type: r.type,
            periodYear: r.periodYear,
            periodMonth: r.periodMonth,
            status: r.status,
            fileUrl: r.fileUrl,
            submittedAt: r.submittedAt,
            createdAt: r.createdAt,
        })),
        total,
    }
}

// ─── Create declaration ───────────────────────────
export async function createDeclaration(input: {
    type: 'IMPORT_CUSTOMS' | 'SCT_MONTHLY' | 'SCT_QUARTERLY' | 'VAT_MONTHLY' | 'VAT_QUARTERLY'
    periodYear: number
    periodMonth?: number
    createdBy: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const decl = await prisma.taxDeclaration.create({
            data: {
                type: input.type,
                periodYear: input.periodYear,
                periodMonth: input.periodMonth ?? null,
                status: 'DRAFT',
                createdBy: input.createdBy,
            },
        })
        revalidatePath('/dashboard/declarations')
        return { success: true, id: decl.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Update declaration status ────────────────────
export async function updateDeclarationStatus(
    id: string,
    status: 'DRAFT' | 'APPROVED' | 'SUBMITTED',
    fileUrl?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.taxDeclaration.update({
            where: { id },
            data: {
                status,
                ...(status === 'SUBMITTED' && { submittedAt: new Date() }),
                ...(fileUrl && { fileUrl }),
            },
        })
        revalidatePath('/dashboard/declarations')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Generate declaration data (aggregate) ────────
export async function getDeclarationData(input: {
    type: string
    year: number
    month?: number
}) {
    const { type, year, month } = input
    const startDate = new Date(year, month ? month - 1 : 0, 1)
    const endDate = month
        ? new Date(year, month, 0, 23, 59, 59) // End of month
        : new Date(year, 11, 31, 23, 59, 59)   // End of year

    if (type.startsWith('VAT')) {
        // Sum VAT from AR invoices in period
        const invoices = await prisma.aRInvoice.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            orderBy: { createdAt: 'asc' },
        })

        const totalAmount = invoices.reduce((s, i) => s + Number(i.amount), 0)
        const totalVat = invoices.reduce((s, i) => s + Number(i.vatAmount), 0)

        return {
            type: 'VAT',
            period: { year, month },
            invoiceCount: invoices.length,
            totalAmount,
            totalVat,
            invoices: invoices.map(i => ({
                invoiceNo: i.invoiceNo,
                customerId: i.customerId,
                amount: Number(i.amount),
                vatAmount: Number(i.vatAmount),
                total: Number(i.totalAmount),
                date: i.createdAt,
            })),
        }
    }

    if (type.startsWith('SCT')) {
        // TTĐB data from purchase orders + landed costs
        const lots = await prisma.stockLot.findMany({
            where: {
                receivedDate: { gte: startDate, lte: endDate },
                status: { not: 'CONSUMED' },
            },
            include: {
                product: { select: { productName: true, skuCode: true, abvPercent: true } },
            },
        })

        return {
            type: 'SCT',
            period: { year, month },
            lotCount: lots.length,
            lots: lots.map(l => ({
                lotNo: l.lotNo,
                productName: l.product.productName,
                skuCode: l.product.skuCode,
                abvPercent: Number(l.product.abvPercent ?? 0),
                sctRate: Number(l.product.abvPercent ?? 0) >= 20 ? 65 : 35,
                qty: Number(l.qtyReceived),
                unitLandedCost: Number(l.unitLandedCost),
            })),
        }
    }

    return { type, period: { year, month }, data: [] }
}

// ─── Stats ────────────────────────────────────────
export async function getDeclarationStats() {
    const [total, draft, submitted, approved] = await Promise.all([
        prisma.taxDeclaration.count(),
        prisma.taxDeclaration.count({ where: { status: 'DRAFT' } }),
        prisma.taxDeclaration.count({ where: { status: 'SUBMITTED' } }),
        prisma.taxDeclaration.count({ where: { status: 'APPROVED' } }),
    ])
    return { total, draft, submitted, approved }
}

// ─── Import Customs Declaration Data (NK) ─────────
export async function getImportCustomsData(input: { year: number; month?: number }) {
    const { year, month } = input
    const startDate = new Date(year, month ? month - 1 : 0, 1)
    const endDate = month
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59)

    // Get POs with lines and tax rates
    const pos = await prisma.purchaseOrder.findMany({
        where: {
            status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED', 'CLOSED'] },
            createdAt: { gte: startDate, lte: endDate },
        },
        include: {
            supplier: { select: { name: true, code: true, country: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            skuCode: true, productName: true, hsCode: true,
                            country: true, abvPercent: true,
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    })

    // Get tax rates
    const taxRates = await prisma.taxRate.findMany({
        where: { effectiveDate: { lte: endDate } },
        orderBy: { effectiveDate: 'desc' },
    })

    const rows = []
    let totalImportDuty = 0
    let totalSCT = 0
    let totalVAT = 0

    for (const po of pos) {
        for (const line of po.lines) {
            const hsCode = line.product.hsCode ?? ''
            const country = line.product.country ?? po.supplier.country ?? ''

            // Find matching tax rate
            const rate = taxRates.find(t => t.hsCode === hsCode && t.countryOfOrigin === country)
                ?? taxRates.find(t => t.hsCode === hsCode)

            const qty = Number(line.qtyOrdered)
            const cifValue = qty * Number(line.unitPrice) * Number(po.exchangeRate)

            const importTaxRate = rate ? Number(rate.importTaxRate) / 100 : 0
            const sctRate = rate ? Number(rate.sctRate) / 100 : 0.35  // Default 35%
            const vatRate = rate ? Number(rate.vatRate) / 100 : 0.10  // Default 10%

            const importDuty = cifValue * importTaxRate
            const sctBase = cifValue + importDuty
            const sct = sctBase * sctRate
            const vatBase = sctBase + sct
            const vat = vatBase * vatRate

            totalImportDuty += importDuty
            totalSCT += sct
            totalVAT += vat

            rows.push({
                poNo: po.poNo,
                supplierName: po.supplier.name,
                supplierCountry: po.supplier.country,
                skuCode: line.product.skuCode,
                productName: line.product.productName,
                hsCode,
                country,
                qty,
                unitPrice: Number(line.unitPrice),
                exchangeRate: Number(po.exchangeRate),
                cifValue: Math.round(cifValue),
                importTaxRate: importTaxRate * 100,
                importDuty: Math.round(importDuty),
                sctRate: sctRate * 100,
                sct: Math.round(sct),
                vatRate: vatRate * 100,
                vat: Math.round(vat),
                totalTax: Math.round(importDuty + sct + vat),
            })
        }
    }

    return {
        type: 'IMPORT_CUSTOMS',
        period: { year, month },
        poCount: pos.length,
        lineCount: rows.length,
        totalImportDuty: Math.round(totalImportDuty),
        totalSCT: Math.round(totalSCT),
        totalVAT: Math.round(totalVAT),
        grandTotal: Math.round(totalImportDuty + totalSCT + totalVAT),
        rows,
    }
}

// ─── Declaration Calendar (upcoming/overdue) ──────
export async function getDeclarationCalendar() {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Expected declarations per type and their deadlines
    const expected = [
        { type: 'VAT_MONTHLY', period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, deadline: new Date(currentYear, currentMonth, 20) },
        { type: 'SCT_MONTHLY', period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`, deadline: new Date(currentYear, currentMonth, 20) },
    ]

    // Add quarterly if applicable
    if (currentMonth % 3 === 0) {
        expected.push(
            { type: 'VAT_QUARTERLY', period: `Q${Math.ceil(currentMonth / 3)}/${currentYear}`, deadline: new Date(currentYear, currentMonth, 30) },
            { type: 'SCT_QUARTERLY', period: `Q${Math.ceil(currentMonth / 3)}/${currentYear}`, deadline: new Date(currentYear, currentMonth, 30) },
        )
    }

    // Check which are already submitted
    const existing = await prisma.taxDeclaration.findMany({
        where: { periodYear: currentYear, periodMonth: currentMonth },
    })

    return expected.map(e => {
        const found = existing.find(d => d.type === e.type)
        const isOverdue = !found && now > e.deadline
        return {
            type: e.type,
            period: e.period,
            deadline: e.deadline,
            status: found?.status ?? (isOverdue ? 'OVERDUE' : 'PENDING'),
            declarationId: found?.id ?? null,
            daysUntilDeadline: Math.ceil((e.deadline.getTime() - now.getTime()) / 86400000),
        }
    })
}
