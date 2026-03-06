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
    signatureUrl?: string | null
    documents?: { id: string; name: string; fileUrl: string; uploadedAt: Date }[]
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
            include: { documents: { orderBy: { uploadedAt: 'desc' } } },
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
            signatureUrl: r.signatureUrl,
            documents: r.documents,
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
            status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] },
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

// ─── SCT Detailed Report (TTĐB Bảng Kê Chi Tiết) ─
export type SCTLineItem = {
    skuCode: string
    productName: string
    abvPercent: number
    sctRate: number
    // Input (đầu vào - hàng nhập)
    inputQty: number
    inputValue: number
    inputSCT: number
    // Output (đầu ra - hàng bán)
    outputQty: number
    outputRevenue: number
    outputSCT: number
    // Net (thuế phải nộp)
    netSCT: number
}

export type SCTDetailedReport = {
    period: { year: number; month?: number }
    inputSummary: { totalQty: number; totalValue: number; totalSCT: number }
    outputSummary: { totalQty: number; totalRevenue: number; totalSCT: number }
    netSCTPayable: number
    lines: SCTLineItem[]
}

export async function getSCTDetailedReport(input: {
    year: number
    month?: number
}): Promise<SCTDetailedReport> {
    const { year, month } = input
    const startDate = new Date(year, month ? month - 1 : 0, 1)
    const endDate = month
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(year, 11, 31, 23, 59, 59)

    // ── ĐẦU VÀO: StockLots received in period (từ GR confirm) ──
    const inputLots = await prisma.stockLot.findMany({
        where: {
            receivedDate: { gte: startDate, lte: endDate },
        },
        include: {
            product: {
                select: {
                    id: true, skuCode: true, productName: true,
                    abvPercent: true, hsCode: true,
                },
            },
        },
    })

    // ── ĐẦU RA: SO lines delivered in period (từ DO confirm → COGS) ──
    const outputOrders = await prisma.salesOrderLine.findMany({
        where: {
            so: {
                status: { in: ['DELIVERED', 'INVOICED', 'PAID'] },
                updatedAt: { gte: startDate, lte: endDate },
            },
        },
        include: {
            product: {
                select: {
                    id: true, skuCode: true, productName: true,
                    abvPercent: true,
                },
            },
        },
    })

    // ── Aggregate by product ──
    const productMap = new Map<string, SCTLineItem>()

    const getOrInit = (p: { id: string; skuCode: string; productName: string; abvPercent: any }): SCTLineItem => {
        if (!productMap.has(p.id)) {
            const abv = Number(p.abvPercent ?? 0)
            productMap.set(p.id, {
                skuCode: p.skuCode,
                productName: p.productName,
                abvPercent: abv,
                sctRate: abv >= 20 ? 65 : 35,
                inputQty: 0, inputValue: 0, inputSCT: 0,
                outputQty: 0, outputRevenue: 0, outputSCT: 0,
                netSCT: 0,
            })
        }
        return productMap.get(p.id)!
    }

    // Accumulate input (purchases)
    for (const lot of inputLots) {
        const line = getOrInit(lot.product)
        const qty = Number(lot.qtyReceived)
        const value = qty * Number(lot.unitLandedCost)
        const sct = value * (line.sctRate / 100)
        line.inputQty += qty
        line.inputValue += Math.round(value)
        line.inputSCT += Math.round(sct)
    }

    // Accumulate output (sales)
    for (const sol of outputOrders) {
        const line = getOrInit(sol.product)
        const qty = Number(sol.qtyOrdered)
        const revenue = qty * Number(sol.unitPrice)
        const sct = revenue * (line.sctRate / 100)
        line.outputQty += qty
        line.outputRevenue += Math.round(revenue)
        line.outputSCT += Math.round(sct)
    }

    // Calculate net SCT per product
    const lines = Array.from(productMap.values()).map(l => ({
        ...l,
        netSCT: l.outputSCT - l.inputSCT,
    }))

    // Summaries
    const inputSummary = {
        totalQty: lines.reduce((s, l) => s + l.inputQty, 0),
        totalValue: lines.reduce((s, l) => s + l.inputValue, 0),
        totalSCT: lines.reduce((s, l) => s + l.inputSCT, 0),
    }
    const outputSummary = {
        totalQty: lines.reduce((s, l) => s + l.outputQty, 0),
        totalRevenue: lines.reduce((s, l) => s + l.outputRevenue, 0),
        totalSCT: lines.reduce((s, l) => s + l.outputSCT, 0),
    }

    return {
        period: { year, month },
        inputSummary,
        outputSummary,
        netSCTPayable: outputSummary.totalSCT - inputSummary.totalSCT,
        lines: lines.sort((a, b) => b.netSCT - a.netSCT),
    }
}

// ─── Document & Signature ─────────────────────────
import { uploadFile } from '@/lib/storage'

export async function uploadTaxDocument(taxId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Chưa chọn file tờ khai' }

        const uploadRes = await uploadFile(formData, 'tax')
        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload failed' }
        }

        const doc = await prisma.taxDocument.create({
            data: {
                taxId,
                name: file.name,
                fileUrl: uploadRes.url,
            }
        })

        revalidatePath('/dashboard/declarations')
        return { success: true, document: doc }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function signTaxDeclaration(taxId: string, signatureUrl: string) {
    try {
        await prisma.taxDeclaration.update({
            where: { id: taxId },
            data: { signatureUrl, status: 'APPROVED' },
        })
        revalidatePath('/dashboard/declarations')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
