'use server'

import { prisma } from '@/lib/db'
import { revalidateCache } from '@/lib/cache'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { requireAuth } from '@/lib/session'
import { getVnptConfigForEntity, uploadDraftToVnpt, deleteDraftFromVnpt } from '@/lib/vnpt/vnpt-client'
import { buildVnptDraftInvoiceXml } from '@/lib/vnpt/xml-builder'
import { InvoiceBuyer, InvoiceItem, InvoicePayload, VnptDraftMetadata } from '@/lib/vnpt/types'

/**
 * Đẩy hóa đơn nháp của đơn hàng lên hệ thống VNPT e-Invoice (V5 Webservice - TT78/NĐ70)
 */
export async function uploadDraftInvoiceToVnpt(soId: string) {
    const user = await requireAuth()

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
                    parent: {
                        select: {
                            taxId: true,
                            vatCompanyName: true,
                            vatAddress: true,
                            vatEmail: true,
                        },
                    },
                },
            },
            legalEntity: { select: { id: true, name: true, code: true, taxId: true } },
            warehouse: { select: { id: true, name: true, code: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, notes: true } },
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true, country: true } },
                },
            },
        },
    })

    if (!so) {
        return { success: false, error: 'Không tìm thấy đơn hàng trong hệ thống.' }
    }

    if (so.lines.length === 0) {
        return { success: false, error: 'Đơn hàng chưa có dòng sản phẩm nào để xuất hóa đơn.' }
    }

    // Kiểm tra nếu đơn hàng đã có hóa đơn chính thức đã thanh toán
    const existingPublished = so.arInvoices.find(i => i.status === 'PAID' || (i.invoiceNo && !i.invoiceNo.startsWith('NHAP-') && !i.invoiceNo.startsWith('INV-')))
    if (existingPublished) {
        return {
            success: false,
            error: `Đơn hàng này đã có hóa đơn chính thức (${existingPublished.invoiceNo}). Không thể tạo lại bản nháp.`,
        }
    }

    // Xác định thông tin pháp nhân và cấu hình VNPT
    const legalEntityCode = so.legalEntity?.code || 'TA'
    const config = getVnptConfigForEntity(legalEntityCode)

    // Khóa định danh liên kết duy nhất (FKey)
    const sanitizedSoNo = so.soNo.replace(/[^A-Za-z0-9_-]/g, '_')
    const fkey = `SO_${sanitizedSoNo}`

    // Thông tin người mua
    const taxId = so.customer.taxId || so.customer.parent?.taxId || ''
    const isCorporate = Boolean(taxId)
    const buyerName = isCorporate ? '' : so.customer.name
    const companyName = so.customer.vatCompanyName || so.customer.parent?.vatCompanyName || so.customer.name
    const vatAddress = so.customer.vatAddress || so.customer.parent?.vatAddress || 'Việt Nam'
    const vatEmail = so.customer.vatEmail || so.customer.parent?.vatEmail || ''
    const phone = so.customer.purchasingPhone || so.customer.receiverPhone || ''

    const buyer: InvoiceBuyer = {
        buyerName,
        companyName,
        taxId,
        address: vatAddress,
        email: vatEmail,
        phone,
        customerCode: so.customer.code,
    }

    // Xây dựng danh sách hàng hóa
    const orderVatRate = Number(so.vatRate ?? 10)
    let totalNet = 0
    let totalVat = 0
    let totalDiscount = 0

    const items: InvoiceItem[] = so.lines.map((line, idx) => {
        const qty = Number(line.qtyOrdered)
        const unitPrice = Number(line.unitPrice)
        const lineDiscPct = Number(line.lineDiscountPct || 0)
        const lineBeforeDisc = qty * unitPrice
        const lineDiscAmount = lineBeforeDisc * (lineDiscPct / 100)
        const netAmount = lineBeforeDisc - lineDiscAmount

        const rateNum = Number(line.vatRate ?? orderVatRate)
        const vatRateStr = `${rateNum}%`
        const vatAmount = Math.round(netAmount * (rateNum / 100))

        totalNet += netAmount
        totalVat += vatAmount
        totalDiscount += lineDiscAmount

        return {
            lineNo: idx + 1,
            productCode: line.product.skuCode,
            productName: line.product.productName,
            unit: (line.product as any).unit || 'Chai',
            quantity: qty,
            unitPrice,
            discountPct: lineDiscPct,
            discountAmount: lineDiscAmount,
            amount: netAmount,
            vatRate: vatRateStr,
            vatAmount,
            totalAmount: netAmount + vatAmount,
        }
    })

    const totalAmount = Math.round(totalNet + totalVat)
    const payMethod = so.paymentTerm?.includes('TM') ? 'TM/CK' : 'CK'

    const payload: InvoicePayload = {
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

    // Sinh chuỗi XML DSHDon
    const xmlData = buildVnptDraftInvoiceXml(payload)

    // Gọi ASMX Web Service VNPT
    const result = await uploadDraftToVnpt(config, xmlData, fkey)

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

    // Tìm xem đã có ARInvoice chưa
    let targetInv = so.arInvoices[0]
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
        // Cập nhật notes
        let existingNotes: any = {}
        try {
            existingNotes = JSON.parse(targetInv.notes || '{}')
        } catch {
            existingNotes = { rawNotes: targetInv.notes }
        }
        existingNotes.vnpt = draftMeta

        await prisma.aRInvoice.update({
            where: { id: targetInv.id },
            data: {
                notes: JSON.stringify(existingNotes),
                amount: totalNet,
                vatAmount: totalVat,
                totalAmount: totalAmount,
            },
        })
    }

    // Ghi Audit Log
    await logAudit({
        userId: user.id,
        action: 'CREATE',
        entityType: 'ARInvoice',
        entityId: targetInv.id,
        description: `Đẩy hóa đơn nháp lên VNPT e-Invoice cho đơn hàng ${so.soNo} (FKey: ${fkey}, Ký hiệu: ${draftMeta.serial})`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/sales')

    return {
        success: true,
        message: config.isMock
            ? `[GIẢ LẬP] Đã tạo hóa đơn nháp thành công trên VNPT (FKey: ${fkey})`
            : `Đã đẩy hóa đơn nháp thành công lên cổng VNPT e-Invoice (FKey: ${fkey})!`,
        fkey,
        pattern: draftMeta.pattern,
        serial: draftMeta.serial,
        isMock: config.isMock,
        invoiceId: targetInv.id,
    }
}

/**
 * Xóa hóa đơn nháp đã đẩy lên VNPT (để làm lại hoặc khi đơn hàng bị sửa đổi)
 */
export async function deleteDraftInvoiceFromVnpt(soId: string) {
    const user = await requireAuth()

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

    const inv = so.arInvoices[0]
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

    if (!result.success) {
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
        description: `Xóa hóa đơn nháp trên VNPT e-Invoice cho đơn hàng ${so.soNo} (FKey: ${fkey})`,
    })

    revalidateCache('sales')
    revalidatePath('/dashboard/sales')

    return {
        success: true,
        message: 'Đã xóa bản nháp trên VNPT e-Invoice thành công.',
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
            if (parsed.vnpt && parsed.vnpt.status === 'DRAFT') {
                const config = getVnptConfigForEntity(so.legalEntity?.code)
                return {
                    hasDraft: true,
                    invoiceId: inv.id,
                    invoiceNo: inv.invoiceNo,
                    fkey: parsed.vnpt.fkey,
                    pattern: parsed.vnpt.pattern,
                    serial: parsed.vnpt.serial,
                    uploadedAt: parsed.vnpt.uploadedAt,
                    isMock: config.isMock,
                }
            }
        } catch { }
    }

    return { hasDraft: false }
}
