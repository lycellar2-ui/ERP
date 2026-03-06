'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/session'
import { cached, revalidateCache } from '@/lib/cache'

export interface ARRow {
    id: string; invoiceNo: string; customerName: string; customerCode: string
    soNo: string | null; amount: number; paidAmount: number; outstanding: number
    dueDate: Date; status: string; isOverdue: boolean; daysOverdue: number; createdAt: Date
}

export interface APRow {
    id: string; invoiceNo: string; supplierName: string; supplierCode: string
    poNo: string | null; amount: number; currency: string; paidAmount: number; outstanding: number
    dueDate: Date; status: string; isOverdue: boolean; createdAt: Date
}

// ── AR Invoices ──────────────────────────────────
export async function getARInvoices(filters: {
    status?: string; search?: string; page?: number; pageSize?: number
} = {}): Promise<{ rows: ARRow[]; total: number }> {
    const { status, search, page = 1, pageSize = 25 } = filters
    const skip = (page - 1) * pageSize
    const now = new Date()

    const where: any = {}
    if (status) where.status = status
    if (search) where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
    ]

    const [invoices, total] = await Promise.all([
        prisma.aRInvoice.findMany({
            where, skip, take: pageSize, orderBy: { dueDate: 'asc' },
            include: {
                customer: { select: { name: true, code: true } },
                so: { select: { soNo: true } },
                payments: { select: { amount: true } },
            },
        }),
        prisma.aRInvoice.count({ where }),
    ])

    return {
        rows: invoices.map(inv => {
            const paidAmount = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
            const outstanding = Number(inv.amount) - paidAmount
            const daysOverdue = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000))
            return {
                id: inv.id, invoiceNo: inv.invoiceNo,
                customerName: inv.customer.name, customerCode: inv.customer.code,
                soNo: inv.so?.soNo ?? null,
                amount: Number(inv.amount), paidAmount, outstanding,
                dueDate: inv.dueDate, status: inv.status,
                isOverdue: inv.dueDate < now && !['PAID', 'CANCELLED'].includes(inv.status),
                daysOverdue, createdAt: inv.createdAt,
            }
        }),
        total,
    }
}

// ── AP Invoices ──────────────────────────────────
export async function getAPInvoices(filters: {
    status?: string; search?: string; page?: number; pageSize?: number
} = {}): Promise<{ rows: APRow[]; total: number }> {
    const { status, search, page = 1, pageSize = 25 } = filters
    const skip = (page - 1) * pageSize
    const now = new Date()

    const where: any = {}
    if (status) where.status = status
    if (search) where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ]

    const [invoices, total] = await Promise.all([
        prisma.aPInvoice.findMany({
            where, skip, take: pageSize, orderBy: { dueDate: 'asc' },
            include: {
                supplier: { select: { name: true, code: true } },
                po: { select: { poNo: true } },
                payments: { select: { amount: true } },
            },
        }),
        prisma.aPInvoice.count({ where }),
    ])

    return {
        rows: invoices.map(inv => {
            const paidAmount = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
            const outstanding = Number(inv.amount) - paidAmount
            return {
                id: inv.id, invoiceNo: inv.invoiceNo,
                supplierName: inv.supplier.name, supplierCode: inv.supplier.code,
                poNo: inv.po?.poNo ?? null,
                amount: Number(inv.amount), currency: inv.currency,
                paidAmount, outstanding,
                dueDate: inv.dueDate, status: inv.status,
                isOverdue: inv.dueDate < now && !['PAID'].includes(inv.status),
                createdAt: inv.createdAt,
            }
        }),
        total,
    }
}

// ── Finance summary KPIs ─────────────────────────
export async function getFinanceStats() {
    return cached('finance:stats', async () => {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const [arTotal, arOverdue, apTotal, apOverdue, monthRevenue] = await Promise.all([
            prisma.aRInvoice.aggregate({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } }, _sum: { amount: true } }),
            prisma.aRInvoice.aggregate({ where: { status: 'OVERDUE', dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
            prisma.aPInvoice.aggregate({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { amount: true } }),
            prisma.aPInvoice.aggregate({ where: { dueDate: { lt: now }, status: { notIn: ['PAID'] } }, _sum: { amount: true }, _count: true }),
            prisma.aRInvoice.aggregate({ where: { createdAt: { gte: monthStart }, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'PAID'] } }, _sum: { amount: true } }),
        ])

        return {
            arTotal: Number(arTotal._sum?.amount ?? 0),
            arOverdue: Number(arOverdue._sum?.amount ?? 0),
            arOverdueCount: arOverdue._count,
            apTotal: Number(apTotal._sum?.amount ?? 0),
            apOverdue: Number(apOverdue._sum?.amount ?? 0),
            apOverdueCount: apOverdue._count,
            monthRevenue: Number(monthRevenue._sum?.amount ?? 0),
        }
    }) // end cached
}

// ── AR Aging report ──────────────────────────────
export async function getARAgingBuckets() {
    return cached('finance:ar-aging', async () => {
        const now = new Date()
        const invoices = await prisma.aRInvoice.findMany({
            where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
            include: { customer: { select: { name: true } }, payments: { select: { amount: true } } },
        })

        const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }
        invoices.forEach(inv => {
            const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
            const outstanding = Number(inv.amount) - paid
            if (outstanding <= 0) return
            const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
            if (days <= 0) buckets.current += outstanding
            else if (days <= 30) buckets.d30 += outstanding
            else if (days <= 60) buckets.d60 += outstanding
            else if (days <= 90) buckets.d90 += outstanding
            else buckets.over90 += outstanding
        })

        return buckets
    }) // end cached
}

// ── Record AR payment ────────────────────────────
export async function recordARPayment(invoiceId: string, amount: number, method: string): Promise<{ success: boolean; error?: string }> {
    try {
        const inv = await prisma.aRInvoice.findUnique({ where: { id: invoiceId }, include: { payments: true } })
        if (!inv) return { success: false, error: 'Không tìm thấy hóa đơn' }

        const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0) + amount
        const newStatus = totalPaid >= Number(inv.amount) ? 'PAID' : 'PARTIALLY_PAID'

        await prisma.$transaction([
            prisma.aRPayment.create({ data: { invoiceId, amount, method: method as any, paidAt: new Date() } }),
            prisma.aRInvoice.update({ where: { id: invoiceId }, data: { status: newStatus } }),
        ])

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── COD Collection — Thu tiền tại giao ────────────
export async function collectCODPayment(input: {
    soId: string
    collectedAmount: number
    collectedBy: string
    notes?: string
}): Promise<{ success: boolean; error?: string; invoiceNo?: string }> {
    try {
        // Find AR invoice for this SO
        const invoice = await prisma.aRInvoice.findFirst({
            where: { soId: input.soId },
            include: { payments: true },
        })
        if (!invoice) {
            return { success: false, error: 'Chưa có hóa đơn AR cho đơn hàng này' }
        }

        const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Number(invoice.totalAmount) - alreadyPaid

        if (input.collectedAmount > outstanding) {
            return { success: false, error: `Số tiền thu (${input.collectedAmount.toLocaleString()}) vượt quá công nợ (${outstanding.toLocaleString()})` }
        }

        const newTotalPaid = alreadyPaid + input.collectedAmount
        const newStatus = newTotalPaid >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID'

        const payment = await prisma.aRPayment.create({
            data: {
                invoiceId: invoice.id,
                amount: input.collectedAmount,
                method: 'CASH',
                paidAt: new Date(),
            },
        })

        await prisma.aRInvoice.update({ where: { id: invoice.id }, data: { status: newStatus } })

        // Update SO status if fully paid
        if (newStatus === 'PAID') {
            await prisma.salesOrder.update({ where: { id: input.soId }, data: { status: 'PAID' } })
        }

        // Auto journal: DR 111 (Tiền mặt) / CR 131 (Phải thu KH)
        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-COD')
        await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'COD_COLLECTION',
                docId: payment.id,
                periodId: period.id,
                description: `Thu COD ${invoice.invoiceNo} — ${input.collectedAmount.toLocaleString()} VND`,
                createdBy: input.collectedBy,
                lines: {
                    create: [
                        { account: '111 - Tiền mặt', debit: input.collectedAmount, credit: 0 },
                        { account: '131 - Phải thu KH', debit: 0, credit: input.collectedAmount },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/delivery')
        return { success: true, invoiceNo: invoice.invoiceNo }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Record AP payment ────────────────────────────
export async function recordAPPayment(invoiceId: string, amount: number, method: string, reference?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const inv = await prisma.aPInvoice.findUnique({ where: { id: invoiceId }, include: { payments: true } })
        if (!inv) return { success: false, error: 'Không tìm thấy hóa đơn AP' }

        const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0) + amount
        const newStatus = totalPaid >= Number(inv.amount) ? 'PAID' : 'PARTIALLY_PAID'

        await prisma.$transaction([
            prisma.aPPayment.create({
                data: {
                    invoiceId,
                    amount,
                    method: method as any,
                    reference: reference ?? null,
                    paidAt: new Date(),
                },
            }),
            prisma.aPInvoice.update({ where: { id: invoiceId }, data: { status: newStatus } }),
        ])

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// JOURNAL ENTRY — Double-entry auto-generation
// ═══════════════════════════════════════════════════

export type JournalEntryRow = {
    id: string
    entryNo: string
    docType: string
    docId: string
    description: string | null
    periodLabel: string
    totalDebit: number
    totalCredit: number
    postedAt: Date
    lineCount: number
}

// ── List Journal Entries ──────────────────────────
export async function getJournalEntries(filters: {
    periodId?: string
    docType?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: JournalEntryRow[]; total: number }> {
    const { periodId, docType, page = 1, pageSize = 50 } = filters
    const where: any = {}
    if (periodId) where.periodId = periodId
    if (docType) where.docType = docType

    const [entries, total] = await Promise.all([
        prisma.journalEntry.findMany({
            where,
            include: {
                period: { select: { year: true, month: true } },
                lines: { select: { debit: true, credit: true } },
            },
            orderBy: { postedAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.journalEntry.count({ where }),
    ])

    return {
        rows: entries.map(e => ({
            id: e.id,
            entryNo: e.entryNo,
            docType: e.docType,
            docId: e.docId,
            description: e.description,
            periodLabel: `${e.period.month}/${e.period.year}`,
            totalDebit: e.lines.reduce((s, l) => s + Number(l.debit), 0),
            totalCredit: e.lines.reduce((s, l) => s + Number(l.credit), 0),
            postedAt: e.postedAt,
            lineCount: e.lines.length,
        })),
        total,
    }
}

// ── Get or create accounting period ───────────────
async function getOrCreatePeriod(year: number, month: number) {
    let period = await prisma.accountingPeriod.findUnique({
        where: { year_month: { year, month } },
    })
    if (!period) {
        period = await prisma.accountingPeriod.create({
            data: { year, month },
        })
    }
    if (period.isClosed) {
        throw new Error(`Kỳ kế toán ${month}/${year} đã đóng`)
    }
    return period
}

// ── Generate Journal Entry Number ─────────────────
async function nextEntryNo(prefix: string): Promise<string> {
    const count = await prisma.journalEntry.count()
    return `${prefix}-${String(count + 1).padStart(6, '0')}`
}

// ── Auto-generate: Goods Receipt → DR 156 / CR 331
export async function generateGoodsReceiptJournal(
    grId: string,
    createdBy: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const gr = await prisma.goodsReceipt.findUnique({
            where: { id: grId },
            include: {
                lines: {
                    include: { lot: { select: { unitLandedCost: true, qtyReceived: true } } },
                },
            },
        })
        if (!gr) return { success: false, error: 'GR không tồn tại' }

        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-GR')

        const totalValue = gr.lines.reduce(
            (s, l) => s + Number(l.lot?.unitLandedCost ?? 0) * Number(l.lot?.qtyReceived ?? 0), 0
        )

        const entry = await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'GOODS_RECEIPT',
                docId: grId,
                periodId: period.id,
                description: `Nhập kho GR ${gr.grNo}`,
                createdBy,
                lines: {
                    create: [
                        { account: '156 - Hàng tồn kho', debit: totalValue, credit: 0 },
                        { account: '331 - Phải trả NCC', debit: 0, credit: totalValue },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true, entryId: entry.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Auto-generate: Sales Invoice → DR 131 / CR 511 + CR 333
export async function generateSalesInvoiceJournal(
    invoiceId: string,
    createdBy: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const inv = await prisma.aRInvoice.findUnique({
            where: { id: invoiceId },
        })
        if (!inv) return { success: false, error: 'Invoice không tồn tại' }

        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-SI')

        const amount = Number(inv.amount)
        const vat = Number(inv.vatAmount)
        const total = Number(inv.totalAmount)

        const entry = await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'SALES_INVOICE',
                docId: invoiceId,
                periodId: period.id,
                description: `Bán hàng ${inv.invoiceNo}`,
                createdBy,
                lines: {
                    create: [
                        { account: '131 - Phải thu KH', debit: total, credit: 0 },
                        { account: '511 - Doanh thu', debit: 0, credit: amount },
                        { account: '3331 - VAT đầu ra', debit: 0, credit: vat },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true, entryId: entry.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Auto-generate: AR Payment → DR 112 / CR 131
export async function generatePaymentInJournal(
    paymentId: string,
    amount: number,
    invoiceNo: string,
    createdBy: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-PI')

        const entry = await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'PAYMENT_IN',
                docId: paymentId,
                periodId: period.id,
                description: `Thu tiền ${invoiceNo}`,
                createdBy,
                lines: {
                    create: [
                        { account: '112 - Tiền gửi NH', debit: amount, credit: 0 },
                        { account: '131 - Phải thu KH', debit: 0, credit: amount },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true, entryId: entry.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// ACCOUNTING PERIOD — Period closing
// ═══════════════════════════════════════════════════

export async function getAccountingPeriods() {
    return prisma.accountingPeriod.findMany({
        include: { _count: { select: { entries: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
}

export async function closeAccountingPeriod(
    periodId: string,
    closedBy?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let userId = closedBy
        if (!userId) {
            const user = await getCurrentUser()
            userId = user?.id
        }
        if (!userId) {
            const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
            userId = admin?.id
        }
        if (!userId) return { success: false, error: 'No user found' }

        await prisma.accountingPeriod.update({
            where: { id: periodId },
            data: { isClosed: true, closedBy: userId, closedAt: new Date() },
        })
        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Auto-generate: Delivery Order → DR 632 (COGS) / CR 156 (Hàng tồn kho)
export async function generateDeliveryOrderCOGSJournal(
    doId: string,
    createdBy: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const deliveryOrder = await prisma.deliveryOrder.findUnique({
            where: { id: doId },
            include: {
                lines: {
                    include: { lot: { select: { unitLandedCost: true } } },
                },
            },
        })
        if (!deliveryOrder) return { success: false, error: 'DO không tồn tại' }

        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-COGS')

        const totalCOGS = deliveryOrder.lines.reduce(
            (s, l) => s + Number(l.qtyShipped ?? l.qtyPicked) * Number(l.lot?.unitLandedCost ?? 0), 0
        )

        if (totalCOGS <= 0) return { success: true } // No cost to record

        const entry = await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'COGS',
                docId: doId,
                periodId: period.id,
                description: `Giá vốn xuất kho ${deliveryOrder.doNo}`,
                createdBy,
                lines: {
                    create: [
                        { account: '632 - Giá vốn hàng bán', debit: totalCOGS, credit: 0 },
                        { account: '156 - Hàng tồn kho', debit: 0, credit: totalCOGS },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true, entryId: entry.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Auto-generate: Write-off → DR 811 (Chi phí khác) / CR 156 (Hàng tồn kho)
export async function generateWriteOffJournal(
    lotId: string,
    qty: number,
    reason: string,
    createdBy: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
    try {
        const lot = await prisma.stockLot.findUnique({
            where: { id: lotId },
            include: { product: { select: { skuCode: true, productName: true } } },
        })
        if (!lot) return { success: false, error: 'Lot không tồn tại' }

        const unitCost = Number(lot.unitLandedCost)
        const totalLoss = unitCost * qty

        if (totalLoss <= 0) return { success: true } // No cost to record

        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-WO')

        const entry = await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'ADJUSTMENT',
                docId: lotId,
                periodId: period.id,
                description: `Xuất hủy ${qty} chai ${lot.product?.skuCode ?? 'N/A'} - ${reason}`,
                createdBy,
                lines: {
                    create: [
                        { account: '811 - Chi phí khác', debit: totalLoss, credit: 0, description: `Hao hụt/hủy ${lot.product?.productName ?? ''}` },
                        { account: '156 - Hàng tồn kho', debit: 0, credit: totalLoss, description: `Giảm tồn kho lot ${lot.lotNo ?? lotId}` },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true, entryId: entry.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// P&L — Profit & Loss Statement
// ═══════════════════════════════════════════════════

export type PLRow = {
    account: string
    label: string
    amount: number
    type: 'revenue' | 'cogs' | 'expense' | 'summary'
}

export async function getProfitLoss(filters: {
    year?: number
    month?: number
} = {}): Promise<{ rows: PLRow[]; revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number }> {
    const now = new Date()
    const year = filters.year ?? now.getFullYear()
    const month = filters.month ?? (now.getMonth() + 1)

    // Get all journal lines for the period
    const lines = await prisma.journalLine.findMany({
        where: {
            entry: {
                period: { year, month },
            },
        },
        select: {
            account: true,
            debit: true,
            credit: true,
        },
    })

    // Aggregate by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {}
    for (const line of lines) {
        if (!accountTotals[line.account]) {
            accountTotals[line.account] = { debit: 0, credit: 0 }
        }
        accountTotals[line.account].debit += Number(line.debit)
        accountTotals[line.account].credit += Number(line.credit)
    }

    // Revenue (Credit side of 511)
    const revenue = (accountTotals['511 - Doanh thu']?.credit ?? 0)

    // COGS (Debit side of 632)
    const cogs = (accountTotals['632 - Giá vốn hàng bán']?.debit ?? 0)

    const grossProfit = revenue - cogs

    // Expenses (Debit side of 641, 642, 635, 811)
    const expenseAccounts = ['641', '642', '635', '811']
    let expenses = 0
    for (const [account, totals] of Object.entries(accountTotals)) {
        if (expenseAccounts.some(ea => account.startsWith(ea))) {
            expenses += totals.debit - totals.credit
        }
    }

    const netProfit = grossProfit - expenses

    const rows: PLRow[] = [
        { account: '511', label: 'Doanh thu bán hàng', amount: revenue, type: 'revenue' },
        { account: '632', label: 'Giá vốn hàng bán (COGS)', amount: -cogs, type: 'cogs' },
        { account: 'GP', label: 'Lợi nhuận gộp', amount: grossProfit, type: 'summary' },
    ]

    // Add individual expense accounts
    for (const [account, totals] of Object.entries(accountTotals)) {
        if (expenseAccounts.some(ea => account.startsWith(ea))) {
            const net = totals.debit - totals.credit
            if (net > 0) {
                rows.push({ account: account.split(' - ')[0], label: account, amount: -net, type: 'expense' })
            }
        }
    }

    rows.push({ account: 'NP', label: 'Lợi nhuận ròng', amount: netProfit, type: 'summary' })

    return { rows, revenue, cogs, grossProfit, expenses, netProfit }
}

// ── P&L Comparison: vs Previous Month + vs Same Month Last Year ──
export async function getProfitLossComparison(year?: number, month?: number) {
    const now = new Date()
    const y = year ?? now.getFullYear()
    const m = month ?? (now.getMonth() + 1)

    // Calculate previous month
    const prevMonth = m === 1 ? 12 : m - 1
    const prevYear = m === 1 ? y - 1 : y

    const [current, prevM, lastYear] = await Promise.all([
        getProfitLoss({ year: y, month: m }),
        getProfitLoss({ year: prevYear, month: prevMonth }),
        getProfitLoss({ year: y - 1, month: m }),
    ])

    const pctChange = (curr: number, prev: number): number | null =>
        prev === 0 ? (curr > 0 ? 100 : null) : Math.round(((curr - prev) / Math.abs(prev)) * 100)

    return {
        current: { year: y, month: m, ...current },
        vsPrevMonth: {
            period: `T${prevMonth}/${prevYear}`,
            revenueChg: pctChange(current.revenue, prevM.revenue),
            cogsChg: pctChange(current.cogs, prevM.cogs),
            grossProfitChg: pctChange(current.grossProfit, prevM.grossProfit),
            expensesChg: pctChange(current.expenses, prevM.expenses),
            netProfitChg: pctChange(current.netProfit, prevM.netProfit),
            prev: prevM,
        },
        vsLastYear: {
            period: `T${m}/${y - 1}`,
            revenueChg: pctChange(current.revenue, lastYear.revenue),
            cogsChg: pctChange(current.cogs, lastYear.cogs),
            grossProfitChg: pctChange(current.grossProfit, lastYear.grossProfit),
            expensesChg: pctChange(current.expenses, lastYear.expenses),
            netProfitChg: pctChange(current.netProfit, lastYear.netProfit),
            prev: lastYear,
        },
    }
}

// ── Export P&L Excel ────────────────────────────
export async function exportProfitLossExcel(year?: number, month?: number): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const comparison = await getProfitLossComparison(year, month)
    const c = comparison.current
    const pm = comparison.vsPrevMonth
    const ly = comparison.vsLastYear

    type PLExcelRow = { item: string; current: number; prevMonth: number; prevMonthChg: string; lastYear: number; lastYearChg: string }
    const rows: PLExcelRow[] = [
        { item: 'Doanh thu', current: c.revenue, prevMonth: pm.prev.revenue, prevMonthChg: pm.revenueChg !== null ? `${pm.revenueChg}%` : '—', lastYear: ly.prev.revenue, lastYearChg: ly.revenueChg !== null ? `${ly.revenueChg}%` : '—' },
        { item: 'Giá vốn (COGS)', current: c.cogs, prevMonth: pm.prev.cogs, prevMonthChg: pm.cogsChg !== null ? `${pm.cogsChg}%` : '—', lastYear: ly.prev.cogs, lastYearChg: ly.cogsChg !== null ? `${ly.cogsChg}%` : '—' },
        { item: 'Lãi gộp', current: c.grossProfit, prevMonth: pm.prev.grossProfit, prevMonthChg: pm.grossProfitChg !== null ? `${pm.grossProfitChg}%` : '—', lastYear: ly.prev.grossProfit, lastYearChg: ly.grossProfitChg !== null ? `${ly.grossProfitChg}%` : '—' },
        { item: 'Chi phí', current: c.expenses, prevMonth: pm.prev.expenses, prevMonthChg: pm.expensesChg !== null ? `${pm.expensesChg}%` : '—', lastYear: ly.prev.expenses, lastYearChg: ly.expensesChg !== null ? `${ly.expensesChg}%` : '—' },
        { item: 'Lãi ròng', current: c.netProfit, prevMonth: pm.prev.netProfit, prevMonthChg: pm.netProfitChg !== null ? `${pm.netProfitChg}%` : '—', lastYear: ly.prev.netProfit, lastYearChg: ly.netProfitChg !== null ? `${ly.netProfitChg}%` : '—' },
    ]

    // Add individual accounts
    for (const row of c.rows) {
        if (row.type === 'expense') {
            rows.splice(rows.length - 1, 0, {
                item: `  ↳ ${row.label}`,
                current: row.amount,
                prevMonth: 0,
                prevMonthChg: '—',
                lastYear: 0,
                lastYearChg: '—',
            })
        }
    }

    const buffer = await generateExcelBuffer({
        sheetName: 'P&L',
        title: `Báo Cáo Lãi / Lỗ — T${c.month}/${c.year}`,
        columns: [
            { header: 'Khoản mục', key: 'item', width: 30 },
            { header: `T${c.month}/${c.year}`, key: 'current', width: 18, numFmt: '#,##0' },
            { header: pm.period, key: 'prevMonth', width: 18, numFmt: '#,##0' },
            { header: `% vs ${pm.period}`, key: 'prevMonthChg', width: 12 },
            { header: ly.period, key: 'lastYear', width: 18, numFmt: '#,##0' },
            { header: `% vs ${ly.period}`, key: 'lastYearChg', width: 12 },
        ],
        rows,
    })

    return Buffer.from(buffer).toString('base64')
}

// ═══════════════════════════════════════════════════
// BALANCE SHEET — Bảng Cân Đối Kế Toán (VAS)
// ═══════════════════════════════════════════════════

export type BSLineItem = {
    code: string
    label: string
    amount: number
    category: 'asset' | 'liability' | 'equity' | 'summary'
    indent?: number
}

export type BalanceSheetData = {
    asOf: Date
    year: number
    month: number
    // Summaries
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    isBalanced: boolean
    lines: BSLineItem[]
}

export async function getBalanceSheet(filters: {
    year?: number
    month?: number
} = {}): Promise<BalanceSheetData> {
    const now = new Date()
    const year = filters.year ?? now.getFullYear()
    const month = filters.month ?? (now.getMonth() + 1)
    const asOf = new Date(year, month, 0, 23, 59, 59) // Last day of month

    // Get ALL journal lines up to end of period (cumulative)
    const allLines = await prisma.journalLine.findMany({
        where: {
            entry: {
                postedAt: { lte: asOf },
            },
        },
        select: { account: true, debit: true, credit: true },
    })

    // Aggregate by account prefix
    const balances: Record<string, number> = {}
    for (const line of allLines) {
        const acct = line.account
        if (!balances[acct]) balances[acct] = 0
        // Assets (1xx): debit increases, credit decreases
        // Liabilities (3xx): credit increases, debit decreases
        // Revenue (5xx): credit increases
        // Expenses (6xx, 8xx): debit increases
        balances[acct] += Number(line.debit) - Number(line.credit)
    }

    // Helper: sum accounts matching prefix
    const sumAcct = (prefix: string): number => {
        let total = 0
        for (const [acct, bal] of Object.entries(balances)) {
            if (acct.startsWith(prefix)) total += bal
        }
        return total
    }

    // ── ASSETS ──
    const cash = sumAcct('112')           // Tiền gửi ngân hàng
    const ar = sumAcct('131')             // Phải thu khách hàng
    const inventory = sumAcct('156')      // Hàng tồn kho

    // Also fetch real-time inventory value for accuracy
    const stockValue = await prisma.stockLot.aggregate({
        where: { status: { in: ['AVAILABLE', 'QUARANTINE', 'RESERVED'] } },
        _sum: { qtyAvailable: true },
    })

    // Real-time AR outstanding
    const arRealtime = await prisma.aRInvoice.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true },
    })

    // Real-time AP outstanding
    const apRealtime = await prisma.aPInvoice.aggregate({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
        _sum: { amount: true },
    })

    const cashFinal = Math.abs(cash) || 0
    const arFinal = Math.max(ar, Number(arRealtime._sum?.totalAmount ?? 0))
    const inventoryFinal = Math.abs(inventory) || 0

    const totalCurrentAssets = cashFinal + arFinal + inventoryFinal
    const totalAssets = totalCurrentAssets

    // ── LIABILITIES ──
    const ap = Math.abs(sumAcct('331'))   // Phải trả NCC
    const vatPayable = Math.abs(sumAcct('3331')) // VAT đầu ra phải nộp
    const apFinal = Math.max(ap, Number(apRealtime._sum?.amount ?? 0))

    const totalCurrentLiabilities = apFinal + vatPayable
    const totalLiabilities = totalCurrentLiabilities

    // ── EQUITY ── (Lợi nhuận chưa phân phối = cumulative net profit)
    const revenue = Math.abs(sumAcct('511'))
    const cogs = Math.abs(sumAcct('632'))
    const sellingExp = Math.abs(sumAcct('641'))
    const adminExp = Math.abs(sumAcct('642'))
    const finExp = Math.abs(sumAcct('635'))
    const otherExp = Math.abs(sumAcct('811'))
    const retainedEarnings = revenue - cogs - sellingExp - adminExp - finExp - otherExp

    const totalEquity = retainedEarnings
    const isBalanced = Math.abs(totalAssets - totalLiabilities - totalEquity) < 1

    const lines: BSLineItem[] = [
        // Assets
        { code: 'A', label: 'TÀI SẢN', amount: totalAssets, category: 'summary' },
        { code: 'A1', label: 'Tài sản ngắn hạn', amount: totalCurrentAssets, category: 'summary', indent: 1 },
        { code: '112', label: 'Tiền gửi ngân hàng', amount: cashFinal, category: 'asset', indent: 2 },
        { code: '131', label: 'Phải thu khách hàng', amount: arFinal, category: 'asset', indent: 2 },
        { code: '156', label: 'Hàng tồn kho', amount: inventoryFinal, category: 'asset', indent: 2 },

        // Liabilities
        { code: 'L', label: 'NỢ PHẢI TRẢ', amount: totalLiabilities, category: 'summary' },
        { code: 'L1', label: 'Nợ ngắn hạn', amount: totalCurrentLiabilities, category: 'summary', indent: 1 },
        { code: '331', label: 'Phải trả nhà cung cấp', amount: apFinal, category: 'liability', indent: 2 },
        { code: '3331', label: 'Thuế GTGT phải nộp', amount: vatPayable, category: 'liability', indent: 2 },

        // Equity
        { code: 'E', label: 'VỐN CHỦ SỞ HỮU', amount: totalEquity, category: 'summary' },
        { code: '421', label: 'Lợi nhuận chưa phân phối', amount: retainedEarnings, category: 'equity', indent: 2 },
    ]

    return {
        asOf,
        year,
        month,
        totalAssets,
        totalLiabilities,
        totalEquity,
        isBalanced,
        lines,
    }
}

// ═══════════════════════════════════════════════════
// EXPENSE MANAGEMENT
// ═══════════════════════════════════════════════════

const CATEGORY_ACCOUNT: Record<string, string> = {
    SALARY: '642 - Chi phí quản lý DN',
    RENT: '642 - Chi phí quản lý DN',
    UTILITIES: '642 - Chi phí quản lý DN',
    LOGISTICS: '641 - Chi phí bán hàng',
    MARKETING: '641 - Chi phí bán hàng',
    INSURANCE: '635 - Chi phí tài chính',
    BANK_FEE: '635 - Chi phí tài chính',
    OTHER_EXPENSE: '811 - Chi phí khác',
}

const CATEGORY_LABEL: Record<string, string> = {
    SALARY: 'Lương & BHXH',
    RENT: 'Thuê mặt bằng',
    UTILITIES: 'Điện nước, Internet',
    LOGISTICS: 'Vận chuyển',
    MARKETING: 'Quảng cáo, Khuyến mãi',
    INSURANCE: 'Bảo hiểm hàng hóa',
    BANK_FEE: 'Phí ngân hàng',
    OTHER_EXPENSE: 'Chi phí khác',
}

export type ExpenseRow = {
    id: string
    expenseNo: string
    category: string
    categoryLabel: string
    account: string
    amount: number
    description: string
    periodLabel: string
    status: string
    creatorName: string
    approverName: string | null
    createdAt: Date
}

export async function getExpenses(filters: {
    status?: string
    periodId?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: ExpenseRow[]; total: number }> {
    const { status, periodId, page = 1, pageSize = 50 } = filters
    const where: any = {}
    if (status) where.status = status
    if (periodId) where.periodId = periodId

    const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
            where,
            include: {
                period: { select: { year: true, month: true } },
                creator: { select: { name: true } },
                approver: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.expense.count({ where }),
    ])

    return {
        rows: expenses.map(e => ({
            id: e.id,
            expenseNo: e.expenseNo,
            category: e.category,
            categoryLabel: CATEGORY_LABEL[e.category] ?? e.category,
            account: e.account,
            amount: Number(e.amount),
            description: e.description,
            periodLabel: `${e.period.month}/${e.period.year}`,
            status: e.status,
            creatorName: e.creator.name,
            approverName: e.approver?.name ?? null,
            createdAt: e.createdAt,
        })),
        total,
    }
}

export async function createExpense(data: {
    category: string
    amount: number
    description: string
    createdBy?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        let userId = data.createdBy
        if (!userId) {
            const user = await getCurrentUser()
            userId = user?.id
        }
        // Dev fallback: use first admin user when session unavailable
        if (!userId) {
            const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
            userId = admin?.id
        }
        if (!userId) return { success: false, error: 'No user found' }
        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const count = await prisma.expense.count()
        const expenseNo = `EXP-${String(count + 1).padStart(6, '0')}`
        const account = CATEGORY_ACCOUNT[data.category] ?? '811 - Chi phí khác'

        // > 5M → need approval, else auto-approve
        const needsApproval = data.amount > 5_000_000
        const status = needsApproval ? 'PENDING_APPROVAL' : 'APPROVED'

        const expense = await prisma.expense.create({
            data: {
                expenseNo,
                category: data.category as any,
                account,
                amount: data.amount,
                description: data.description,
                periodId: period.id,
                status: status as any,
                createdBy: userId,
                approvedBy: needsApproval ? null : userId,
                approvedAt: needsApproval ? null : now,
            },
        })

        // Auto journal if auto-approved
        if (!needsApproval) {
            await generateExpenseJournal(expense.id, userId)
        }

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function approveExpense(
    expenseId: string,
    approverId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let userId = approverId
        if (!userId) {
            const user = await getCurrentUser()
            userId = user?.id
        }
        if (!userId) {
            const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
            userId = admin?.id
        }
        if (!userId) return { success: false, error: 'No user found' }

        await prisma.expense.update({
            where: { id: expenseId },
            data: {
                status: 'APPROVED',
                approvedBy: userId,
                approvedAt: new Date(),
            },
        })

        await generateExpenseJournal(expenseId, userId)

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function rejectExpense(
    expenseId: string,
    approverId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        let userId = approverId
        if (!userId) {
            const user = await getCurrentUser()
            userId = user?.id
        }
        if (!userId) {
            const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
            userId = admin?.id
        }
        if (!userId) return { success: false, error: 'No user found' }

        await prisma.expense.update({
            where: { id: expenseId },
            data: { status: 'REJECTED', approvedBy: userId, approvedAt: new Date() },
        })
        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

async function generateExpenseJournal(
    expenseId: string,
    createdBy: string
) {
    const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: { period: true },
    })
    if (!expense) return

    const entryNo = await nextEntryNo('JE-EXP')
    await prisma.journalEntry.create({
        data: {
            entryNo,
            docType: 'EXPENSE',
            docId: expenseId,
            periodId: expense.periodId,
            description: `Chi phí: ${expense.description}`,
            createdBy,
            lines: {
                create: [
                    { account: expense.account, debit: Number(expense.amount), credit: 0 },
                    { account: '112 - Tiền gửi NH', debit: 0, credit: Number(expense.amount) },
                ],
            },
        },
    })
}

// ═══════════════════════════════════════════════════
// PERIOD CLOSE — Pre-closing checklist
// ═══════════════════════════════════════════════════

export type PeriodCloseCheckItem = {
    label: string
    count: number
    amount: number
    status: 'ok' | 'warning' | 'danger'
}

export async function getPeriodCloseChecklist(year: number, month: number): Promise<PeriodCloseCheckItem[]> {
    const now = new Date()
    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0, 23, 59, 59)

    // AR chưa thu trong kỳ
    const arUnpaid = await prisma.aRInvoice.aggregate({
        where: {
            createdAt: { gte: periodStart, lte: periodEnd },
            status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { amount: true },
        _count: true,
    })

    // AP chưa trả trong kỳ
    const apUnpaid = await prisma.aPInvoice.aggregate({
        where: {
            createdAt: { gte: periodStart, lte: periodEnd },
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        },
        _sum: { amount: true },
        _count: true,
    })

    // GR chưa confirm
    const grPending = await prisma.goodsReceipt.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd }, status: 'DRAFT' },
    })

    // DO chưa ship
    const doPending = await prisma.deliveryOrder.count({
        where: { createdAt: { gte: periodStart, lte: periodEnd }, status: { in: ['DRAFT', 'PICKING'] } },
    })

    // Expenses pending approval
    const expPending = await prisma.expense.count({
        where: { period: { year, month }, status: 'PENDING_APPROVAL' },
    })

    return [
        {
            label: 'Công nợ phải thu (AR) chưa ghi nhận',
            count: arUnpaid._count,
            amount: Number(arUnpaid._sum?.amount ?? 0),
            status: arUnpaid._count > 0 ? 'warning' : 'ok',
        },
        {
            label: 'Công nợ phải trả (AP) chưa thanh toán',
            count: apUnpaid._count,
            amount: Number(apUnpaid._sum?.amount ?? 0),
            status: apUnpaid._count > 0 ? 'warning' : 'ok',
        },
        {
            label: 'Phiếu nhập kho (GR) chưa xác nhận',
            count: grPending,
            amount: 0,
            status: grPending > 0 ? 'danger' : 'ok',
        },
        {
            label: 'Phiếu xuất kho (DO) chưa giao hàng',
            count: doPending,
            amount: 0,
            status: doPending > 0 ? 'danger' : 'ok',
        },
        {
            label: 'Chi phí chờ duyệt',
            count: expPending,
            amount: 0,
            status: expPending > 0 ? 'danger' : 'ok',
        },
    ]
}

// ═══════════════════════════════════════════════════
// BAD DEBT WRITE-OFF — Nợ khó đòi
// ═══════════════════════════════════════════════════

export type BadDebtCandidate = {
    invoiceId: string
    invoiceNo: string
    customerName: string
    amount: number
    outstanding: number
    dueDate: Date
    daysOverdue: number
}

export async function getBadDebtCandidates(minDaysOverdue: number = 180): Promise<BadDebtCandidate[]> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - minDaysOverdue)

    const invoices = await prisma.aRInvoice.findMany({
        where: {
            dueDate: { lt: cutoff },
            status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        include: {
            customer: { select: { name: true, shortName: true } },
        },
        orderBy: { dueDate: 'asc' },
    })

    const now = new Date()
    return invoices.map(inv => ({
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        customerName: inv.customer?.shortName ?? inv.customer?.name ?? 'N/A',
        amount: Number(inv.totalAmount ?? inv.amount),
        outstanding: Number(inv.totalAmount ?? inv.amount) - Number(inv.paidAmount ?? 0),
        dueDate: inv.dueDate,
        daysOverdue: Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }))
}

export async function writeOffBadDebt(input: {
    invoiceId: string
    reason: string
    approvedBy?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        let userId = input.approvedBy
        if (!userId) {
            const user = await getCurrentUser()
            userId = user?.id
        }
        if (!userId) {
            const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
            userId = admin?.id
        }
        if (!userId) return { success: false, error: 'No user found' }

        const invoice = await prisma.aRInvoice.findUnique({
            where: { id: input.invoiceId },
            include: {
                customer: { select: { name: true, shortName: true } },
            },
        })
        if (!invoice) return { success: false, error: 'Hóa đơn không tồn tại' }

        const outstanding = Number(invoice.totalAmount ?? invoice.amount) - Number(invoice.paidAmount ?? 0)
        if (outstanding <= 0) return { success: false, error: 'Hóa đơn đã thanh toán đủ' }

        // 1. Mark invoice as BAD_DEBT
        await prisma.aRInvoice.update({
            where: { id: input.invoiceId },
            data: { status: 'CANCELLED', notes: `[XÓA NỢ] ${input.reason}` },
        })

        // 2. Create journal entry: DR 642 (Chi phí quản lý DN - bad debt) / CR 131 (Phải thu KH)
        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-BD')

        await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'BAD_DEBT',
                docId: input.invoiceId,
                periodId: period.id,
                description: `Xóa nợ khó đòi: ${invoice.invoiceNo} - ${invoice.customer?.shortName ?? invoice.customer?.name ?? 'N/A'} - ${input.reason}`,
                createdBy: userId,
                lines: {
                    create: [
                        { account: '642 - Chi phí quản lý DN', debit: outstanding, credit: 0, description: `Nợ khó đòi ${invoice.invoiceNo}` },
                        { account: '131 - Phải thu KH', debit: 0, credit: outstanding, description: `Xóa phải thu ${invoice.invoiceNo}` },
                    ],
                },
            },
        })

        revalidateCache('finance')
        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
