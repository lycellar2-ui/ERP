'use server'

import { Resend } from 'resend'
import { notifyTelegram, formatVND } from '@/lib/telegram'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? "LY's Cellars ERP <noreply@lyscellars.com>"

export type EmailPayload = {
    to: string | string[]
    subject: string
    html: string
}

// Base send function
async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!process.env.RESEND_API_KEY) {
        console.log('[Email Mock]', payload.subject, '→', payload.to)
        return { success: true, id: 'mock-' + Date.now() }
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM,
            to: Array.isArray(payload.to) ? payload.to : [payload.to],
            subject: payload.subject,
            html: payload.html,
        })

        if (error) return { success: false, error: error.message }
        return { success: true, id: data?.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// Telegram notification channel (alongside email)
// ═══════════════════════════════════════════════════

async function sendNotification(
    emailPayload: EmailPayload,
    telegramMessage: string
) {
    const results = await Promise.allSettled([
        sendEmail(emailPayload),
        notifyTelegram(telegramMessage),
    ])

    return {
        email: results[0].status === 'fulfilled' ? results[0].value : { success: false, error: 'Email failed' },
        telegram: results[1].status === 'fulfilled' ? results[1].value : { success: false, error: 'Telegram failed' },
    }
}

// ═══════════════════════════════════════════════════
// Pre-built notification templates
// ═══════════════════════════════════════════════════

export async function notifySOApprovalRequired(input: {
    soNo: string
    customerName: string
    totalAmount: number
    salesRepName: string
    approverEmail: string
}) {
    const telegramMsg = `✅ <b>Yêu cầu phê duyệt đơn hàng</b>
━━━━━━━━━━━━━━━━━━
📋 Số SO: <b>${input.soNo}</b>
👤 Khách hàng: ${input.customerName}
💰 Tổng tiền: <b>${formatVND(input.totalAmount)}</b>
🧑‍💼 NV Bán hàng: ${input.salesRepName}`

    return sendNotification(
        {
            to: input.approverEmail,
            subject: `[Phê duyệt] Đơn hàng ${input.soNo} — ${input.customerName}`,
            html: `
            <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
                <div style="background: #0A1926; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: #87CBB9; margin: 0;">🍷 Yêu cầu phê duyệt đơn hàng</h2>
                </div>
                <div style="background: #1B2E3D; padding: 24px; border-radius: 0 0 8px 8px; color: #E8F1F2;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; color: #8AAEBB;">Số SO:</td><td style="padding: 8px; font-weight: bold;">${input.soNo}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Khách hàng:</td><td style="padding: 8px;">${input.customerName}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Tổng tiền:</td><td style="padding: 8px; font-weight: bold;">${input.totalAmount.toLocaleString('vi-VN')} VND</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">NV Bán hàng:</td><td style="padding: 8px;">${input.salesRepName}</td></tr>
                    </table>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/sales" 
                           style="display: inline-block; background: #87CBB9; color: #0A1926; padding: 12px 32px; 
                                  border-radius: 6px; text-decoration: none; font-weight: 600;">
                            Xem & Phê duyệt
                        </a>
                    </div>
                </div>
            </div>
        `,
        },
        telegramMsg,
    )
}

export async function notifyInvoiceOverdue(input: {
    invoiceNo: string
    customerName: string
    amount: number
    dueDate: string
    daysOverdue: number
    collectorEmail: string
}) {
    const telegramMsg = `⚠️ <b>Hóa đơn quá hạn thanh toán</b>
━━━━━━━━━━━━━━━━━━
🧾 Số HĐ: <b>${input.invoiceNo}</b>
👤 Khách hàng: ${input.customerName}
💰 Số tiền: <b>${formatVND(input.amount)}</b>
📅 Hạn thanh toán: ${input.dueDate}
🔴 Quá hạn: <b>${input.daysOverdue} ngày</b>`

    return sendNotification(
        {
            to: input.collectorEmail,
            subject: `⚠️ Hóa đơn quá hạn ${input.invoiceNo} — ${input.daysOverdue} ngày`,
            html: `
            <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
                <div style="background: #92400E; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: #FEF3C7; margin: 0;">⚠️ Hóa đơn quá hạn thanh toán</h2>
                </div>
                <div style="background: #1B2E3D; padding: 24px; border-radius: 0 0 8px 8px; color: #E8F1F2;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; color: #8AAEBB;">Số HĐ:</td><td style="padding: 8px; font-weight: bold;">${input.invoiceNo}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Khách hàng:</td><td style="padding: 8px;">${input.customerName}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Số tiền:</td><td style="padding: 8px; font-weight: bold; color: #FCA5A5;">${input.amount.toLocaleString('vi-VN')} VND</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Hạn thanh toán:</td><td style="padding: 8px;">${input.dueDate}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Quá hạn:</td><td style="padding: 8px; color: #FCA5A5; font-weight: bold;">${input.daysOverdue} ngày</td></tr>
                    </table>
                </div>
            </div>
        `,
        },
        telegramMsg,
    )
}

export async function notifyShipmentArrival(input: {
    billOfLading: string
    vesselName: string
    eta: string
    recipientEmails: string[]
}) {
    const telegramMsg = `🚢 <b>Lô hàng sắp cập cảng</b>
━━━━━━━━━━━━━━━━━━
📋 Vận đơn: <b>${input.billOfLading}</b>
🚢 Tàu: ${input.vesselName}
📅 ETA: <b>${input.eta}</b>

📦 Vui lòng chuẩn bị chứng từ thông quan và bố trí kho nhận hàng.`

    return sendNotification(
        {
            to: input.recipientEmails,
            subject: `🚢 Lô hàng sắp cập cảng — ${input.billOfLading}`,
            html: `
            <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
                <div style="background: #0A1926; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: #87CBB9; margin: 0;">🚢 Thông báo tàu cập cảng</h2>
                </div>
                <div style="background: #1B2E3D; padding: 24px; border-radius: 0 0 8px 8px; color: #E8F1F2;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; color: #8AAEBB;">Vận đơn:</td><td style="padding: 8px; font-weight: bold;">${input.billOfLading}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Tàu:</td><td style="padding: 8px;">${input.vesselName}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">ETA:</td><td style="padding: 8px; font-weight: bold;">${input.eta}</td></tr>
                    </table>
                    <p style="margin-top: 16px; color: #8AAEBB; font-size: 14px;">
                        Vui lòng chuẩn bị chứng từ thông quan và bố trí kho nhận hàng.
                    </p>
                </div>
            </div>
        `,
        },
        telegramMsg,
    )
}

export async function notifyLowStock(input: {
    productName: string
    skuCode: string
    currentQty: number
    threshold: number
    managerEmail: string
}) {
    const telegramMsg = `📦 <b>Cảnh báo tồn kho thấp</b>
━━━━━━━━━━━━━━━━━━
🍷 Sản phẩm: <b>${input.productName}</b>
🏷️ SKU: ${input.skuCode}
🔴 Tồn hiện tại: <b>${input.currentQty}</b>
📊 Ngưỡng tối thiểu: ${input.threshold}`

    return sendNotification(
        {
            to: input.managerEmail,
            subject: `📦 Tồn kho thấp: ${input.skuCode} — ${input.productName}`,
            html: `
            <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
                <div style="background: #0A1926; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: #87CBB9; margin: 0;">📦 Cảnh báo tồn kho thấp</h2>
                </div>
                <div style="background: #1B2E3D; padding: 24px; border-radius: 0 0 8px 8px; color: #E8F1F2;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; color: #8AAEBB;">Sản phẩm:</td><td style="padding: 8px; font-weight: bold;">${input.productName}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">SKU:</td><td style="padding: 8px;">${input.skuCode}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Tồn hiện tại:</td><td style="padding: 8px; color: #FCA5A5; font-weight: bold;">${input.currentQty}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Ngưỡng tối thiểu:</td><td style="padding: 8px;">${input.threshold}</td></tr>
                    </table>
                </div>
            </div>
        `,
        },
        telegramMsg,
    )
}

export async function notifyContractExpiring(input: {
    contractNo: string
    supplierName: string
    contractType: string
    expiryDate: string
    daysRemaining: number
    managerEmail: string
}) {
    const urgencyColor = input.daysRemaining <= 7 ? '#DC2626' : '#F59E0B'
    const urgencyLabel = input.daysRemaining <= 7 ? '🔴 Khẩn cấp' : '🟡 Sắp hết hạn'

    const telegramMsg = `📋 <b>${urgencyLabel}: Hợp đồng sắp hết hạn</b>
━━━━━━━━━━━━━━━━━━
📋 Số HĐ: <b>${input.contractNo}</b>
🏢 Nhà cung cấp: ${input.supplierName}
📁 Loại HĐ: ${input.contractType}
📅 Hạn HĐ: <b>${input.expiryDate}</b>
⏰ Còn lại: <b>${input.daysRemaining} ngày</b>`

    return sendNotification(
        {
            to: input.managerEmail,
            subject: `${urgencyLabel} Hợp đồng ${input.contractNo} — còn ${input.daysRemaining} ngày`,
            html: `
            <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
                <div style="background: ${urgencyColor}; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0;">📋 ${urgencyLabel}: Hợp đồng sắp hết hạn</h2>
                </div>
                <div style="background: #1B2E3D; padding: 24px; border-radius: 0 0 8px 8px; color: #E8F1F2;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px; color: #8AAEBB;">Số HĐ:</td><td style="padding: 8px; font-weight: bold;">${input.contractNo}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Nhà cung cấp:</td><td style="padding: 8px;">${input.supplierName}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Loại HĐ:</td><td style="padding: 8px;">${input.contractType}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Hạn HĐ:</td><td style="padding: 8px; font-weight: bold;">${input.expiryDate}</td></tr>
                        <tr><td style="padding: 8px; color: #8AAEBB;">Còn lại:</td><td style="padding: 8px; color: ${urgencyColor}; font-weight: bold;">${input.daysRemaining} ngày</td></tr>
                    </table>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/contracts" 
                           style="display: inline-block; background: #87CBB9; color: #0A1926; padding: 12px 32px; 
                                  border-radius: 6px; text-decoration: none; font-weight: 600;">
                            Xem hợp đồng
                        </a>
                    </div>
                </div>
            </div>
        `,
        },
        telegramMsg,
    )
}
