'use server'

import { prisma } from '@/lib/db'
import { revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { requireAuth, hasRole, hasPermission, type SessionUser } from '@/lib/session'
import { getVnptConfigForEntity, uploadDraftToVnpt, deleteDraftFromVnpt, syncInvoiceStatusFromVnpt } from '@/lib/vnpt/vnpt-client'
import { buildVnptDraftInvoiceXml, calculateVnptInvoiceTotals } from '@/lib/vnpt/xml-builder'
import { InvoiceBuyer, InvoicePayload, VnptDraftMetadata } from '@/lib/vnpt/types'

import { checkInvoiceDateDiscrepancy } from '@/lib/vnpt/date-utils'

const BLOCKED_INVOICE_SO_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'PENDING_ACCOUNTING', 'CANCELLED'])
const SYNC_TRANSITION_SO_STATUSES = new Set(['CONFIRMED', 'DELIVERED', 'PARTIALLY_DELIVERED'])

function canWriteVnptInvoice(user: SessionUser): boolean {
    return (
        hasRole(user, 'Admin', 'ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN', 'Sales Admin', 'SALES_ADMIN', 'Sales Manager', 'SALES_MGR', 'TAX:WRITE', 'FIN:WRITE') ||
        hasPermission(user, 'TAX', 'WRITE') ||
        hasPermission(user, 'TAX', 'CREATE') ||
        hasPermission(user, 'FIN', 'WRITE')
    )
}

function getVnptFkeyVersion(fkey: string | undefined, baseFkey: string): number {
    if (!fkey) return 0
    if (fkey === baseFkey) return 1
    if (fkey.startsWith(`${baseFkey}_V`)) {
        const ver = Number(fkey.substring(baseFkey.length + 2))
        return Number.isInteger(ver) && ver >= 2 ? ver : 0
    }
    return 0
}

/**
 * Đẩy hóa đơn nháp của đơn hàng lên hệ thống VNPT e-Invoice (V5 Webservice - TT78/NĐ70)
 */
export async function uploadDraftInvoiceToVnpt(soId: string) {
    const user = await requireAuth()
    if (!canWriteVnptInvoice(user)) {
        return { success: false, error: 'Bạn không có quyền đẩy hóa đơn điện tử lên VNPT.' }
    }

    const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            customer: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    taxId: true,
                    purchasingPhone: true,
                    receiverPhone: true,
                    vatCompanyName: true,
                    vatAddress: true,
                    vatEmail: true,
                    vatBuyerName: true,
                    addresses: {
                        select: { address: true },
                        orderBy: [{ isBilling: 'desc' }, { isDefault: 'desc' }, { id: 'asc' }],
                        take: 1,
                    },
                    parent: {
                        select: {
                            id: true,
                            name: true,
                            taxId: true,
                            vatCompanyName: true,
                            vatAddress: true,
                            vatEmail: true,
                            vatBuyerName: true,
                            purchasingPhone: true,
                            receiverPhone: true,
                            addresses: {
                                select: { address: true },
                                orderBy: [{ isBilling: 'desc' }, { isDefault: 'desc' }, { id: 'asc' }],
                                take: 1,
                            },
                        },
                    },
                },
            },
            shippingAddress: { select: { address: true } },
            legalEntity: { select: { id: true, name: true, code: true, taxId: true } },
            warehouse: { select: { id: true, name: true, code: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, notes: true } },
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true, invoiceName: true, country: true, wineType: true } },
                },
            },
        },
    })

    if (!so) {
        return { success: false, error: 'Không tìm thấy đơn hàng trong hệ thống.' }
    }

    if (BLOCKED_INVOICE_SO_STATUSES.has(so.status)) {
        return {
            success: false,
            error: `Đơn hàng đang ở trạng thái ${so.status}, chưa đủ điều kiện xuất hóa đơn VNPT.`,
        }
    }

    if (so.isInvoiceExempt) {
        return {
            success: false,
            error: 'Đơn hàng đang được đánh dấu Miễn xuất hóa đơn VAT. Vui lòng hủy đánh dấu miễn hóa đơn trước khi đẩy VNPT.',
        }
    }

    if (so.lines.length === 0) {
        return { success: false, error: 'Đơn hàng chưa có dòng sản phẩm nào để xuất hóa đơn.' }
    }

    // Kiểm tra nếu đơn hàng đã có hóa đơn chính thức đã phát hành/thanh toán
    const existingPublished = so.arInvoices.find(i => {
        if (i.status === 'CANCELLED') return false
        if (i.status === 'PAID') return true
        try {
            const parsed = JSON.parse(i.notes || '{}')
            if (parsed.vnpt?.status === 'PUBLISHED') return true
        } catch { }
        return Boolean(i.invoiceNo && !i.invoiceNo.startsWith('NHAP-') && !i.invoiceNo.startsWith('INV-'))
    })
    if (existingPublished) {
        return {
            success: false,
            error: `Đơn hàng này đã có hóa đơn chính thức (${existingPublished.invoiceNo}). Không thể tạo lại bản nháp.`,
        }
    }

    // Xác định thông tin pháp nhân và cấu hình VNPT
    const legalEntityCode = so.legalEntity?.code || 'TA'
    const config = getVnptConfigForEntity(legalEntityCode)

    // Khóa định danh liên kết duy nhất (FKey) + hỗ trợ versioning khi bản nháp cũ còn kẹt trên portal VNPT
    const sanitizedSoNo = so.soNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const baseFkey = `SO_${sanitizedSoNo}`

    let existingDraftMeta: VnptDraftMetadata | null = null
    let maxCancelledVer = 0
    let maxKnownVer = 0

    for (const inv of so.arInvoices) {
        try {
            const parsed = JSON.parse(inv.notes || '{}')
            const meta = parsed.vnpt as VnptDraftMetadata | undefined
            if (!meta?.fkey) continue
            const ver = getVnptFkeyVersion(meta.fkey, baseFkey)
            if (ver > maxKnownVer) maxKnownVer = ver
            if (meta.status === 'CANCELLED' && ver > maxCancelledVer) {
                maxCancelledVer = ver
            }
            if (meta.status === 'DRAFT' || inv.invoiceNo.startsWith('NHAP-')) {
                existingDraftMeta = meta
            }
        } catch { }
    }

    let fkey = existingDraftMeta?.fkey || (maxCancelledVer >= 1 ? `${baseFkey}_V${maxCancelledVer + 1}` : baseFkey)

    // Thông tin người mua: ƯU TIÊN TUYỆT ĐỐI thông tin pháp nhân của Công ty mẹ (Tên, MST, Địa chỉ VAT)
    const parent = so.customer.parent
    const taxId = parent?.taxId || so.customer.taxId || ''
    const isCorporate = Boolean(taxId || parent?.vatCompanyName || so.customer.vatCompanyName)

    // Tên đơn vị mua hàng xuất HĐ: ưu tiên Tên VAT công ty mẹ -> Tên công ty mẹ -> Tên VAT con -> Tên con
    const companyName = parent?.vatCompanyName || parent?.name || so.customer.vatCompanyName || so.customer.name

    // Tên người mua hàng (<HVTNMHang>): chỉ xuất khi có nhập trường vatBuyerName (ưu tiên chi nhánh con -> công ty mẹ), để trống nếu không nhập
    const buyerName = (so.customer.vatBuyerName || parent?.vatBuyerName || '').trim()

    // Địa chỉ đăng ký thuế VAT: nếu có Công ty mẹ thì CHỈ lấy từ Công ty mẹ, không fallback sang địa chỉ giao hàng/chi nhánh con
    const parentPrimaryAddress = parent?.addresses?.[0]?.address || ''
    const customerPrimaryAddress = so.customer.addresses?.[0]?.address || ''
    const vatAddress = parent
        ? (parent.vatAddress || parentPrimaryAddress || '')
        : (so.customer.vatAddress || customerPrimaryAddress || (isCorporate ? '' : (so.shippingAddress?.address || 'Việt Nam')))

    if (!vatAddress.trim()) {
        return {
            success: false,
            error: parent
                ? `Công ty mẹ (${companyName}) chưa có Địa chỉ đăng ký thuế VAT. Vui lòng cập nhật địa chỉ trên hồ sơ Công ty Mẹ trước khi đẩy hóa đơn VNPT.`
                : `Khách hàng (${companyName}) chưa có Địa chỉ đăng ký thuế VAT. Vui lòng cập nhật địa chỉ trước khi đẩy hóa đơn VNPT.`,
        }
    }

    // Email nhận hóa đơn VAT: ưu tiên email của công ty mẹ
    const vatEmail = parent?.vatEmail || so.customer.vatEmail || ''

    // Số điện thoại liên hệ
    const phone = so.customer.purchasingPhone || so.customer.receiverPhone || parent?.purchasingPhone || parent?.receiverPhone || ''

    const buyer: InvoiceBuyer = {
        buyerName,
        companyName,
        taxId,
        address: vatAddress,
        email: vatEmail,
        phone,
        customerCode: so.customer.code,
    }

    // Tính toán chi tiết từng dòng hàng và tổng tiền (bao gồm tách VAT kênh lẻ & chiết khấu toàn đơn)
    const { items, totalNet, totalVat, totalDiscount, totalAmount } = calculateVnptInvoiceTotals({
        channel: so.channel,
        orderType: so.orderType,
        orderDiscountPct: Number(so.orderDiscount || 0),
        defaultVatRate: Number(so.vatRate ?? 10),
        lines: so.lines.map((line) => ({
            skuCode: line.product.skuCode,
            productName: line.product.productName,
            invoiceName: line.product.invoiceName,
            wineType: line.product.wineType,
            unit: 'Chai',
            qtyOrdered: Number(line.qtyOrdered),
            unitPrice: Number(line.unitPrice),
            lineDiscountPct: Number(line.lineDiscountPct || 0),
            vatRate: Number(line.vatRate ?? so.vatRate ?? 10),
        })),
    })

    const payMethod = 'Chuyển khoản/Tiền mặt'
    const basePayload: InvoicePayload = {
        fkey,
        pattern: config.pattern,
        serial: config.serial,
        paymentMethod: payMethod,
        buyer,
        items,
        totalNet,
        totalVat,
        totalDiscount,
        totalAmount,
        note: `Xuất hóa đơn GTGT đơn hàng ${so.soNo}`,
    }

    // Sinh chuỗi XML DSHDon và gọi ASMX Web Service VNPT
    let xmlData = buildVnptDraftInvoiceXml(basePayload)
    let result = await uploadDraftToVnpt(config, xmlData, fkey)
    let retriedDuplicateFkey = false

    // Xử lý tự phục hồi nếu trùng FKey (ERR:13): kiểm tra xem đã ký số chưa trước khi nâng phiên bản FKey (_V2..)
    if (!result.success && result.errorCode === 'ERR:13') {
        const syncCheck = await syncInvoiceStatusFromVnpt(config, fkey, config.pattern)
        if (syncCheck.success && !syncCheck.isDraft) {
            return {
                success: false,
                error: `Đơn hàng này đã có hóa đơn ký số trên VNPT (${syncCheck.fullInvoiceNo}). Vui lòng bấm "Đồng bộ số HĐ" thay vì đẩy nháp mới.`,
                errorCode: 'ALREADY_PUBLISHED',
            }
        }

        const currentVer = getVnptFkeyVersion(fkey, baseFkey)
        const startVer = Math.max(2, maxKnownVer + 1, currentVer + 1)

        for (let ver = startVer; ver <= Math.max(10, startVer + 8); ver++) {
            const nextFkey = `${baseFkey}_V${ver}`
            const retryXml = buildVnptDraftInvoiceXml({ ...basePayload, fkey: nextFkey })
            const retryRes = await uploadDraftToVnpt(config, retryXml, nextFkey)

            if (retryRes.success) {
                fkey = nextFkey
                xmlData = retryXml
                result = retryRes
                retriedDuplicateFkey = true
                break
            }

            if (retryRes.errorCode === 'ERR:13') {
                const retrySyncCheck = await syncInvoiceStatusFromVnpt(config, nextFkey, config.pattern)
                if (retrySyncCheck.success && !retrySyncCheck.isDraft) {
                    return {
                        success: false,
                        error: `Đơn hàng này đã có hóa đơn ký số trên VNPT (${retrySyncCheck.fullInvoiceNo}). Vui lòng bấm "Đồng bộ số HĐ" thay vì đẩy nháp mới.`,
                        errorCode: 'ALREADY_PUBLISHED',
                    }
                }
                continue
            }

            result = retryRes
            break
        }
    }

    if (!result.success) {
        return {
            success: false,
            error: result.errorMessage || 'Lỗi không xác định từ hệ thống VNPT',
            errorCode: result.errorCode,
        }
    }

    // Lưu metadata vào ARInvoice
    const draftMeta: VnptDraftMetadata = {
        fkey,
        pattern: result.pattern || config.pattern,
        serial: result.serial || config.serial,
        status: 'DRAFT',
        uploadedAt: new Date().toISOString(),
        xmlSnapshot: xmlData,
    }

    // Chọn đúng bản ghi ARInvoice nháp hoặc đang mở để cập nhật
    let targetInv =
        so.arInvoices.find(i => i.invoiceNo.startsWith('NHAP-')) ||
        so.arInvoices.find(i => i.status !== 'CANCELLED')
    const invoiceNo = `NHAP-${so.soNo}`

    if (!targetInv) {
        // Cần legalEntityId hợp lệ
        let legalEntityId = so.legalEntityId
        if (!legalEntityId) {
            const defaultEntity = await prisma.legalEntity.findFirst()
            legalEntityId = defaultEntity?.id || ''
        }

        targetInv = await prisma.aRInvoice.create({
            data: {
                invoiceNo,
                legalEntityId,
                soId: so.id,
                customerId: so.customerId,
                amount: totalNet,
                vatAmount: totalVat,
                totalAmount: totalAmount,
                dueDate: new Date(Date.now() + 30 * 86400000),
                status: 'UNPAID',
                notes: JSON.stringify({ vnpt: draftMeta }),
            },
        })
    } else {
        let existingNotes: any = {}
        try {
            existingNotes = JSON.parse(targetInv.notes || '{}')
        } catch {
            existingNotes = { rawNotes: targetInv.notes }
        }
        existingNotes.vnpt = draftMeta

        let resolvedInvoiceNo = targetInv.invoiceNo
        if (targetInv.invoiceNo.startsWith('INV-')) {
            const conflict = await prisma.aRInvoice.findUnique({ where: { invoiceNo }, select: { id: true } })
            if (!conflict) resolvedInvoiceNo = invoiceNo
        }

        await prisma.aRInvoice.update({
            where: { id: targetInv.id },
            data: {
                invoiceNo: resolvedInvoiceNo,
                notes: JSON.stringify(existingNotes),
                amount: totalNet,
                vatAmount: totalVat,
                totalAmount: totalAmount,
            },
        })
    }

    // Ghi Audit Log kèm cảnh báo ngày nếu có
    const dateWarning = checkInvoiceDateDiscrepancy(so.createdAt)
    const warningDesc = dateWarning.hasWarning
        ? ` [LƯU Ý NGÀY: Lập đơn ${dateWarning.orderDateFormatted}, HĐ ngày ${dateWarning.invoiceDateFormatted}, lệch ${dateWarning.diffDays} ngày]`
        : ''

    await logAudit({
        userId: user.id,
        action: 'CREATE',
        entityType: 'ARInvoice',
        entityId: targetInv.id,
        description: `Đẩy hóa đơn nháp lên VNPT e-Invoice cho đơn hàng ${so.soNo} (Pháp nhân: ${config.entityName || so.legalEntity?.name || 'TA'}, FKey: ${fkey}, Ký hiệu: ${draftMeta.serial})${warningDesc}`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reconciliation')

    const successMessage = config.isMock
        ? `[GIẢ LẬP] Đã tạo hóa đơn nháp thành công trên VNPT (FKey: ${fkey})`
        : retriedDuplicateFkey
            ? `Đã đẩy lại hóa đơn nháp thành công lên cổng VNPT (FKey: ${fkey}). Lưu ý: bản nháp FKey cũ vẫn còn trên cổng web VNPT, vui lòng xóa bản nháp cũ trước khi ký số.`
            : `Đã đẩy hóa đơn nháp thành công lên cổng VNPT e-Invoice (FKey: ${fkey})!`

    return {
        success: true,
        message: successMessage,
        fkey,
        pattern: draftMeta.pattern,
        serial: draftMeta.serial,
        dateWarning,
        isMock: config.isMock,
        invoiceId: targetInv.id,
    }
}

/**
 * Xóa hóa đơn nháp đã đẩy lên VNPT (để làm lại hoặc khi đơn hàng bị sửa đổi)
 */
export async function deleteDraftInvoiceFromVnpt(soId: string) {
    const user = await requireAuth()
    if (!canWriteVnptInvoice(user)) {
        return { success: false, error: 'Bạn không có quyền hủy bản nháp hóa đơn VNPT.' }
    }

    const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            arInvoices: true,
            legalEntity: { select: { code: true } },
        },
    })

    if (!so || so.arInvoices.length === 0) {
        return { success: false, error: 'Không tìm thấy hóa đơn của đơn hàng này.' }
    }

    const inv =
        so.arInvoices.find(i => i.invoiceNo.startsWith('NHAP-') || Boolean(i.notes && i.notes.includes('"status":"DRAFT"'))) ||
        so.arInvoices[0]
    let fkey = ''
    try {
        const parsed = JSON.parse(inv.notes || '{}')
        fkey = parsed.vnpt?.fkey
    } catch { }

    if (!fkey) {
        fkey = `SO_${so.soNo.replace(/[^A-Za-z0-9_-]/g, '_')}`
    }

    const config = getVnptConfigForEntity(so.legalEntity?.code)
    const result = await deleteDraftFromVnpt(config, fkey)

    // Nếu VNPT báo lỗi nhưng hóa đơn trong ERP là bản nháp (NHAP-), vẫn cho phép xóa bản ghi trong ERP
    // để tránh tình trạng kẹt trạng thái Chờ Ký Số khi cổng VNPT TT78 trả ERR:5 / ERR:1
    if (!result.success && !inv.invoiceNo.startsWith('NHAP-')) {
        return { success: false, error: result.errorMessage || 'Không thể xóa bản nháp trên VNPT.' }
    }

    // Xóa hoặc làm sạch notes nếu là bản nháp
    if (inv.invoiceNo.startsWith('NHAP-')) {
        await prisma.aRInvoice.delete({ where: { id: inv.id } })
    } else {
        try {
            const parsed = JSON.parse(inv.notes || '{}')
            if (parsed.vnpt) {
                parsed.vnpt.status = 'CANCELLED'
                parsed.vnpt.cancelledAt = new Date().toISOString()
                await prisma.aRInvoice.update({
                    where: { id: inv.id },
                    data: { notes: JSON.stringify(parsed) },
                })
            }
        } catch { }
    }

    await logAudit({
        userId: user.id,
        action: 'DELETE',
        entityType: 'ARInvoice',
        entityId: inv.id,
        description: `Xóa hóa đơn nháp trên VNPT e-Invoice cho đơn hàng ${so.soNo} (FKey: ${fkey})${!result.success ? ` [VNPT ${result.errorCode || 'ERR'}: đã dọn nháp cục bộ]` : ''}`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reconciliation')

    return {
        success: true,
        message: result.success
            ? 'Đã xóa bản nháp trên VNPT e-Invoice thành công.'
            : `Đã xóa bản nháp trong ERP. Lưu ý: cổng VNPT không xóa được qua API (${result.errorCode || 'ERR:5'}), nếu đẩy lại bản nháp mới hệ thống sẽ tự tạo FKey phiên bản kế tiếp và bạn cần xóa nháp cũ trên portal VNPT.`,
    }
}

/**
 * Lấy thông tin bản nháp VNPT của đơn hàng
 */
export async function getVnptDraftInfo(soId: string) {
    const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            arInvoices: { select: { id: true, invoiceNo: true, status: true, notes: true } },
            legalEntity: { select: { code: true, name: true } },
        },
    })

    if (!so || so.arInvoices.length === 0) {
        return { hasDraft: false }
    }

    for (const inv of so.arInvoices) {
        try {
            const parsed = JSON.parse(inv.notes || '{}')
            if (parsed.vnpt) {
                const config = getVnptConfigForEntity(so.legalEntity?.code)
                const isDraft = parsed.vnpt.status === 'DRAFT'
                const isPublished = parsed.vnpt.status === 'PUBLISHED'
                return {
                    hasDraft: isDraft,
                    isPublished,
                    status: parsed.vnpt.status as 'DRAFT' | 'PUBLISHED' | 'CANCELLED',
                    invoiceId: inv.id,
                    invoiceNo: parsed.vnpt.invoiceNo || inv.invoiceNo,
                    fullInvoiceNo: parsed.vnpt.fullInvoiceNo || inv.invoiceNo,
                    fkey: parsed.vnpt.fkey,
                    pattern: parsed.vnpt.pattern,
                    serial: parsed.vnpt.serial,
                    taxAuthorityCode: parsed.vnpt.taxAuthorityCode,
                    taxStatus: parsed.vnpt.taxStatus,
                    taxStatusText: parsed.vnpt.taxStatusText,
                    viewUrl: parsed.vnpt.viewUrl,
                    pdfUrl: parsed.vnpt.pdfUrl,
                    xmlUrl: parsed.vnpt.xmlUrl,
                    uploadedAt: parsed.vnpt.uploadedAt,
                    syncedAt: parsed.vnpt.syncedAt,
                    isMock: config.isMock,
                }
            }
        } catch { }
    }

    return { hasDraft: false, isPublished: false }
}

/**
 * Đồng bộ số hóa đơn chính thức, mã CQT và link PDF từ VNPT sau khi kế toán đã ký số trên portal
 */
export async function syncVnptInvoiceForOrder(soId: string) {
    const user = await requireAuth()
    if (!canWriteVnptInvoice(user)) {
        return { success: false, error: 'Bạn không có quyền đồng bộ hóa đơn VNPT.' }
    }

    const so = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            customer: { select: { name: true, code: true } },
            legalEntity: { select: { code: true, name: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, notes: true } },
        },
    })

    if (!so) {
        return { success: false, error: 'Không tìm thấy đơn hàng trong hệ thống.' }
    }

    // Tìm FKey và Pattern từ bản nháp ARInvoice hiện tại (ưu tiên bản nháp NHAP- / DRAFT)
    let targetInv = so.arInvoices.find(i => i.invoiceNo.startsWith('NHAP-')) || so.arInvoices[0]
    let fkey = ''
    let pattern = ''
    let existingVnpt: any = null

    for (const inv of so.arInvoices) {
        try {
            const parsed = JSON.parse(inv.notes || '{}')
            if (parsed.vnpt && parsed.vnpt.fkey && (inv.invoiceNo.startsWith('NHAP-') || parsed.vnpt.status === 'DRAFT' || !fkey)) {
                targetInv = inv
                fkey = parsed.vnpt.fkey
                pattern = parsed.vnpt.pattern
                existingVnpt = parsed.vnpt
                if (inv.invoiceNo.startsWith('NHAP-') || parsed.vnpt.status === 'DRAFT') {
                    break
                }
            }
        } catch { }
    }

    if (!fkey) {
        const sanitizedSoNo = so.soNo.replace(/[^A-Za-z0-9_-]/g, '_')
        fkey = `SO_${sanitizedSoNo}`
    }

    const config = getVnptConfigForEntity(so.legalEntity?.code)

    // Gọi VNPT để kiểm tra trạng thái ký số và lấy thông tin hóa đơn chính thức
    const syncRes = await syncInvoiceStatusFromVnpt(config, fkey, pattern)

    if (!syncRes.success) {
        return {
            success: false,
            isDraft: syncRes.isDraft,
            error: syncRes.errorMessage || 'Chưa thể đồng bộ số hóa đơn từ VNPT.',
        }
    }

    const finalInvoiceNo = syncRes.fullInvoiceNo || `${syncRes.serial}-${syncRes.invoiceNo}`

    // Cập nhật metadata VNPT vào ARInvoice
    const updatedVnptMeta: VnptDraftMetadata = {
        ...(existingVnpt || {}),
        fkey,
        pattern: syncRes.pattern || pattern || config.pattern,
        serial: syncRes.serial || config.serial,
        invoiceNo: syncRes.invoiceNo,
        fullInvoiceNo: finalInvoiceNo,
        taxAuthorityCode: syncRes.taxAuthorityCode,
        taxStatus: syncRes.taxStatus,
        viewUrl: syncRes.viewUrl,
        pdfUrl: syncRes.pdfUrl,
        xmlUrl: syncRes.xmlUrl,
        status: 'PUBLISHED',
        syncedAt: new Date().toISOString(),
        publishedAt: syncRes.publishedAt || new Date().toISOString(),
        ...(syncRes.publishedBy ? { publishedBy: syncRes.publishedBy } : {}),
        uploadedAt: existingVnpt?.uploadedAt || new Date().toISOString(),
    }

    if (targetInv) {
        let existingNotes: any = {}
        try {
            existingNotes = JSON.parse(targetInv.notes || '{}')
        } catch {
            existingNotes = { rawNotes: targetInv.notes }
        }
        existingNotes.vnpt = updatedVnptMeta

        await prisma.aRInvoice.update({
            where: { id: targetInv.id },
            data: {
                invoiceNo: finalInvoiceNo,
                notes: JSON.stringify(existingNotes),
            },
        })
    }

    if (SYNC_TRANSITION_SO_STATUSES.has(so.status)) {
        await prisma.salesOrder.update({
            where: { id: so.id },
            data: { status: 'INVOICED' },
        })
    }

    await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'ARInvoice',
        entityId: targetInv?.id || so.id,
        description: `Đồng bộ thành công số HĐ VNPT cho đơn ${so.soNo}: ${finalInvoiceNo} (Mã CQT: ${syncRes.taxAuthorityCode || 'Chưa cấp'})`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/sales')
    revalidatePath('/dashboard/finance')
    revalidatePath('/dashboard/reconciliation')

    return {
        success: true,
        invoiceNo: syncRes.invoiceNo,
        fullInvoiceNo: finalInvoiceNo,
        taxAuthorityCode: syncRes.taxAuthorityCode,
        viewUrl: syncRes.viewUrl,
        pdfUrl: syncRes.pdfUrl,
        publishedAt: syncRes.publishedAt,
        publishedBy: syncRes.publishedBy,
        message: `Đồng bộ thành công! Số hóa đơn chính thức: ${finalInvoiceNo}`,
    }
}

