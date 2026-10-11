'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { parseBankStatementBuffer } from '@/lib/bank-statement/bank-parser'
import {
    matchBankTransaction,
    OpenInvoiceCandidate,
    RuleCandidate,
    CustomerCandidate
} from '@/lib/bank-statement/bank-matching-engine'

/**
 * Lấy danh sách tài khoản ngân hàng của công ty
 */
export async function getBankAccounts() {
    try {
        await requireAuth()

        let accounts = await prisma.bankAccount.findMany({
            include: {
                legalEntity: {
                    select: { id: true, code: true, name: true }
                },
                _count: {
                    select: { transactions: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        })

        // Tự động tạo 1 tài khoản VCB mặc định nếu hệ thống chưa có
        if (accounts.length === 0) {
            const entity = await prisma.legalEntity.findFirst()
            if (entity) {
                const defaultAcc = await prisma.bankAccount.create({
                    data: {
                        bankCode: 'VCB',
                        bankName: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
                        accountNumber: entity.bankAccountNumber || '0071000888999',
                        accountHolder: entity.bankAccountName || entity.name,
                        branch: 'Chi nhánh TP.HCM',
                        legalEntityId: entity.id,
                        currency: 'VND'
                    },
                    include: {
                        legalEntity: { select: { id: true, code: true, name: true } },
                        _count: { select: { transactions: true } }
                    }
                })
                accounts = [defaultAcc]
            }
        }

        return {
            success: true,
            data: JSON.parse(JSON.stringify(accounts))
        }
    } catch (err: any) {
        console.error('[getBankAccounts] Error:', err)
        return { success: false, error: err.message || 'Lỗi khi tải danh sách tài khoản ngân hàng' }
    }
}

/**
 * Tạo tài khoản ngân hàng mới
 */
export async function createBankAccount(data: {
    bankCode: string
    bankName: string
    accountNumber: string
    accountHolder: string
    branch?: string
    legalEntityId: string
}) {
    try {
        const user = await requireAuth()

        const existing = await prisma.bankAccount.findFirst({
            where: {
                bankCode: data.bankCode.toUpperCase(),
                accountNumber: data.accountNumber.trim()
            }
        })

        if (existing) {
            return { success: false, error: 'Số tài khoản này đã tồn tại trong hệ thống.' }
        }

        const newAccount = await prisma.bankAccount.create({
            data: {
                bankCode: data.bankCode.toUpperCase(),
                bankName: data.bankName,
                accountNumber: data.accountNumber.trim(),
                accountHolder: data.accountHolder.trim(),
                branch: data.branch,
                legalEntityId: data.legalEntityId
            }
        })

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CREATE',
            entityType: 'BankAccount',
            entityId: newAccount.id,
            description: `Tạo tài khoản ngân hàng ${newAccount.bankCode} - ${newAccount.accountNumber}`
        })

        revalidatePath('/dashboard/finance')
        return { success: true, data: JSON.parse(JSON.stringify(newAccount)) }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi tạo tài khoản' }
    }
}

/**
 * Lấy danh sách giao dịch sao kê kèm thông tin khớp thông minh
 */
export async function getBankTransactions(filters: {
    bankAccountId?: string
    status?: 'ALL' | 'UNMATCHED' | 'SUGGESTED' | 'POSTED' | 'IGNORED'
    search?: string
    page?: number
    pageSize?: number
}) {
    try {
        await requireAuth()

        const page = filters.page || 1
        const pageSize = filters.pageSize || 30
        const skip = (page - 1) * pageSize

        const where: any = {}
        if (filters.bankAccountId && filters.bankAccountId !== 'ALL') {
            where.bankAccountId = filters.bankAccountId
        }

        if (filters.status && filters.status !== 'ALL') {
            where.status = filters.status
        }

        if (filters.search && filters.search.trim()) {
            const s = filters.search.trim()
            where.OR = [
                { rawNarrative: { contains: s, mode: 'insensitive' } },
                { txnRef: { contains: s, mode: 'insensitive' } },
                { matchedCustomer: { name: { contains: s, mode: 'insensitive' } } },
                { suggestedReason: { contains: s, mode: 'insensitive' } }
            ]
        }

        const [total, transactions, stats] = await Promise.all([
            prisma.bankTransaction.count({ where }),
            prisma.bankTransaction.findMany({
                where,
                include: {
                    bankAccount: {
                        select: { id: true, bankCode: true, bankName: true, accountNumber: true }
                    },
                    matchedCustomer: {
                        select: { id: true, code: true, name: true, purchasingPhone: true }
                    },
                    paymentMatches: {
                        include: {
                            invoice: {
                                select: {
                                    id: true,
                                    invoiceNo: true,
                                    amount: true,
                                    totalAmount: true,
                                    paidAmount: true,
                                    status: true,
                                    so: { select: { id: true, soNo: true } }
                                }
                            },
                            arPayment: {
                                select: { id: true, paymentNo: true, amount: true, paidAt: true }
                            }
                        }
                    },
                    postedBy: {
                        select: { id: true, name: true }
                    }
                },
                orderBy: { txnDate: 'desc' },
                skip,
                take: pageSize
            }),
            prisma.bankTransaction.groupBy({
                by: ['status'],
                where: filters.bankAccountId && filters.bankAccountId !== 'ALL'
                    ? { bankAccountId: filters.bankAccountId }
                    : {},
                _count: true,
                _sum: { amount: true }
            })
        ])

        const kpis = {
            totalCount: 0,
            totalCreditAmount: 0,
            suggestedCount: 0,
            unmatchedCount: 0,
            postedCount: 0,
            ignoredCount: 0
        }

        for (const s of stats) {
            const count = s._count || 0
            const sum = Number(s._sum.amount || 0)
            kpis.totalCount += count
            kpis.totalCreditAmount += sum

            if (s.status === 'SUGGESTED') kpis.suggestedCount = count
            else if (s.status === 'UNMATCHED') kpis.unmatchedCount = count
            else if (s.status === 'POSTED') kpis.postedCount = count
            else if (s.status === 'IGNORED') kpis.ignoredCount = count
        }

        return {
            success: true,
            data: {
                transactions: JSON.parse(JSON.stringify(transactions)),
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                },
                kpis
            }
        }
    } catch (err: any) {
        console.error('[getBankTransactions] Error:', err)
        return { success: false, error: err.message || 'Lỗi khi tải danh sách giao dịch' }
    }
}

/**
 * Upload và xử lý file sao kê Excel/CSV
 */
export async function uploadBankStatementAction(formData: FormData) {
    try {
        const user = await requireAuth()

        const bankAccountId = formData.get('bankAccountId') as string
        const file = formData.get('file') as File

        if (!bankAccountId) {
            return { success: false, error: 'Vui lòng chọn tài khoản ngân hàng.' }
        }

        if (!file || file.size === 0) {
            return { success: false, error: 'Vui lòng chọn file sao kê Excel/CSV.' }
        }

        const bankAccount = await prisma.bankAccount.findUnique({
            where: { id: bankAccountId }
        })

        if (!bankAccount) {
            return { success: false, error: 'Không tìm thấy tài khoản ngân hàng.' }
        }

        // Đọc buffer file
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Phân tích file sao kê
        const parseResult = await parseBankStatementBuffer(buffer, bankAccountId)

        if (parseResult.transactions.length === 0) {
            return { success: false, error: 'Không tìm thấy dòng giao dịch hợp lệ nào trong file sao kê.' }
        }

        // Lấy danh sách hóa đơn đang nợ để chạy engine khớp
        const [openInvoicesRaw, rulesRaw, customersRaw] = await Promise.all([
            prisma.aRInvoice.findMany({
                where: {
                    status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
                },
                include: {
                    customer: {
                        select: { code: true, name: true }
                    },
                    so: {
                        select: { soNo: true }
                    }
                }
            }),
            prisma.bankReconciliationRule.findMany({
                include: {
                    customer: { select: { id: true, name: true } }
                }
            }),
            prisma.customer.findMany({
                where: { status: 'ACTIVE' },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    taxId: true,
                    purchasingPhone: true
                }
            })
        ])

        const candidateInvoices: OpenInvoiceCandidate[] = openInvoicesRaw.map(inv => ({
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            customerId: inv.customerId,
            customerName: inv.customer?.name || '',
            customerCode: inv.customer?.code || '',
            totalAmount: Number(inv.totalAmount),
            paidAmount: Number(inv.paidAmount),
            remainingAmount: Number(inv.totalAmount) - Number(inv.paidAmount),
            orderNo: inv.so?.soNo || inv.invoiceNo,
            soId: inv.soId,
            dueDate: inv.dueDate
        }))

        const candidateRules: RuleCandidate[] = rulesRaw.map(r => ({
            keyword: r.keyword,
            customerId: r.customerId,
            customerName: r.customer?.name || ''
        }))

        const candidateCustomers: CustomerCandidate[] = customersRaw.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            taxId: c.taxId,
            phone: c.purchasingPhone
        }))

        // Tạo Batch import
        const batch = await prisma.bankStatementBatch.create({
            data: {
                bankAccountId,
                fileName: file.name,
                fileSize: file.size,
                totalRecords: parseResult.totalRowsParsed,
                totalCredit: parseResult.totalCreditAmount,
                totalDebit: parseResult.totalDebitAmount,
                importedById: user.id
            }
        })

        let insertedCount = 0
        let skippedDuplicateCount = 0
        let autoSuggestedCount = 0

        // Duyệt từng giao dịch, chạy engine gợi ý và lưu DB
        for (const txn of parseResult.transactions) {
            // Kiểm tra trùng lặp qua SHA256 hash
            const existing = await prisma.bankTransaction.findUnique({
                where: { txnHash: txn.txnHash }
            })

            if (existing) {
                skippedDuplicateCount++
                continue
            }

            // Chạy engine phân tích
            const matchResult = txn.txnType === 'CREDIT'
                ? matchBankTransaction(
                    txn.rawNarrative,
                    txn.amount,
                    candidateInvoices,
                    candidateRules,
                    candidateCustomers
                )
                : {
                    confidenceScore: 0,
                    suggestedReason: 'Giao dịch tiền ra (DEBIT / Chi phí / Trả NCC)',
                    matchedCustomerId: null,
                    suggestedAllocations: []
                }

            const status = txn.txnType === 'CREDIT' && matchResult.confidenceScore >= 60
                ? 'SUGGESTED'
                : 'UNMATCHED'

            if (status === 'SUGGESTED') {
                autoSuggestedCount++
            }

            await prisma.bankTransaction.create({
                data: {
                    batchId: batch.id,
                    bankAccountId,
                    txnDate: txn.txnDate,
                    txnRef: txn.txnRef,
                    txnType: txn.txnType,
                    amount: txn.amount,
                    balanceAfter: txn.balanceAfter,
                    rawNarrative: txn.rawNarrative,
                    txnHash: txn.txnHash,
                    status,
                    confidenceScore: matchResult.confidenceScore,
                    suggestedReason: matchResult.suggestedReason,
                    matchedCustomerId: matchResult.matchedCustomerId
                }
            })

            insertedCount++
        }

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CREATE',
            entityType: 'BankStatementBatch',
            entityId: batch.id,
            description: `Import file sao kê ${file.name}: ${insertedCount} giao dịch mới, ${skippedDuplicateCount} trùng lặp bỏ qua, ${autoSuggestedCount} gợi ý khớp.`
        })

        revalidatePath('/dashboard/finance')
        revalidateCache('finance')

        return {
            success: true,
            data: {
                batchId: batch.id,
                totalParsed: parseResult.totalRowsParsed,
                insertedCount,
                skippedDuplicateCount,
                autoSuggestedCount
            }
        }
    } catch (err: any) {
        console.error('[uploadBankStatementAction] Error:', err)
        return { success: false, error: err.message || 'Lỗi khi nạp file sao kê ngân hàng.' }
    }
}

/**
 * 1-Click Phê Duyệt & Hạch Toán Thanh Toán Khách Hàng (Approve & Post)
 */
export async function approveBankTransactionMatch(params: {
    bankTxnId: string
    customerId?: string
    allocations: {
        invoiceId: string
        allocatedAmount: number
        feeDifference?: number
    }[]
    rememberRuleKeyword?: string
}) {
    try {
        const user = await requireAuth()

        if (!params.allocations || params.allocations.length === 0) {
            return { success: false, error: 'Vui lòng chọn ít nhất một hóa đơn để phân bổ thanh toán.' }
        }

        const result = await prisma.$transaction(async (tx) => {
            const bankTxn = await tx.bankTransaction.findUnique({
                where: { id: params.bankTxnId },
                include: { bankAccount: true }
            })

            if (!bankTxn) {
                throw new Error('Không tìm thấy giao dịch ngân hàng.')
            }

            if (bankTxn.status === 'POSTED') {
                throw new Error('Giao dịch này đã được ghi sổ thanh toán trước đó.')
            }

            const totalAllocated = params.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
            if (totalAllocated > Number(bankTxn.amount) + 10000) {
                throw new Error(`Tổng số tiền phân bổ (${totalAllocated.toLocaleString()} đ) vượt quá số tiền giao dịch (${Number(bankTxn.amount).toLocaleString()} đ).`)
            }

            const targetCustomerId = params.customerId || bankTxn.matchedCustomerId

            for (const alloc of params.allocations) {
                const invoice = await tx.aRInvoice.findUnique({
                    where: { id: alloc.invoiceId },
                    include: { so: true }
                })

                if (!invoice) {
                    throw new Error(`Không tìm thấy hóa đơn ID ${alloc.invoiceId}`)
                }

                // 1. Tạo phiếu thu ARPayment
                const paymentNo = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`
                const feeDiff = alloc.feeDifference || 0

                const arPayment = await tx.aRPayment.create({
                    data: {
                        paymentNo,
                        invoiceId: alloc.invoiceId,
                        amount: alloc.allocatedAmount,
                        method: 'BANK_TRANSFER',
                        reference: bankTxn.txnRef || `BANK-${bankTxn.id.slice(-6)}`,
                        notes: `Đối soát sao kê ${bankTxn.bankAccount.bankCode} (${bankTxn.txnDate.toISOString().split('T')[0]}): ${bankTxn.rawNarrative}`,
                        paymentDate: bankTxn.txnDate,
                        paidAt: new Date()
                    }
                })

                // 2. Cập nhật paidAmount & status của ARInvoice
                const newPaidAmount = Number(invoice.paidAmount) + alloc.allocatedAmount + feeDiff
                const isFullyPaid = newPaidAmount >= Number(invoice.totalAmount) - 500 // Sai số nhỏ coi như hoàn tất

                await tx.aRInvoice.update({
                    where: { id: alloc.invoiceId },
                    data: {
                        paidAmount: newPaidAmount,
                        status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID'
                    }
                })

                // 3. Tạo bản ghi phân bổ BankTransactionMatch
                await tx.bankTransactionMatch.create({
                    data: {
                        bankTxnId: bankTxn.id,
                        invoiceId: alloc.invoiceId,
                        allocatedAmount: alloc.allocatedAmount,
                        feeDifference: feeDiff,
                        arPaymentId: arPayment.id
                    }
                })
            }

            // 4. Kiểm tra và gỡ Credit Hold nếu khách hàng đã thanh toán hết nợ quá hạn
            if (targetCustomerId) {
                const overdueInvoicesCount = await tx.aRInvoice.count({
                    where: {
                        customerId: targetCustomerId,
                        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
                        dueDate: { lt: new Date() }
                    }
                })

                if (overdueInvoicesCount === 0) {
                    await tx.customer.update({
                        where: { id: targetCustomerId },
                        data: { creditHold: false }
                    })
                }
            }

            // 5. Ghi nhớ quy tắc học nếu kế toán yêu cầu
            if (params.rememberRuleKeyword && params.rememberRuleKeyword.trim().length >= 3 && targetCustomerId) {
                const cleanKeyword = params.rememberRuleKeyword.trim()
                await tx.bankReconciliationRule.upsert({
                    where: {
                        keyword_customerId: {
                            keyword: cleanKeyword,
                            customerId: targetCustomerId
                        }
                    },
                    create: {
                        keyword: cleanKeyword,
                        customerId: targetCustomerId,
                        createdById: user.id
                    },
                    update: {}
                })
            }

            // 6. Cập nhật trạng thái giao dịch ngân hàng thành POSTED
            const updatedTxn = await tx.bankTransaction.update({
                where: { id: bankTxn.id },
                data: {
                    status: 'POSTED',
                    postedAt: new Date(),
                    postedById: user.id,
                    matchedCustomerId: targetCustomerId
                }
            })

            return updatedTxn
        })

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'CONFIRM',
            entityType: 'BankTransaction',
            entityId: params.bankTxnId,
            description: `Duyệt hạch toán sao kê ngân hàng thành công (${params.allocations.length} hóa đơn).`
        })

        revalidatePath('/dashboard/finance')
        revalidateCache('finance')

        return { success: true, data: JSON.parse(JSON.stringify(result)) }
    } catch (err: any) {
        console.error('[approveBankTransactionMatch] Error:', err)
        return { success: false, error: err.message || 'Lỗi khi hạch toán thanh toán.' }
    }
}

/**
 * Hủy Khớp & Hoàn Tác Thanh Toán (Rollback / Unmatch Safe Operation)
 */
export async function revertBankTransactionMatch(bankTxnId: string) {
    try {
        const user = await requireAuth()

        const result = await prisma.$transaction(async (tx) => {
            const bankTxn = await tx.bankTransaction.findUnique({
                where: { id: bankTxnId },
                include: {
                    paymentMatches: {
                        include: {
                            invoice: true,
                            arPayment: true
                        }
                    }
                }
            })

            if (!bankTxn) {
                throw new Error('Không tìm thấy giao dịch ngân hàng.')
            }

            if (bankTxn.status !== 'POSTED') {
                throw new Error('Giao dịch chưa được hạch toán, không thể hoàn tác.')
            }

            // Hoàn nguyên từng hóa đơn và xóa ARPayment
            for (const match of bankTxn.paymentMatches) {
                const totalRollback = Number(match.allocatedAmount) + Number(match.feeDifference)
                const currentPaid = Number(match.invoice.paidAmount)
                const newPaid = Math.max(0, currentPaid - totalRollback)

                await tx.aRInvoice.update({
                    where: { id: match.invoiceId },
                    data: {
                        paidAmount: newPaid,
                        status: newPaid <= 0 ? 'UNPAID' : 'PARTIALLY_PAID'
                    }
                })

                if (match.arPaymentId) {
                    await tx.aRPayment.delete({
                        where: { id: match.arPaymentId }
                    })
                }

                await tx.bankTransactionMatch.delete({
                    where: { id: match.id }
                })
            }

            // Đưa giao dịch quay lại trạng thái SUGGESTED
            const updated = await tx.bankTransaction.update({
                where: { id: bankTxn.id },
                data: {
                    status: bankTxn.confidenceScore && bankTxn.confidenceScore >= 60 ? 'SUGGESTED' : 'UNMATCHED',
                    postedAt: null,
                    postedById: null
                }
            })

            return updated
        })

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'STATUS_CHANGE',
            entityType: 'BankTransaction',
            entityId: bankTxnId,
            description: `Hoàn tác / Hủy khớp giao dịch sao kê ngân hàng thành công.`
        })

        revalidatePath('/dashboard/finance')
        revalidateCache('finance')

        return { success: true, data: JSON.parse(JSON.stringify(result)) }
    } catch (err: any) {
        console.error('[revertBankTransactionMatch] Error:', err)
        return { success: false, error: err.message || 'Lỗi khi hoàn tác giao dịch.' }
    }
}

/**
 * Đánh dấu Bỏ qua (IGNORED) hoặc Bỏ qua sang Chưa khớp (UNMATCHED)
 */
export async function toggleIgnoreBankTransaction(bankTxnId: string, ignore: boolean) {
    try {
        const user = await requireAuth()

        const updated = await prisma.bankTransaction.update({
            where: { id: bankTxnId },
            data: {
                status: ignore ? 'IGNORED' : 'UNMATCHED'
            }
        })

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'UPDATE',
            entityType: 'BankTransaction',
            entityId: bankTxnId,
            description: `${ignore ? 'Bỏ qua' : 'Khôi phục'} giao dịch sao kê.`
        })

        revalidatePath('/dashboard/finance')
        return { success: true, data: JSON.parse(JSON.stringify(updated)) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Lấy danh sách hóa đơn đang nợ của khách hàng để gán thủ công
 */
export async function getOpenInvoicesForCustomer(customerId: string) {
    try {
        await requireAuth()

        const invoices = await prisma.aRInvoice.findMany({
            where: {
                customerId,
                status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
            },
            include: {
                so: {
                    select: { id: true, soNo: true, totalAmount: true }
                }
            },
            orderBy: { dueDate: 'asc' }
        })

        return { success: true, data: JSON.parse(JSON.stringify(invoices)) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Tìm kiếm nhanh khách hàng
 */
export async function searchCustomers(query: string) {
    try {
        await requireAuth()
        const q = query.trim()
        if (!q) return { success: true, data: [] }

        const customers = await prisma.customer.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                    { purchasingPhone: { contains: q, mode: 'insensitive' } },
                    { taxId: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: {
                id: true,
                code: true,
                name: true,
                purchasingPhone: true,
                taxId: true
            }
        })

        return { success: true, data: JSON.parse(JSON.stringify(customers)) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Lấy danh sách quy tắc ghi nhớ từ khóa
 */
export async function getReconciliationRules() {
    try {
        await requireAuth()

        const rules = await prisma.bankReconciliationRule.findMany({
            include: {
                customer: {
                    select: { id: true, code: true, name: true }
                },
                createdBy: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, data: JSON.parse(JSON.stringify(rules)) }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Xóa quy tắc ghi nhớ từ khóa
 */
export async function deleteReconciliationRule(ruleId: string) {
    try {
        const user = await requireAuth()

        await prisma.bankReconciliationRule.delete({
            where: { id: ruleId }
        })

        await logAudit({
            userId: user.id,
            userName: user.name,
            action: 'DELETE',
            entityType: 'BankReconciliationRule',
            entityId: ruleId,
            description: 'Xóa quy tắc ghi nhớ nhận diện khách hàng.'
        })

        revalidatePath('/dashboard/finance')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
