'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ── Top selling SKUs ─────────────────────────────
export async function getTopSKUs(limit = 10) {
    const lines = await prisma.salesOrderLine.groupBy({
        by: ['productId'],
        _sum: { qtyOrdered: true },
        orderBy: { _sum: { qtyOrdered: 'desc' } },
        take: limit,
        where: {
            so: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
        },
    })

    const products = await prisma.product.findMany({
        where: { id: { in: lines.map(l => l.productId) } },
        select: { id: true, skuCode: true, productName: true, wineType: true },
    })

    return lines.map(l => {
        const p = products.find(p => p.id === l.productId)!
        return {
            productId: l.productId,
            skuCode: p?.skuCode ?? 'Unknown',
            productName: p?.productName ?? 'Unknown',
            wineType: p?.wineType ?? 'RED',
            qtyOrdered: Number(l._sum.qtyOrdered ?? 0),
        }
    })
}

// ── Revenue by month (last 6) ────────────────────
export async function getMonthlyRevenue() {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const orders = await prisma.salesOrder.findMany({
        where: {
            status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
            createdAt: { gte: sixMonthsAgo },
        },
        select: { totalAmount: true, createdAt: true },
    })

    const monthMap: Record<string, number> = {}
    orders.forEach(o => {
        const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`
        monthMap[key] = (monthMap[key] ?? 0) + Number(o.totalAmount)
    })

    const result = []
    for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        result.push({
            month: key,
            label: d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
            revenue: monthMap[key] ?? 0,
        })
    }
    return result
}

// ── Revenue by channel ───────────────────────────
export async function getRevenueByChannel() {
    const result = await prisma.salesOrder.groupBy({
        by: ['channel'],
        _sum: { totalAmount: true },
        _count: true,
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
    })
    return result.map(r => ({
        channel: r.channel,
        revenue: Number(r._sum.totalAmount ?? 0),
        orders: r._count,
    }))
}

// ── Stock valuation ──────────────────────────────
export async function getStockValuation() {
    const result = await prisma.stockLot.aggregate({
        where: { status: 'AVAILABLE' },
        _sum: { qtyAvailable: true, unitLandedCost: true },
    })

    const productCount = await prisma.stockLot.groupBy({
        by: ['productId'],
        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
    })

    const lots = await prisma.stockLot.findMany({
        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
        select: { qtyAvailable: true, unitLandedCost: true },
    })

    const totalValue = lots.reduce((sum, l) => sum + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)

    return {
        totalQty: Number(result._sum.qtyAvailable ?? 0),
        totalValue,
        productCount: productCount.length,
    }
}

// ═══════════════════════════════════════════════════
// REPORT BUILDER — Template CRUD + dynamic execution
// ═══════════════════════════════════════════════════

export async function getReportTemplates() {
    return prisma.reportTemplate.findMany({
        include: { schedules: { select: { id: true, frequency: true, status: true } } },
        orderBy: { createdAt: 'desc' },
    })
}

export async function createReportTemplate(input: {
    name: string
    sourceModule: string
    dimensions: string[]
    metrics: string[]
    filters?: any
    chartType?: string
    isShared?: boolean
    createdBy: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const template = await prisma.reportTemplate.create({
            data: {
                name: input.name,
                sourceModule: input.sourceModule,
                dimensions: input.dimensions,
                metrics: input.metrics,
                filters: input.filters ?? {},
                chartType: input.chartType ?? 'bar',
                isShared: input.isShared ?? false,
                createdBy: input.createdBy,
            },
        })
        revalidatePath('/dashboard/reports')
        return { success: true, id: template.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteReportTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.reportSchedule.deleteMany({ where: { templateId: id } })
        await prisma.reportTemplate.delete({ where: { id } })
        revalidatePath('/dashboard/reports')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Dynamic report execution
export async function executeReport(templateId: string): Promise<{
    success: boolean
    data?: any[]
    error?: string
}> {
    try {
        const t = await prisma.reportTemplate.findUnique({ where: { id: templateId } })
        if (!t) return { success: false, error: 'Template không tồn tại' }

        let data: any[] = []

        switch (t.sourceModule) {
            case 'sales': {
                const orders = await prisma.salesOrder.findMany({
                    where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
                    include: {
                        customer: { select: { name: true, code: true } },
                        salesRep: { select: { name: true } },
                    },
                })
                data = orders.map(o => ({
                    soNo: o.soNo,
                    customerName: o.customer.name,
                    channel: o.channel,
                    status: o.status,
                    totalAmount: Number(o.totalAmount),
                    salesRep: o.salesRep.name,
                    month: `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`,
                }))
                break
            }
            case 'inventory': {
                const lots = await prisma.stockLot.findMany({
                    where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                    include: {
                        product: { select: { skuCode: true, productName: true, wineType: true, country: true } },
                        location: { select: { locationCode: true, zone: true, warehouse: { select: { name: true } } } },
                    },
                })
                data = lots.map(l => ({
                    skuCode: l.product.skuCode,
                    productName: l.product.productName,
                    wineType: l.product.wineType,
                    country: l.product.country,
                    warehouse: l.location.warehouse.name,
                    zone: l.location.zone,
                    qtyAvailable: Number(l.qtyAvailable),
                    totalValue: Number(l.qtyAvailable) * Number(l.unitLandedCost),
                }))
                break
            }
            case 'finance': {
                const invoices = await prisma.aRInvoice.findMany({
                    include: { customer: { select: { name: true } } },
                })
                data = invoices.map(i => ({
                    invoiceNo: i.invoiceNo,
                    customerName: i.customer.name,
                    amount: Number(i.amount),
                    status: i.status,
                    dueDate: i.dueDate,
                }))
                break
            }
            case 'procurement': {
                const pos = await prisma.purchaseOrder.findMany({
                    include: {
                        supplier: { select: { name: true } },
                        _count: { select: { lines: true } },
                    },
                })
                data = pos.map(po => ({
                    poNo: po.poNo,
                    supplierName: po.supplier.name,
                    status: po.status,
                    lineCount: po._count.lines,
                    createdAt: po.createdAt,
                }))
                break
            }
            default:
                return { success: false, error: `Module "${t.sourceModule}" chưa được hỗ trợ` }
        }

        // Dimension grouping
        if (t.dimensions.length > 0) {
            const grouped = new Map<string, any>()
            for (const row of data) {
                const key = t.dimensions.map((d: string) => row[d] ?? 'N/A').join('|')
                if (!grouped.has(key)) {
                    const base: any = { _count: 0 }
                    t.dimensions.forEach((d: string) => { base[d] = row[d] })
                    t.metrics.forEach((m: string) => { base[m] = 0 })
                    grouped.set(key, base)
                }
                const e = grouped.get(key)!
                t.metrics.forEach((m: string) => { if (typeof row[m] === 'number') e[m] += row[m] })
                e._count++
            }
            data = Array.from(grouped.values())
        }

        return { success: true, data }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// STANDARD REPORTS — R01-R15 Export Data Queries
// ═══════════════════════════════════════════════════

import { generateExcelBuffer, type ExcelColumn } from '@/lib/excel'

export type ReportKey =
    | 'stock_inventory' | 'sales_revenue' | 'ar_aging' | 'costing' | 'ap_outstanding'
    | 'po_status' | 'monthly_pnl' | 'margin_per_sku' | 'channel_performance'
    | 'customer_ranking' | 'slow_moving' | 'stamp_usage' | 'tax_summary'
    | 'expense_summary' | 'journal_ledger'

export const REPORT_CATALOG: { key: ReportKey; code: string; name: string; module: string }[] = [
    { key: 'stock_inventory', code: 'R01', name: 'Tồn Kho Chi Tiết', module: 'WMS' },
    { key: 'sales_revenue', code: 'R02', name: 'Doanh Thu Bán Hàng', module: 'SLS' },
    { key: 'ar_aging', code: 'R03', name: 'Công Nợ Phải Thu (AR Aging)', module: 'FIN' },
    { key: 'costing', code: 'R04', name: 'Phân Tích Giá Vốn & Biên LN', module: 'CST' },
    { key: 'ap_outstanding', code: 'R05', name: 'Công Nợ Phải Trả (AP)', module: 'FIN' },
    { key: 'po_status', code: 'R06', name: 'Tình Trạng Đơn Mua Hàng', module: 'PRC' },
    { key: 'monthly_pnl', code: 'R07', name: 'Kết Quả Kinh Doanh Tháng', module: 'FIN' },
    { key: 'margin_per_sku', code: 'R08', name: 'Biên Lợi Nhuận Theo SKU', module: 'SLS' },
    { key: 'channel_performance', code: 'R09', name: 'Hiệu Suất Kênh Bán', module: 'SLS' },
    { key: 'customer_ranking', code: 'R10', name: 'Xếp Hạng Khách Hàng', module: 'CRM' },
    { key: 'slow_moving', code: 'R11', name: 'Hàng Tồn Chậm Luân Chuyển', module: 'WMS' },
    { key: 'stamp_usage', code: 'R12', name: 'Sử Dụng Tem Rượu', module: 'STM' },
    { key: 'tax_summary', code: 'R13', name: 'Tổng Hợp Thuế NK/TTĐB/VAT', module: 'TAX' },
    { key: 'expense_summary', code: 'R14', name: 'Tổng Hợp Chi Phí', module: 'FIN' },
    { key: 'journal_ledger', code: 'R15', name: 'Sổ Nhật Ký Kế Toán', module: 'FIN' },
]

// ── R05: AP Outstanding ──────────────────────────
async function getAPOutstanding() {
    const invoices = await prisma.aPInvoice.findMany({
        include: { supplier: { select: { name: true } }, payments: { select: { amount: true } } },
        orderBy: { dueDate: 'asc' },
    })
    return invoices.map(i => {
        const paidAmount = i.payments.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Number(i.amount) - paidAmount
        const daysOverdue = i.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000)) : 0
        return {
            invoiceNo: i.invoiceNo, supplierName: i.supplier.name,
            amount: Number(i.amount), paidAmount,
            outstanding, dueDate: new Date(i.dueDate).toLocaleDateString('vi-VN'),
            daysOverdue, status: i.status,
        }
    })
}

// ── R06: PO Status ───────────────────────────────
async function getPOStatus() {
    const pos = await prisma.purchaseOrder.findMany({
        include: {
            supplier: { select: { name: true } },
            lines: { select: { qtyOrdered: true, unitPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
    })
    return pos.map(po => ({
        poNo: po.poNo, supplierName: po.supplier.name,
        status: po.status, lineCount: po.lines.length,
        totalQty: po.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0),
        totalValue: po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0),
        currency: po.currency, exchangeRate: Number(po.exchangeRate),
        createdAt: new Date(po.createdAt).toLocaleDateString('vi-VN'),
    }))
}

// ── R07: Monthly P&L ─────────────────────────────
async function getMonthlyPnL() {
    const entries = await prisma.journalEntry.findMany({
        include: { lines: true },
        orderBy: { postedAt: 'desc' },
        take: 500,
    })
    const monthMap = new Map<string, { revenue: number; cogs: number; expenses: number }>()
    for (const j of entries) {
        const key = `${j.postedAt.getFullYear()}-${String(j.postedAt.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap.has(key)) monthMap.set(key, { revenue: 0, cogs: 0, expenses: 0 })
        const m = monthMap.get(key)!
        for (const line of j.lines) {
            const amount = Number(line.debit) || Number(line.credit) || 0
            if (line.account.startsWith('511')) m.revenue += amount
            else if (line.account.startsWith('632')) m.cogs += amount
            else if (line.account.startsWith('641') || line.account.startsWith('642')) m.expenses += amount
        }
    }
    return Array.from(monthMap.entries()).map(([month, d]) => ({
        month, revenue: d.revenue, cogs: d.cogs, grossProfit: d.revenue - d.cogs,
        expenses: d.expenses, netProfit: d.revenue - d.cogs - d.expenses,
        grossMargin: d.revenue > 0 ? ((d.revenue - d.cogs) / d.revenue * 100).toFixed(1) + '%' : '—',
    })).sort((a, b) => b.month.localeCompare(a.month))
}

// ── R08: Margin per SKU ──────────────────────────
async function getMarginPerSKU() {
    const lots = await prisma.stockLot.findMany({
        where: { qtyAvailable: { gt: 0 } },
        select: { productId: true, unitLandedCost: true, qtyAvailable: true },
    })
    const costMap = new Map<string, { totalCost: number; totalQty: number }>()
    for (const l of lots) {
        const e = costMap.get(l.productId) ?? { totalCost: 0, totalQty: 0 }
        e.totalCost += Number(l.unitLandedCost) * Number(l.qtyAvailable)
        e.totalQty += Number(l.qtyAvailable)
        costMap.set(l.productId, e)
    }
    const result = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
            id: true, skuCode: true, productName: true, wineType: true, country: true,
            priceLines: { select: { unitPrice: true }, take: 1, orderBy: { priceList: { effectiveDate: 'desc' } } },
        },
    })
    return result.map(p => {
        const c = costMap.get(p.id)
        const avgCost = c && c.totalQty > 0 ? c.totalCost / c.totalQty : 0
        const price = p.priceLines[0] ? Number(p.priceLines[0].unitPrice) : 0
        const margin = price > 0 ? ((price - avgCost) / price * 100) : 0
        return {
            skuCode: p.skuCode, productName: p.productName, wineType: p.wineType,
            country: p.country, avgCost: Math.round(avgCost), listPrice: price,
            margin: Math.round(margin * 10) / 10, stockQty: c?.totalQty ?? 0,
            isLoss: margin < 0,
        }
    })
}

// ── R09: Channel Performance ─────────────────────
async function getChannelPerformance() {
    const result = await prisma.salesOrder.groupBy({
        by: ['channel'],
        _sum: { totalAmount: true },
        _count: true,
        _avg: { totalAmount: true },
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
    })
    return result.map(r => ({
        channel: r.channel, revenue: Number(r._sum.totalAmount ?? 0),
        orderCount: r._count, avgOrderValue: Math.round(Number(r._avg.totalAmount ?? 0)),
    }))
}

// ── R10: Customer Revenue Ranking ────────────────
async function getCustomerRanking() {
    const result = await prisma.salesOrder.groupBy({
        by: ['customerId'],
        _sum: { totalAmount: true },
        _count: true,
        where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 50,
    })
    const customers = await prisma.customer.findMany({
        where: { id: { in: result.map(r => r.customerId) } },
        select: { id: true, name: true, code: true, customerType: true, channel: true },
    })
    return result.map((r, i) => {
        const c = customers.find(c => c.id === r.customerId)
        return {
            rank: i + 1, customerCode: c?.code ?? '—', customerName: c?.name ?? '—',
            customerType: c?.customerType ?? '—', channel: c?.channel ?? '—',
            totalRevenue: Number(r._sum.totalAmount ?? 0), orderCount: r._count,
        }
    })
}

// ── R11: Slow-Moving Stock ──────────────────────
async function getSlowMovingStock() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 180)
    const lots = await prisma.stockLot.findMany({
        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 }, receivedDate: { lt: cutoff } },
        include: {
            product: { select: { skuCode: true, productName: true, wineType: true } },
            location: { select: { warehouse: { select: { name: true } } } },
        },
        orderBy: { receivedDate: 'asc' },
    })
    return lots.map(l => ({
        skuCode: l.product.skuCode, productName: l.product.productName,
        wineType: l.product.wineType, lotNo: l.lotNo,
        warehouse: l.location.warehouse.name,
        qtyAvailable: Number(l.qtyAvailable),
        unitCost: Number(l.unitLandedCost), value: Number(l.qtyAvailable) * Number(l.unitLandedCost),
        receivedAt: new Date(l.receivedDate).toLocaleDateString('vi-VN'),
        daysInStock: Math.floor((Date.now() - new Date(l.receivedDate).getTime()) / 86400000),
    }))
}

// ── R12: Stamp Usage ────────────────────────────
async function getStampUsage() {
    const purchases = await prisma.wineStampPurchase.findMany({
        include: { usages: true },
        orderBy: { purchaseDate: 'desc' },
    })
    return purchases.map(p => ({
        stampType: p.stampType, symbol: p.symbol,
        serialStart: p.serialStart, serialEnd: p.serialEnd,
        totalQty: p.totalQty, usedQty: p.usages.reduce((s, u) => s + u.qtyUsed, 0),
        damagedQty: p.usages.reduce((s, u) => s + u.qtyDamaged, 0),
        remaining: p.totalQty - p.usages.reduce((s, u) => s + u.qtyUsed + u.qtyDamaged, 0),
        purchaseDate: new Date(p.purchaseDate).toLocaleDateString('vi-VN'),
    }))
}

// ── R13: Tax Summary ────────────────────────────
async function getTaxSummary() {
    const taxes = await prisma.taxRate.findMany({ orderBy: { hsCode: 'asc' } })
    return taxes.map(t => ({
        hsCode: t.hsCode, country: t.countryOfOrigin, tradeAgreement: t.tradeAgreement,
        importTaxPct: Number(t.importTaxRate), sctPct: Number(t.sctRate),
        vatPct: Number(t.vatRate), effectiveDate: new Date(t.effectiveDate).toLocaleDateString('vi-VN'),
        expiryDate: t.expiryDate ? new Date(t.expiryDate).toLocaleDateString('vi-VN') : '—',
    }))
}

// ── R14: Expense Summary ────────────────────────
async function getExpenseSummary() {
    const expenses = await prisma.expense.findMany({
        include: { approver: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 200,
    })
    return expenses.map(e => ({
        category: e.category, description: e.description, amount: Number(e.amount),
        status: e.status, approvedBy: e.approver?.name ?? '—',
        expenseDate: new Date(e.createdAt).toLocaleDateString('vi-VN'),
    }))
}

// ── R15: Journal Ledger ─────────────────────────
async function getJournalLedger() {
    const entries = await prisma.journalEntry.findMany({
        include: { lines: true },
        orderBy: { postedAt: 'desc' },
        take: 200,
    })
    const rows: any[] = []
    for (const j of entries) {
        for (const line of j.lines) {
            rows.push({
                date: new Date(j.postedAt).toLocaleDateString('vi-VN'),
                accountCode: line.account.split(' ')[0] ?? line.account,
                accountName: line.account,
                description: line.description ?? j.description ?? '—',
                debit: Number(line.debit), credit: Number(line.credit),
                sourceType: j.docType, sourceId: j.docId ?? '—',
            })
        }
    }
    return rows
}

// ═══════════════════════════════════════════════════
// MASTER EXPORT — Generate Excel for any report key
// ═══════════════════════════════════════════════════

const REPORT_COLUMNS: Record<ReportKey, ExcelColumn[]> = {
    stock_inventory: [
        { header: 'Mã SKU', key: 'skuCode', width: 15 }, { header: 'Tên SP', key: 'productName', width: 30 },
        { header: 'Kho', key: 'warehouseName', width: 18 }, { header: 'Vị trí', key: 'locationCode', width: 12 },
        { header: 'Mã Lot', key: 'lotNo', width: 15 }, { header: 'SL Nhập', key: 'qtyReceived', width: 10, numFmt: '#,##0' },
        { header: 'SL Tồn', key: 'qtyAvailable', width: 10, numFmt: '#,##0' },
        { header: 'Đơn giá', key: 'unitLandedCost', width: 12, numFmt: '#,##0' }, { header: 'Trạng thái', key: 'status', width: 12 },
    ],
    sales_revenue: [
        { header: 'Số SO', key: 'soNo', width: 15 }, { header: 'Khách hàng', key: 'customerName', width: 25 },
        { header: 'Kênh', key: 'channel', width: 15 }, { header: 'Tổng tiền', key: 'totalAmount', width: 15, numFmt: '#,##0' },
        { header: 'Chiết khấu', key: 'orderDiscount', width: 12, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 12 }, { header: 'Ngày tạo', key: 'createdAt', width: 15 },
        { header: 'NV Bán hàng', key: 'salesRepName', width: 20 },
    ],
    ar_aging: [
        { header: 'Số HĐ', key: 'invoiceNo', width: 15 }, { header: 'Khách hàng', key: 'customerName', width: 25 },
        { header: 'Số tiền', key: 'amount', width: 15, numFmt: '#,##0' }, { header: 'Đã trả', key: 'paidAmount', width: 15, numFmt: '#,##0' },
        { header: 'Còn lại', key: 'outstanding', width: 15, numFmt: '#,##0' }, { header: 'Hạn TT', key: 'dueDate', width: 13 },
        { header: 'Ngày QH', key: 'daysOverdue', width: 10 }, { header: 'Trạng thái', key: 'status', width: 12 },
    ],
    costing: [
        { header: 'Mã SKU', key: 'skuCode', width: 15 }, { header: 'Tên SP', key: 'productName', width: 30 },
        { header: 'Quốc gia', key: 'country', width: 13 }, { header: 'ABV %', key: 'abvPercent', width: 8, numFmt: '0.0' },
        { header: 'Giá vốn/chai', key: 'unitLandedCost', width: 12, numFmt: '#,##0' },
        { header: 'Giá bán', key: 'listPrice', width: 12, numFmt: '#,##0' },
        { header: 'Biên LN %', key: 'marginPct', width: 10, numFmt: '0.0' }, { header: 'SL Tồn', key: 'stockQty', width: 10, numFmt: '#,##0' },
    ],
    ap_outstanding: [
        { header: 'Số HĐ', key: 'invoiceNo', width: 15 }, { header: 'NCC', key: 'supplierName', width: 25 },
        { header: 'Số tiền', key: 'amount', width: 15, numFmt: '#,##0' }, { header: 'Đã trả', key: 'paidAmount', width: 15, numFmt: '#,##0' },
        { header: 'Còn lại', key: 'outstanding', width: 15, numFmt: '#,##0' }, { header: 'Hạn TT', key: 'dueDate', width: 13 },
        { header: 'Ngày QH', key: 'daysOverdue', width: 10 }, { header: 'Trạng thái', key: 'status', width: 12 },
    ],
    po_status: [
        { header: 'Số PO', key: 'poNo', width: 15 }, { header: 'NCC', key: 'supplierName', width: 25 },
        { header: 'Trạng thái', key: 'status', width: 15 }, { header: 'Dòng SP', key: 'lineCount', width: 8 },
        { header: 'Tổng SL', key: 'totalQty', width: 10, numFmt: '#,##0' },
        { header: 'Tổng giá trị', key: 'totalValue', width: 15, numFmt: '#,##0' },
        { header: 'Tiền tệ', key: 'currency', width: 8 }, { header: 'Ngày tạo', key: 'createdAt', width: 13 },
    ],
    monthly_pnl: [
        { header: 'Tháng', key: 'month', width: 12 }, { header: 'Doanh thu', key: 'revenue', width: 15, numFmt: '#,##0' },
        { header: 'COGS', key: 'cogs', width: 15, numFmt: '#,##0' }, { header: 'Lãi gộp', key: 'grossProfit', width: 15, numFmt: '#,##0' },
        { header: 'Chi phí', key: 'expenses', width: 15, numFmt: '#,##0' }, { header: 'Lãi ròng', key: 'netProfit', width: 15, numFmt: '#,##0' },
        { header: 'Biên GP %', key: 'grossMargin', width: 10 },
    ],
    margin_per_sku: [
        { header: 'Mã SKU', key: 'skuCode', width: 15 }, { header: 'Tên SP', key: 'productName', width: 30 },
        { header: 'Loại', key: 'wineType', width: 10 }, { header: 'Quốc gia', key: 'country', width: 13 },
        { header: 'Giá vốn TB', key: 'avgCost', width: 12, numFmt: '#,##0' },
        { header: 'Giá bán', key: 'listPrice', width: 12, numFmt: '#,##0' },
        { header: 'Biên %', key: 'margin', width: 10, numFmt: '0.0' }, { header: 'Tồn kho', key: 'stockQty', width: 10, numFmt: '#,##0' },
    ],
    channel_performance: [
        { header: 'Kênh', key: 'channel', width: 20 }, { header: 'Doanh thu', key: 'revenue', width: 18, numFmt: '#,##0' },
        { header: 'Số đơn', key: 'orderCount', width: 10 }, { header: 'GT trung bình/đơn', key: 'avgOrderValue', width: 18, numFmt: '#,##0' },
    ],
    customer_ranking: [
        { header: '#', key: 'rank', width: 5 }, { header: 'Mã KH', key: 'customerCode', width: 12 },
        { header: 'Tên KH', key: 'customerName', width: 25 }, { header: 'Loại', key: 'customerType', width: 12 },
        { header: 'Kênh', key: 'channel', width: 15 }, { header: 'Tổng DT', key: 'totalRevenue', width: 18, numFmt: '#,##0' },
        { header: 'Số đơn', key: 'orderCount', width: 10 },
    ],
    slow_moving: [
        { header: 'Mã SKU', key: 'skuCode', width: 15 }, { header: 'Tên SP', key: 'productName', width: 30 },
        { header: 'Kho', key: 'warehouse', width: 18 }, { header: 'Lot No', key: 'lotNo', width: 15 },
        { header: 'SL Tồn', key: 'qtyAvailable', width: 10, numFmt: '#,##0' },
        { header: 'Giá trị', key: 'value', width: 15, numFmt: '#,##0' },
        { header: 'Ngày nhập', key: 'receivedAt', width: 13 }, { header: 'Số ngày', key: 'daysInStock', width: 10 },
    ],
    stamp_usage: [
        { header: 'Loại tem', key: 'stampType', width: 15 }, { header: 'Ký hiệu', key: 'symbol', width: 12 },
        { header: 'Serial đầu', key: 'serialStart', width: 12 }, { header: 'Serial cuối', key: 'serialEnd', width: 12 },
        { header: 'Tổng', key: 'totalQty', width: 10, numFmt: '#,##0' }, { header: 'Đã dùng', key: 'usedQty', width: 10, numFmt: '#,##0' },
        { header: 'Hỏng', key: 'damagedQty', width: 10, numFmt: '#,##0' }, { header: 'Còn lại', key: 'remaining', width: 10, numFmt: '#,##0' },
        { header: 'Ngày mua', key: 'purchaseDate', width: 13 },
    ],
    tax_summary: [
        { header: 'HS Code', key: 'hsCode', width: 12 }, { header: 'Quốc gia', key: 'country', width: 13 },
        { header: 'FTA', key: 'tradeAgreement', width: 12 }, { header: 'Thuế NK %', key: 'importTaxPct', width: 10, numFmt: '0.0' },
        { header: 'TTĐB %', key: 'sctPct', width: 10, numFmt: '0.0' }, { header: 'VAT %', key: 'vatPct', width: 10, numFmt: '0.0' },
        { header: 'Hiệu lực', key: 'effectiveDate', width: 13 }, { header: 'Hết hạn', key: 'expiryDate', width: 13 },
    ],
    expense_summary: [
        { header: 'Danh mục', key: 'category', width: 18 }, { header: 'Mô tả', key: 'description', width: 30 },
        { header: 'Số tiền', key: 'amount', width: 15, numFmt: '#,##0' }, { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Duyệt bởi', key: 'approvedBy', width: 18 }, { header: 'Ngày', key: 'expenseDate', width: 13 },
    ],
    journal_ledger: [
        { header: 'Ngày', key: 'date', width: 13 }, { header: 'Mã TK', key: 'accountCode', width: 10 },
        { header: 'Tên TK', key: 'accountName', width: 25 }, { header: 'Diễn giải', key: 'description', width: 30 },
        { header: 'Nợ', key: 'debit', width: 15, numFmt: '#,##0' }, { header: 'Có', key: 'credit', width: 15, numFmt: '#,##0' },
        { header: 'Loại', key: 'sourceType', width: 12 }, { header: 'Mã CT', key: 'sourceId', width: 15 },
    ],
}

const REPORT_TITLES: Record<ReportKey, string> = {
    stock_inventory: 'BÁO CÁO TỒN KHO CHI TIẾT',
    sales_revenue: 'BÁO CÁO DOANH THU BÁN HÀNG',
    ar_aging: 'BÁO CÁO CÔNG NỢ PHẢI THU',
    costing: 'PHÂN TÍCH GIÁ VỐN & BIÊN LỢI NHUẬN',
    ap_outstanding: 'BÁO CÁO CÔNG NỢ PHẢI TRẢ',
    po_status: 'BÁO CÁO TÌNH TRẠNG ĐƠN MUA HÀNG',
    monthly_pnl: 'BÁO CÁO KẾT QUẢ KINH DOANH THÁNG',
    margin_per_sku: 'BÁO CÁO BIÊN LỢI NHUẬN THEO SKU',
    channel_performance: 'BÁO CÁO HIỆU SUẤT KÊNH BÁN',
    customer_ranking: 'BÁO CÁO XẾP HẠNG KHÁCH HÀNG',
    slow_moving: 'BÁO CÁO HÀNG TỒN CHẬM LUÂN CHUYỂN',
    stamp_usage: 'BÁO CÁO SỬ DỤNG TEM RƯỢU',
    tax_summary: 'BẢNG TỔNG HỢP THUẾ NK / TTĐB / VAT',
    expense_summary: 'BÁO CÁO TỔNG HỢP CHI PHÍ',
    journal_ledger: 'SỔ NHẬT KÝ KẾ TOÁN TỔNG HỢP',
}

export async function exportReportExcel(key: ReportKey): Promise<{ success: boolean; buffer?: string; fileName?: string; error?: string }> {
    try {
        let rows: any[] = []
        switch (key) {
            case 'stock_inventory': {
                const lots = await prisma.stockLot.findMany({
                    where: { qtyAvailable: { gt: 0 } },
                    include: {
                        product: { select: { skuCode: true, productName: true } },
                        location: { select: { locationCode: true, warehouse: { select: { name: true } } } },
                    },
                })
                rows = lots.map(l => ({
                    skuCode: l.product.skuCode, productName: l.product.productName,
                    warehouseName: l.location.warehouse.name, locationCode: l.location.locationCode,
                    lotNo: l.lotNo, qtyReceived: Number(l.qtyReceived), qtyAvailable: Number(l.qtyAvailable),
                    unitLandedCost: Number(l.unitLandedCost), status: l.status,
                }))
                break
            }
            case 'sales_revenue': {
                const orders = await prisma.salesOrder.findMany({
                    where: { status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] } },
                    include: { customer: { select: { name: true } }, salesRep: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                })
                rows = orders.map(o => ({
                    soNo: o.soNo, customerName: o.customer.name, channel: o.channel,
                    totalAmount: Number(o.totalAmount), orderDiscount: Number(o.orderDiscount),
                    status: o.status, createdAt: new Date(o.createdAt).toLocaleDateString('vi-VN'),
                    salesRepName: o.salesRep.name,
                }))
                break
            }
            case 'ar_aging': {
                const invoices = await prisma.aRInvoice.findMany({
                    include: { customer: { select: { name: true } }, payments: { select: { amount: true } } }, orderBy: { dueDate: 'asc' },
                })
                rows = invoices.map(i => {
                    const paidAmount = i.payments.reduce((s, p) => s + Number(p.amount), 0)
                    const outstanding = Number(i.amount) - paidAmount
                    const daysOverdue = i.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000)) : 0
                    return {
                        invoiceNo: i.invoiceNo, customerName: i.customer.name, amount: Number(i.amount),
                        paidAmount, outstanding, dueDate: new Date(i.dueDate).toLocaleDateString('vi-VN'),
                        daysOverdue, status: i.status,
                    }
                })
                break
            }
            case 'costing': {
                const p = await prisma.product.findMany({
                    where: { status: 'ACTIVE' },
                    select: {
                        id: true, skuCode: true, productName: true, country: true, abvPercent: true,
                        priceLines: { select: { unitPrice: true }, take: 1, orderBy: { priceList: { effectiveDate: 'desc' } } },
                    },
                })
                const lotData = await prisma.stockLot.findMany({
                    where: { qtyAvailable: { gt: 0 } },
                    select: { productId: true, unitLandedCost: true, qtyAvailable: true },
                })
                const cm = new Map<string, { tc: number; tq: number }>()
                for (const l of lotData) {
                    const e = cm.get(l.productId) ?? { tc: 0, tq: 0 }
                    e.tc += Number(l.unitLandedCost) * Number(l.qtyAvailable); e.tq += Number(l.qtyAvailable)
                    cm.set(l.productId, e)
                }
                rows = p.map(prod => {
                    const c = cm.get(prod.id)
                    const avgCost = c && c.tq > 0 ? c.tc / c.tq : 0
                    const lp = prod.priceLines[0] ? Number(prod.priceLines[0].unitPrice) : 0
                    return {
                        skuCode: prod.skuCode, productName: prod.productName, country: prod.country,
                        abvPercent: prod.abvPercent ? Number(prod.abvPercent) : null,
                        unitLandedCost: Math.round(avgCost), listPrice: lp,
                        marginPct: lp > 0 ? Math.round((lp - avgCost) / lp * 1000) / 10 : 0,
                        stockQty: c?.tq ?? 0,
                    }
                })
                break
            }
            case 'ap_outstanding': rows = await getAPOutstanding(); break
            case 'po_status': rows = await getPOStatus(); break
            case 'monthly_pnl': rows = await getMonthlyPnL(); break
            case 'margin_per_sku': rows = await getMarginPerSKU(); break
            case 'channel_performance': rows = await getChannelPerformance(); break
            case 'customer_ranking': rows = await getCustomerRanking(); break
            case 'slow_moving': rows = await getSlowMovingStock(); break
            case 'stamp_usage': rows = await getStampUsage(); break
            case 'tax_summary': rows = await getTaxSummary(); break
            case 'expense_summary': rows = await getExpenseSummary(); break
            case 'journal_ledger': rows = await getJournalLedger(); break
        }

        const catalog = REPORT_CATALOG.find(r => r.key === key)!
        const buffer = await generateExcelBuffer({
            sheetName: catalog.code,
            title: REPORT_TITLES[key],
            columns: REPORT_COLUMNS[key],
            rows,
        })

        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const fileName = `${catalog.code}_${key}_${date}.xlsx`

        return { success: true, buffer: buffer.toString('base64'), fileName }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// AR AGING — Bucket Summary + Print-to-PDF HTML
// ═══════════════════════════════════════════════════

export async function getARAgingBucketSummary() {
    const invoices = await prisma.aRInvoice.findMany({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        include: {
            customer: { select: { name: true, code: true } },
            payments: { select: { amount: true } },
        },
        orderBy: { dueDate: 'asc' },
    })

    const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 }
    const rows = invoices.map(i => {
        const paidAmount = i.payments.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Number(i.amount) - paidAmount
        const daysOverdue = i.dueDate
            ? Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86400000))
            : 0

        if (daysOverdue === 0) buckets.current += outstanding
        else if (daysOverdue <= 30) buckets['1_30'] += outstanding
        else if (daysOverdue <= 60) buckets['31_60'] += outstanding
        else if (daysOverdue <= 90) buckets['61_90'] += outstanding
        else buckets['90_plus'] += outstanding

        return {
            invoiceNo: i.invoiceNo,
            customerName: i.customer.name,
            customerCode: i.customer.code,
            amount: Number(i.amount),
            paidAmount,
            outstanding,
            dueDate: i.dueDate,
            daysOverdue,
            status: i.status,
        }
    })

    const totalOutstanding = Object.values(buckets).reduce((s, v) => s + v, 0)

    return { rows, buckets, totalOutstanding }
}

export async function exportARAgingHTML(): Promise<{ success: boolean; html?: string; error?: string }> {
    try {
        const { rows, buckets, totalOutstanding } = await getARAgingBucketSummary()
        const fmt = (n: number) => n.toLocaleString('vi-VN')
        const today = new Date().toLocaleDateString('vi-VN')

        const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Báo Cáo Công Nợ Phải Thu — AR Aging</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #1a1a1a; font-size: 11px; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 13px; color: #555; margin-top: 0; }
  .meta { text-align: center; color: #888; margin-bottom: 20px; }
  .buckets { display: flex; gap: 12px; margin-bottom: 20px; justify-content: center; }
  .bucket { border: 1px solid #ddd; border-radius: 6px; padding: 10px 16px; text-align: center; min-width: 100px; }
  .bucket .label { font-size: 10px; color: #888; text-transform: uppercase; }
  .bucket .value { font-size: 16px; font-weight: bold; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #2A4355; color: #fff; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px; border-bottom: 1px solid #e5e5e5; }
  tr:nth-child(even) { background: #f8f8f8; }
  .right { text-align: right; }
  .overdue { color: #c0392b; font-weight: bold; }
  .total-row { font-weight: bold; background: #e8f4f0 !important; }
  @media print { body { margin: 15px; } .no-print { display: none; } }
</style>
</head>
<body>
<h1>CÔNG TY CỔ PHẦN LYS CELLARS</h1>
<h2>BÁO CÁO CÔNG NỢ PHẢI THU (AR AGING)</h2>
<p class="meta">Ngày xuất: ${today} — Tổng cộng: ${fmt(totalOutstanding)} VNĐ</p>

<div class="buckets">
  <div class="bucket"><div class="label">Chưa đến hạn</div><div class="value">${fmt(buckets.current)}</div></div>
  <div class="bucket"><div class="label">1-30 ngày</div><div class="value">${fmt(buckets['1_30'])}</div></div>
  <div class="bucket"><div class="label">31-60 ngày</div><div class="value">${fmt(buckets['31_60'])}</div></div>
  <div class="bucket"><div class="label">61-90 ngày</div><div class="value" style="color:#e67e22">${fmt(buckets['61_90'])}</div></div>
  <div class="bucket"><div class="label">90+ ngày</div><div class="value" style="color:#c0392b">${fmt(buckets['90_plus'])}</div></div>
</div>

<table>
<thead>
<tr>
  <th>Số HĐ</th><th>Mã KH</th><th>Khách Hàng</th>
  <th class="right">Số Tiền</th><th class="right">Đã Thu</th><th class="right">Còn Lại</th>
  <th>Hạn TT</th><th class="right">Ngày QH</th><th>Trạng Thái</th>
</tr>
</thead>
<tbody>
${rows.map(r => `<tr${r.daysOverdue > 90 ? ' class="overdue"' : ''}>
  <td>${r.invoiceNo}</td><td>${r.customerCode}</td><td>${r.customerName}</td>
  <td class="right">${fmt(r.amount)}</td><td class="right">${fmt(r.paidAmount)}</td>
  <td class="right">${fmt(r.outstanding)}</td>
  <td>${new Date(r.dueDate).toLocaleDateString('vi-VN')}</td>
  <td class="right">${r.daysOverdue > 0 ? r.daysOverdue : '—'}</td>
  <td>${r.status}</td>
</tr>`).join('\n')}
<tr class="total-row">
  <td colspan="5">TỔNG CỘNG</td>
  <td class="right">${fmt(totalOutstanding)}</td>
  <td colspan="3">${rows.length} hóa đơn</td>
</tr>
</tbody>
</table>
</body>
</html>`

        return { success: true, html }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
