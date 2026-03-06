'use server'

/**
 * Telegram Bot Command Handlers — LY's Cellars ERP
 * 
 * Each handler queries the database and returns a formatted
 * Telegram message for the CEO.
 */

import { prisma } from '@/lib/db'
import {
    sendMessage, sendMessageWithKeyboard, answerCallbackQuery,
    editMessageText, formatVND, escapeHtml,
    type TelegramCallbackQuery,
} from '@/lib/telegram'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ═══════════════════════════════════════════════════
// /start — Welcome
// ═══════════════════════════════════════════════════

export async function handleStart(chatId: number) {
    const msg = `🍷 <b>LY's Cellars ERP Bot</b>

Xin chào! Tôi là trợ lý CEO cho hệ thống quản lý rượu vang.

<b>Các lệnh có sẵn:</b>
/menu — 📋 Menu chính
/doanhthu — 💰 Doanh thu tháng
/donhang — 📦 Đơn hàng gần đây
/pheduyet — ✅ Chờ phê duyệt
/tonkho — 🏭 Tồn kho
/congno — 💳 Công nợ phải thu
/timkiem — 🔍 Tìm kiếm
/baocao — 📊 Báo cáo tổng hợp

💡 <i>Mọi thông báo quan trọng sẽ được gửi tự động về đây.</i>`

    await sendMessage(chatId, msg)
}

// ═══════════════════════════════════════════════════
// /menu — Interactive Main Menu
// ═══════════════════════════════════════════════════

export async function handleMenu(chatId: number) {
    await sendMessageWithKeyboard(
        chatId,
        '📋 <b>Menu chính</b> — Chọn mục cần xem:',
        [
            [
                { text: '💰 Doanh thu', callback_data: 'cmd:doanhthu' },
                { text: '📦 Đơn hàng', callback_data: 'cmd:donhang' },
            ],
            [
                { text: '✅ Phê duyệt', callback_data: 'cmd:pheduyet' },
                { text: '🏭 Tồn kho', callback_data: 'cmd:tonkho' },
            ],
            [
                { text: '💳 Công nợ', callback_data: 'cmd:congno' },
                { text: '📊 Báo cáo', callback_data: 'cmd:baocao' },
            ],
            [
                { text: '🌐 Mở ERP', url: `${APP_URL}/dashboard` },
            ],
        ]
    )
}

// ═══════════════════════════════════════════════════
// /doanhthu — Revenue Summary
// ═══════════════════════════════════════════════════

export async function handleRevenue(chatId: number) {
    const now = new Date()
    const from = startOfMonth(now)
    const to = endOfMonth(now)
    const prevFrom = startOfMonth(subMonths(now, 1))
    const prevTo = endOfMonth(subMonths(now, 1))

    const [currentRev, prevRev, orderCount, todayRev] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
            },
            _sum: { totalAmount: true },
        }),
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: prevFrom, lte: prevTo },
            },
            _sum: { totalAmount: true },
        }),
        prisma.salesOrder.count({
            where: { createdAt: { gte: from, lte: to } },
        }),
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: {
                    gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    lte: now,
                },
            },
            _sum: { totalAmount: true },
        }),
    ])

    const current = Number(currentRev._sum.totalAmount ?? 0)
    const prev = Number(prevRev._sum.totalAmount ?? 0)
    const today = Number(todayRev._sum.totalAmount ?? 0)
    const growth = prev > 0 ? ((current - prev) / prev * 100).toFixed(1) : 'N/A'
    const growthIcon = current >= prev ? '📈' : '📉'

    const msg = `💰 <b>Doanh Thu — ${now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</b>

━━━━━━━━━━━━━━━━━━
📅 <b>Hôm nay:</b> ${formatVND(today)}
📊 <b>Tháng này:</b> ${formatVND(current)}
📋 <b>Số đơn:</b> ${orderCount}

${growthIcon} <b>So tháng trước:</b> ${growth}%
📦 <b>Tháng trước:</b> ${formatVND(prev)}
━━━━━━━━━━━━━━━━━━`

    await sendMessageWithKeyboard(chatId, msg, [
        [
            { text: '📊 Xem chi tiết', url: `${APP_URL}/dashboard` },
            { text: '🔄 Làm mới', callback_data: 'cmd:doanhthu' },
        ],
    ])
}

// ═══════════════════════════════════════════════════
// /donhang — Recent Orders
// ═══════════════════════════════════════════════════

export async function handleOrders(chatId: number) {
    const orders = await prisma.salesOrder.findMany({
        include: { customer: { select: { name: true } }, salesRep: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
    })

    if (orders.length === 0) {
        await sendMessage(chatId, '📦 Chưa có đơn hàng nào.')
        return
    }

    const statusEmoji: Record<string, string> = {
        DRAFT: '📝', PENDING_APPROVAL: '⏳', CONFIRMED: '✅',
        PARTIALLY_DELIVERED: '🚚', DELIVERED: '📬', INVOICED: '🧾',
        PAID: '💰', CANCELLED: '❌',
    }

    let msg = `📦 <b>Đơn hàng gần đây</b>\n━━━━━━━━━━━━━━━━━━\n\n`

    for (const o of orders) {
        const emoji = statusEmoji[o.status] ?? '📋'
        const amount = formatVND(Number(o.totalAmount))
        const customer = escapeHtml(o.customer?.name ?? 'Khách lẻ')
        msg += `${emoji} <b>${o.soNo}</b> — ${amount}\n`
        msg += `   👤 ${customer} • ${o.salesRep?.name ?? ''}\n`
        msg += `   📅 ${o.createdAt.toLocaleDateString('vi-VN')}\n\n`
    }

    await sendMessageWithKeyboard(chatId, msg, [
        [
            { text: '📋 Xem tất cả', url: `${APP_URL}/dashboard/sales` },
            { text: '🔄 Làm mới', callback_data: 'cmd:donhang' },
        ],
    ])
}

// ═══════════════════════════════════════════════════
// /pheduyet — Pending Approvals
// ═══════════════════════════════════════════════════

export async function handleApprovals(chatId: number) {
    const requests = await prisma.approvalRequest.findMany({
        where: { status: 'PENDING' },
        include: {
            template: { select: { name: true, docType: true } },
            requester: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    })

    if (requests.length === 0) {
        await sendMessage(chatId, '✅ Không có yêu cầu phê duyệt nào đang chờ!')
        return
    }

    let msg = `✅ <b>Phê duyệt chờ xử lý</b> (${requests.length})\n━━━━━━━━━━━━━━━━━━\n\n`

    const buttons: { text: string; callback_data: string }[][] = []

    for (const r of requests) {
        const typeLabel = r.docType === 'PURCHASE_ORDER' ? 'PO' : r.docType === 'SALES_ORDER' ? 'SO' : r.docType
        msg += `📋 <b>${typeLabel}</b> — ${r.template.name}\n`
        msg += `   👤 Yêu cầu bởi: ${escapeHtml(r.requester.name)}\n`
        msg += `   📅 ${r.createdAt.toLocaleDateString('vi-VN')}\n`
        msg += `   🔢 Bước hiện tại: ${r.currentStep}\n\n`

        // Quick approve/reject buttons for each request
        buttons.push([
            { text: `✅ Duyệt ${typeLabel}`, callback_data: `approve:${r.id}` },
            { text: `❌ Từ chối ${typeLabel}`, callback_data: `reject:${r.id}` },
        ])
    }

    buttons.push([
        { text: '🌐 Mở ERP', url: `${APP_URL}/dashboard/settings?tab=approvals` },
    ])

    await sendMessageWithKeyboard(chatId, msg, buttons)
}

// ═══════════════════════════════════════════════════
// /tonkho — Stock Overview
// ═══════════════════════════════════════════════════

export async function handleStock(chatId: number) {
    const [totalQty, lowStock, quarantine, productCount] = await Promise.all([
        prisma.stockLot.aggregate({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
        }),
        prisma.stockLot.groupBy({
            by: ['productId'],
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
            having: { qtyAvailable: { _sum: { lt: 12 } } },
        }),
        prisma.stockLot.count({
            where: { status: 'QUARANTINE', qtyAvailable: { gt: 0 } },
        }),
        prisma.product.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    ])

    // Top 5 products by stock quantity
    const topProducts = await prisma.stockLot.groupBy({
        by: ['productId'],
        where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
        _sum: { qtyAvailable: true },
        orderBy: { _sum: { qtyAvailable: 'desc' } },
        take: 5,
    })

    let topList = ''
    if (topProducts.length > 0) {
        const products = await prisma.product.findMany({
            where: { id: { in: topProducts.map(p => p.productId) } },
            select: { id: true, productName: true, skuCode: true },
        })
        const productMap = new Map(products.map(p => [p.id, p]))

        for (const tp of topProducts) {
            const prod = productMap.get(tp.productId)
            if (prod) {
                topList += `  🍷 ${escapeHtml(prod.productName.slice(0, 30))} — ${Number(tp._sum.qtyAvailable)} chai\n`
            }
        }
    }

    const totalBottles = Number(totalQty._sum.qtyAvailable ?? 0)

    const msg = `🏭 <b>Tổng Quan Tồn Kho</b>
━━━━━━━━━━━━━━━━━━

📦 <b>Tổng tồn:</b> ${totalBottles.toLocaleString('vi-VN')} chai
📋 <b>SKU đang hoạt động:</b> ${productCount}
⚠️ <b>Tồn thấp (&lt;12 chai):</b> ${lowStock.length} SKU
🔒 <b>Cách ly (Quarantine):</b> ${quarantine} lô

<b>Top 5 tồn kho:</b>
${topList || '  Chưa có dữ liệu'}
━━━━━━━━━━━━━━━━━━`

    await sendMessageWithKeyboard(chatId, msg, [
        [
            { text: '📊 Chi tiết kho', url: `${APP_URL}/dashboard/warehouse` },
            { text: '🔄 Làm mới', callback_data: 'cmd:tonkho' },
        ],
    ])
}

// ═══════════════════════════════════════════════════
// /congno — AR Aging
// ═══════════════════════════════════════════════════

export async function handleDebt(chatId: number) {
    const now = new Date()

    const invoices = await prisma.aRInvoice.findMany({
        where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        include: { customer: { select: { name: true } } },
    })

    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
    let totalOutstanding = 0

    for (const inv of invoices) {
        const amount = Number(inv.totalAmount)
        totalOutstanding += amount
        const daysPast = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)

        if (daysPast <= 0) buckets.current += amount
        else if (daysPast <= 30) buckets.d30 += amount
        else if (daysPast <= 60) buckets.d60 += amount
        else if (daysPast <= 90) buckets.d90 += amount
        else buckets.d90plus += amount
    }

    // Top 5 debtors
    const debtors = new Map<string, { name: string; total: number }>()
    for (const inv of invoices) {
        const key = inv.customerId
        const existing = debtors.get(key) ?? { name: inv.customer?.name ?? 'N/A', total: 0 }
        existing.total += Number(inv.totalAmount)
        debtors.set(key, existing)
    }
    const topDebtors = [...debtors.values()].sort((a, b) => b.total - a.total).slice(0, 5)

    let debtorList = ''
    for (const d of topDebtors) {
        debtorList += `  👤 ${escapeHtml(d.name.slice(0, 25))} — ${formatVND(d.total)}\n`
    }

    const msg = `💳 <b>Công Nợ Phải Thu (AR)</b>
━━━━━━━━━━━━━━━━━━

💰 <b>Tổng dư nợ:</b> ${formatVND(totalOutstanding)}
📋 <b>Số hóa đơn:</b> ${invoices.length}

<b>Phân tích tuổi nợ:</b>
  ✅ Chưa đến hạn: ${formatVND(buckets.current)}
  🟡 1-30 ngày: ${formatVND(buckets.d30)}
  🟠 31-60 ngày: ${formatVND(buckets.d60)}
  🔴 61-90 ngày: ${formatVND(buckets.d90)}
  ⛔ &gt;90 ngày: ${formatVND(buckets.d90plus)}

<b>Top khách nợ nhiều:</b>
${debtorList || '  Không có dữ liệu'}
━━━━━━━━━━━━━━━━━━`

    await sendMessageWithKeyboard(chatId, msg, [
        [
            { text: '💳 Xem chi tiết', url: `${APP_URL}/dashboard/finance` },
            { text: '🔄 Làm mới', callback_data: 'cmd:congno' },
        ],
    ])
}

// ═══════════════════════════════════════════════════
// /baocao — Quick Summary Report
// ═══════════════════════════════════════════════════

export async function handleReport(chatId: number) {
    const now = new Date()
    const from = startOfMonth(now)
    const to = endOfMonth(now)

    const [revenue, orderCount, pendingApprovals, stockQty, arTotal, shipments, contracts] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: from, lte: to },
            },
            _sum: { totalAmount: true },
        }),
        prisma.salesOrder.count({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
        prisma.stockLot.aggregate({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            _sum: { qtyAvailable: true },
        }),
        prisma.aRInvoice.aggregate({
            where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
            _sum: { totalAmount: true },
        }),
        prisma.shipment.count({
            where: { status: { in: ['BOOKED', 'ON_VESSEL', 'ARRIVED_PORT'] } },
        }),
        prisma.contract.count({
            where: {
                status: 'ACTIVE',
                endDate: { lte: new Date(now.getTime() + 30 * 86400000) },
            },
        }),
    ])

    const rev = Number(revenue._sum.totalAmount ?? 0)
    const stock = Number(stockQty._sum.qtyAvailable ?? 0)
    const ar = Number(arTotal._sum.totalAmount ?? 0)

    const msg = `📊 <b>Báo Cáo Tổng Hợp Nhanh</b>
🗓 ${now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━

💰 <b>Doanh thu tháng:</b> ${formatVND(rev)}
📦 <b>Số đơn hàng:</b> ${orderCount}
✅ <b>Chờ duyệt:</b> ${pendingApprovals}
🏭 <b>Tồn kho:</b> ${stock.toLocaleString('vi-VN')} chai
💳 <b>Công nợ phải thu:</b> ${formatVND(ar)}
🚢 <b>Lô hàng đang vận chuyển:</b> ${shipments}
📋 <b>HĐ sắp hết hạn (30 ngày):</b> ${contracts}

━━━━━━━━━━━━━━━━━━
⏰ Cập nhật lúc: ${now.toLocaleTimeString('vi-VN')}`

    await sendMessageWithKeyboard(chatId, msg, [
        [
            { text: '📊 Dashboard đầy đủ', url: `${APP_URL}/dashboard` },
            { text: '🔄 Làm mới', callback_data: 'cmd:baocao' },
        ],
    ])
}

// ═══════════════════════════════════════════════════
// /timkiem <keyword> — Multi-module Search
// ═══════════════════════════════════════════════════

export async function handleSearch(chatId: number, query: string) {
    if (!query || query.length < 2) {
        await sendMessage(chatId, '🔍 Cú pháp: <code>/timkiem [từ khóa]</code>\n\nVí dụ: <code>/timkiem Margaux</code> hoặc <code>/timkiem SO-</code>')
        return
    }

    const searchTerm = `%${query}%`

    // Search in parallel: Products, Sales Orders, Customers
    const [products, orders, customers] = await Promise.all([
        prisma.product.findMany({
            where: {
                OR: [
                    { productName: { contains: query, mode: 'insensitive' } },
                    { skuCode: { contains: query, mode: 'insensitive' } },
                ],
                deletedAt: null,
            },
            select: { productName: true, skuCode: true, status: true },
            take: 5,
        }),
        prisma.salesOrder.findMany({
            where: {
                OR: [
                    { soNo: { contains: query, mode: 'insensitive' } },
                ],
            },
            include: { customer: { select: { name: true } } },
            take: 5,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.customer.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
                ],
                deletedAt: null,
            },
            select: { name: true, code: true, customerType: true },
            take: 5,
        }),
    ])

    let msg = `🔍 <b>Kết quả tìm kiếm:</b> "${escapeHtml(query)}"\n━━━━━━━━━━━━━━━━━━\n\n`

    if (products.length > 0) {
        msg += `<b>🍷 Sản phẩm (${products.length}):</b>\n`
        for (const p of products) {
            msg += `  • ${escapeHtml(p.productName.slice(0, 35))} [${p.skuCode}]\n`
        }
        msg += '\n'
    }

    if (orders.length > 0) {
        msg += `<b>📦 Đơn hàng (${orders.length}):</b>\n`
        for (const o of orders) {
            msg += `  • ${o.soNo} — ${escapeHtml(o.customer?.name ?? 'N/A')} (${formatVND(Number(o.totalAmount))})\n`
        }
        msg += '\n'
    }

    if (customers.length > 0) {
        msg += `<b>👤 Khách hàng (${customers.length}):</b>\n`
        for (const c of customers) {
            msg += `  • ${escapeHtml(c.name)} [${c.code}] — ${c.customerType}\n`
        }
        msg += '\n'
    }

    if (products.length === 0 && orders.length === 0 && customers.length === 0) {
        msg += '❌ Không tìm thấy kết quả nào.'
    }

    await sendMessage(chatId, msg)
}

// ═══════════════════════════════════════════════════
// Callback Query Handler (menu buttons, approvals)
// ═══════════════════════════════════════════════════

export async function handleCallbackQuery(query: TelegramCallbackQuery) {
    const chatId = query.message?.chat.id
    if (!chatId || !query.data) return

    await answerCallbackQuery(query.id)

    // Command callbacks (from menu)
    if (query.data.startsWith('cmd:')) {
        const cmd = query.data.replace('cmd:', '')
        switch (cmd) {
            case 'doanhthu': return handleRevenue(chatId)
            case 'donhang': return handleOrders(chatId)
            case 'pheduyet': return handleApprovals(chatId)
            case 'tonkho': return handleStock(chatId)
            case 'congno': return handleDebt(chatId)
            case 'baocao': return handleReport(chatId)
        }
    }

    // Approval callbacks
    if (query.data.startsWith('approve:') || query.data.startsWith('reject:')) {
        const [action, requestId] = query.data.split(':')
        const isApprove = action === 'approve'

        try {
            const request = await prisma.approvalRequest.findUnique({
                where: { id: requestId },
                include: { template: true },
            })

            if (!request) {
                await sendMessage(chatId, '❌ Yêu cầu không tồn tại hoặc đã bị xóa.')
                return
            }

            if (request.status !== 'PENDING') {
                await sendMessage(chatId, `ℹ️ Yêu cầu này đã được xử lý (${request.status}).`)
                return
            }

            // Update approval status
            await prisma.approvalRequest.update({
                where: { id: requestId },
                data: { status: isApprove ? 'APPROVED' : 'REJECTED' },
            })

            // If approving a SO — also update the SO status
            if (isApprove && request.docType === 'SALES_ORDER') {
                await prisma.salesOrder.update({
                    where: { id: request.docId },
                    data: { status: 'CONFIRMED' },
                })
            }

            const emoji = isApprove ? '✅' : '❌'
            const actionLabel = isApprove ? 'Đã duyệt' : 'Đã từ chối'

            // Edit the original message to reflect the action
            if (query.message) {
                await editMessageText(
                    chatId,
                    query.message.message_id,
                    `${emoji} <b>${actionLabel}</b> — ${request.template.name}\n\n🕐 ${new Date().toLocaleTimeString('vi-VN')}`,
                )
            }
        } catch (err) {
            console.error('[Telegram Approval Error]', err)
            await sendMessage(chatId, '❌ Lỗi khi xử lý phê duyệt. Vui lòng duyệt trên ERP.')
        }
    }
}
