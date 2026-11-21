import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { generateNextDocCode } from '@/lib/doc-code'
import { getOrCreatePeriod, nextEntryNo } from '@/app/dashboard/finance/actions'
import { fetchKnbsTaReceipts, KnbsReceiptVoucher } from './knbs-client'

export interface KnbsSkippedItem {
    knbsId: string
    voucherNo: string
    customerTaxId: string | null
    customerName: string | null
    amount: number
    reason: string
}

export interface KnbsSyncSummary {
    totalFetched: number
    syncedCount: number
    alreadySyncedCount: number
    skippedCount: number
    failedCount: number
    totalSyncedAmount: number
    skippedItems: KnbsSkippedItem[]
    errors: string[]
    syncedAt: string
}

function buildKnbsImportHash(knbsId: string): string {
    return crypto.createHash('sha256').update(`KNBS_TA|${knbsId}`).digest('hex')
}

function normalizeTaxId(taxId: string | null | undefined): string {
    return String(taxId ?? '').replace(/\s+/g, '').trim()
}

async function resolveFallbackCreatorId(): Promise<string> {
    const admin = await prisma.user.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    })
    return admin?.id ?? 'system-cron'
}

export async function syncKnbsTaPayments(triggeredByUserId?: string): Promise<KnbsSyncSummary> {
    const vouchers = await fetchKnbsTaReceipts()
    const summary: KnbsSyncSummary = {
        totalFetched: vouchers.length,
        syncedCount: 0,
        alreadySyncedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        totalSyncedAmount: 0,
        skippedItems: [],
        errors: [],
        syncedAt: new Date().toISOString(),
    }

    if (vouchers.length === 0) {
        return summary
    }

    // Load active customers mapped strictly by Tax ID (MST)
    const customers = await prisma.customer.findMany({
        where: { deletedAt: null, taxId: { not: null } },
        select: { id: true, code: true, name: true, taxId: true },
    })
    const customerByTaxId = new Map<string, { id: string; code: string; name: string }>()
    for (const c of customers) {
        const norm = normalizeTaxId(c.taxId)
        if (norm && !customerByTaxId.has(norm)) {
            customerByTaxId.set(norm, { id: c.id, code: c.code, name: c.name })
        }
    }

    // Check existing non-reversed KNBS batches in one query
    const candidateHashes = vouchers.map(v => buildKnbsImportHash(v.knbsId))
    const existingBatches = await prisma.aRPaymentBatch.findMany({
        where: {
            importHash: { in: candidateHashes },
            status: { not: 'REVERSED' },
        },
        select: { importHash: true },
    })
    const existingHashSet = new Set(existingBatches.map(b => b.importHash).filter(Boolean))

    // Resolve Thắng Ân legal entity ID if present (to prioritize TA invoices first)
    const taEntity = await prisma.legalEntity.findFirst({
        where: {
            OR: [{ taxId: '0109579480' }, { code: 'TA' }],
        },
        select: { id: true },
    })

    const actorUserId = triggeredByUserId || (await resolveFallbackCreatorId())

    for (const voucher of vouchers) {
        const importHash = buildKnbsImportHash(voucher.knbsId)
        if (existingHashSet.has(importHash)) {
            summary.alreadySyncedCount += 1
            continue
        }

        const normTaxId = normalizeTaxId(voucher.customerTaxId)
        if (!normTaxId) {
            summary.skippedCount += 1
            summary.skippedItems.push({
                knbsId: voucher.knbsId,
                voucherNo: voucher.voucherNo,
                customerTaxId: null,
                customerName: voucher.customerName,
                amount: voucher.totalAmount,
                reason: 'Chứng từ KNBS không có Mã số thuế (MST) khách hàng',
            })
            continue
        }

        const matchedCustomer = customerByTaxId.get(normTaxId)
        if (!matchedCustomer) {
            summary.skippedCount += 1
            summary.skippedItems.push({
                knbsId: voucher.knbsId,
                voucherNo: voucher.voucherNo,
                customerTaxId: normTaxId,
                customerName: voucher.customerName,
                amount: voucher.totalAmount,
                reason: `Không tìm thấy khách hàng trong ERP khớp MST ${normTaxId}`,
            })
            continue
        }

        try {
            await postKnbsVoucherToErp(
                voucher,
                importHash,
                matchedCustomer.id,
                taEntity?.id ?? null,
                actorUserId
            )
            existingHashSet.add(importHash)
            summary.syncedCount += 1
            summary.totalSyncedAmount += voucher.totalAmount
        } catch (err: any) {
            summary.failedCount += 1
            summary.errors.push(`${voucher.voucherNo}: ${err.message || 'Lỗi không xác định'}`)
        }
    }

    if (summary.syncedCount > 0) {
        await logAudit({
            userId: triggeredByUserId ?? undefined,
            action: 'CREATE',
            entityType: 'ARPaymentBatch',
            description: `Đồng bộ KNBS Thắng Ân: ${summary.syncedCount} chứng từ (${summary.totalSyncedAmount.toLocaleString('vi-VN')} VND), bỏ qua ${summary.skippedCount}, lỗi ${summary.failedCount}`,
            newValue: {
                syncedCount: summary.syncedCount,
                totalSyncedAmount: summary.totalSyncedAmount,
                skippedCount: summary.skippedCount,
                failedCount: summary.failedCount,
            },
        })
        revalidateCache('finance')
        revalidateCache('sales')
        revalidateCache('customers')
    }

    return summary
}

async function postKnbsVoucherToErp(
    voucher: KnbsReceiptVoucher,
    importHash: string,
    customerId: string,
    taLegalEntityId: string | null,
    actorUserId: string
): Promise<void> {
    const payDate = voucher.postingDate
    const batchNo = await generateNextDocCode(prisma.aRPaymentBatch, 'batchNo', 'KNBS-', 6)
    const debitAccount = voucher.voucherType === 'CASH' ? '111 - Tiền mặt' : '112 - Tiền gửi NH'

    await prisma.$transaction(async tx => {
        // Closed period check inside transaction
        const period = await getOrCreatePeriod(payDate.getFullYear(), payDate.getMonth() + 1, tx)

        // Double-check idempotency inside transaction
        const dup = await tx.aRPaymentBatch.findUnique({ where: { importHash } })
        if (dup && dup.status !== 'REVERSED') {
            return
        }

        // Find open AR invoices for this customer (prioritize Thắng Ân entity, then FIFO by dueDate)
        const openInvoices = await tx.aRInvoice.findMany({
            where: {
                customerId,
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
                ...(taLegalEntityId ? { legalEntityId: taLegalEntityId } : {}),
            },
            include: { payments: { select: { amount: true } } },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        })

        let remainingToAllocate = voucher.totalAmount
        const allocations: {
            invoiceId: string
            invoiceNo: string
            soId: string | null
            amount: number
            newPaid: number
            newStatus: 'PAID' | 'PARTIALLY_PAID'
        }[] = []

        for (const inv of openInvoices) {
            if (remainingToAllocate <= 0) break
            const alreadyPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
            const invTotal = Number(inv.totalAmount ?? inv.amount)
            const outstanding = Math.max(0, invTotal - alreadyPaid)
            if (outstanding <= 0) continue

            const allocAmount = Math.min(remainingToAllocate, outstanding)
            const newPaid = alreadyPaid + allocAmount
            const newStatus = newPaid >= invTotal ? 'PAID' : 'PARTIALLY_PAID'

            allocations.push({
                invoiceId: inv.id,
                invoiceNo: inv.invoiceNo,
                soId: inv.soId,
                amount: allocAmount,
                newPaid,
                newStatus,
            })
            remainingToAllocate -= allocAmount
        }

        const allocatedAmount = allocations.reduce((s, a) => s + a.amount, 0)
        const unallocatedAmount = Math.max(0, voucher.totalAmount - allocatedAmount)
        const batchStatus = unallocatedAmount > 0 ? 'PARTIALLY_ALLOCATED' : 'POSTED'

        const batch = await tx.aRPaymentBatch.create({
            data: {
                batchNo,
                customerId,
                totalAmount: voucher.totalAmount,
                allocatedAmount,
                unallocatedAmount,
                method: voucher.voucherType,
                paymentDate: payDate,
                reference: voucher.voucherNo,
                notes: `[KNBS TA] ${voucher.description}`,
                importHash,
                status: batchStatus,
                createdById: actorUserId,
            },
        })

        for (const item of allocations) {
            const payment = await tx.aRPayment.create({
                data: {
                    invoiceId: item.invoiceId,
                    batchId: batch.id,
                    amount: item.amount,
                    method: voucher.voucherType,
                    reference: voucher.voucherNo,
                    notes: `[KNBS TA] ${voucher.description}`,
                    paymentDate: payDate,
                    paidAt: payDate,
                },
            })

            await tx.aRInvoice.update({
                where: { id: item.invoiceId },
                data: {
                    paidAmount: item.newPaid,
                    status: item.newStatus,
                },
            })

            if (item.newStatus === 'PAID' && item.soId) {
                await tx.salesOrder.update({
                    where: { id: item.soId },
                    data: { status: 'PAID' },
                })
            }

            const entryNo = await nextEntryNo('JE-PI', tx)
            await tx.journalEntry.create({
                data: {
                    entryNo,
                    docType: 'PAYMENT_IN',
                    docId: payment.id,
                    periodId: period.id,
                    description: `[KNBS TA] Thu tiền ${item.invoiceNo} (${voucher.voucherNo})`,
                    createdBy: actorUserId,
                    lines: {
                        create: [
                            { account: debitAccount, debit: item.amount, credit: 0 },
                            { account: '131 - Phải thu KH', debit: 0, credit: item.amount },
                        ],
                    },
                },
            })
        }

        // If voucher has unallocated advance (customer paid without open AR invoice yet), still book cash-in journal
        if (unallocatedAmount > 0) {
            const entryNo = await nextEntryNo('JE-PI', tx)
            await tx.journalEntry.create({
                data: {
                    entryNo,
                    docType: 'PAYMENT_IN',
                    docId: batch.id,
                    periodId: period.id,
                    description: `[KNBS TA] Thu tiền trả trước / chưa phân bổ (${voucher.voucherNo})`,
                    createdBy: actorUserId,
                    lines: {
                        create: [
                            { account: debitAccount, debit: unallocatedAmount, credit: 0 },
                            { account: '131 - Phải thu KH', debit: 0, credit: unallocatedAmount },
                        ],
                    },
                },
            })
        }
    })
}
