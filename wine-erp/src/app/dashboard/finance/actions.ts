'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/session'
import { cached, revalidateCache } from '@/lib/cache'
import { parseOrThrow, ARPaymentCreateSchema, ExpenseCreateSchema, JournalEntrySchema, CODCollectionSchema, BadDebtWriteOffSchema } from '@/lib/validations'

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

// ── Record AR payment + AUTO-UPDATE SO status ────
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

        // ── EVENT-DRIVEN: Auto-update SO status when fully paid ──
        if (newStatus === 'PAID' && inv.soId) {
            await prisma.salesOrder.update({
                where: { id: inv.soId },
                data: { status: 'PAID' },
            })
            revalidateCache('sales')
            revalidatePath('/dashboard/sales')
        }

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
        const validated = parseOrThrow(CODCollectionSchema, input)
        const invoice = await prisma.aRInvoice.findFirst({
            where: { soId: validated.soId },
            include: { payments: true },
        })
        if (!invoice) {
            return { success: false, error: 'Chưa có hóa đơn AR cho đơn hàng này' }
        }

        const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Number(invoice.totalAmount) - alreadyPaid

        if (validated.collectedAmount > outstanding) {
            return { success: false, error: `Số tiền thu (${validated.collectedAmount.toLocaleString()}) vượt quá công nợ (${outstanding.toLocaleString()})` }
        }

        const newTotalPaid = alreadyPaid + validated.collectedAmount
        const newStatus = newTotalPaid >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIALLY_PAID'

        const payment = await prisma.aRPayment.create({
            data: {
                invoiceId: invoice.id,
                amount: validated.collectedAmount,
                method: 'CASH',
                paidAt: new Date(),
            },
        })

        await prisma.aRInvoice.update({ where: { id: invoice.id }, data: { status: newStatus } })

        if (newStatus === 'PAID') {
            await prisma.salesOrder.update({ where: { id: validated.soId }, data: { status: 'PAID' } })
        }

        const now = new Date()
        const period = await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)
        const entryNo = await nextEntryNo('JE-COD')
        await prisma.journalEntry.create({
            data: {
                entryNo,
                docType: 'COD_COLLECTION',
                docId: payment.id,
                periodId: period.id,
                description: `Thu COD ${invoice.invoiceNo} — ${validated.collectedAmount.toLocaleString()} VND`,
                createdBy: validated.collectedBy,
                lines: {
                    create: [
                        { account: '111 - Tiền mặt', debit: validated.collectedAmount, credit: 0 },
                        { account: '131 - Phải thu KH', debit: 0, credit: validated.collectedAmount },
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

// ═══════════════════════════════════════════════════
// CASH POSITION — "Tôi còn bao nhiêu tiền?"
// ═══════════════════════════════════════════════════

export type CashPositionData = {
    asOf: Date
    bankBalance: number        // TK 112 — Tiền gửi ngân hàng
    pettyCash: number          // TK 111 — Tiền mặt quỹ
    totalCash: number          // 111 + 112
    arReceivable: number       // Tổng công nợ phải thu
    apPayable: number          // Tổng công nợ phải trả
    netWorkingCapital: number  // totalCash + AR - AP
    // Alert
    safetyThreshold: number
    isBelowSafety: boolean
    // Trends (vs 30 days ago)
    cashChange30d: number
    arChange30d: number
    apChange30d: number
}

export async function getCashPosition(): Promise<CashPositionData> {
    return cached('finance:cash-position', async () => {
        const now = new Date()
        const d30ago = new Date()
        d30ago.setDate(d30ago.getDate() - 30)

        // ── Current cash from Journal Entries (TK 112 + 111) ──
        const allCashLines = await prisma.journalLine.findMany({
            where: {
                account: { startsWith: '112' },
            },
            select: { debit: true, credit: true },
        })
        const bankBalance = allCashLines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)

        const allPettyLines = await prisma.journalLine.findMany({
            where: { account: { startsWith: '111' } },
            select: { debit: true, credit: true },
        })
        const pettyCash = allPettyLines.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)

        // ── Real-time AR/AP outstanding ──
        const [arAgg, apAgg] = await Promise.all([
            prisma.aRInvoice.aggregate({
                where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
                _sum: { amount: true },
            }),
            prisma.aPInvoice.aggregate({
                where: { status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
                _sum: { amount: true },
            }),
        ])
        const arReceivable = Number(arAgg._sum?.amount ?? 0)
        const apPayable = Number(apAgg._sum?.amount ?? 0)

        const totalCash = Math.max(bankBalance, 0) + Math.max(pettyCash, 0)
        const netWorkingCapital = totalCash + arReceivable - apPayable

        // ── 30-day trend: compare with journal lines before 30 days ago ──
        const cashLines30d = await prisma.journalLine.findMany({
            where: {
                account: { startsWith: '112' },
                entry: { postedAt: { lte: d30ago } },
            },
            select: { debit: true, credit: true },
        })
        const bankBalance30d = cashLines30d.reduce((sum, l) => sum + Number(l.debit) - Number(l.credit), 0)

        const [arAgg30d, apAgg30d] = await Promise.all([
            prisma.aRInvoice.aggregate({
                where: { createdAt: { lte: d30ago }, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
                _sum: { amount: true },
            }),
            prisma.aPInvoice.aggregate({
                where: { createdAt: { lte: d30ago }, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
                _sum: { amount: true },
            }),
        ])

        const SAFETY_THRESHOLD = 500_000_000 // 500M VND

        return {
            asOf: now,
            bankBalance: Math.max(bankBalance, 0),
            pettyCash: Math.max(pettyCash, 0),
            totalCash,
            arReceivable,
            apPayable,
            netWorkingCapital,
            safetyThreshold: SAFETY_THRESHOLD,
            isBelowSafety: totalCash < SAFETY_THRESHOLD,
            cashChange30d: totalCash - Math.max(bankBalance30d, 0),
            arChange30d: arReceivable - Number(arAgg30d._sum?.amount ?? 0),
            apChange30d: apPayable - Number(apAgg30d._sum?.amount ?? 0),
        }
    }, 30_000) // cache 30s
}

// ═══════════════════════════════════════════════════
// CASH FLOW FORECAST — Dự báo dòng tiền 30/60/90 ngày
// ═══════════════════════════════════════════════════

export type CashFlowBucket = {
    period: string       // "0-30 ngày", "31-60 ngày", "61-90 ngày"
    arExpected: number   // AR sẽ thu (theo due date)
    apDue: number        // AP phải trả (theo due date)
    expenseEstimate: number // Chi phí ước tính (avg 3 tháng gần nhất)
    netCashFlow: number  // AR - AP - Expense
    cumulative: number   // Lũy kế
}

export type CashFlowForecastData = {
    currentCash: number
    buckets: CashFlowBucket[]
    endingCash30: number
    endingCash60: number
    endingCash90: number
    isRisk30: boolean
    isRisk60: boolean
    isRisk90: boolean
}

export async function getCashFlowForecast(): Promise<CashFlowForecastData> {
    return cached('finance:cash-forecast', async () => {
        const now = new Date()
        const d30 = new Date(now); d30.setDate(d30.getDate() + 30)
        const d60 = new Date(now); d60.setDate(d60.getDate() + 60)
        const d90 = new Date(now); d90.setDate(d90.getDate() + 90)

        // Get current cash position
        const cashPos = await getCashPosition()
        const currentCash = cashPos.totalCash

        // ── AR expected to collect (by due date) ──
        const arInvoices = await prisma.aRInvoice.findMany({
            where: {
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                dueDate: { lte: d90 },
            },
            select: { amount: true, paidAmount: true, dueDate: true },
        })

        const arBy30 = arInvoices.filter(i => i.dueDate <= d30).reduce((s, i) => s + Number(i.amount) - Number(i.paidAmount ?? 0), 0)
        const arBy60 = arInvoices.filter(i => i.dueDate > d30 && i.dueDate <= d60).reduce((s, i) => s + Number(i.amount) - Number(i.paidAmount ?? 0), 0)
        const arBy90 = arInvoices.filter(i => i.dueDate > d60 && i.dueDate <= d90).reduce((s, i) => s + Number(i.amount) - Number(i.paidAmount ?? 0), 0)

        // ── AP due to pay (by due date) ──
        const apInvoices = await prisma.aPInvoice.findMany({
            where: {
                status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
                dueDate: { lte: d90 },
            },
            select: { amount: true, dueDate: true, payments: { select: { amount: true } } },
        })

        const apOutstanding = (inv: { amount: any; payments: { amount: any }[] }) => {
            const paid = inv.payments.reduce((s: number, p: { amount: any }) => s + Number(p.amount), 0)
            return Number(inv.amount) - paid
        }
        const apBy30 = apInvoices.filter(i => i.dueDate <= d30).reduce((s, i) => s + apOutstanding(i), 0)
        const apBy60 = apInvoices.filter(i => i.dueDate > d30 && i.dueDate <= d60).reduce((s, i) => s + apOutstanding(i), 0)
        const apBy90 = apInvoices.filter(i => i.dueDate > d60 && i.dueDate <= d90).reduce((s, i) => s + apOutstanding(i), 0)

        // ── Estimated monthly expenses (average of last 3 months) ──
        const m3ago = new Date(now); m3ago.setMonth(m3ago.getMonth() - 3)
        const recentExpenses = await prisma.expense.aggregate({
            where: { status: 'APPROVED', createdAt: { gte: m3ago } },
            _sum: { amount: true },
        })
        const monthlyExpenseAvg = Number(recentExpenses._sum?.amount ?? 0) / 3

        // Build buckets
        const b1Net = arBy30 - apBy30 - monthlyExpenseAvg
        const endCash30 = currentCash + b1Net

        const b2Net = arBy60 - apBy60 - monthlyExpenseAvg
        const endCash60 = endCash30 + b2Net

        const b3Net = arBy90 - apBy90 - monthlyExpenseAvg
        const endCash90 = endCash60 + b3Net

        const buckets: CashFlowBucket[] = [
            { period: '0–30 ngày', arExpected: arBy30, apDue: apBy30, expenseEstimate: monthlyExpenseAvg, netCashFlow: b1Net, cumulative: endCash30 },
            { period: '31–60 ngày', arExpected: arBy60, apDue: apBy60, expenseEstimate: monthlyExpenseAvg, netCashFlow: b2Net, cumulative: endCash60 },
            { period: '61–90 ngày', arExpected: arBy90, apDue: apBy90, expenseEstimate: monthlyExpenseAvg, netCashFlow: b3Net, cumulative: endCash90 },
        ]

        return {
            currentCash,
            buckets,
            endingCash30: endCash30,
            endingCash60: endCash60,
            endingCash90: endCash90,
            isRisk30: endCash30 < 0,
            isRisk60: endCash60 < 0,
            isRisk90: endCash90 < 0,
        }
    }, 60_000) // cache 1 min
}

// ═══════════════════════════════════════════════════
// BALANCE SHEET EXCEL EXPORT
// ═══════════════════════════════════════════════════

export async function exportBalanceSheetExcel(year?: number, month?: number): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const bs = await getBalanceSheet({ year, month })

    type BSExcelRow = { code: string; item: string; amount: number }
    const rows: BSExcelRow[] = bs.lines.map(l => ({
        code: l.code,
        item: (l.indent && l.indent > 0 ? '  '.repeat(l.indent) : '') + l.label,
        amount: l.amount,
    }))

    // Add balance check row
    rows.push({ code: '', item: '', amount: 0 })
    rows.push({
        code: '✓',
        item: bs.isBalanced ? 'CÂN ĐỐI ✓ (Tài sản = Nợ + Vốn CSH)' : '⚠ CHÊNH LỆCH — Kiểm tra lại dữ liệu!',
        amount: bs.totalAssets - bs.totalLiabilities - bs.totalEquity,
    })

    const buffer = await generateExcelBuffer({
        sheetName: 'CĐKT',
        title: `Bảng Cân Đối Kế Toán — T${bs.month}/${bs.year}`,
        columns: [
            { header: 'Mã số', key: 'code', width: 10 },
            { header: 'Chỉ tiêu', key: 'item', width: 40 },
            { header: `Số cuối kỳ (T${bs.month}/${bs.year})`, key: 'amount', width: 22, numFmt: '#,##0' },
        ],
        rows,
    })

    return Buffer.from(buffer).toString('base64')
}

// ═══════════════════════════════════════════════════
// AR AGING EXCEL EXPORT — Chi tiết theo Khách hàng
// ═══════════════════════════════════════════════════

export async function exportARAgingExcel(): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const now = new Date()

    const invoices = await prisma.aRInvoice.findMany({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        include: {
            customer: { select: { name: true, code: true } },
            payments: { select: { amount: true } },
        },
        orderBy: [{ customer: { name: 'asc' } }, { dueDate: 'asc' }],
    })

    type ARAgingRow = {
        customerCode: string
        customerName: string
        invoiceNo: string
        amount: number
        paid: number
        outstanding: number
        dueDate: string
        daysOverdue: number
        bucket: string
    }

    const rows: ARAgingRow[] = invoices.map(inv => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
        const outstanding = Number(inv.amount) - paid
        const days = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000))
        let bucket = 'Chưa đến hạn'
        if (days > 0 && days <= 30) bucket = '1–30 ngày'
        else if (days > 30 && days <= 60) bucket = '31–60 ngày'
        else if (days > 60 && days <= 90) bucket = '61–90 ngày'
        else if (days > 90) bucket = 'Trên 90 ngày'

        return {
            customerCode: inv.customer?.code ?? '',
            customerName: inv.customer?.name ?? 'N/A',
            invoiceNo: inv.invoiceNo,
            amount: Number(inv.amount),
            paid,
            outstanding,
            dueDate: inv.dueDate.toLocaleDateString('vi-VN'),
            daysOverdue: days,
            bucket,
        }
    }).filter(r => r.outstanding > 0)

    const buffer = await generateExcelBuffer({
        sheetName: 'AR Aging',
        title: `Báo Cáo Tuổi Nợ Phải Thu — ${now.toLocaleDateString('vi-VN')}`,
        columns: [
            { header: 'Mã KH', key: 'customerCode', width: 12 },
            { header: 'Tên Khách Hàng', key: 'customerName', width: 30 },
            { header: 'Số Hóa Đơn', key: 'invoiceNo', width: 18 },
            { header: 'Giá trị HĐ', key: 'amount', width: 18, numFmt: '#,##0' },
            { header: 'Đã thu', key: 'paid', width: 16, numFmt: '#,##0' },
            { header: 'Còn nợ', key: 'outstanding', width: 18, numFmt: '#,##0' },
            { header: 'Hạn TT', key: 'dueDate', width: 14 },
            { header: 'Ngày QH', key: 'daysOverdue', width: 10 },
            { header: 'Phân loại', key: 'bucket', width: 16 },
        ],
        rows,
    })

    return Buffer.from(buffer).toString('base64')
}

// ═══════════════════════════════════════════════════
// CREDIT HOLD AUTO — Tự động flag khách hàng vượt hạn mức
// ═══════════════════════════════════════════════════

export type CreditHoldResult = {
    customerId: string
    customerName: string
    creditLimit: number
    currentAR: number
    isOverLimit: boolean
    overAmount: number
    wasHeld: boolean // true = mới bị hold lần này
}

export async function autoCheckCreditHold(): Promise<{
    success: boolean
    checked: number
    held: number
    released: number
    results: CreditHoldResult[]
    error?: string
}> {
    try {
        // Get all customers with credit limit > 0
        const customers = await prisma.customer.findMany({
            where: {
                status: 'ACTIVE',
                deletedAt: null,
                creditLimit: { gt: 0 },
            },
            select: { id: true, name: true, creditLimit: true, creditHold: true },
        })

        const results: CreditHoldResult[] = []
        let held = 0
        let released = 0

        for (const cust of customers) {
            const arBalance = await prisma.aRInvoice.aggregate({
                where: {
                    customerId: cust.id,
                    status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                },
                _sum: { amount: true },
            })
            const currentAR = Number(arBalance._sum?.amount ?? 0)
            const creditLimit = Number(cust.creditLimit)
            const isOverLimit = currentAR > creditLimit

            let wasHeld = false
            if (isOverLimit && !cust.creditHold) {
                // Auto HOLD
                await prisma.customer.update({
                    where: { id: cust.id },
                    data: { creditHold: true },
                })
                wasHeld = true
                held++
            } else if (!isOverLimit && cust.creditHold) {
                // Auto RELEASE
                await prisma.customer.update({
                    where: { id: cust.id },
                    data: { creditHold: false },
                })
                released++
            }

            if (isOverLimit || cust.creditHold) {
                results.push({
                    customerId: cust.id,
                    customerName: cust.name,
                    creditLimit,
                    currentAR,
                    isOverLimit,
                    overAmount: Math.max(0, currentAR - creditLimit),
                    wasHeld,
                })
            }
        }

        revalidateCache('finance')
        revalidateCache('sales')
        revalidatePath('/dashboard/finance')
        revalidatePath('/dashboard/sales')

        return { success: true, checked: customers.length, held, released, results }
    } catch (err: any) {
        return { success: false, checked: 0, held: 0, released: 0, results: [], error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// VAT DECLARATION — Bảng kê VAT Mua vào / Bán ra
// ═══════════════════════════════════════════════════

export type VATOutputRow = {
    invoiceNo: string
    customerName: string
    customerTaxId: string
    soNo: string
    salesAmount: number
    vatRate: number
    vatAmount: number
    totalAmount: number
    invoiceDate: string
}

export type VATInputRow = {
    invoiceNo: string
    supplierName: string
    supplierTaxId: string
    poNo: string
    purchaseAmount: number
    vatRate: number
    vatAmount: number
    totalWithVat: number
    invoiceDate: string
}

export type VATSummary = {
    year: number
    month: number
    totalOutputVAT: number
    totalInputVAT: number
    netVATPayable: number
    outputRows: VATOutputRow[]
    inputRows: VATInputRow[]
}

export async function getVATDeclaration(year?: number, month?: number): Promise<VATSummary> {
    const now = new Date()
    const y = year ?? now.getFullYear()
    const m = month ?? (now.getMonth() + 1)

    const startDate = new Date(y, m - 1, 1)
    const endDate = new Date(y, m, 0, 23, 59, 59)

    // ── Output VAT (Bán ra) – AR Invoices ──
    const arInvoices = await prisma.aRInvoice.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            status: { not: 'CANCELLED' },
        },
        include: {
            customer: { select: { name: true, taxId: true } },
            so: { select: { soNo: true } },
        },
        orderBy: { createdAt: 'asc' },
    })

    const outputRows: VATOutputRow[] = arInvoices.map(inv => {
        const amount = Number(inv.amount)
        const vat = Number(inv.vatAmount ?? 0)
        return {
            invoiceNo: inv.invoiceNo,
            customerName: inv.customer.name,
            customerTaxId: inv.customer.taxId ?? '',
            soNo: inv.so?.soNo ?? '',
            salesAmount: amount,
            vatRate: amount > 0 ? Math.round((vat / amount) * 100) : 10,
            vatAmount: vat,
            totalAmount: Number(inv.totalAmount ?? amount + vat),
            invoiceDate: inv.createdAt.toISOString().slice(0, 10),
        }
    })

    // ── Input VAT (Mua vào) – AP Invoices ──
    const apInvoices = await prisma.aPInvoice.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            status: { not: 'CANCELLED' },
        },
        include: {
            supplier: { select: { name: true, taxId: true } },
            po: { select: { poNo: true } },
        },
        orderBy: { createdAt: 'asc' },
    })

    const inputRows: VATInputRow[] = apInvoices.map(inv => {
        const amount = Number(inv.amount) * Number(inv.exchangeRate ?? 1) // convert to VND
        const vatRate = 10 // standard rate
        const vatAmount = Math.round(amount * vatRate / 100)
        return {
            invoiceNo: inv.invoiceNo,
            supplierName: inv.supplier.name,
            supplierTaxId: inv.supplier.taxId ?? '',
            poNo: inv.po?.poNo ?? '',
            purchaseAmount: amount,
            vatRate,
            vatAmount,
            totalWithVat: amount + vatAmount,
            invoiceDate: inv.createdAt.toISOString().slice(0, 10),
        }
    })

    const totalOutputVAT = outputRows.reduce((s, r) => s + r.vatAmount, 0)
    const totalInputVAT = inputRows.reduce((s, r) => s + r.vatAmount, 0)

    return {
        year: y,
        month: m,
        totalOutputVAT,
        totalInputVAT,
        netVATPayable: totalOutputVAT - totalInputVAT,
        outputRows,
        inputRows,
    }
}

export async function exportVATDeclarationExcel(year?: number, month?: number): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const data = await getVATDeclaration(year, month)

    // Sheet 1: Output VAT (Bán ra)
    const outputBuffer = await generateExcelBuffer({
        sheetName: 'VAT Bán Ra',
        title: `BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG BÁN RA — T${data.month}/${data.year}`,
        columns: [
            { header: 'Số HĐ', key: 'invoiceNo', width: 15 },
            { header: 'Ngày HĐ', key: 'invoiceDate', width: 12 },
            { header: 'Khách Hàng', key: 'customerName', width: 30 },
            { header: 'MST', key: 'customerTaxId', width: 15 },
            { header: 'Số SO', key: 'soNo', width: 15 },
            { header: 'Doanh số bán', key: 'salesAmount', width: 18, numFmt: '#,##0' },
            { header: 'Thuế suất (%)', key: 'vatRate', width: 12 },
            { header: 'Thuế GTGT', key: 'vatAmount', width: 18, numFmt: '#,##0' },
            { header: 'Tổng TT', key: 'totalAmount', width: 18, numFmt: '#,##0' },
        ],
        rows: [
            ...data.outputRows,
            {
                invoiceNo: '',
                invoiceDate: '',
                customerName: 'TỔNG CỘNG',
                customerTaxId: '',
                soNo: '',
                salesAmount: data.outputRows.reduce((s, r) => s + r.salesAmount, 0),
                vatRate: '',
                vatAmount: data.totalOutputVAT,
                totalAmount: data.outputRows.reduce((s, r) => s + r.totalAmount, 0),
            },
        ],
    })

    // For simplicity, return single-sheet. In production, use ExcelJS multi-sheet.
    return Buffer.from(outputBuffer).toString('base64')
}

// ═══════════════════════════════════════════════════
// SCT DECLARATION — Tờ khai Thuế Tiêu Thụ Đặc Biệt (TTĐB)
// ═══════════════════════════════════════════════════

export type SCTRow = {
    productSku: string
    productName: string
    hsCode: string
    country: string
    quantity: number
    cifValueVND: number
    importTaxRate: number
    importTaxAmount: number
    sctRate: number
    sctBase: number
    sctAmount: number
    shipmentBL: string
    grNo: string
    grDate: string
}

export type SCTSummary = {
    year: number
    month: number
    totalCIF: number
    totalImportTax: number
    totalSCT: number
    rows: SCTRow[]
}

export async function getSCTDeclaration(year?: number, month?: number): Promise<SCTSummary> {
    const now = new Date()
    const y = year ?? now.getFullYear()
    const m = month ?? (now.getMonth() + 1)

    const startDate = new Date(y, m - 1, 1)
    const endDate = new Date(y, m, 0, 23, 59, 59)

    // Get all GR in period with PO lines + products
    const goodsReceipts = await prisma.goodsReceipt.findMany({
        where: {
            status: 'CONFIRMED',
            createdAt: { gte: startDate, lte: endDate },
        },
        include: {
            po: {
                include: {
                    lines: {
                        include: {
                            product: { select: { skuCode: true, productName: true, hsCode: true, country: true } },
                        },
                    },
                },
            },
            shipment: { select: { billOfLading: true, cifAmount: true, cifCurrency: true } },
            lines: true,
        },
    })

    // Get all tax rates for lookup
    const taxRates = await prisma.taxRate.findMany({
        where: { effectiveDate: { lte: endDate } },
        orderBy: { effectiveDate: 'desc' },
    })

    const rows: SCTRow[] = []

    for (const gr of goodsReceipts) {
        const exchangeRate = Number(gr.po?.exchangeRate ?? 24500)

        for (const grLine of gr.lines) {
            const poLine = gr.po?.lines.find(l => l.productId === grLine.productId)
            if (!poLine) continue

            const product = poLine.product
            const qty = Number(grLine.qtyReceived)
            const unitPrice = Number(poLine.unitPrice)
            const cifLineVND = qty * unitPrice * exchangeRate

            // Find matching tax rate
            const taxRate = taxRates.find(t =>
                t.hsCode === product.hsCode && t.countryOfOrigin === product.country
            )

            const importTaxRate = Number(taxRate?.importTaxRate ?? 15)
            const sctRate = Number(taxRate?.sctRate ?? 35)

            const importTaxAmount = Math.round(cifLineVND * importTaxRate / 100)
            // SCT base = CIF + Import Tax (theo luật VN)
            const sctBase = cifLineVND + importTaxAmount
            const sctAmount = Math.round(sctBase * sctRate / 100)

            rows.push({
                productSku: product.skuCode,
                productName: product.productName,
                hsCode: product.hsCode,
                country: product.country,
                quantity: qty,
                cifValueVND: cifLineVND,
                importTaxRate,
                importTaxAmount,
                sctRate,
                sctBase,
                sctAmount,
                shipmentBL: gr.shipment?.billOfLading ?? '',
                grNo: gr.grNo,
                grDate: gr.createdAt.toISOString().slice(0, 10),
            })
        }
    }

    return {
        year: y,
        month: m,
        totalCIF: rows.reduce((s, r) => s + r.cifValueVND, 0),
        totalImportTax: rows.reduce((s, r) => s + r.importTaxAmount, 0),
        totalSCT: rows.reduce((s, r) => s + r.sctAmount, 0),
        rows,
    }
}

export async function exportSCTDeclarationExcel(year?: number, month?: number): Promise<string> {
    const { generateExcelBuffer } = await import('@/lib/excel')
    const data = await getSCTDeclaration(year, month)

    const buffer = await generateExcelBuffer({
        sheetName: 'Tờ Khai TTĐB',
        title: `TỜ KHAI THUẾ TIÊU THỤ ĐẶC BIỆT — T${data.month}/${data.year}`,
        columns: [
            { header: 'SKU', key: 'productSku', width: 15 },
            { header: 'Tên SP', key: 'productName', width: 35 },
            { header: 'HS Code', key: 'hsCode', width: 12 },
            { header: 'Xuất xứ', key: 'country', width: 10 },
            { header: 'SL', key: 'quantity', width: 8, numFmt: '#,##0' },
            { header: 'CIF (VND)', key: 'cifValueVND', width: 18, numFmt: '#,##0' },
            { header: '% NK', key: 'importTaxRate', width: 8 },
            { header: 'Thuế NK', key: 'importTaxAmount', width: 18, numFmt: '#,##0' },
            { header: '% TTĐB', key: 'sctRate', width: 8 },
            { header: 'CIF+NK', key: 'sctBase', width: 18, numFmt: '#,##0' },
            { header: 'Thuế TTĐB', key: 'sctAmount', width: 18, numFmt: '#,##0' },
            { header: 'B/L', key: 'shipmentBL', width: 15 },
            { header: 'GR', key: 'grNo', width: 12 },
            { header: 'Ngày GR', key: 'grDate', width: 12 },
        ],
        rows: [
            ...data.rows,
            {
                productSku: '',
                productName: 'TỔNG CỘNG',
                hsCode: '',
                country: '',
                quantity: data.rows.reduce((s, r) => s + r.quantity, 0),
                cifValueVND: data.totalCIF,
                importTaxRate: '',
                importTaxAmount: data.totalImportTax,
                sctRate: '',
                sctBase: data.totalCIF + data.totalImportTax,
                sctAmount: data.totalSCT,
                shipmentBL: '',
                grNo: '',
                grDate: '',
            },
        ],
    })

    return Buffer.from(buffer).toString('base64')
}
