'use server'

import { prisma } from '@/lib/db'
import { requireAuth, hasRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { syncVnptInvoiceForOrder } from '../sales/actions-vnpt'
import { checkInvoiceDateDiscrepancy } from '@/lib/vnpt/date-utils'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

export type ReconciliationStatus = 'MATCHED' | 'MISSING_INVOICE' | 'PENDING_SIGN' | 'DISCREPANCY' | 'EXEMPT'

export interface ReconciliationRow {
    soId: string
    soNo: string
    orderDate: string
    customerName: string
    customerCode: string
    taxId: string
    legalEntityName: string
    legalEntityCode: string
    soStatus: string
    orderTotal: number
    orderNet?: number
    orderVat: number
    invoiceTotal: number | null
    invoiceNet?: number | null
    invoiceVat: number | null
    variance: number
    vatVariance?: number
    reconciliationStatus: ReconciliationStatus
    isInvoiceExempt: boolean
    invoiceId?: string
    invoiceNo?: string
    pattern?: string
    serial?: string
    taxAuthorityCode?: string
    taxStatus?: string
    taxStatusText?: string
    pdfUrl?: string
    viewUrl?: string
    discrepancyReason?: string
    dateWarning?: {
        hasWarning: boolean
        isDifferentMonth: boolean
        diffDays: number
        orderDateFormatted: string
        invoiceDateFormatted: string
        level: 'INFO' | 'WARNING' | 'DANGER'
        message: string
    }
}

export interface ReconciliationKpis {
    totalOrders: number
    totalOrderAmount: number
    matchedOrders: number
    matchedAmount: number
    missingOrders: number
    missingAmount: number
    pendingSignOrders: number
    pendingSignAmount: number
    discrepancyOrders: number
    discrepancyAmount: number
    exemptOrders: number
    exemptAmount: number
    coveragePct: number
}

export interface ReconciliationFilters {
    period?: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all' | 'custom'
    customFrom?: string
    customTo?: string
    legalEntityId?: string
    statusFilter?: 'ALL' | ReconciliationStatus
    search?: string
    page?: number
    pageSize?: number
}

function getDateRange(period: string = 'this_month', customFrom?: string, customTo?: string) {
    const now = new Date()
    let from: Date | undefined
    let to: Date | undefined

    if (period === 'this_month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1)
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (period === 'last_month') {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    } else if (period === 'this_quarter') {
        const qMonth = Math.floor(now.getMonth() / 3) * 3
        from = new Date(now.getFullYear(), qMonth, 1)
        to = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999)
    } else if (period === 'this_year') {
        from = new Date(now.getFullYear(), 0, 1)
        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    } else if (period === 'custom' && customFrom && customTo) {
        from = new Date(customFrom)
        to = new Date(customTo + 'T23:59:59.999Z')
    }

    return { from, to }
}

export async function getInvoiceReconciliationData(filters: ReconciliationFilters = {}): Promise<{
    success: boolean
    rows: ReconciliationRow[]
    total: number
    page: number
    pageSize: number
    kpis: ReconciliationKpis
    legalEntities: { id: string; code: string; name: string }[]
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:READ', 'FIN:READ')) {
            throw new Error('Bạn không có quyền truy cập màn hình kiểm soát hóa đơn.')
        }

        const {
            period = 'this_month',
            customFrom,
            customTo,
            legalEntityId,
            statusFilter = 'ALL',
            search = '',
            page = 1,
            pageSize = 25,
        } = filters

        const { from, to } = getDateRange(period, customFrom, customTo)

        // Query Legal Entities for dropdown
        const legalEntities = await prisma.legalEntity.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
        })

        // Build where clause for Sales Orders
        const whereClause: any = {
            status: { notIn: ['DRAFT', 'CANCELLED'] },
        }

        if (from && to) {
            whereClause.createdAt = {
                gte: from,
                lte: to,
            }
        }

        if (legalEntityId) {
            whereClause.legalEntityId = legalEntityId
        }

        // Fetch all matching orders in the period to calculate KPIs accurately
        const orders = await prisma.salesOrder.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        taxId: true,
                        vatCompanyName: true,
                        parent: {
                            select: {
                                id: true,
                                name: true,
                                taxId: true,
                                vatCompanyName: true,
                            },
                        },
                    },
                },
                legalEntity: { select: { id: true, code: true, name: true } },
                arInvoices: {
                    select: {
                        id: true,
                        invoiceNo: true,
                        amount: true,
                        vatAmount: true,
                        totalAmount: true,
                        status: true,
                        notes: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        let totalOrderAmount = 0
        let matchedOrders = 0
        let matchedAmount = 0
        let missingOrders = 0
        let missingAmount = 0
        let pendingSignOrders = 0
        let pendingSignAmount = 0
        let discrepancyOrders = 0
        let discrepancyAmount = 0
        let exemptOrders = 0
        let exemptAmount = 0

        const allRows: ReconciliationRow[] = []

        for (const so of orders) {
            const orderNet = Number(so.totalAmount || 0)
            const orderVat = Number(so.vatAmount || 0)
            const orderGross = Math.round(orderNet + orderVat)
            totalOrderAmount += orderGross

            // Prioritize published official invoices over draft invoices
            const publishedInvs = so.arInvoices.filter(i => !i.invoiceNo.startsWith('NHAP-') && i.status !== 'CANCELLED')
            const draftInvs = so.arInvoices.filter(i => i.invoiceNo.startsWith('NHAP-'))
            const targetInvs = publishedInvs.length > 0 ? publishedInvs : draftInvs

            const primaryInv = targetInvs[0] || so.arInvoices[0]

            let vnptMeta: any = null
            if (primaryInv?.notes) {
                try {
                    const parsed = JSON.parse(primaryInv.notes)
                    vnptMeta = parsed.vnpt || null
                } catch { }
            }

            const isExempt = Boolean(so.isInvoiceExempt)
            const hasInv = Boolean(primaryInv && primaryInv.invoiceNo)
            const isDraftInv = Boolean(primaryInv && (primaryInv.invoiceNo.startsWith('NHAP-') || vnptMeta?.status === 'DRAFT'))

            let invoiceNet: number | null = null
            let invoiceVat: number | null = null
            let invoiceTotal: number | null = null
            let variance = 0
            let vatVariance = 0
            let reconciliationStatus: ReconciliationStatus = 'MISSING_INVOICE'
            let discrepancyReason = ''

            if (targetInvs.length > 0) {
                invoiceNet = targetInvs.reduce((acc, i) => acc + Number(i.amount || 0), 0)
                invoiceVat = targetInvs.reduce((acc, i) => acc + Number(i.vatAmount || 0), 0)
                invoiceTotal = targetInvs.reduce((acc, i) => acc + Number(i.totalAmount || (Number(i.amount || 0) + Number(i.vatAmount || 0))), 0)
                variance = orderGross - invoiceTotal
                vatVariance = orderVat - invoiceVat
            }

            if (isExempt) {
                reconciliationStatus = 'EXEMPT'
                exemptOrders++
                exemptAmount += orderGross
            } else if (!hasInv) {
                reconciliationStatus = 'MISSING_INVOICE'
                missingOrders++
                missingAmount += orderGross
            } else if (isDraftInv) {
                reconciliationStatus = 'PENDING_SIGN'
                pendingSignOrders++
                pendingSignAmount += orderGross
            } else {
                // Check discrepancy: variance > 1000 VND OR vatVariance > 1000 VND
                const absDiff = Math.abs(variance)
                const absVatDiff = Math.abs(vatVariance)
                if (absDiff > 1000 || absVatDiff > 1000) {
                    reconciliationStatus = 'DISCREPANCY'
                    discrepancyOrders++
                    discrepancyAmount += orderGross
                    const reasons: string[] = []
                    if (absDiff > 1000) {
                        reasons.push(`Lệch tổng thanh toán: Đơn hàng (${orderGross.toLocaleString('vi-VN')} đ) vs HĐ (${(invoiceTotal || 0).toLocaleString('vi-VN')} đ) lệch ${absDiff.toLocaleString('vi-VN')} đ`)
                    }
                    if (absVatDiff > 1000) {
                        reasons.push(`Lệch thuế VAT: Thuế SO (${orderVat.toLocaleString('vi-VN')} đ) vs Thuế HĐ (${(invoiceVat || 0).toLocaleString('vi-VN')} đ) lệch ${absVatDiff.toLocaleString('vi-VN')} đ`)
                    }
                    discrepancyReason = reasons.join('; ')
                } else {
                    reconciliationStatus = 'MATCHED'
                    matchedOrders++
                    matchedAmount += orderGross
                }
            }

            // Customer taxId prioritized by parent
            const effectiveTaxId = so.customer.parent?.taxId || so.customer.taxId || 'Chưa cập nhật'
            const effectiveCustomerName = so.customer.parent?.vatCompanyName || so.customer.vatCompanyName || so.customer.name

            // Check date discrepancy under ND 123
            const dateWarning = checkInvoiceDateDiscrepancy(so.createdAt)

            allRows.push({
                soId: so.id,
                soNo: so.soNo,
                orderDate: so.createdAt.toISOString(),
                customerName: effectiveCustomerName,
                customerCode: so.customer.code,
                taxId: effectiveTaxId,
                legalEntityName: so.legalEntity?.name || 'Chưa gán',
                legalEntityCode: so.legalEntity?.code || '',
                soStatus: so.status,
                orderTotal: orderGross,
                orderNet,
                orderVat,
                invoiceTotal,
                invoiceNet,
                invoiceVat,
                variance,
                vatVariance,
                reconciliationStatus,
                isInvoiceExempt: isExempt,
                invoiceId: primaryInv?.id,
                invoiceNo: targetInvs.map(i => i.invoiceNo).join(', ') || primaryInv?.invoiceNo,
                pattern: vnptMeta?.pattern,
                serial: vnptMeta?.serial,
                taxAuthorityCode: vnptMeta?.taxAuthorityCode,
                taxStatus: vnptMeta?.taxStatus,
                taxStatusText: vnptMeta?.taxStatusText,
                pdfUrl: vnptMeta?.pdfUrl,
                viewUrl: vnptMeta?.viewUrl,
                discrepancyReason,
                dateWarning: dateWarning.hasWarning ? {
                    hasWarning: true,
                    isDifferentMonth: dateWarning.isDifferentMonth,
                    diffDays: dateWarning.diffDays,
                    orderDateFormatted: dateWarning.orderDateFormatted,
                    invoiceDateFormatted: dateWarning.invoiceDateFormatted,
                    level: dateWarning.level,
                    message: dateWarning.message,
                } : undefined,
            })
        }

        const totalOrders = orders.length
        const effectiveForCoverage = totalOrders - exemptOrders
        const coveragePct = effectiveForCoverage > 0 ? Math.round((matchedOrders / effectiveForCoverage) * 100) : 100

        const kpis: ReconciliationKpis = {
            totalOrders,
            totalOrderAmount,
            matchedOrders,
            matchedAmount,
            missingOrders,
            missingAmount,
            pendingSignOrders,
            pendingSignAmount,
            discrepancyOrders,
            discrepancyAmount,
            exemptOrders,
            exemptAmount,
            coveragePct,
        }

        // Apply Status Filter
        let filteredRows = allRows
        if (statusFilter !== 'ALL') {
            filteredRows = filteredRows.filter(r => r.reconciliationStatus === statusFilter)
        }

        // Apply Search
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            filteredRows = filteredRows.filter(r =>
                r.soNo.toLowerCase().includes(q) ||
                r.customerName.toLowerCase().includes(q) ||
                r.customerCode.toLowerCase().includes(q) ||
                r.taxId.toLowerCase().includes(q) ||
                (r.invoiceNo && r.invoiceNo.toLowerCase().includes(q)) ||
                (r.taxAuthorityCode && r.taxAuthorityCode.toLowerCase().includes(q))
            )
        }

        // Paginate
        const total = filteredRows.length
        const startIndex = (page - 1) * pageSize
        const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize)

        return {
            success: true,
            rows: paginatedRows,
            total,
            page,
            pageSize,
            kpis,
            legalEntities,
        }
    } catch (err: any) {
        return {
            success: false,
            rows: [],
            total: 0,
            page: 1,
            pageSize: 25,
            kpis: {
                totalOrders: 0,
                totalOrderAmount: 0,
                matchedOrders: 0,
                matchedAmount: 0,
                missingOrders: 0,
                missingAmount: 0,
                pendingSignOrders: 0,
                pendingSignAmount: 0,
                discrepancyOrders: 0,
                discrepancyAmount: 0,
                exemptOrders: 0,
                exemptAmount: 0,
                coveragePct: 0,
            },
            legalEntities: [],
            error: err.message,
        }
    }
}

/**
 * Đồng bộ hàng loạt toàn bộ đơn hàng đang chờ ký số từ VNPT
 */
export async function batchSyncPendingInvoices(soIds?: string[]): Promise<{
    success: boolean
    syncedCount: number
    stillDraftCount: number
    failedCount: number
    message: string
}> {
    const user = await requireAuth()
    if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:WRITE', 'FIN:WRITE')) {
        return { success: false, syncedCount: 0, stillDraftCount: 0, failedCount: 0, message: 'Bạn không có quyền thực hiện đồng bộ hóa đơn.' }
    }

    let targetSoIds = soIds

    if (!targetSoIds || targetSoIds.length === 0) {
        // Find all orders that currently have a draft VNPT invoice
        const draftInvoices = await prisma.aRInvoice.findMany({
            where: {
                OR: [
                    { invoiceNo: { startsWith: 'NHAP-' } },
                    { notes: { contains: '"status":"DRAFT"' } },
                ],
            },
            select: { soId: true },
        })
        targetSoIds = draftInvoices.map((i: { soId: string | null }) => i.soId).filter(Boolean) as string[]
    }

    if (targetSoIds.length === 0) {
        return {
            success: true,
            syncedCount: 0,
            stillDraftCount: 0,
            failedCount: 0,
            message: 'Không có đơn hàng nào đang ở trạng thái nháp cần đồng bộ từ VNPT.',
        }
    }

    let syncedCount = 0
    let stillDraftCount = 0
    let failedCount = 0

    // Concurrently process in chunks of 5
    const CHUNK_SIZE = 5
    for (let i = 0; i < targetSoIds.length; i += CHUNK_SIZE) {
        const chunk = targetSoIds.slice(i, i + CHUNK_SIZE)
        await Promise.all(
            chunk.map(async (soId) => {
                try {
                    const res = await syncVnptInvoiceForOrder(soId)
                    if (res.success) {
                        syncedCount++
                    } else if (res.isDraft) {
                        stillDraftCount++
                    } else {
                        failedCount++
                    }
                } catch {
                    failedCount++
                }
            })
        )
    }

    await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'ARInvoice',
        entityId: 'BATCH_SYNC',
        description: `Đồng bộ hàng loạt VNPT: ${syncedCount} đã cấp số, ${stillDraftCount} vẫn chờ ký, ${failedCount} lỗi.`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/finance')

    return {
        success: true,
        syncedCount,
        stillDraftCount,
        failedCount,
        message: `Đã quét ${targetSoIds.length} đơn: ${syncedCount} đơn đã ký số & cập nhật số HĐ thành công; ${stillDraftCount} đơn vẫn chờ ký trên cổng VNPT; ${failedCount} đơn gặp lỗi.`,
    }
}

/**
 * Gán thủ công một số hóa đơn VAT vào đơn hàng
 */
export async function manualLinkInvoiceToOrder(params: {
    soId: string
    invoiceNo: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:WRITE', 'FIN:WRITE')) {
            throw new Error('Bạn không có quyền gán số hóa đơn.')
        }

        const { soId, invoiceNo, notes } = params
        const trimmedInvNo = invoiceNo.trim()
        if (!trimmedInvNo) {
            return { success: false, error: 'Vui lòng nhập số hóa đơn VAT hợp lệ.' }
        }

        const so = await prisma.salesOrder.findUnique({
            where: { id: soId },
            include: { arInvoices: true, customer: true, legalEntity: true },
        })

        if (!so) {
            return { success: false, error: 'Không tìm thấy đơn hàng trong hệ thống.' }
        }

        const existingInv = so.arInvoices[0]
        const netAmount = Number(so.totalAmount || 0)
        const vatAmount = Number(so.vatAmount || 0)
        const totalAmount = Math.round(netAmount + vatAmount)

        if (existingInv) {
            await prisma.aRInvoice.update({
                where: { id: existingInv.id },
                data: {
                    invoiceNo: trimmedInvNo,
                    amount: Number(existingInv.amount || 0) > 0 ? existingInv.amount : netAmount,
                    vatAmount: Number(existingInv.vatAmount || 0) > 0 ? existingInv.vatAmount : vatAmount,
                    totalAmount: Number(existingInv.totalAmount || 0) > 0 ? existingInv.totalAmount : totalAmount,
                    notes: notes || existingInv.notes,
                },
            })
        } else {
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 30)

            await prisma.aRInvoice.create({
                data: {
                    invoiceNo: trimmedInvNo,
                    legalEntityId: so.legalEntityId || (await prisma.legalEntity.findFirst())!.id,
                    soId: so.id,
                    customerId: so.customerId,
                    amount: netAmount,
                    vatAmount: vatAmount,
                    totalAmount: totalAmount,
                    paidAmount: 0,
                    dueDate,
                    status: 'UNPAID',
                    notes: notes ? JSON.stringify({ manualLink: true, note: notes }) : null,
                },
            })
        }

        // Update SO status to INVOICED if not yet delivered
        if (so.status === 'CONFIRMED' || so.status === 'DELIVERED') {
            await prisma.salesOrder.update({
                where: { id: soId },
                data: { status: 'INVOICED' },
            })
        }

        await logAudit({
            userId: user.id,
            action: 'UPDATE',
            entityType: 'ARInvoice',
            entityId: so.id,
            description: `Gán thủ công số hóa đơn ${trimmedInvNo} cho đơn hàng ${so.soNo}`,
        })

        revalidateCache('sales')
        revalidatePath('/dashboard/finance')

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Xuất file Excel Báo Cáo Đối Chiếu Hóa Đơn Chuẩn Kế Toán
 */
export async function exportInvoiceReconciliationExcel(filters: ReconciliationFilters = {}): Promise<{
    success: boolean
    base64?: string
    filename?: string
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:READ', 'FIN:READ')) {
            throw new Error('Bạn không có quyền xuất báo cáo đối chiếu.')
        }

        // Fetch all rows without pagination
        const res = await getInvoiceReconciliationData({
            ...filters,
            page: 1,
            pageSize: 10000,
        })

        if (!res.success) {
            return { success: false, error: res.error }
        }

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'Wine ERP - Ly\'s Cellar'
        workbook.created = new Date()

        // ── Sheet 1: Tổng Hợp Đối Chiếu ──
        const sumSheet = workbook.addWorksheet('Tổng Hợp Đối Chiếu', {
            views: [{ showGridLines: true }],
        })

        sumSheet.columns = [
            { width: 32 },
            { width: 20 },
            { width: 25 },
            { width: 25 },
        ]

        sumSheet.addRow(['BÁO CÁO TỔNG HỢP ĐỐI CHIẾU HÓA ĐƠN ĐIỆN TỬ VNPT VS ERP']).font = { bold: true, size: 14 }
        sumSheet.addRow([`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`]).font = { italic: true, size: 10 }
        sumSheet.addRow([])

        const kpis = res.kpis
        const summaryRows = [
            ['Chỉ Tiêu', 'Số Lượng Đơn', 'Giá Trị Đơn Hàng (VNĐ)', 'Tỷ Lệ / Ghi Chú'],
            ['Tổng đơn hàng phát sinh trong kỳ', kpis.totalOrders, kpis.totalOrderAmount, '100%'],
            ['Đã khớp hóa đơn chính thức (VNPT)', kpis.matchedOrders, kpis.matchedAmount, `${kpis.coveragePct}% Độ phủ hóa đơn`],
            ['Đơn hàng chưa có hóa đơn (Cần xuất)', kpis.missingOrders, kpis.missingAmount, 'Chưa lập HĐ VAT'],
            ['Đơn hàng đang chờ ký số trên VNPT', kpis.pendingSignOrders, kpis.pendingSignAmount, 'Đã đẩy nháp lên portal'],
            ['Đơn hàng lệch tiền / thuế với HĐ', kpis.discrepancyOrders, kpis.discrepancyAmount, 'Chênh lệch > 1.000đ'],
            ['Đơn hàng miễn xuất hóa đơn VAT', kpis.exemptOrders, kpis.exemptAmount, 'isInvoiceExempt = TRUE'],
        ]

        summaryRows.forEach((r, idx) => {
            const row = sumSheet.addRow(r)
            if (idx === 0) {
                row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
                row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF142433' } }
            } else {
                row.getCell(2).numFmt = '#,##0'
                row.getCell(3).numFmt = '#,##0'
            }
        })

        // ── Sheet 2: Chi Tiết Đối Chiếu ──
        const detSheet = workbook.addWorksheet('Chi Tiết Đối Chiếu', {
            views: [{ showGridLines: true }],
        })

        detSheet.columns = [
            { header: 'STT', width: 6 },
            { header: 'Mã Đơn (SO)', width: 16 },
            { header: 'Ngày Đơn', width: 14 },
            { header: 'Tên Khách Hàng / Công Ty Mẹ', width: 35 },
            { header: 'Mã Số Thuế', width: 16 },
            { header: 'Pháp Nhân Bán', width: 14 },
            { header: 'Giá Trị Đơn (VNĐ)', width: 18 },
            { header: 'Tiền Thuế VAT (VNĐ)', width: 16 },
            { header: 'Giá Trị HĐ (VNĐ)', width: 18 },
            { header: 'Chênh Lệch (VNĐ)', width: 16 },
            { header: 'Trạng Thái Đối Chiếu', width: 22 },
            { header: 'Số Hóa Đơn VAT', width: 22 },
            { header: 'Mã Cơ Quan Thuế', width: 34 },
            { header: 'Ghi Chú / Lý Do Lệch', width: 35 },
        ]

        const headerRow = detSheet.getRow(1)
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2E3D' } }

        const STATUS_VN: Record<ReconciliationStatus, string> = {
            MATCHED: 'Đã Khớp (VNPT Đã Ký)',
            MISSING_INVOICE: 'Thiếu HĐ (Cần Xuất)',
            PENDING_SIGN: 'Chờ Ký Số (Bản Nháp)',
            DISCREPANCY: 'Lệch Tiền / Thuế',
            EXEMPT: 'Miễn Xuất HĐ',
        }

        res.rows.forEach((r, idx) => {
            const row = detSheet.addRow([
                idx + 1,
                r.soNo,
                new Date(r.orderDate).toLocaleDateString('vi-VN'),
                r.customerName,
                r.taxId,
                r.legalEntityCode,
                r.orderTotal,
                r.orderVat,
                r.invoiceTotal ?? 0,
                r.variance,
                STATUS_VN[r.reconciliationStatus] || r.reconciliationStatus,
                r.invoiceNo || 'Chưa có',
                r.taxAuthorityCode || 'Chưa cấp',
                r.discrepancyReason || (r.isInvoiceExempt ? 'Đánh dấu miễn HĐ' : ''),
            ])

            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '#,##0'
            row.getCell(9).numFmt = '#,##0'
            row.getCell(10).numFmt = '#,##0'

            // Color status cell
            const statusCell = row.getCell(11)
            if (r.reconciliationStatus === 'MATCHED') {
                statusCell.font = { color: { argb: 'FF16A34A' }, bold: true }
            } else if (r.reconciliationStatus === 'MISSING_INVOICE') {
                statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }
            } else if (r.reconciliationStatus === 'PENDING_SIGN') {
                statusCell.font = { color: { argb: 'FFD97706' }, bold: true }
            } else if (r.reconciliationStatus === 'DISCREPANCY') {
                statusCell.font = { color: { argb: 'FFEA580C' }, bold: true }
            } else if (r.reconciliationStatus === 'EXEMPT') {
                statusCell.font = { color: { argb: 'FF64748B' } }
            }
        })

        const buffer = await workbook.xlsx.writeBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const filename = `Doi_Chieu_Hoa_Don_VNPT_${new Date().toISOString().split('T')[0]}.xlsx`

        return {
            success: true,
            base64,
            filename,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ============================================================================
// VNPT INVOICES REGISTRY & REVERSE RECONCILIATION (VNPT -> ERP)
// ============================================================================

export type VnptAssignmentStatus = 'ALL' | 'UNASSIGNED' | 'ASSIGNED' | 'SPECIAL'

export interface VnptInvoiceRegistryItem {
    invNo: string
    fullInvoiceNo: string
    pattern: string
    serial: string
    entityCode: 'TA' | 'LC'
    issueDate: string
    buyerName: string
    buyerTaxId: string
    buyerAddress?: string
    totalNet: number
    totalVat: number
    totalGross: number
    note?: string
    itemCount: number
    isAssigned: boolean
    isSpecial: boolean
    specialType?: 'ADJUSTMENT' | 'INTERNAL_TRANSFER' | 'OTHER'
    linkedSoId?: string
    linkedSoNo?: string
    linkedCustomerName?: string
    linkedCustomerTaxId?: string
    linkedSoGross?: number
    variance?: number
}

export interface VnptRegistryKpis {
    totalInvoices: number
    totalAmount: number
    assignedCount: number
    assignedAmount: number
    unassignedCount: number
    unassignedAmount: number
    specialCount: number
    specialAmount: number
}

export interface VnptRegistryFilters {
    entityCode?: 'ALL' | 'TA' | 'LC'
    statusFilter?: VnptAssignmentStatus
    search?: string
    page?: number
    pageSize?: number
}

function getInvoiceDirectories(): string[] {
    const candidates = [
        path.join(process.cwd(), 'data', 'invoices'),
        path.join(process.cwd(), 'wine-erp', 'data', 'invoices'),
        path.join(process.cwd(), 'public', 'invoices'),
        path.join(process.cwd(), 'invoice'),
        path.join(process.cwd(), '..', 'invoice'),
    ]
    return candidates.filter(p => {
        try {
            return fs.existsSync(p)
        } catch {
            return false
        }
    })
}

function parseVnptWorkbook(workbook: ExcelJS.Workbook, filename: string): VnptInvoiceRegistryItem[] {
    const ws = workbook.worksheets[0]
    if (!ws) return []

    let defaultEntity: 'TA' | 'LC' = 'TA'
    const upperName = filename.toUpperCase()
    if (upperName.includes('C26TLY') || upperName.includes('0109902863') || upperName.includes('LYS') || upperName.includes('LC')) {
        defaultEntity = 'LC'
    }

    const invoices = new Map<string, VnptInvoiceRegistryItem>()

    let startRow = 12
    for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
        const val = String(ws.getRow(r).getCell(5).value || '')
        if (val.includes('Số hóa đơn') || val.includes('Số hoá đơn')) {
            startRow = r + 1
            break
        }
    }

    for (let r = startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const invNoRaw = String(row.getCell(5).value || '').trim()
        if (!invNoRaw || invNoRaw === 'Tổng' || invNoRaw.toLowerCase().includes('tổng')) continue

        const formattedInvNo = !isNaN(Number(invNoRaw)) ? String(invNoRaw).padStart(8, '0') : invNoRaw
        const pattern = String(row.getCell(3).value || '1/001').trim()
        const serial = String(row.getCell(4).value || (defaultEntity === 'LC' ? 'C26TLY' : 'C26TTA')).trim()
        const entityCode: 'TA' | 'LC' = serial.includes('TLY') || defaultEntity === 'LC' ? 'LC' : 'TA'
        const issueDate = String(row.getCell(6).value || '').trim()
        const company = String(row.getCell(8).value || '').trim()
        const buyer = String(row.getCell(10).value || '').trim()
        const taxId = String(row.getCell(11).value || '').trim()
        const address = String(row.getCell(12).value || '').trim()

        const totalGross = Number(String(row.getCell(24).value || 0).replace(/,/g, ''))
        const totalNet = Number(String(row.getCell(22).value || 0).replace(/,/g, ''))
        const totalVat = Number(String(row.getCell(23).value || 0).replace(/,/g, ''))
        const note = String(row.getCell(26).value || '').trim()

        const key = `${entityCode}_${formattedInvNo}`
        if (!invoices.has(key)) {
            invoices.set(key, {
                invNo: formattedInvNo,
                fullInvoiceNo: `${serial}-${formattedInvNo}`,
                pattern,
                serial,
                entityCode,
                issueDate,
                buyerName: company || buyer || 'Khách lẻ',
                buyerTaxId: taxId,
                buyerAddress: address,
                totalNet,
                totalVat,
                totalGross,
                note,
                itemCount: 0,
                isAssigned: false,
                isSpecial: false,
            })
        }

        const item = invoices.get(key)!
        item.itemCount += 1
    }

    return Array.from(invoices.values())
}

async function loadAllVnptInvoicesFromDisk(): Promise<VnptInvoiceRegistryItem[]> {
    const dirs = getInvoiceDirectories()
    const allInvoicesMap = new Map<string, VnptInvoiceRegistryItem>()

    for (const dir of dirs) {
        try {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
            for (const file of files) {
                const filePath = path.join(dir, file)
                const wb = new ExcelJS.Workbook()
                await wb.xlsx.readFile(filePath)
                const items = parseVnptWorkbook(wb, file)
                for (const item of items) {
                    const key = `${item.entityCode}_${item.invNo}`
                    if (!allInvoicesMap.has(key)) {
                        allInvoicesMap.set(key, item)
                    }
                }
            }
        } catch (e) {
            console.error('Error reading invoice directory:', dir, e)
        }
    }

    return Array.from(allInvoicesMap.values())
}

/**
 * Lấy danh sách toàn bộ hóa đơn từ VNPT và ánh xạ trạng thái gán đơn hàng ERP
 */
export async function getVnptInvoicesRegistry(filters: VnptRegistryFilters = {}): Promise<{
    success: boolean
    items: VnptInvoiceRegistryItem[]
    total: number
    page: number
    pageSize: number
    kpis: VnptRegistryKpis
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:READ', 'FIN:READ')) {
            throw new Error('Bạn không có quyền xem danh sách hóa đơn VNPT.')
        }

        const {
            entityCode = 'ALL',
            statusFilter = 'ALL',
            search = '',
            page = 1,
            pageSize = 25,
        } = filters

        // 1. Load VNPT invoices from stored Excel files
        const vnptItems = await loadAllVnptInvoicesFromDisk()

        // 2. Fetch all AR Invoices from DB with SO & Customer
        const arInvoices = await prisma.aRInvoice.findMany({
            where: {
                status: { not: 'CANCELLED' },
            },
            include: {
                so: {
                    select: {
                        id: true,
                        soNo: true,
                        status: true,
                        totalAmount: true,
                        vatAmount: true,
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                taxId: true,
                                vatCompanyName: true,
                                parent: {
                                    select: {
                                        id: true,
                                        name: true,
                                        taxId: true,
                                        vatCompanyName: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        // Build fast lookup map: invoiceNo -> AR Invoice record
        const arMap = new Map<string, (typeof arInvoices)[0]>()
        for (const ar of arInvoices) {
            const rawNo = ar.invoiceNo.trim()
            arMap.set(rawNo, ar)
            if (!isNaN(Number(rawNo))) {
                arMap.set(String(rawNo).padStart(8, '0'), ar)
                arMap.set(String(parseInt(rawNo, 10)), ar)
            }
        }

        let totalAmount = 0
        let assignedCount = 0
        let assignedAmount = 0
        let unassignedCount = 0
        let unassignedAmount = 0
        let specialCount = 0
        let specialAmount = 0

        const processedItems: VnptInvoiceRegistryItem[] = []

        for (const item of vnptItems) {
            totalAmount += item.totalGross

            const matchedAr = arMap.get(item.invNo) || arMap.get(String(parseInt(item.invNo, 10)))

            if (matchedAr && matchedAr.so) {
                const so = matchedAr.so
                const soGross = Math.round(Number(so.totalAmount || 0) + Number(so.vatAmount || 0))
                const effCustName = so.customer?.parent?.vatCompanyName || so.customer?.parent?.name || so.customer?.vatCompanyName || so.customer?.name || 'Chưa cập nhật'
                const effTaxId = so.customer?.parent?.taxId || so.customer?.taxId || ''

                item.isAssigned = true
                item.isSpecial = false
                item.linkedSoId = so.id
                item.linkedSoNo = so.soNo
                item.linkedCustomerName = effCustName
                item.linkedCustomerTaxId = effTaxId
                item.linkedSoGross = soGross
                item.variance = soGross - item.totalGross

                assignedCount++
                assignedAmount += item.totalGross
            } else {
                item.isAssigned = false

                const isNeg = item.totalGross < 0 || (item.note && item.note.toLowerCase().includes('điều chỉnh'))
                const isInternalTransfer = item.buyerName.toUpperCase().includes("LY'S") || item.buyerTaxId === '0109902863'

                if (isNeg) {
                    item.isSpecial = true
                    item.specialType = 'ADJUSTMENT'
                    specialCount++
                    specialAmount += item.totalGross
                } else if (isInternalTransfer) {
                    item.isSpecial = true
                    item.specialType = 'INTERNAL_TRANSFER'
                    specialCount++
                    specialAmount += item.totalGross
                } else {
                    item.isSpecial = false
                    unassignedCount++
                    unassignedAmount += item.totalGross
                }
            }

            processedItems.push(item)
        }

        const kpis: VnptRegistryKpis = {
            totalInvoices: processedItems.length,
            totalAmount,
            assignedCount,
            assignedAmount,
            unassignedCount,
            unassignedAmount,
            specialCount,
            specialAmount,
        }

        // Apply Entity Filter
        let filtered = processedItems
        if (entityCode !== 'ALL') {
            filtered = filtered.filter(i => i.entityCode === entityCode)
        }

        // Apply Status Filter
        if (statusFilter === 'UNASSIGNED') {
            filtered = filtered.filter(i => !i.isAssigned && !i.isSpecial)
        } else if (statusFilter === 'ASSIGNED') {
            filtered = filtered.filter(i => i.isAssigned)
        } else if (statusFilter === 'SPECIAL') {
            filtered = filtered.filter(i => i.isSpecial)
        }

        // Apply Search
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            filtered = filtered.filter(i =>
                i.invNo.toLowerCase().includes(q) ||
                i.buyerName.toLowerCase().includes(q) ||
                i.buyerTaxId.toLowerCase().includes(q) ||
                (i.note && i.note.toLowerCase().includes(q)) ||
                (i.linkedSoNo && i.linkedSoNo.toLowerCase().includes(q)) ||
                (i.linkedCustomerName && i.linkedCustomerName.toLowerCase().includes(q))
            )
        }

        // Sort: Unassigned first, then by invoice number descending
        filtered.sort((a, b) => {
            if (!a.isAssigned && !a.isSpecial && (b.isAssigned || b.isSpecial)) return -1
            if ((a.isAssigned || a.isSpecial) && !b.isAssigned && !b.isSpecial) return 1
            return b.invNo.localeCompare(a.invNo)
        })

        const total = filtered.length
        const startIndex = (page - 1) * pageSize
        const paginatedItems = filtered.slice(startIndex, startIndex + pageSize)

        return {
            success: true,
            items: paginatedItems,
            total,
            page,
            pageSize,
            kpis,
        }
    } catch (err: any) {
        return {
            success: false,
            items: [],
            total: 0,
            page: 1,
            pageSize: 25,
            kpis: {
                totalInvoices: 0,
                totalAmount: 0,
                assignedCount: 0,
                assignedAmount: 0,
                unassignedCount: 0,
                unassignedAmount: 0,
                specialCount: 0,
                specialAmount: 0,
            },
            error: err.message,
        }
    }
}

/**
 * Tải lên file Excel xuất từ portal VNPT (định dạng 01GTGT_DetailProduct_...xlsx)
 */
export async function uploadVnptMonthlyExcel(formData: FormData): Promise<{
    success: boolean
    count?: number
    message?: string
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:WRITE', 'FIN:WRITE')) {
            throw new Error('Bạn không có quyền tải lên dữ liệu hóa đơn VNPT.')
        }

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'Vui lòng chọn file Excel VNPT hợp lệ.' }
        }

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            return { success: false, error: 'Chỉ chấp nhận file định dạng Excel (.xlsx hoặc .xls).' }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Parse test to verify it's a valid VNPT export
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buffer as any)
        const items = parseVnptWorkbook(wb, file.name)

        if (items.length === 0) {
            return {
                success: false,
                error: 'File không chứa dòng hóa đơn VNPT nào hợp lệ. Vui lòng kiểm tra lại cấu trúc file xuất từ portal VNPT.',
            }
        }

        // Save to data/invoices/
        const targetDir = path.join(process.cwd(), 'data', 'invoices')
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
        }

        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const targetPath = path.join(targetDir, sanitizedFileName)
        fs.writeFileSync(targetPath, buffer)

        await logAudit({
            userId: user.id,
            action: 'CREATE',
            entityType: 'VNPT_INVOICE_IMPORT',
            entityId: sanitizedFileName,
            description: `Tải lên file hóa đơn VNPT ${sanitizedFileName}: tìm thấy ${items.length} hóa đơn.`,
        })

        revalidateCache('sales')
        revalidatePath('/dashboard/finance')

        return {
            success: true,
            count: items.length,
            message: `Tải lên thành công! Đã nạp ${items.length} hóa đơn VNPT từ file ${sanitizedFileName}.`,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Tìm kiếm đơn hàng ERP để gán thủ công vào hóa đơn VNPT
 */
export async function searchSalesOrdersForLinking(params: {
    query?: string
    entityCode?: string
}): Promise<{
    success: boolean
    orders: {
        id: string
        soNo: string
        orderDate: string
        customerName: string
        customerTaxId: string
        legalEntityCode: string
        grossAmount: number
        status: string
        currentInvoiceNo?: string
    }[]
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:READ', 'FIN:READ')) {
            throw new Error('Bạn không có quyền tìm kiếm đơn hàng.')
        }

        const { query = '', entityCode } = params
        const q = query.trim()

        const whereClause: any = {
            status: { notIn: ['DRAFT', 'CANCELLED'] },
        }

        if (q) {
            whereClause.OR = [
                { soNo: { contains: q, mode: 'insensitive' } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
                { customer: { taxId: { contains: q, mode: 'insensitive' } } },
                { customer: { vatCompanyName: { contains: q, mode: 'insensitive' } } },
            ]
        }

        if (entityCode && entityCode !== 'ALL') {
            whereClause.legalEntity = { code: entityCode }
        }

        const orders = await prisma.salesOrder.findMany({
            where: whereClause,
            include: {
                customer: {
                    select: {
                        name: true,
                        taxId: true,
                        vatCompanyName: true,
                        parent: { select: { name: true, taxId: true, vatCompanyName: true } }
                    }
                },
                legalEntity: { select: { code: true } },
                arInvoices: { select: { invoiceNo: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
        })

        const formatted = orders.map(o => {
            const net = Number(o.totalAmount || 0)
            const vat = Number(o.vatAmount || 0)
            const gross = Math.round(net + vat)
            const custName = o.customer?.parent?.vatCompanyName || o.customer?.parent?.name || o.customer?.vatCompanyName || o.customer?.name || 'Khách lẻ'
            const custTax = o.customer?.parent?.taxId || o.customer?.taxId || ''
            const primaryInv = o.arInvoices[0]?.invoiceNo

            return {
                id: o.id,
                soNo: o.soNo,
                orderDate: o.createdAt.toISOString(),
                customerName: custName,
                customerTaxId: custTax,
                legalEntityCode: o.legalEntity?.code || '',
                grossAmount: gross,
                status: o.status,
                currentInvoiceNo: primaryInv,
            }
        })

        return { success: true, orders: formatted }
    } catch (err: any) {
        return { success: false, orders: [], error: err.message }
    }
}

/**
 * Hủy gán số hóa đơn khỏi đơn hàng ERP
 */
export async function unlinkVnptInvoiceFromOrder(params: {
    soId: string
    invoiceNo: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:WRITE', 'FIN:WRITE')) {
            throw new Error('Bạn không có quyền hủy gán hóa đơn.')
        }

        const { soId, invoiceNo } = params

        await prisma.aRInvoice.deleteMany({
            where: {
                soId,
                invoiceNo: { in: [invoiceNo, invoiceNo.padStart(8, '0'), String(parseInt(invoiceNo, 10))] },
            }
        })

        await logAudit({
            userId: user.id,
            action: 'DELETE',
            entityType: 'ARInvoice',
            entityId: soId,
            description: `Hủy gán số hóa đơn ${invoiceNo} khỏi đơn hàng ID ${soId}`,
        })

        revalidateCache('sales')
        revalidatePath('/dashboard/finance')

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Xuất file Excel Danh Sách Hóa Đơn VNPT & Trạng Thái Gán
 */
export async function exportVnptRegistryExcel(filters: VnptRegistryFilters = {}): Promise<{
    success: boolean
    base64?: string
    filename?: string
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'TAX:READ', 'FIN:READ')) {
            throw new Error('Bạn không có quyền xuất danh sách hóa đơn VNPT.')
        }

        const res = await getVnptInvoicesRegistry({
            ...filters,
            page: 1,
            pageSize: 10000,
        })

        if (!res.success) {
            return { success: false, error: res.error }
        }

        const workbook = new ExcelJS.Workbook()
        workbook.creator = "Wine ERP - Ly's Cellar"
        workbook.created = new Date()

        const sheet = workbook.addWorksheet('Danh Sách HĐ VNPT', {
            views: [{ showGridLines: true }],
        })

        sheet.columns = [
            { header: 'STT', width: 6 },
            { header: 'Số HĐ', width: 14 },
            { header: 'Ký Hiệu', width: 12 },
            { header: 'Mẫu Số', width: 10 },
            { header: 'Pháp Nhân', width: 12 },
            { header: 'Ngày Lập', width: 14 },
            { header: 'Tên Đơn Vị Mua / Khách Hàng', width: 35 },
            { header: 'Mã Số Thuế', width: 16 },
            { header: 'Doanh Thu Trước Thuế', width: 20 },
            { header: 'Tiền Thuế VAT', width: 16 },
            { header: 'Tổng Thanh Toán (Gross)', width: 22 },
            { header: 'Ghi Chú Trên HĐ', width: 30 },
            { header: 'Trạng Thái Gán', width: 20 },
            { header: 'Mã Đơn ERP (SO)', width: 16 },
            { header: 'Khách Hàng Trên ERP', width: 35 },
            { header: 'Tổng Tiền Đơn ERP', width: 18 },
            { header: 'Chênh Lệch (VNĐ)', width: 16 },
        ]

        const headerRow = sheet.getRow(1)
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF142433' } }

        res.items.forEach((item, idx) => {
            let statusText = 'Chưa Gán Đơn'
            if (item.isAssigned) statusText = 'Đã Gán Đơn'
            else if (item.specialType === 'ADJUSTMENT') statusText = 'HĐ Điều Chỉnh Giảm'
            else if (item.specialType === 'INTERNAL_TRANSFER') statusText = 'Điều Chuyển Nội Bộ'

            const row = sheet.addRow([
                idx + 1,
                item.invNo,
                item.serial,
                item.pattern,
                item.entityCode === 'TA' ? 'Thắng Ân' : "Ly's Cellar",
                item.issueDate,
                item.buyerName,
                item.buyerTaxId,
                item.totalNet,
                item.totalVat,
                item.totalGross,
                item.note || '',
                statusText,
                item.linkedSoNo || '',
                item.linkedCustomerName || '',
                item.linkedSoGross ?? '',
                item.variance ?? '',
            ])

            row.getCell(9).numFmt = '#,##0'
            row.getCell(10).numFmt = '#,##0'
            row.getCell(11).numFmt = '#,##0'
            if (item.linkedSoGross) row.getCell(16).numFmt = '#,##0'
            if (item.variance !== undefined) row.getCell(17).numFmt = '#,##0'

            const statusCell = row.getCell(13)
            if (item.isAssigned) {
                statusCell.font = { color: { argb: 'FF16A34A' }, bold: true }
            } else if (item.isSpecial) {
                statusCell.font = { color: { argb: 'FF64748B' } }
            } else {
                statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }
            }
        })

        const buffer = await workbook.xlsx.writeBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const filename = `Bang_Ke_Hoa_Don_VNPT_${new Date().toISOString().split('T')[0]}.xlsx`

        return {
            success: true,
            base64,
            filename,
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

