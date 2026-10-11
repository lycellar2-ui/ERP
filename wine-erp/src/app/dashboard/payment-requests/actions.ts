'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser, requireAuth, hasRole } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { revalidateCache } from '@/lib/cache'
import { createNotification, triggerNotificationForRole } from '@/lib/notifications'
import { getPresignedDocUrl } from '@/lib/storage-r2'
import type { PaymentRequestStatus, PaymentDocType, BudgetPeriodType, PaymentCategory } from '@prisma/client'

// ═══════════════════════════════════════════════════════════════
// 1. EXPENSE CATEGORIES (Cấu Hình Hạng Mục Chi Phí)
// ═══════════════════════════════════════════════════════════════

export type ExpenseCategoryRow = {
    id: string
    code: string
    name: string
    group: string
    defaultAccount: string | null
    parentId: string | null
    parentName?: string | null
    description: string | null
    isActive: boolean
    sortOrder: number
    itemCount?: number
}

export async function getExpenseCategories(includeInactive = false): Promise<ExpenseCategoryRow[]> {
    const where: any = {}
    if (!includeInactive) where.isActive = true

    const categories = await prisma.expenseCategoryMaster.findMany({
        where,
        include: {
            parent: { select: { name: true } },
            _count: { select: { paymentItems: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return categories.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        group: c.group,
        defaultAccount: c.defaultAccount,
        parentId: c.parentId,
        parentName: c.parent?.name ?? null,
        description: c.description,
        isActive: c.isActive,
        sortOrder: c.sortOrder,
        itemCount: c._count.paymentItems,
    }))
}

export async function saveExpenseCategory(data: {
    id?: string
    code: string
    name: string
    group: string
    defaultAccount?: string | null
    parentId?: string | null
    description?: string | null
    isActive?: boolean
    sortOrder?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const upperCode = data.code.trim().toUpperCase().replace(/\s+/g, '_')

        if (data.id) {
            const updated = await prisma.expenseCategoryMaster.update({
                where: { id: data.id },
                data: {
                    code: upperCode,
                    name: data.name.trim(),
                    group: data.group,
                    defaultAccount: data.defaultAccount?.trim() || null,
                    parentId: data.parentId || null,
                    description: data.description?.trim() || null,
                    isActive: data.isActive ?? true,
                    sortOrder: data.sortOrder ?? 0,
                },
            })
            revalidatePath('/dashboard/payment-requests')
            return { success: true, id: updated.id }
        } else {
            const existing = await prisma.expenseCategoryMaster.findUnique({
                where: { code: upperCode }
            })
            if (existing) {
                return { success: false, error: `Mã hạng mục ${upperCode} đã tồn tại` }
            }

            const created = await prisma.expenseCategoryMaster.create({
                data: {
                    code: upperCode,
                    name: data.name.trim(),
                    group: data.group,
                    defaultAccount: data.defaultAccount?.trim() || null,
                    parentId: data.parentId || null,
                    description: data.description?.trim() || null,
                    isActive: data.isActive ?? true,
                    sortOrder: data.sortOrder ?? 0,
                },
            })
            revalidatePath('/dashboard/payment-requests')
            return { success: true, id: created.id }
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi lưu hạng mục' }
    }
}

export async function deleteExpenseCategory(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const usedCount = await prisma.paymentRequestItem.count({ where: { categoryId: id } })
        if (usedCount > 0) {
            // Soft delete by deactivating
            await prisma.expenseCategoryMaster.update({
                where: { id },
                data: { isActive: false }
            })
            revalidatePath('/dashboard/payment-requests')
            return { success: true }
        }

        await prisma.expenseCategoryMaster.delete({ where: { id } })
        revalidatePath('/dashboard/payment-requests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi xóa hạng mục' }
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. EXPENSE BUDGETS (Quản Lý & Kiểm Soát Ngân Sách)
// ═══════════════════════════════════════════════════════════════

export type ExpenseBudgetRow = {
    id: string
    categoryId: string
    categoryCode: string
    categoryName: string
    categoryGroup: string
    departmentId: string | null
    departmentName: string | null
    year: number
    periodType: BudgetPeriodType
    periodIndex: number | null
    allocatedAmount: number
    spentAmount: number
    pendingAmount: number
    remainingAmount: number
    utilizationPct: number
    warningThresholdPct: number
    isAlert: boolean
    isOverBudget: boolean
    notes: string | null
}

export async function getExpenseBudgets(filters: {
    year?: number
    departmentId?: string
    categoryId?: string
} = {}): Promise<ExpenseBudgetRow[]> {
    const year = filters.year || new Date().getFullYear()
    const where: any = { year }
    if (filters.departmentId) where.departmentId = filters.departmentId
    if (filters.categoryId) where.categoryId = filters.categoryId

    const [budgets, categories, itemsSpent, itemsPending] = await Promise.all([
        prisma.expenseBudget.findMany({
            where,
            include: {
                category: true,
                department: { select: { name: true } },
            },
            orderBy: [{ category: { sortOrder: 'asc' } }, { periodType: 'asc' }],
        }),
        prisma.expenseCategoryMaster.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        // Sum spent by category in the given year
        prisma.paymentRequestItem.findMany({
            where: {
                categoryId: { not: null },
                request: {
                    status: 'PAID',
                    createdAt: {
                        gte: new Date(year, 0, 1),
                        lte: new Date(year, 11, 31, 23, 59, 59),
                    },
                },
            },
            select: {
                categoryId: true,
                totalAmount: true,
            },
        }),
        // Sum pending approval by category in the given year
        prisma.paymentRequestItem.findMany({
            where: {
                categoryId: { not: null },
                request: {
                    status: { in: ['SUBMITTED', 'REVIEWING_L1', 'REVIEWING_L2', 'APPROVED'] },
                    createdAt: {
                        gte: new Date(year, 0, 1),
                        lte: new Date(year, 11, 31, 23, 59, 59),
                    },
                },
            },
            select: {
                categoryId: true,
                totalAmount: true,
            },
        }),
    ])

    // Aggregate spent & pending by category
    const spentMap = new Map<string, number>()
    for (const item of itemsSpent) {
        if (!item.categoryId) continue
        const curr = spentMap.get(item.categoryId) || 0
        spentMap.set(item.categoryId, curr + Number(item.totalAmount))
    }

    const pendingMap = new Map<string, number>()
    for (const item of itemsPending) {
        if (!item.categoryId) continue
        const curr = pendingMap.get(item.categoryId) || 0
        pendingMap.set(item.categoryId, curr + Number(item.totalAmount))
    }

    // Build rows from explicit budgets
    const budgetMap = new Map<string, any>()
    for (const b of budgets) {
        budgetMap.set(b.categoryId, b)
    }

    // Map all active categories so user sees status even if budget not yet set
    const result: ExpenseBudgetRow[] = categories.map(cat => {
        const b = budgetMap.get(cat.id)
        const allocated = b ? Number(b.allocatedAmount) : 0
        const spent = spentMap.get(cat.id) || 0
        const pending = pendingMap.get(cat.id) || 0
        const remaining = allocated > 0 ? allocated - spent : 0
        const utilizationPct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0
        const warningThreshold = b ? Number(b.warningThresholdPct) : 85

        return {
            id: b?.id || `unbudgeted-${cat.id}`,
            categoryId: cat.id,
            categoryCode: cat.code,
            categoryName: cat.name,
            categoryGroup: cat.group,
            departmentId: b?.departmentId || null,
            departmentName: b?.department?.name || 'Toàn công ty',
            year: b?.year || year,
            periodType: (b?.periodType as BudgetPeriodType) || 'YEARLY',
            periodIndex: b?.periodIndex ?? null,
            allocatedAmount: allocated,
            spentAmount: spent,
            pendingAmount: pending,
            remainingAmount: remaining,
            utilizationPct,
            warningThresholdPct: warningThreshold,
            isAlert: allocated > 0 && utilizationPct >= warningThreshold && spent <= allocated,
            isOverBudget: allocated > 0 && spent > allocated,
            notes: b?.notes || null,
        }
    })

    return result
}

export async function saveExpenseBudget(data: {
    id?: string
    categoryId: string
    departmentId?: string | null
    year: number
    periodType: BudgetPeriodType
    periodIndex?: number | null
    allocatedAmount: number
    warningThresholdPct?: number
    notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        if (data.id && !data.id.startsWith('unbudgeted-')) {
            await prisma.expenseBudget.update({
                where: { id: data.id },
                data: {
                    allocatedAmount: data.allocatedAmount,
                    warningThresholdPct: data.warningThresholdPct ?? 85,
                    notes: data.notes?.trim() || null,
                },
            })
        } else {
            // Find existing or create
            const existing = await prisma.expenseBudget.findFirst({
                where: {
                    categoryId: data.categoryId,
                    departmentId: data.departmentId || null,
                    year: data.year,
                    periodType: data.periodType,
                    periodIndex: data.periodIndex || null,
                },
            })

            if (existing) {
                await prisma.expenseBudget.update({
                    where: { id: existing.id },
                    data: {
                        allocatedAmount: data.allocatedAmount,
                        warningThresholdPct: data.warningThresholdPct ?? 85,
                        notes: data.notes?.trim() || null,
                    },
                })
            } else {
                await prisma.expenseBudget.create({
                    data: {
                        categoryId: data.categoryId,
                        departmentId: data.departmentId || null,
                        year: data.year,
                        periodType: data.periodType,
                        periodIndex: data.periodIndex || null,
                        allocatedAmount: data.allocatedAmount,
                        warningThresholdPct: data.warningThresholdPct ?? 85,
                        notes: data.notes?.trim() || null,
                    },
                })
            }
        }

        revalidatePath('/dashboard/payment-requests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi lưu hạn mức ngân sách' }
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. PAYMENT REQUESTS (Đề Nghị Thanh Toán)
// ═══════════════════════════════════════════════════════════════

export type PaymentRequestRow = {
    id: string
    requestNo: string
    title: string
    category: PaymentCategory
    priority: string
    status: PaymentRequestStatus
    currentLevel: number
    currency: string
    totalAmount: number
    totalAmountVND: number
    paidAmount: number
    beneficiaryName: string
    beneficiaryBank: string | null
    beneficiaryAccount: string | null
    departmentName: string | null
    creatorName: string
    creatorEmail: string
    dueDate: Date | null
    paidDate: Date | null
    itemCount: number
    attachmentCount: number
    uncVoucherNo: string | null
    createdAt: Date
}

async function generatePaymentRequestNo(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `PR-${year}-`
    const last = await prisma.paymentRequest.findFirst({
        where: { requestNo: { startsWith: prefix } },
        orderBy: { requestNo: 'desc' },
        select: { requestNo: true },
    })

    let seq = 1
    if (last) {
        const numPart = last.requestNo.replace(prefix, '')
        const parsed = parseInt(numPart, 10)
        if (!isNaN(parsed)) seq = parsed + 1
    }

    return `${prefix}${String(seq).padStart(4, '0')}`
}

export async function getPaymentRequests(filters: {
    status?: string
    category?: string
    search?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: PaymentRequestRow[]; total: number }> {
    const user = await getCurrentUser()
    const { status, category, search, dateFrom, dateTo, page = 1, pageSize = 25 } = filters

    const where: any = {}
    if (status && status !== 'ALL') where.status = status
    if (category && category !== 'ALL') where.category = category

    if (search) {
        where.OR = [
            { requestNo: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { beneficiaryName: { contains: search, mode: 'insensitive' } },
        ]
    }

    if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`)
    }

    // RBAC: If normal user, show own requests + department requests if manager
    const isCEO = user?.roles.some(r => ['CEO', 'ADMIN', 'GIAM_DOC'].includes(r.toUpperCase()))
    const isAccountant = user?.roles.some(r => ['KE_TOAN', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'KETOAN_TRUONG'].includes(r.toUpperCase()))
    const isManager = user?.roles.some(r => ['TRUONG_PHONG', 'MANAGER', 'DIRECTOR'].includes(r.toUpperCase()))

    let userDeptId: string | null = null
    if (user && isManager) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { deptId: true } })
        userDeptId = dbUser?.deptId || null
    }

    if (user && !isCEO && !isAccountant) {
        if (isManager && userDeptId) {
            where.OR = [
                { createdBy: user.id },
                { departmentId: userDeptId },
            ]
        } else {
            where.createdBy = user.id
        }
    }

    const [rows, total] = await Promise.all([
        prisma.paymentRequest.findMany({
            where,
            include: {
                creator: { select: { name: true, email: true } },
                department: { select: { name: true } },
                _count: { select: { items: true, attachments: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.paymentRequest.count({ where }),
    ])

    return {
        rows: rows.map(r => ({
            id: r.id,
            requestNo: r.requestNo,
            title: r.title,
            category: r.category,
            priority: r.priority,
            status: r.status,
            currentLevel: r.currentLevel,
            currency: r.currency,
            totalAmount: Number(r.totalAmount),
            totalAmountVND: Number(r.totalAmountVND),
            paidAmount: Number(r.paidAmount),
            beneficiaryName: r.beneficiaryName,
            beneficiaryBank: r.beneficiaryBank,
            beneficiaryAccount: r.beneficiaryAccount,
            departmentName: r.department?.name || null,
            creatorName: r.creator?.name || r.creator?.email || 'N/A',
            creatorEmail: r.creator?.email || '',
            dueDate: r.dueDate,
            paidDate: r.paidDate,
            itemCount: r._count.items,
            attachmentCount: r._count.attachments,
            uncVoucherNo: r.uncVoucherNo,
            createdAt: r.createdAt,
        })),
        total,
    }
}

export async function getPaymentRequestDetail(id: string) {
    const r = await prisma.paymentRequest.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true } },
            legalEntity: { select: { id: true, name: true, code: true, taxId: true, address: true, phone: true, bankName: true, bankAccountNumber: true } },
            supplier: { select: { id: true, name: true, code: true, taxId: true, bankAccountInfo: true } },
            po: { select: { id: true, poNo: true, totalAmount: true } },
            apInvoice: { select: { id: true, invoiceNo: true, amount: true, status: true } },
            proposal: { select: { id: true, proposalNo: true, title: true } },
            items: {
                include: {
                    category: { select: { id: true, code: true, name: true, defaultAccount: true } },
                },
                orderBy: { id: 'asc' },
            },
            attachments: {
                include: {
                    uploader: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
            },
            approvalLogs: {
                include: {
                    actor: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    })

    if (!r) return null

    // Refresh signed URLs for attachments so user can view/preview immediately
    const attachmentsWithUrls = await Promise.all(
        r.attachments.map(async (att) => {
            let activeUrl = att.fileUrl
            if (att.storagePath) {
                const presigned = await getPresignedDocUrl(att.storagePath, 3600)
                if (presigned) activeUrl = presigned
            }
            return {
                id: att.id,
                docType: att.docType,
                fileName: att.fileName,
                fileUrl: activeUrl,
                storagePath: att.storagePath,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
                uploadedByName: att.uploader.name || att.uploader.email,
                createdAt: att.createdAt,
            }
        })
    )

    return {
        id: r.id,
        requestNo: r.requestNo,
        title: r.title,
        category: r.category,
        priority: r.priority,
        status: r.status,
        currentLevel: r.currentLevel,
        currency: r.currency,
        exchangeRate: Number(r.exchangeRate),
        totalAmount: Number(r.totalAmount),
        totalAmountVND: Number(r.totalAmountVND),
        paidAmount: Number(r.paidAmount),
        paymentMethod: r.paymentMethod,
        dueDate: r.dueDate,
        paidDate: r.paidDate,
        beneficiaryName: r.beneficiaryName,
        beneficiaryAccount: r.beneficiaryAccount,
        beneficiaryBank: r.beneficiaryBank,
        legalEntity: r.legalEntity,
        department: r.department,
        creator: r.creator,
        supplier: r.supplier,
        po: r.po,
        apInvoice: r.apInvoice,
        proposal: r.proposal,
        notes: r.notes,
        rejectReason: r.rejectReason,
        uncVoucherNo: r.uncVoucherNo,
        uncFileUrl: r.uncFileUrl,
        items: r.items.map(i => ({
            id: i.id,
            categoryId: i.categoryId,
            categoryCode: i.category?.code || null,
            categoryName: i.category?.name || null,
            description: i.description,
            accountCode: i.accountCode,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            amount: Number(i.amount),
            vatAmount: Number(i.vatAmount),
            totalAmount: Number(i.totalAmount),
            invoiceNo: i.invoiceNo,
            invoiceDate: i.invoiceDate,
        })),
        attachments: attachmentsWithUrls,
        approvalLogs: r.approvalLogs.map(l => ({
            id: l.id,
            level: l.level,
            action: l.action,
            actorName: l.actor.name || l.actor.email,
            comment: l.comment,
            createdAt: l.createdAt,
        })),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
    }
}

export async function createPaymentRequest(input: {
    title: string
    category: PaymentCategory
    priority?: string
    currency?: string
    exchangeRate?: number
    dueDate?: string | null
    beneficiaryName: string
    beneficiaryAccount?: string | null
    beneficiaryBank?: string | null
    legalEntityId?: string | null
    departmentId?: string | null
    supplierId?: string | null
    poId?: string | null
    apInvoiceId?: string | null
    proposalId?: string | null
    notes?: string | null
    items: {
        categoryId?: string | null
        description: string
        accountCode?: string | null
        quantity: number
        unitPrice: number
        vatAmount?: number
        invoiceNo?: string | null
        invoiceDate?: string | null
    }[]
    attachments?: {
        docType: PaymentDocType
        fileName: string
        fileUrl: string
        storagePath: string
        fileSize: number
        mimeType: string
    }[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        if (!input.title || input.title.trim().length === 0) {
            return { success: false, error: 'Vui lòng nhập nội dung đề nghị thanh toán' }
        }

        if (!input.beneficiaryName || input.beneficiaryName.trim().length === 0) {
            return { success: false, error: 'Vui lòng nhập tên người/đơn vị thụ hưởng' }
        }

        if (!input.items || input.items.length === 0) {
            return { success: false, error: 'Vui lòng nhập ít nhất một khoản mục thanh toán' }
        }

        const exchangeRate = input.exchangeRate && input.exchangeRate > 0 ? input.exchangeRate : 1
        const currency = input.currency || 'VND'

        let totalAmount = 0
        const parsedItems = input.items.map(item => {
            const qty = Number(item.quantity) || 1
            const price = Number(item.unitPrice) || 0
            const amount = qty * price
            const vat = Number(item.vatAmount) || 0
            const lineTotal = amount + vat
            totalAmount += lineTotal

            return {
                categoryId: item.categoryId || null,
                description: item.description.trim(),
                accountCode: item.accountCode?.trim() || null,
                quantity: qty,
                unitPrice: price,
                amount,
                vatAmount: vat,
                totalAmount: lineTotal,
                invoiceNo: item.invoiceNo?.trim() || null,
                invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : null,
            }
        })

        const totalAmountVND = Math.round(totalAmount * exchangeRate)
        const requestNo = await generatePaymentRequestNo()

        const created = await prisma.paymentRequest.create({
            data: {
                requestNo,
                title: input.title.trim(),
                category: input.category,
                priority: (input.priority as any) || 'NORMAL',
                status: 'SUBMITTED',
                currentLevel: 1, // Start at Level 1 (Trưởng phòng)
                currency,
                exchangeRate,
                totalAmount,
                totalAmountVND,
                paidAmount: 0,
                dueDate: input.dueDate ? new Date(input.dueDate) : null,
                beneficiaryName: input.beneficiaryName.trim(),
                beneficiaryAccount: input.beneficiaryAccount?.trim() || null,
                beneficiaryBank: input.beneficiaryBank?.trim() || null,
                legalEntityId: input.legalEntityId || null,
                departmentId: input.departmentId || null,
                createdBy: user.id,
                supplierId: input.supplierId || null,
                poId: input.poId || null,
                apInvoiceId: input.apInvoiceId || null,
                proposalId: input.proposalId || null,
                notes: input.notes?.trim() || null,
                items: {
                    create: parsedItems,
                },
                attachments: input.attachments && input.attachments.length > 0 ? {
                    create: input.attachments.map(att => ({
                        docType: att.docType,
                        fileName: att.fileName,
                        fileUrl: att.fileUrl,
                        storagePath: att.storagePath,
                        fileSize: att.fileSize,
                        mimeType: att.mimeType,
                        uploadedBy: user.id,
                    })),
                } : undefined,
                approvalLogs: {
                    create: {
                        level: 1,
                        action: 'SUBMIT',
                        actorId: user.id,
                        comment: 'Khởi tạo đề nghị thanh toán',
                    },
                },
            },
        })

        // Notify manager / accountant
        try {
            await triggerNotificationForRole('TRUONG_PHONG', {
                title: `Đề nghị thanh toán mới: ${created.requestNo}`,
                content: `${user.name} đã gửi Đề nghị thanh toán "${created.title}" giá trị ${totalAmountVND.toLocaleString('vi-VN')} VND.`,
                type: 'info',
                link: `/dashboard/payment-requests?id=${created.id}`,
            })
        } catch (e) {
            console.warn('[PaymentRequest] Notification error:', e)
        }

        revalidatePath('/dashboard/payment-requests')
        revalidateCache('payment-requests')
        return { success: true, id: created.id }
    } catch (err: any) {
        console.error('[PaymentRequest] Create error:', err)
        return { success: false, error: err.message || 'Lỗi khi tạo đề nghị thanh toán' }
    }
}

export async function processPaymentApproval(input: {
    requestId: string
    action: 'APPROVE' | 'REJECT' | 'RETURN'
    comment?: string
}): Promise<{ success: boolean; newStatus?: PaymentRequestStatus; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const req = await prisma.paymentRequest.findUnique({
            where: { id: input.requestId },
            include: { creator: true },
        })
        if (!req) return { success: false, error: 'Không tìm thấy phiếu đề nghị' }

        if (['APPROVED', 'PAID', 'REJECTED', 'CANCELLED'].includes(req.status)) {
            return { success: false, error: `Phiếu đang ở trạng thái ${req.status}, không thể thao tác tiếp` }
        }

        const isCEO = hasRole(user, 'CEO', 'ADMIN', 'TRO_LY') || user.roles.some(r => ['CEO', 'ADMIN', 'GIAM_DOC'].includes(r.toUpperCase()))
        const isAccountant = hasRole(user, 'KE_TOAN', 'Kế Toán') || user.roles.some(r => ['KE_TOAN', 'ACCOUNTANT', 'CHIEF_ACCOUNTANT', 'KETOAN_TRUONG'].includes(r.toUpperCase()))
        const isManager = hasRole(user, 'SALES_MGR', 'Sales Manager') || user.roles.some(r => ['TRUONG_PHONG', 'MANAGER', 'DIRECTOR', 'CBO'].includes(r.toUpperCase()))

        if (!isCEO && !isAccountant && !isManager) {
            return { success: false, error: 'Bạn không có quyền thực hiện thao tác này trên đề nghị thanh toán' }
        }

        let newStatus: PaymentRequestStatus = req.status
        let nextLevel = req.currentLevel

        if (input.action === 'REJECT') {
            newStatus = 'REJECTED'
            await prisma.paymentRequest.update({
                where: { id: input.requestId },
                data: {
                    status: newStatus,
                    rejectReason: input.comment || 'Từ chối phê duyệt',
                },
            })
        } else if (input.action === 'RETURN') {
            newStatus = 'DRAFT'
            nextLevel = 0
            await prisma.paymentRequest.update({
                where: { id: input.requestId },
                data: {
                    status: newStatus,
                    currentLevel: nextLevel,
                    rejectReason: input.comment || 'Trả lại sửa thông tin',
                },
            })
        } else if (input.action === 'APPROVE') {
            if (req.currentLevel === 1) {
                // Manager approved -> move to Accountant
                if (!isManager && !isCEO) {
                    return { success: false, error: 'Chỉ Quản lý bộ phận hoặc Ban Giám Đốc mới có quyền duyệt Cấp 1' }
                }
                if (req.createdBy === user.id && !isCEO) {
                    return { success: false, error: 'Người tạo đề nghị không thể tự phê duyệt bước này' }
                }
                newStatus = 'REVIEWING_L2'
                nextLevel = 2
            } else if (req.currentLevel === 2) {
                // Accountant approved -> check threshold
                if (!isAccountant && !isCEO) {
                    return { success: false, error: 'Chỉ Kế toán hoặc Ban Giám Đốc mới có quyền duyệt Cấp 2' }
                }
                // If amount >= 20,000,000 VND -> must go to CEO
                const amountVND = Number(req.totalAmountVND)
                if (amountVND >= 20_000_000 && !isCEO) {
                    newStatus = 'REVIEWING_L2'
                    nextLevel = 3 // Waiting for CEO
                } else {
                    newStatus = 'APPROVED'
                    nextLevel = 3
                }
            } else if (req.currentLevel === 3) {
                // CEO approved
                if (!isCEO) {
                    return { success: false, error: 'Chỉ Ban Giám Đốc (CEO) mới có quyền duyệt Cấp 3' }
                }
                newStatus = 'APPROVED'
            }

            await prisma.paymentRequest.update({
                where: { id: input.requestId },
                data: {
                    status: newStatus,
                    currentLevel: nextLevel,
                    rejectReason: null,
                },
            })
        }

        // Log approval step
        await prisma.paymentApprovalLog.create({
            data: {
                requestId: input.requestId,
                level: req.currentLevel,
                action: input.action,
                actorId: user.id,
                comment: input.comment || (input.action === 'APPROVE' ? 'Đã phê duyệt' : 'Đã xử lý'),
            },
        })

        // Send notifications
        try {
            if (input.action === 'APPROVE' && newStatus === 'APPROVED') {
                await createNotification({
                    userId: req.createdBy,
                    title: `Đề nghị thanh toán ${req.requestNo} đã được duyệt!`,
                    content: `Khoản chi "${req.title}" đã được duyệt hoàn tất, đang chờ Kế toán xuất quỹ/chi tiền.`,
                    type: 'success',
                    link: `/dashboard/payment-requests?id=${req.id}`,
                })
            } else if (input.action === 'REJECT') {
                await createNotification({
                    userId: req.createdBy,
                    title: `Đề nghị thanh toán ${req.requestNo} bị từ chối`,
                    content: `Lý do: ${input.comment || 'Không đạt yêu cầu'}`,
                    type: 'warning',
                    link: `/dashboard/payment-requests?id=${req.id}`,
                })
            }
        } catch (e) {
            console.warn('[PaymentRequest] Approval notification error:', e)
        }

        revalidatePath('/dashboard/payment-requests')
        revalidateCache('payment-requests')
        return { success: true, newStatus }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi phê duyệt' }
    }
}

export async function settlePaymentRequest(input: {
    requestId: string
    paidAmount: number
    paymentMethod: any
    uncFileUrl?: string | null
    uncVoucherNo?: string | null
    notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const req = await prisma.paymentRequest.findUnique({
            where: { id: input.requestId },
            include: { apInvoice: true },
        })
        if (!req) return { success: false, error: 'Không tìm thấy phiếu đề nghị' }

        if (req.status !== 'APPROVED') {
            return { success: false, error: 'Chỉ có thể giải ngân phiếu đã được Ban Giám Đốc phê duyệt' }
        }

        const paidDate = new Date()

        await prisma.paymentRequest.update({
            where: { id: input.requestId },
            data: {
                status: 'PAID',
                paidAmount: input.paidAmount,
                paidDate,
                paymentMethod: input.paymentMethod || req.paymentMethod,
                uncFileUrl: input.uncFileUrl || null,
                uncVoucherNo: input.uncVoucherNo?.trim() || null,
                notes: input.notes ? `${req.notes || ''}\n${input.notes}`.trim() : req.notes,
            },
        })

        // If linked to an AP Invoice, auto-record payment
        if (req.apInvoiceId && req.apInvoice) {
            try {
                await prisma.aPPayment.create({
                    data: {
                        invoiceId: req.apInvoiceId,
                        amount: input.paidAmount,
                        method: input.paymentMethod || 'BANK_TRANSFER',
                        reference: input.uncVoucherNo || req.requestNo,
                        paidAt: paidDate,
                    },
                })

                // Check remaining
                const allPayments = await prisma.aPPayment.findMany({
                    where: { invoiceId: req.apInvoiceId },
                    select: { amount: true },
                })
                const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0)
                const invoiceAmount = Number(req.apInvoice.amount)

                const newInvoiceStatus = totalPaid >= invoiceAmount ? 'PAID' : 'PARTIALLY_PAID'
                await prisma.aPInvoice.update({
                    where: { id: req.apInvoiceId },
                    data: { status: newInvoiceStatus as any },
                })
            } catch (apErr) {
                console.warn('[PaymentRequest] Auto AP Payment record error:', apErr)
            }
        }

        // Log payment log
        await prisma.paymentApprovalLog.create({
            data: {
                requestId: input.requestId,
                level: 3,
                action: 'PAY',
                actorId: user.id,
                comment: `Đã chi tiền: ${input.paidAmount.toLocaleString('vi-VN')} VND. UNC: ${input.uncVoucherNo || 'N/A'}`,
            },
        })

        // Notify requester
        try {
            await createNotification({
                userId: req.createdBy,
                title: `Đề nghị thanh toán ${req.requestNo} đã được giải ngân!`,
                content: `Số tiền ${input.paidAmount.toLocaleString('vi-VN')} VND đã được Kế toán chuyển khoản thành công.`,
                type: 'success',
                link: `/dashboard/payment-requests?id=${req.id}`,
            })
        } catch (e) {
            console.warn('[PaymentRequest] Settlement notification error:', e)
        }

        revalidatePath('/dashboard/payment-requests')
        revalidatePath('/dashboard/finance')
        revalidateCache('payment-requests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi giải ngân phiếu' }
    }
}

export async function deletePaymentRequest(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const req = await prisma.paymentRequest.findUnique({
            where: { id },
            select: { status: true, createdBy: true },
        })
        if (!req) return { success: false, error: 'Không tìm thấy phiếu' }

        if (!['DRAFT', 'REJECTED', 'CANCELLED'].includes(req.status)) {
            return { success: false, error: 'Không thể xóa phiếu đã gửi duyệt hoặc đã thanh toán' }
        }

        await prisma.paymentRequest.delete({ where: { id } })
        revalidatePath('/dashboard/payment-requests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi xóa phiếu' }
    }
}

export async function getPaymentRequestStats() {
    const year = new Date().getFullYear()
    const [total, pending, approved, paid, sumPending, sumPaid] = await Promise.all([
        prisma.paymentRequest.count({
            where: { createdAt: { gte: new Date(year, 0, 1) } }
        }),
        prisma.paymentRequest.count({
            where: { status: { in: ['SUBMITTED', 'REVIEWING_L1', 'REVIEWING_L2'] } }
        }),
        prisma.paymentRequest.count({
            where: { status: 'APPROVED' }
        }),
        prisma.paymentRequest.count({
            where: { status: 'PAID', createdAt: { gte: new Date(year, 0, 1) } }
        }),
        prisma.paymentRequest.aggregate({
            where: { status: { in: ['SUBMITTED', 'REVIEWING_L1', 'REVIEWING_L2'] } },
            _sum: { totalAmountVND: true }
        }),
        prisma.paymentRequest.aggregate({
            where: { status: 'PAID', createdAt: { gte: new Date(year, 0, 1) } },
            _sum: { paidAmount: true }
        }),
    ])

    return {
        totalCount: total,
        pendingCount: pending,
        approvedCount: approved,
        paidCount: paid,
        totalPendingVND: Number(sumPending._sum.totalAmountVND) || 0,
        totalPaidVND: Number(sumPaid._sum.paidAmount) || 0,
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. SUPPLIER MASTER DATA & PENDING INVOICES / POs
// ═══════════════════════════════════════════════════════════════

export type SupplierMasterRow = {
    id: string
    code: string
    name: string
    type: string
    country: string
    taxId: string | null
    paymentTerm: string | null
    bankAccountInfo: string | null
    notes: string | null
    openPOCount: number
    unpaidInvoiceCount: number
    paymentRequestCount: number
    totalPaidVND: number
}

export async function getSuppliersMaster(): Promise<SupplierMasterRow[]> {
    const suppliers = await prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        include: {
            _count: {
                select: {
                    purchaseOrders: true,
                    apInvoices: true,
                    paymentRequests: true,
                }
            },
            paymentRequests: {
                where: { status: 'PAID' },
                select: { paidAmount: true }
            }
        },
        orderBy: { name: 'asc' },
    })

    return suppliers.map(s => {
        const totalPaid = s.paymentRequests.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0)
        return {
            id: s.id,
            code: s.code,
            name: s.name,
            type: s.type,
            country: s.country,
            taxId: s.taxId,
            paymentTerm: s.paymentTerm,
            bankAccountInfo: s.bankAccountInfo,
            notes: s.notes,
            openPOCount: s._count.purchaseOrders,
            unpaidInvoiceCount: s._count.apInvoices,
            paymentRequestCount: s._count.paymentRequests,
            totalPaidVND: totalPaid,
        }
    })
}

export async function getSupplierPendingInvoicesAndPOs(supplierId: string) {
    if (!supplierId) return { pos: [], invoices: [] }

    const [pos, invoices] = await Promise.all([
        prisma.purchaseOrder.findMany({
            where: {
                supplierId,
                status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
            },
            select: {
                id: true,
                poNo: true,
                totalAmount: true,
                currency: true,
                status: true,
                paymentTerm: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        prisma.aPInvoice.findMany({
            where: {
                supplierId,
                status: { not: 'PAID' },
            },
            select: {
                id: true,
                invoiceNo: true,
                amount: true,
                currency: true,
                dueDate: true,
                status: true,
                po: { select: { poNo: true } },
            },
            orderBy: { dueDate: 'asc' },
            take: 10,
        }),
    ])

    return {
        pos: pos.map((p: any) => ({
            id: p.id,
            poNo: p.poNo,
            totalAmount: Number(p.totalAmount || 0),
            currency: p.currency,
            status: p.status,
            paymentTerm: p.paymentTerm,
            createdAt: p.createdAt,
        })),
        invoices: invoices.map((i: any) => ({
            id: i.id,
            invoiceNo: i.invoiceNo,
            amount: Number(i.amount || 0),
            currency: i.currency,
            dueDate: i.dueDate,
            status: i.status,
            poNo: i.po?.poNo || null,
        })),
    }
}

export async function quickCreateSupplier(input: {
    name: string
    code?: string
    type?: string
    taxId?: string
    bankName?: string
    bankAccountNo?: string
    bankAccountName?: string
    phone?: string
    email?: string
    address?: string
    paymentTerm?: string
}): Promise<{ success: boolean; supplier?: any; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        let code = input.code?.trim().toUpperCase()
        if (!code) {
            const count = await prisma.supplier.count()
            code = `NCC-${String(count + 1).padStart(4, '0')}`
        }

        // Format bankAccountInfo string: "Ngân hàng: ..., STK: ..., Chủ TK: ..."
        let bankAccountInfo = ''
        if (input.bankAccountNo) {
            const parts: string[] = []
            if (input.bankName) parts.push(`NH: ${input.bankName.trim()}`)
            if (input.bankAccountNo) parts.push(`STK: ${input.bankAccountNo.trim()}`)
            if (input.bankAccountName) parts.push(`Chủ TK: ${input.bankAccountName.trim()}`)
            bankAccountInfo = parts.join(' - ')
        }

        const supplier = await prisma.supplier.create({
            data: {
                code,
                name: input.name.trim(),
                type: (input.type as any) || 'DISTRIBUTOR',
                country: 'Việt Nam',
                taxId: input.taxId?.trim() || null,
                paymentTerm: input.paymentTerm?.trim() || 'NET30',
                defaultCurrency: 'VND',
                bankAccountInfo: bankAccountInfo || null,
                contacts: (input.phone || input.email) ? {
                    create: {
                        name: input.name.trim(),
                        phone: input.phone?.trim() || null,
                        email: input.email?.trim() || null,
                        isPrimary: true,
                    }
                } : undefined,
                addresses: input.address ? {
                    create: {
                        label: 'Văn phòng chính',
                        address: input.address.trim(),
                        isDefault: true,
                    }
                } : undefined,
            },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                country: true,
                taxId: true,
                paymentTerm: true,
                bankAccountInfo: true,
                notes: true,
            }
        })

        revalidatePath('/dashboard/payment-requests')
        return { success: true, supplier }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi tạo nhà cung cấp' }
    }
}

export async function updateSupplierPaymentInfo(input: {
    id: string
    taxId?: string
    bankName?: string
    bankAccountNo?: string
    bankAccountName?: string
    paymentTerm?: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const parts: string[] = []
        if (input.bankName) parts.push(`NH: ${input.bankName.trim()}`)
        if (input.bankAccountNo) parts.push(`STK: ${input.bankAccountNo.trim()}`)
        if (input.bankAccountName) parts.push(`Chủ TK: ${input.bankAccountName.trim()}`)
        const bankAccountInfo = parts.join(' - ')

        await prisma.supplier.update({
            where: { id: input.id },
            data: {
                taxId: input.taxId?.trim() || undefined,
                bankAccountInfo: bankAccountInfo || undefined,
                paymentTerm: input.paymentTerm?.trim() || undefined,
                notes: input.notes?.trim() || undefined,
            }
        })

        revalidatePath('/dashboard/payment-requests')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi cập nhật thông tin nhà cung cấp' }
    }
}
