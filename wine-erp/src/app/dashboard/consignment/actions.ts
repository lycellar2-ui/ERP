'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ═══════════════════════════════════════════════════
// CSG — Consignment Management
// ═══════════════════════════════════════════════════

export type ConsignmentRow = {
    id: string
    customerName: string
    customerId: string
    contractId: string | null
    status: string
    startDate: Date
    endDate: Date
    reportFrequency: string
    stockCount: number
    totalQty: number
    createdAt: Date
}

export type ConsignmentStockRow = {
    id: string
    agreementId: string
    productName: string
    skuCode: string
    productId: string
    qtyConsigned: number
    qtySold: number
    qtyRemaining: number
}

export type ConsignmentReportRow = {
    id: string
    agreementId: string
    customerName: string
    periodStart: Date
    periodEnd: Date
    status: string
    confirmedAt: Date | null
    submittedAt: Date
}

// ─── List Agreements ──────────────────────────────
export async function getConsignmentAgreements(filters: {
    status?: string
    customerId?: string
} = {}): Promise<ConsignmentRow[]> {
    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.customerId) where.customerId = filters.customerId

    const agreements = await prisma.consignmentAgreement.findMany({
        where,
        include: {
            customer: { select: { name: true } },
            stocks: {
                select: { qtyConsigned: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return agreements.map(a => ({
        id: a.id,
        customerName: a.customer.name,
        customerId: a.customerId,
        contractId: a.contractId,
        status: a.status,
        startDate: a.startDate,
        endDate: a.endDate,
        reportFrequency: a.reportFrequency,
        stockCount: a.stocks.length,
        totalQty: a.stocks.reduce((s: number, st: { qtyConsigned: any }) => s + Number(st.qtyConsigned), 0),
        createdAt: a.createdAt,
    }))
}

// ─── Create Agreement ─────────────────────────────
const agreementSchema = z.object({
    customerId: z.string().min(1, 'Khách hàng bắt buộc'),
    contractId: z.string().nullable().optional(),
    reportFrequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'AS_NEEDED']).default('MONTHLY'),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
})

export async function createConsignmentAgreement(
    input: z.infer<typeof agreementSchema>
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const data = agreementSchema.parse(input)

        const agreement = await prisma.consignmentAgreement.create({
            data: {
                customerId: data.customerId,
                contractId: data.contractId ?? null,
                reportFrequency: data.reportFrequency,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                status: 'ACTIVE',
            },
        })
        revalidatePath('/dashboard/consignment')
        return { success: true, id: agreement.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Send stock to consignment (upsert) ───────────
export async function addConsignmentStock(input: {
    agreementId: string
    productId: string
    qtyConsigned: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.consignmentStock.upsert({
            where: {
                agreementId_productId: {
                    agreementId: input.agreementId,
                    productId: input.productId,
                },
            },
            create: {
                agreementId: input.agreementId,
                productId: input.productId,
                qtyConsigned: input.qtyConsigned,
                qtySold: 0,
                qtyRemaining: input.qtyConsigned,
            },
            update: {
                qtyConsigned: { increment: input.qtyConsigned },
                qtyRemaining: { increment: input.qtyConsigned },
            },
        })
        revalidatePath('/dashboard/consignment')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get consignment stock for an agreement ───────
export async function getConsignmentStocks(agreementId: string): Promise<ConsignmentStockRow[]> {
    const stocks = await prisma.consignmentStock.findMany({
        where: { agreementId },
        include: {
            product: { select: { productName: true, skuCode: true } },
        },
        orderBy: { updatedAt: 'desc' },
    })

    return stocks.map(s => ({
        id: s.id,
        agreementId: s.agreementId,
        productName: s.product.productName,
        skuCode: s.product.skuCode,
        productId: s.productId,
        qtyConsigned: Number(s.qtyConsigned),
        qtySold: Number(s.qtySold),
        qtyRemaining: Number(s.qtyRemaining),
    }))
}

// ─── Record sales report from consignment partner ─
export async function createConsignmentReport(input: {
    agreementId: string
    periodStart: string
    periodEnd: string
    items: { stockId: string; qtySold: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction(async (tx) => {
            // Create report
            await tx.consignmentReport.create({
                data: {
                    agreementId: input.agreementId,
                    periodStart: new Date(input.periodStart),
                    periodEnd: new Date(input.periodEnd),
                    status: 'PENDING',
                },
            })

            // Update sold quantities
            for (const item of input.items) {
                await tx.consignmentStock.update({
                    where: { id: item.stockId },
                    data: {
                        qtySold: { increment: item.qtySold },
                        qtyRemaining: { decrement: item.qtySold },
                    },
                })
            }
        })

        revalidatePath('/dashboard/consignment')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Confirm consignment report → Auto AR Invoice ─
export async function confirmConsignmentReport(
    reportId: string
): Promise<{ success: boolean; error?: string; invoiceNo?: string }> {
    try {
        const report = await prisma.consignmentReport.findUnique({
            where: { id: reportId },
            include: {
                agreement: {
                    include: {
                        customer: { select: { id: true, name: true } },
                        stocks: {
                            include: { product: { select: { id: true, productName: true } } },
                        },
                    },
                },
            },
        })
        if (!report) return { success: false, error: 'Report not found' }

        // Calculate total from consignment sold qty × latest price
        let totalSales = 0
        for (const stock of report.agreement.stocks) {
            const sold = Number(stock.qtySold)
            if (sold <= 0) continue
            // Get price from PriceList or market price
            const priceListLine = await prisma.priceListLine.findFirst({
                where: { productId: stock.productId },
                orderBy: { priceList: { effectiveDate: 'desc' } },
            })
            const unitPrice = priceListLine ? Number(priceListLine.unitPrice) : 0
            totalSales += sold * unitPrice
        }

        // Create AR Invoice if there are sales
        let invoiceNo: string | undefined
        if (totalSales > 0) {
            // Find or create a SO placeholder for consignment
            let soId: string | undefined
            const existingSO = await prisma.salesOrder.findFirst({
                where: { customerId: report.agreement.customerId, channel: 'HORECA' },
                orderBy: { createdAt: 'desc' },
                select: { id: true },
            })
            soId = existingSO?.id

            if (soId) {
                const invCount = await prisma.aRInvoice.count()
                invoiceNo = `CSG-INV-${String(invCount + 1).padStart(6, '0')}`
                const vatAmount = totalSales * 0.1
                const totalAmount = totalSales + vatAmount

                await prisma.aRInvoice.create({
                    data: {
                        invoiceNo,
                        soId,
                        customerId: report.agreement.customerId,
                        amount: totalSales,
                        vatAmount,
                        totalAmount,
                        dueDate: new Date(Date.now() + 30 * 86400000), // NET30
                        status: 'UNPAID',
                    },
                })
            }
        }

        await prisma.consignmentReport.update({
            where: { id: reportId },
            data: {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                ...(invoiceNo ? { arInvoiceId: invoiceNo } : {}),
            },
        })

        revalidatePath('/dashboard/consignment')
        revalidatePath('/dashboard/finance')
        return { success: true, invoiceNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get reports ──────────────────────────────────
export async function getConsignmentReports(agreementId?: string): Promise<ConsignmentReportRow[]> {
    const where: any = {}
    if (agreementId) where.agreementId = agreementId

    const reports = await prisma.consignmentReport.findMany({
        where,
        include: {
            agreement: {
                include: { customer: { select: { name: true } } },
            },
        },
        orderBy: { periodEnd: 'desc' },
    })

    return reports.map(r => ({
        id: r.id,
        agreementId: r.agreementId,
        customerName: r.agreement.customer.name,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        status: r.status,
        confirmedAt: r.confirmedAt,
        submittedAt: r.submittedAt,
    }))
}

// ─── Stats ────────────────────────────────────────
export async function getConsignmentStats() {
    const [total, active, totalConsigned, totalSold] = await Promise.all([
        prisma.consignmentAgreement.count(),
        prisma.consignmentAgreement.count({ where: { status: 'ACTIVE' } }),
        prisma.consignmentStock.aggregate({ _sum: { qtyConsigned: true } }),
        prisma.consignmentStock.aggregate({ _sum: { qtySold: true } }),
    ])
    return {
        total,
        active,
        totalStockSent: Number(totalConsigned._sum.qtyConsigned ?? 0),
        totalSold: Number(totalSold._sum.qtySold ?? 0),
    }
}

// ─── Customer options for dropdown ────────────────
export async function getCustomerOptionsForCSG() {
    return prisma.customer.findMany({
        where: { status: 'ACTIVE', customerType: { in: ['HORECA', 'WHOLESALE_DISTRIBUTOR'] } },
        select: { id: true, name: true, code: true, customerType: true },
        orderBy: { name: 'asc' },
    })
}

// ─── Product options for dropdown ─────────────────
export async function getProductOptionsForCSG() {
    return prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, skuCode: true, productName: true, wineType: true },
        orderBy: { productName: 'asc' },
    })
}

// ─── Consigned Stock Map (per Customer × SKU) ─────
export type ConsignedStockMapRow = {
    customerName: string
    customerId: string
    skuCode: string
    productName: string
    productId: string
    qtyConsigned: number
    qtySold: number
    qtyRemaining: number
    pctSold: number
    agreementStatus: string
}

export async function getConsignedStockMap(): Promise<ConsignedStockMapRow[]> {
    const stocks = await prisma.consignmentStock.findMany({
        where: {
            agreement: { status: 'ACTIVE' },
        },
        include: {
            product: { select: { skuCode: true, productName: true } },
            agreement: {
                select: { status: true, customer: { select: { name: true, id: true } } },
            },
        },
        orderBy: [{ agreement: { customer: { name: 'asc' } } }, { product: { skuCode: 'asc' } }],
    })

    return stocks.map(s => ({
        customerName: s.agreement.customer.name,
        customerId: s.agreement.customer.id,
        skuCode: s.product.skuCode,
        productName: s.product.productName,
        productId: s.productId,
        qtyConsigned: Number(s.qtyConsigned),
        qtySold: Number(s.qtySold),
        qtyRemaining: Number(s.qtyRemaining),
        pctSold: Number(s.qtyConsigned) > 0
            ? (Number(s.qtySold) / Number(s.qtyConsigned)) * 100
            : 0,
        agreementStatus: s.agreement.status,
    }))
}

// ─── Replenishment Alerts ─────────────────────────
export type ReplenishmentAlert = {
    customerName: string
    skuCode: string
    productName: string
    qtyRemaining: number
    qtyConsigned: number
    agreementId: string
}

export async function getReplenishmentAlerts(minStock: number = 10): Promise<ReplenishmentAlert[]> {
    const stocks = await prisma.consignmentStock.findMany({
        where: {
            agreement: { status: 'ACTIVE' },
            qtyRemaining: { lte: minStock },
        },
        include: {
            product: { select: { skuCode: true, productName: true } },
            agreement: {
                select: { id: true, customer: { select: { name: true } } },
            },
        },
        orderBy: { qtyRemaining: 'asc' },
    })

    return stocks.map(s => ({
        customerName: s.agreement.customer.name,
        skuCode: s.product.skuCode,
        productName: s.product.productName,
        qtyRemaining: Number(s.qtyRemaining),
        qtyConsigned: Number(s.qtyConsigned),
        agreementId: s.agreement.id,
    }))
}
