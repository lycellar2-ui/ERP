'use server'

import { prisma } from '@/lib/db'
import { requireAuth, hasRole } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { syncVnptInvoiceForOrder } from '../sales/actions-vnpt'
import ExcelJS from 'exceljs'

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
    orderVat: number
    invoiceTotal: number | null
    invoiceVat: number | null
    variance: number
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
            const orderTotal = Number(so.totalAmount)
            const orderVat = Number(so.vatAmount || 0)
            totalOrderAmount += orderTotal

            const inv = so.arInvoices[0]
            let vnptMeta: any = null
            if (inv?.notes) {
                try {
                    const parsed = JSON.parse(inv.notes)
                    vnptMeta = parsed.vnpt || null
                } catch { }
            }

            const isExempt = Boolean(so.isInvoiceExempt)
            const hasInv = Boolean(inv && inv.invoiceNo)
            const isDraftInv = Boolean(inv && inv.invoiceNo.startsWith('NHAP-'))

            let invoiceTotal: number | null = null
            let invoiceVat: number | null = null
            let variance = 0
            let reconciliationStatus: ReconciliationStatus = 'MISSING_INVOICE'
            let discrepancyReason = ''

            if (inv) {
                invoiceTotal = Number(inv.totalAmount || inv.amount || 0)
                invoiceVat = Number(inv.vatAmount || 0)
                variance = orderTotal - invoiceTotal
            }

            if (isExempt) {
                reconciliationStatus = 'EXEMPT'
                exemptOrders++
                exemptAmount += orderTotal
            } else if (!hasInv) {
                reconciliationStatus = 'MISSING_INVOICE'
                missingOrders++
                missingAmount += orderTotal
            } else if (isDraftInv || vnptMeta?.status === 'DRAFT') {
                reconciliationStatus = 'PENDING_SIGN'
                pendingSignOrders++
                pendingSignAmount += orderTotal
            } else {
                // Check discrepancy: variance > 1000 VND
                const absDiff = Math.abs(variance)
                if (absDiff > 1000) {
                    reconciliationStatus = 'DISCREPANCY'
                    discrepancyOrders++
                    discrepancyAmount += orderTotal
                    discrepancyReason = `Lệch tổng tiền: Đơn hàng (${orderTotal.toLocaleString('vi-VN')} đ) vs HĐ (${(invoiceTotal || 0).toLocaleString('vi-VN')} đ) lệch ${absDiff.toLocaleString('vi-VN')} đ`
                } else {
                    reconciliationStatus = 'MATCHED'
                    matchedOrders++
                    matchedAmount += orderTotal
                }
            }

            // Customer taxId prioritized by parent
            const effectiveTaxId = so.customer.parent?.taxId || so.customer.taxId || 'Chưa cập nhật'
            const effectiveCustomerName = so.customer.parent?.vatCompanyName || so.customer.vatCompanyName || so.customer.name

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
                orderTotal,
                orderVat,
                invoiceTotal,
                invoiceVat,
                variance,
                reconciliationStatus,
                isInvoiceExempt: isExempt,
                invoiceId: inv?.id,
                invoiceNo: inv?.invoiceNo,
                pattern: vnptMeta?.pattern,
                serial: vnptMeta?.serial,
                taxAuthorityCode: vnptMeta?.taxAuthorityCode,
                taxStatus: vnptMeta?.taxStatus,
                taxStatusText: vnptMeta?.taxStatusText,
                pdfUrl: vnptMeta?.pdfUrl,
                viewUrl: vnptMeta?.viewUrl,
                discrepancyReason,
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

    for (const soId of targetSoIds) {
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

        if (existingInv) {
            await prisma.aRInvoice.update({
                where: { id: existingInv.id },
                data: {
                    invoiceNo: trimmedInvNo,
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
                    amount: so.totalAmount,
                    vatAmount: so.vatAmount || 0,
                    totalAmount: so.totalAmount,
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
