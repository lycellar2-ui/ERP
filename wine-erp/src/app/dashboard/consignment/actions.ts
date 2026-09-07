'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth } from '@/lib/session'

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
        revalidateCache('consignment')
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
                        customer: { select: { id: true, name: true, parentId: true } },
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
            let legalEntityId: string | undefined
            const existingSO = await prisma.salesOrder.findFirst({
                where: { customerId: report.agreement.customerId, channel: 'HORECA' },
                orderBy: { createdAt: 'desc' },
                select: { id: true, legalEntityId: true },
            })
            soId = existingSO?.id
            legalEntityId = existingSO?.legalEntityId

            if (soId && legalEntityId) {
                const invCount = await prisma.aRInvoice.count()
                invoiceNo = `CSG-INV-${String(invCount + 1).padStart(6, '0')}`
                const vatAmount = totalSales * 0.1
                const totalAmount = totalSales + vatAmount

                await prisma.aRInvoice.create({
                    data: {
                        invoiceNo,
                        soId,
                        customerId: report.agreement.customer.parentId ?? report.agreement.customerId,
                        amount: totalSales,
                        vatAmount,
                        totalAmount,
                        dueDate: new Date(Date.now() + 30 * 86400000), // NET30
                        status: 'UNPAID',
                        legalEntityId,
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
    return cached('consignment:stats', async () => {
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
    }) // end cached
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

// ═══════════════════════════════════════════════════
// PHYSICAL COUNT AT HORECA
// ═══════════════════════════════════════════════════

export type PhysicalCountSession = {
    id: string
    agreementId: string
    customerName: string
    countDate: Date
    status: string // DRAFT | COUNTING | CONFIRMED
    countedBy: string
    items: PhysicalCountItem[]
    createdAt: Date
}

export type PhysicalCountItem = {
    stockId: string
    skuCode: string
    productName: string
    systemQty: number      // qtyRemaining from system
    physicalQty: number     // actual count at HORECA
    variance: number        // physical - system
    variancePct: number
}

export async function createPhysicalCount(input: {
    agreementId: string
    countedBy: string
    countDate: string
}): Promise<{ success: boolean; session?: PhysicalCountSession; error?: string }> {
    try {
        const agreement = await prisma.consignmentAgreement.findUnique({
            where: { id: input.agreementId },
            include: {
                customer: { select: { name: true } },
                stocks: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
        })
        if (!agreement) return { success: false, error: 'Hợp đồng ký gửi không tồn tại' }

        const items: PhysicalCountItem[] = agreement.stocks.map(s => ({
            stockId: s.id,
            skuCode: s.product.skuCode,
            productName: s.product.productName,
            systemQty: Number(s.qtyRemaining),
            physicalQty: Number(s.qtyRemaining), // Default to system qty
            variance: 0,
            variancePct: 0,
        }))

        return {
            success: true,
            session: {
                id: `PC-${Date.now()}`,
                agreementId: input.agreementId,
                customerName: agreement.customer.name,
                countDate: new Date(input.countDate),
                status: 'COUNTING',
                countedBy: input.countedBy,
                items,
                createdAt: new Date(),
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function confirmPhysicalCount(input: {
    agreementId: string
    countedBy: string
    items: { stockId: string; physicalQty: number }[]
}): Promise<{ success: boolean; adjustments?: { skuCode: string; variance: number }[]; error?: string }> {
    try {
        const adjustments: { skuCode: string; variance: number }[] = []

        await prisma.$transaction(async (tx) => {
            for (const item of input.items) {
                const stock = await tx.consignmentStock.findUnique({
                    where: { id: item.stockId },
                    include: { product: { select: { skuCode: true } } },
                })
                if (!stock) continue

                const systemQty = Number(stock.qtyRemaining)
                const variance = item.physicalQty - systemQty

                if (variance !== 0) {
                    // Adjust qtyRemaining to match physical count
                    // If physical < system: record as additional sales (unrecorded)
                    // If physical > system: unexpected surplus
                    const newRemaining = item.physicalQty
                    const soldAdjust = variance < 0 ? Math.abs(variance) : 0

                    await tx.consignmentStock.update({
                        where: { id: item.stockId },
                        data: {
                            qtyRemaining: newRemaining,
                            qtySold: { increment: soldAdjust }, // lost stock = "sold" for accounting
                        },
                    })

                    adjustments.push({
                        skuCode: stock.product.skuCode,
                        variance,
                    })
                }
            }

            // Create report for the count
            await tx.consignmentReport.create({
                data: {
                    agreementId: input.agreementId,
                    periodStart: new Date(),
                    periodEnd: new Date(),
                    status: 'CONFIRMED',
                    confirmedAt: new Date(),
                },
            })
        })

        revalidateCache('consignment')
        revalidatePath('/dashboard/consignment')
        return {
            success: true,
            adjustments: adjustments.length > 0 ? adjustments : undefined,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// PERIODIC RECONCILIATION — HORECA Month-End Summary
// ═══════════════════════════════════════════════════

export type ReconciliationRow = {
    customerId: string
    customerName: string
    agreementId: string
    reportFrequency: string
    skuCount: number
    totalConsigned: number
    totalSold: number
    totalRemaining: number
    varianceFromPhysical: number
    estimatedRevenue: number
    pendingARAmount: number
    lastReportDate: Date | null
    daysSinceLastReport: number | null
    isOverdue: boolean
}

export async function getPeriodicReconciliation(periodStart?: string, periodEnd?: string): Promise<{
    success: boolean
    rows?: ReconciliationRow[]
    summary?: { totalCustomers: number; totalConsigned: number; totalSold: number; totalPendingAR: number; overdueCount: number }
    error?: string
}> {
    try {
        const agreements = await prisma.consignmentAgreement.findMany({
            where: { status: 'ACTIVE' },
            include: {
                customer: { select: { id: true, name: true } },
                stocks: {
                    include: { product: { select: { id: true, skuCode: true, productName: true } } },
                },
                reports: {
                    orderBy: { periodEnd: 'desc' },
                    take: 1,
                    select: { periodEnd: true, status: true },
                },
            },
        })

        const now = new Date()
        const rows: ReconciliationRow[] = []
        let totalPendingAR = 0

        for (const a of agreements) {
            const totalConsigned = a.stocks.reduce((s, st) => s + Number(st.qtyConsigned), 0)
            const totalSold = a.stocks.reduce((s, st) => s + Number(st.qtySold), 0)
            const totalRemaining = a.stocks.reduce((s, st) => s + Number(st.qtyRemaining), 0)
            const varianceFromPhysical = totalConsigned - totalSold - totalRemaining

            // Estimate revenue from sold qty × latest price
            let estimatedRevenue = 0
            for (const st of a.stocks) {
                const sold = Number(st.qtySold)
                if (sold <= 0) continue
                const priceLine = await prisma.priceListLine.findFirst({
                    where: { productId: st.productId },
                    orderBy: { priceList: { effectiveDate: 'desc' } },
                    select: { unitPrice: true },
                })
                estimatedRevenue += sold * (priceLine ? Number(priceLine.unitPrice) : 0)
            }

            // Check pending AR for this customer
            const pendingAR = await prisma.aRInvoice.aggregate({
                where: { customerId: a.customer.id, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
                _sum: { totalAmount: true },
            })
            const pendingARAmount = Number(pendingAR._sum.totalAmount ?? 0)
            totalPendingAR += pendingARAmount

            const lastReport = a.reports[0]
            const lastReportDate = lastReport?.periodEnd ?? null
            const daysSince = lastReportDate ? Math.floor((now.getTime() - lastReportDate.getTime()) / 86400000) : null

            // Determine overdue based on frequency
            const freqDays: Record<string, number> = { WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90, AS_NEEDED: 999 }
            const maxDays = freqDays[a.reportFrequency] ?? 30
            const isOverdue = daysSince !== null && daysSince > maxDays

            rows.push({
                customerId: a.customer.id,
                customerName: a.customer.name,
                agreementId: a.id,
                reportFrequency: a.reportFrequency,
                skuCount: a.stocks.length,
                totalConsigned,
                totalSold,
                totalRemaining,
                varianceFromPhysical,
                estimatedRevenue,
                pendingARAmount,
                lastReportDate,
                daysSinceLastReport: daysSince,
                isOverdue,
            })
        }

        return {
            success: true,
            rows,
            summary: {
                totalCustomers: rows.length,
                totalConsigned: rows.reduce((s, r) => s + r.totalConsigned, 0),
                totalSold: rows.reduce((s, r) => s + r.totalSold, 0),
                totalPendingAR,
                overdueCount: rows.filter(r => r.isOverdue).length,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// KHO KÝ GỬI THEO KHÁCH HÀNG (CUSTOMER CONSIGNMENT WAREHOUSES)
// ═══════════════════════════════════════════════════

export type ConsignmentWarehouseRow = {
    id: string
    code: string
    name: string
    address: string | null
    customerId: string | null
    customerCode: string
    customerName: string
    customerPhone: string | null
    customerAddress: string | null
    customerTaxId: string | null
    totalBottles: number
    skuCount: number
    totalStockValue: number
    createdAt: Date
}

// ─── Get all Consignment Warehouses with Real Stock ─────
export async function getConsignmentWarehouses(): Promise<ConsignmentWarehouseRow[]> {
    try {
        const warehouses = await prisma.warehouse.findMany({
            where: { type: 'CONSIGNMENT' },
            include: {
                customer: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        purchasingPhone: true,
                        receiverPhone: true,
                        vatAddress: true,
                        vatCompanyName: true,
                        taxId: true,
                        addresses: { select: { address: true, isDefault: true } },
                    },
                },
                locations: {
                    include: {
                        stockLots: {
                            where: { qtyAvailable: { gt: 0 } },
                            select: {
                                productId: true,
                                qtyAvailable: true,
                                unitLandedCost: true,
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        return warehouses.map((wh: any) => {
            const allLots = wh.locations.flatMap((l: any) => l.stockLots)
            const totalBottles = allLots.reduce((sum: number, lot: any) => sum + Number(lot.qtyAvailable), 0)
            const uniqueSKUs = new Set(allLots.map((lot: any) => lot.productId)).size
            const totalStockValue = allLots.reduce((sum: number, lot: any) => sum + (Number(lot.qtyAvailable) * Number(lot.unitLandedCost || 0)), 0)
            const defaultAddress = wh.customer?.addresses.find((a: any) => a.isDefault)?.address || wh.customer?.addresses[0]?.address || wh.customer?.vatAddress || null
            const phone = wh.customer?.receiverPhone || wh.customer?.purchasingPhone || null

            return {
                id: wh.id,
                code: wh.code,
                name: wh.name,
                address: wh.address || defaultAddress,
                customerId: wh.customerId,
                customerCode: wh.customer?.code || '',
                customerName: wh.customer?.name || wh.name,
                customerPhone: phone,
                customerAddress: defaultAddress,
                customerTaxId: wh.customer?.taxId || null,
                totalBottles,
                skuCount: uniqueSKUs,
                totalStockValue,
                createdAt: wh.createdAt,
            }
        })
    } catch (err: any) {
        console.error('getConsignmentWarehouses error:', err)
        return []
    }
}

// ─── Create Consignment Warehouse for Customer ──────────
export async function createConsignmentWarehouse(input: {
    customerId: string
    name?: string
    address?: string
}): Promise<{ success: boolean; warehouseId?: string; error?: string }> {
    try {
        await requireAuth()
        const customer = await prisma.customer.findUnique({
            where: { id: input.customerId },
            include: { addresses: true },
        })
        if (!customer) return { success: false, error: 'Không tìm thấy khách hàng' }

        const existing = await prisma.warehouse.findFirst({
            where: { customerId: customer.id, type: 'CONSIGNMENT' },
        })
        if (existing) {
            return { success: false, error: `Khách hàng này đã có kho ký gửi: ${existing.name} (${existing.code})` }
        }

        const code = `WH-CSG-${customer.code}`
        const name = input.name?.trim() || `Kho Ký Gửi - ${customer.name}`
        const address = input.address?.trim() || customer.addresses.find((a: any) => a.isDefault)?.address || customer.vatAddress || null

        const defaultWH = await prisma.warehouse.findFirst({ where: { isDefault: true }, select: { legalEntityId: true } })
        const legalEntityId = defaultWH?.legalEntityId || (await prisma.legalEntity.findFirst({ select: { id: true } }))?.id || null

        const warehouse = await prisma.warehouse.create({
            data: {
                code,
                name,
                address,
                type: 'CONSIGNMENT',
                customerId: customer.id,
                legalEntityId,
                allowSales: true,
                allowTransfer: true,
                isDefault: false,
                locations: {
                    create: {
                        zone: 'CSG',
                        locationCode: 'CSG-DEFAULT',
                        type: 'STORAGE',
                    },
                },
            },
        })

        revalidateCache('wms')
        revalidateCache('consignment')
        revalidatePath('/dashboard/consignment')
        revalidatePath('/dashboard/warehouse')
        return { success: true, warehouseId: warehouse.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get Internal Warehouses for Consignment Dispatch ───
export async function getInternalWarehouses(): Promise<{ id: string; code: string; name: string }[]> {
    try {
        return await prisma.warehouse.findMany({
            where: { type: 'INTERNAL' },
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
        })
    } catch (err: any) {
        return []
    }
}

// ─── Get Available Products in a Warehouse ──────────────
export async function getWarehouseStockForTransfer(warehouseId: string): Promise<{
    productId: string
    skuCode: string
    productName: string
    vintage: number | null
    qtyAvailable: number
}[]> {
    try {
        const lots = await prisma.stockLot.findMany({
            where: {
                location: { warehouseId },
                status: 'AVAILABLE',
                qtyAvailable: { gt: 0 },
            },
            include: {
                product: { select: { skuCode: true, productName: true } },
            },
            orderBy: [{ product: { skuCode: 'asc' } }, { vintage: 'asc' }],
        })

        const map = new Map<string, { productId: string; skuCode: string; productName: string; vintage: number | null; qtyAvailable: number }>()
        for (const lot of lots) {
            const key = `${lot.productId}_${lot.vintage || 'NV'}`
            const existing = map.get(key)
            if (existing) {
                existing.qtyAvailable += Number(lot.qtyAvailable)
            } else {
                map.set(key, {
                    productId: lot.productId,
                    skuCode: lot.product.skuCode,
                    productName: lot.product.productName,
                    vintage: lot.vintage,
                    qtyAvailable: Number(lot.qtyAvailable),
                })
            }
        }
        return Array.from(map.values())
    } catch (err: any) {
        return []
    }
}

// ─── Dispatch Consignment Stock (Transfer without invoice) ─
export async function createConsignmentTransfer(input: {
    fromWarehouseId: string
    toWarehouseId: string
    notes?: string
    transferDate?: string
    instantReceive?: boolean
    lines: { productId: string; qtyTransferred: number; vintage?: number | null }[]
}): Promise<{ success: boolean; transferNo?: string; error?: string }> {
    try {
        const user = await requireAuth()

        if (!input.fromWarehouseId || !input.toWarehouseId) {
            return { success: false, error: 'Vui lòng chọn Kho xuất và Kho nhận ký gửi' }
        }
        if (input.fromWarehouseId === input.toWarehouseId) {
            return { success: false, error: 'Kho xuất và Kho nhận ký gửi phải khác nhau' }
        }
        if (!input.lines || input.lines.length === 0) {
            return { success: false, error: 'Vui lòng chọn ít nhất 1 sản phẩm để xuất kho ký gửi' }
        }

        const now = new Date()
        const prefix = `TO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-`
        const lastTO = await prisma.transferOrder.findFirst({
            where: { transferNo: { startsWith: prefix } },
            orderBy: { transferNo: 'desc' },
            select: { transferNo: true },
        })
        const nextSeq = lastTO ? parseInt(lastTO.transferNo.slice(-4), 10) + 1 : 1
        const transferNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

        let destLoc = await prisma.location.findFirst({
            where: { warehouseId: input.toWarehouseId },
            orderBy: { locationCode: 'asc' },
        })
        if (!destLoc) {
            destLoc = await prisma.location.create({
                data: {
                    warehouseId: input.toWarehouseId,
                    zone: 'CSG',
                    locationCode: 'CSG-DEFAULT',
                    type: 'STORAGE',
                },
            })
        }

        await prisma.$transaction(async (tx) => {
            await tx.transferOrder.create({
                data: {
                    transferNo,
                    fromWarehouseId: input.fromWarehouseId,
                    toWarehouseId: input.toWarehouseId,
                    requesterId: user.id,
                    transferDate: input.transferDate ? new Date(input.transferDate) : now,
                    status: input.instantReceive !== false ? 'RECEIVED' : 'IN_TRANSIT',
                    notes: input.notes || 'Xuất hàng gửi bán đại lý / ký gửi (chuyển kho không xuất hóa đơn)',
                    confirmedAt: now,
                    receivedAt: input.instantReceive !== false ? now : null,
                    lines: {
                        create: input.lines.map(l => ({
                            productId: l.productId,
                            qtyTransferred: l.qtyTransferred,
                            vintage: l.vintage ?? null,
                            qtyReceived: input.instantReceive !== false ? l.qtyTransferred : 0,
                        })),
                    },
                },
            })

            for (const line of input.lines) {
                let remaining = Number(line.qtyTransferred)
                const whereLot: any = {
                    productId: line.productId,
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                    location: { warehouseId: input.fromWarehouseId },
                }
                if (line.vintage) {
                    whereLot.vintage = line.vintage
                }

                const lots = await tx.stockLot.findMany({
                    where: whereLot,
                    orderBy: { receivedDate: 'asc' },
                })

                let totalAvail = lots.reduce((sum, l) => sum + Number(l.qtyAvailable), 0)
                if (totalAvail < remaining) {
                    const prod = await tx.product.findUnique({ where: { id: line.productId }, select: { skuCode: true } })
                    throw new Error(`Kho xuất không đủ tồn kho cho SKU ${prod?.skuCode || line.productId} (còn ${totalAvail} chai, yêu cầu ${remaining} chai)`)
                }

                let totalCostAmount = 0
                let transferredLotCost = 0

                for (const lot of lots) {
                    if (remaining <= 0) break
                    const take = Math.min(Number(lot.qtyAvailable), remaining)
                    await tx.stockLot.update({
                        where: { id: lot.id },
                        data: { qtyAvailable: { decrement: take } },
                    })
                    totalCostAmount += take * Number(lot.unitLandedCost || 0)
                    transferredLotCost = Number(lot.unitLandedCost || 0)
                    remaining -= take
                }
                const avgCost = Number(line.qtyTransferred) > 0 ? totalCostAmount / Number(line.qtyTransferred) : transferredLotCost

                if (input.instantReceive !== false) {
                    const lastTrf = await tx.stockLot.findFirst({
                        where: { lotNo: { startsWith: 'TRF-' } },
                        orderBy: { lotNo: 'desc' },
                        select: { lotNo: true },
                    })
                    let nextTrfSeq = 1
                    if (lastTrf) {
                        const parts = lastTrf.lotNo.split('-')
                        const parsed = parseInt(parts[parts.length - 1], 10)
                        if (!isNaN(parsed)) nextTrfSeq = parsed + 1
                    }
                    const lotNo = `TRF-${String(nextTrfSeq).padStart(6, '0')}`

                    const firstLE = await tx.legalEntity.findFirst({ select: { id: true } })

                    await tx.stockLot.create({
                        data: {
                            lotNo,
                            ownerEntityId: firstLE?.id || 'default',
                            productId: line.productId,
                            locationId: destLoc!.id,
                            qtyReceived: line.qtyTransferred,
                            qtyAvailable: line.qtyTransferred,
                            unitLandedCost: avgCost,
                            receivedDate: now,
                            vintage: line.vintage ?? null,
                            status: 'AVAILABLE',
                        },
                    })
                }
            }
        })

        revalidateCache('transfers')
        revalidateCache('wms')
        revalidateCache('consignment')
        revalidatePath('/dashboard/consignment')
        revalidatePath('/dashboard/transfers')
        revalidatePath('/dashboard/warehouse')
        return { success: true, transferNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get Consignment Inventory for Count Sheet (A4) ─────
export async function getConsignmentInventoryForCount(warehouseId: string) {
    try {
        const wh: any = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            include: {
                customer: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        vatAddress: true,
                        taxId: true,
                        receiverPhone: true,
                        purchasingPhone: true,
                        addresses: { select: { address: true, isDefault: true } },
                    },
                },
                legalEntity: {
                    select: { name: true, address: true, taxId: true },
                },
                locations: {
                    include: {
                        stockLots: {
                            where: { qtyAvailable: { gt: 0 }, status: 'AVAILABLE' },
                            include: {
                                product: { select: { skuCode: true, productName: true } },
                            },
                        },
                    },
                },
            },
        })
        if (!wh) return { success: false, error: 'Không tìm thấy kho' }

        const map = new Map<string, {
            productId: string
            skuCode: string
            productName: string
            vintage: number | null
            unit: string
            qtySystem: number
        }>()

        for (const loc of wh.locations) {
            for (const lot of loc.stockLots) {
                const key = `${lot.productId}_${lot.vintage || 'NV'}`
                const existing = map.get(key)
                if (existing) {
                    existing.qtySystem += Number(lot.qtyAvailable)
                } else {
                    map.set(key, {
                        productId: lot.productId,
                        skuCode: lot.product.skuCode,
                        productName: lot.product.productName,
                        vintage: lot.vintage,
                        unit: 'Chai',
                        qtySystem: Number(lot.qtyAvailable),
                    })
                }
            }
        }

        const items = Array.from(map.values()).sort((a, b) => a.skuCode.localeCompare(b.skuCode))
        const defaultCustAddr = wh.customer?.addresses?.find((a: any) => a.isDefault)?.address || wh.customer?.addresses?.[0]?.address || wh.customer?.vatAddress || null

        return {
            success: true,
            data: {
                warehouseId: wh.id,
                warehouseCode: wh.code,
                warehouseName: wh.name,
                warehouseAddress: wh.address,
                customerId: wh.customer?.id || '',
                customerCode: wh.customer?.code || '',
                customerName: wh.customer?.name || wh.name,
                customerAddress: defaultCustAddr,
                customerPhone: wh.customer?.receiverPhone || wh.customer?.purchasingPhone || null,
                customerTaxId: wh.customer?.taxId || null,
                countedAt: new Date().toISOString(),
                legalEntityName: wh.legalEntity?.name || 'CÔNG TY TNHH LY CELLARS',
                legalEntityAddress: wh.legalEntity?.address || undefined,
                legalEntityTaxId: wh.legalEntity?.taxId || undefined,
                items,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get Consignment Transfer Print Data ────────────────
export async function getConsignmentTransferPrintData(transferNoOrId: string) {
    try {
        const to: any = await prisma.transferOrder.findFirst({
            where: {
                OR: [{ id: transferNoOrId }, { transferNo: transferNoOrId }],
            },
            include: {
                fromWarehouse: { select: { code: true, name: true, address: true } },
                toWarehouse: {
                    select: {
                        code: true,
                        name: true,
                        address: true,
                        customer: {
                            select: {
                                code: true,
                                name: true,
                                taxId: true,
                                receiverPhone: true,
                                addresses: { select: { address: true, isDefault: true } },
                            },
                        },
                    },
                },
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true } },
                    },
                },
            },
        })
        if (!to) return { success: false, error: 'Không tìm thấy phiếu chuyển kho' }

        const customer = to.toWarehouse?.customer
        const defaultCustAddr = customer?.addresses?.find((a: any) => a.isDefault)?.address || customer?.addresses?.[0]?.address || null

        return {
            success: true,
            data: {
                transferNo: to.transferNo,
                transferDate: to.transferDate.toISOString(),
                fromWarehouseName: to.fromWarehouse?.name || '',
                fromWarehouseCode: to.fromWarehouse?.code || '',
                fromWarehouseAddress: to.fromWarehouse?.address || null,
                toWarehouseName: to.toWarehouse?.name || '',
                toWarehouseCode: to.toWarehouse?.code || '',
                toWarehouseAddress: to.toWarehouse?.address || null,
                customerName: customer?.name || to.toWarehouse?.name || '',
                customerCode: customer?.code || '',
                customerAddress: defaultCustAddr,
                customerPhone: customer?.receiverPhone || null,
                customerTaxId: customer?.taxId || null,
                notes: to.notes,
                legalEntityName: 'CÔNG TY TNHH LY CELLARS',
                lines: to.lines.map((l: any) => ({
                    productId: l.productId,
                    skuCode: l.product.skuCode,
                    productName: l.product.productName,
                    vintage: l.vintage,
                    unit: 'Chai',
                    qtyTransferred: Number(l.qtyTransferred),
                    notes: null,
                })),
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get Consignment Transfers History ──────────────────
export async function getConsignmentTransfers() {
    try {
        const transfers = await prisma.transferOrder.findMany({
            where: {
                OR: [
                    { fromWarehouse: { type: 'CONSIGNMENT' } },
                    { toWarehouse: { type: 'CONSIGNMENT' } },
                ],
            },
            include: {
                fromWarehouse: { select: { code: true, name: true, type: true } },
                toWarehouse: { select: { code: true, name: true, type: true, customer: { select: { name: true, code: true } } } },
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        return transfers.map(t => {
            const isOut = t.toWarehouse.type === 'CONSIGNMENT'
            const totalQty = t.lines.reduce((s, l) => s + Number(l.qtyTransferred), 0)
            return {
                id: t.id,
                transferNo: t.transferNo,
                type: isOut ? 'XUẤT_KÝ_GỬI' : 'THU_HỒI_KÝ_GỬI',
                fromWarehouseName: t.fromWarehouse.name,
                toWarehouseName: t.toWarehouse.name,
                customerName: t.toWarehouse.customer?.name || t.fromWarehouse.name,
                totalQty,
                itemCount: t.lines.length,
                status: t.status,
                transferDate: t.transferDate,
                notes: t.notes,
            }
        })
    } catch (err: any) {
        return []
    }
}

// ─── Sell from Consignment Warehouse (Generates SO, DO & AR Invoice) ──
export async function sellFromConsignmentWarehouse(input: {
    warehouseId: string
    notes?: string
    items: { productId: string; qty: number; vintage?: number | null; unitPrice?: number }[]
}): Promise<{ success: boolean; soNo?: string; invoiceNo?: string; error?: string }> {
    try {
        const user = await requireAuth()

        const wh = await prisma.warehouse.findUnique({
            where: { id: input.warehouseId },
            include: {
                customer: { select: { id: true, name: true, parentId: true } },
            },
        })
        if (!wh) return { success: false, error: 'Kho ký gửi không tồn tại' }
        if (!wh.customerId) return { success: false, error: 'Kho này chưa được gắn với Khách hàng ký gửi nào' }
        if (!input.items || input.items.length === 0) return { success: false, error: 'Vui lòng chọn ít nhất 1 sản phẩm đã bán' }

        const now = new Date()
        const prefix = `SO-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}-`
        const lastSO = await prisma.salesOrder.findFirst({
            where: { soNo: { startsWith: prefix } },
            orderBy: { soNo: 'desc' },
            select: { soNo: true },
        })
        const nextSeq = lastSO ? parseInt(lastSO.soNo.slice(-4), 10) + 1 : 1
        const soNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

        let totalAmount = 0
        const lineData: any[] = []

        for (const item of input.items) {
            let unitPrice = item.unitPrice
            if (!unitPrice || unitPrice <= 0) {
                const pl = await prisma.priceListLine.findFirst({
                    where: { productId: item.productId },
                    orderBy: { priceList: { effectiveDate: 'desc' } },
                    select: { unitPrice: true },
                })
                unitPrice = pl ? Number(pl.unitPrice) : 500000
            }
            const lineTotal = item.qty * unitPrice
            totalAmount += lineTotal
            lineData.push({
                productId: item.productId,
                qtyOrdered: item.qty,
                qtyAllocated: item.qty,
                unitPrice,
                lineTotal,
                vintage: item.vintage ?? null,
            })
        }

        const legalEntity = await prisma.legalEntity.findFirst({ select: { id: true } })

        const result = await prisma.$transaction(async (tx) => {
            for (const item of input.items) {
                let remaining = item.qty
                const whereLot: any = {
                    productId: item.productId,
                    status: 'AVAILABLE',
                    qtyAvailable: { gt: 0 },
                    location: { warehouseId: input.warehouseId },
                }
                if (item.vintage) {
                    whereLot.vintage = item.vintage
                }

                const lots = await tx.stockLot.findMany({
                    where: whereLot,
                    orderBy: { receivedDate: 'asc' },
                })

                const totalAvail = lots.reduce((sum, l) => sum + Number(l.qtyAvailable), 0)
                if (totalAvail < remaining) {
                    const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { skuCode: true } })
                    throw new Error(`Kho ký gửi không đủ tồn kho cho SKU ${prod?.skuCode || item.productId} (còn ${totalAvail} chai, bán ${remaining} chai)`)
                }

                for (const lot of lots) {
                    if (remaining <= 0) break
                    const take = Math.min(Number(lot.qtyAvailable), remaining)
                    await tx.stockLot.update({
                        where: { id: lot.id },
                        data: { qtyAvailable: { decrement: take } },
                    })
                    remaining -= take
                }
            }

            const so = await tx.salesOrder.create({
                data: {
                    soNo,
                    customerId: wh.customerId!,
                    warehouseId: wh.id,
                    channel: 'HORECA',
                    legalEntityId: wh.legalEntityId || legalEntity?.id || 'default',
                    salesRepId: user.id,
                    status: 'DELIVERED',
                    paymentTerm: 'NET30',
                    totalAmount,
                    notes: input.notes || 'Xuất bán từ kho ký gửi khách hàng',
                    lines: {
                        create: lineData,
                    },
                },
            })

            const invCount = await tx.aRInvoice.count()
            const invoiceNo = `CSG-INV-${String(invCount + 1).padStart(6, '0')}`
            const vatAmount = totalAmount * 0.1
            const grandTotal = totalAmount + vatAmount

            await tx.aRInvoice.create({
                data: {
                    invoiceNo,
                    soId: so.id,
                    customerId: wh.customer?.parentId || wh.customerId!,
                    amount: totalAmount,
                    vatAmount,
                    totalAmount: grandTotal,
                    dueDate: new Date(Date.now() + 30 * 86400000),
                    status: 'UNPAID',
                    legalEntityId: wh.legalEntityId || legalEntity?.id || 'default',
                },
            })

            return { soNo, invoiceNo }
        })

        revalidateCache('sales')
        revalidateCache('wms')
        revalidateCache('consignment')
        revalidatePath('/dashboard/consignment')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/warehouse')
        return { success: true, ...result }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

