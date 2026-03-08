import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    const style = req.nextUrl.searchParams.get('style') || 'professional'

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const qt = await prisma.salesQuotation.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, code: true, channel: true } },
            salesRep: { select: { name: true, email: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            skuCode: true, productName: true, wineType: true, volumeMl: true,
                            vintage: true, country: true, abvPercent: true, tastingNotes: true,
                            classification: true,
                            producer: { select: { name: true } },
                            appellation: { select: { name: true, region: { select: { name: true } } } },
                            media: { where: { isPrimary: true }, select: { url: true }, take: 1 },
                            awards: { select: { source: true, score: true, medal: true }, take: 2 },
                        },
                    },
                },
            },
        },
    })

    if (!qt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
    const fmtDate = (d: Date) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const subtotal = qt.lines.reduce((s, l) => {
        const qty = Number(l.qtyOrdered)
        const price = Number(l.unitPrice)
        const disc = Number(l.lineDiscountPct)
        return s + qty * price * (1 - disc / 100)
    }, 0)
    const discountAmount = subtotal * (Number(qt.orderDiscount) / 100)
    const afterDiscount = subtotal - discountAmount
    const vatAmount = qt.vatIncluded ? 0 : afterDiscount * 0.1
    const grandTotal = afterDiscount + vatAmount

    const isDark = style === 'elegant'

    // Theme colors — optimized for PRINT readability
    const t = isDark ? {
        pageBg: '#0F1F2E',
        cardBg: '#162736',
        headerBg: '#0B1924',
        text: '#F0F4F7',
        textStrong: '#FFFFFF',
        textMuted: '#94B3C8',
        accent: '#6EC5B0',
        accentDark: '#4A9E8B',
        border: '#2C4558',
        tableBg: '#162736',
        tableAlt: '#1A2F40',
        awardBg: 'rgba(234,179,8,0.2)',
        awardText: '#F5CC50',
    } : {
        pageBg: '#FFFFFF',
        cardBg: '#FFFFFF',
        headerBg: '#1A2D3D',
        text: '#1A1A1A',
        textStrong: '#000000',
        textMuted: '#555555',
        accent: '#1A7A66',
        accentDark: '#135E4F',
        border: '#D0D5DB',
        tableBg: '#FFFFFF',
        tableAlt: '#F5F7F9',
        awardBg: '#FFF8E1',
        awardText: '#B8860B',
    }

    const productRows = qt.lines.map((l, i) => {
        const qty = Number(l.qtyOrdered)
        const price = Number(l.unitPrice)
        const disc = Number(l.lineDiscountPct)
        const lineTotal = qty * price * (1 - disc / 100)
        const imgUrl = l.product.media?.[0]?.url
        const awards = l.product.awards?.map(a =>
            `${a.source} ${a.score ? Number(a.score) : (a.medal?.replace('_', ' ') || '')}`
        ).join(' · ')

        return `
        <tr class="${i % 2 === 1 ? 'alt' : ''}">
            <td class="cell-center cell-num">${i + 1}</td>
            <td class="cell-img">
                ${imgUrl
                ? `<img src="${imgUrl}" alt="" class="product-img" />`
                : `<div class="product-img-placeholder">🍷</div>`
            }
            </td>
            <td class="cell-product">
                <div class="product-name">${l.product.productName}</div>
                <div class="product-detail">
                    ${l.product.vintage ? `<strong>${l.product.vintage}</strong> · ` : ''}${l.product.appellation?.name || ''}${l.product.appellation?.region?.name ? ` · ${l.product.appellation.region.name}` : ''} · ${l.product.country}
                </div>
                <div class="product-meta">
                    ${l.product.skuCode} · ${l.product.wineType} · ${l.product.volumeMl}ml · ${Number(l.product.abvPercent)}% ABV${l.product.classification ? ` · ${l.product.classification}` : ''}
                </div>
                ${awards ? `<div class="product-awards">🏅 ${awards}</div>` : ''}
                ${l.product.tastingNotes ? `<div class="product-notes">${l.product.tastingNotes.slice(0, 120)}${l.product.tastingNotes.length > 120 ? '…' : ''}</div>` : ''}
            </td>
            <td class="cell-center cell-qty">${qty}</td>
            <td class="cell-right cell-price">${fmt(price)}</td>
            <td class="cell-center cell-disc">${disc > 0 ? `${disc}%` : '—'}</td>
            <td class="cell-right cell-total">${fmt(lineTotal)}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <title>Báo Giá ${qt.quotationNo} — LY's Cellars</title>
    <style>
        /* ═══════════ RESET & BASE ═══════════ */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        @page {
            size: A4;
            margin: 12mm 14mm;
        }

        body {
            font-family: 'Segoe UI', 'Arial', 'Helvetica Neue', sans-serif;
            font-size: 13px;
            line-height: 1.5;
            color: ${t.text};
            background: ${t.pageBg};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* ═══════════ HEADER ═══════════ */
        .header {
            background: ${t.headerBg};
            color: #FFFFFF;
            padding: 22px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-brand {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .header-logo {
            width: 44px;
            height: 44px;
            border: 2px solid ${t.accent};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
        }
        .header-name {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.02em;
        }
        .header-sub {
            font-size: 10px;
            letter-spacing: 0.18em;
            opacity: 0.7;
            margin-top: 1px;
        }
        .header-info {
            text-align: right;
            font-size: 11.5px;
            line-height: 1.7;
            opacity: 0.85;
        }
        .header-info strong {
            display: block;
            font-size: 12.5px;
            opacity: 1;
        }

        /* ═══════════ TITLE BAR ═══════════ */
        .title-bar {
            padding: 18px 28px;
            border-bottom: 3px solid ${t.accent};
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            background: ${t.cardBg};
        }
        .title-text {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: ${t.textStrong};
        }
        .title-no {
            font-size: 16px;
            font-weight: 700;
            color: ${t.accent};
            margin-top: 2px;
        }
        .title-dates {
            text-align: right;
            font-size: 13px;
            color: ${t.textMuted};
            line-height: 1.8;
        }
        .title-dates strong {
            color: ${t.textStrong};
        }

        /* ═══════════ CUSTOMER INFO ═══════════ */
        .info-grid {
            display: flex;
            gap: 24px;
            padding: 18px 28px;
            border-bottom: 1px solid ${t.border};
            background: ${t.cardBg};
        }
        .info-box {
            flex: 1;
        }
        .info-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 700;
            color: ${t.textMuted};
            margin-bottom: 6px;
        }
        .info-value {
            font-size: 15px;
            font-weight: 700;
            color: ${t.textStrong};
        }
        .info-detail {
            font-size: 12.5px;
            color: ${t.textMuted};
            margin-top: 3px;
            line-height: 1.6;
        }

        /* ═══════════ TABLE ═══════════ */
        .table-wrap {
            padding: 12px 28px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead th {
            padding: 10px 8px;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 700;
            color: ${isDark ? '#94B3C8' : '#666666'};
            border-bottom: 2px solid ${t.border};
            text-align: left;
        }
        thead th.th-center { text-align: center; }
        thead th.th-right { text-align: right; }

        tbody td {
            padding: 10px 8px;
            border-bottom: 1px solid ${isDark ? '#223344' : '#E8EAED'};
            vertical-align: top;
            font-size: 12.5px;
        }
        tr.alt { background: ${t.tableAlt}; }

        .cell-center { text-align: center; }
        .cell-right { text-align: right; }
        .cell-num { color: ${t.textMuted}; font-size: 12px; width: 28px; }
        .cell-img { width: 54px; }
        .cell-qty { width: 40px; font-weight: 600; color: ${t.textStrong}; }
        .cell-price { width: 100px; font-family: 'Consolas', 'Courier New', monospace; color: ${t.textStrong}; }
        .cell-disc { width: 48px; color: ${t.accent}; font-weight: 600; }
        .cell-total { width: 115px; font-family: 'Consolas', 'Courier New', monospace; font-weight: 700; color: ${t.textStrong}; font-size: 13px; }

        .product-img {
            width: 48px;
            height: 64px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid ${t.border};
        }
        .product-img-placeholder {
            width: 48px;
            height: 64px;
            border-radius: 4px;
            background: ${isDark ? '#1A2F40' : '#F0F0F0'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            border: 1px solid ${t.border};
        }
        .product-name {
            font-size: 13.5px;
            font-weight: 700;
            color: ${t.textStrong};
            margin-bottom: 2px;
        }
        .product-detail {
            font-size: 12px;
            color: ${t.textMuted};
        }
        .product-detail strong {
            color: ${t.accent};
            font-weight: 700;
        }
        .product-meta {
            font-size: 10.5px;
            color: ${isDark ? '#6B8A9E' : '#999999'};
            margin-top: 2px;
        }
        .product-awards {
            font-size: 11px;
            color: ${t.awardText};
            background: ${t.awardBg};
            display: inline-block;
            padding: 1px 8px;
            border-radius: 10px;
            font-weight: 600;
            margin-top: 4px;
        }
        .product-notes {
            font-size: 10.5px;
            color: ${isDark ? '#6B8A9E' : '#999999'};
            font-style: italic;
            margin-top: 3px;
            line-height: 1.4;
        }

        /* ═══════════ TOTALS ═══════════ */
        .totals-wrap {
            padding: 8px 28px 20px;
            display: flex;
            justify-content: flex-end;
        }
        .totals-box {
            width: 300px;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 13.5px;
        }
        .totals-row .label { color: ${t.textMuted}; }
        .totals-row .value { color: ${t.textStrong}; font-family: 'Consolas', 'Courier New', monospace; }
        .totals-row.discount .value { color: ${t.accent}; }
        .totals-grand {
            border-top: 3px solid ${t.accent};
            margin-top: 8px;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .totals-grand .label {
            font-size: 15px;
            font-weight: 700;
            color: ${t.textStrong};
        }
        .totals-grand .value {
            font-size: 22px;
            font-weight: 800;
            color: ${t.accent};
            font-family: 'Consolas', 'Courier New', monospace;
        }
        .vat-note {
            text-align: right;
            font-size: 11px;
            color: ${t.textMuted};
            margin-top: 4px;
        }

        /* ═══════════ TERMS ═══════════ */
        .terms-section {
            padding: 16px 28px;
            border-top: 1px solid ${t.border};
            margin: 0;
        }
        .terms-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 700;
            color: ${t.textMuted};
            margin-bottom: 6px;
        }
        .terms-content {
            font-size: 12.5px;
            color: ${t.text};
            line-height: 1.7;
            white-space: pre-line;
        }

        /* ═══════════ FOOTER ═══════════ */
        .footer {
            padding: 14px 28px;
            border-top: 1px solid ${t.border};
            text-align: center;
            font-size: 10.5px;
            color: ${t.textMuted};
            margin-top: 12px;
        }

        /* ═══════════ PRINT BUTTON ═══════════ */
        .no-print { position: fixed; bottom: 20px; right: 20px; z-index: 999; display: flex; gap: 8px; }
        .btn-print {
            padding: 12px 28px;
            border-radius: 8px;
            border: none;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .btn-print-primary { background: ${t.accent}; color: ${isDark ? '#0A1926' : '#FFFFFF'}; }
        .btn-print-secondary { background: ${isDark ? '#2C4558' : '#E5E7EB'}; color: ${isDark ? '#E8F1F2' : '#333'}; }

        @media print {
            .no-print { display: none !important; }
            body { background: ${t.pageBg} !important; }
        }
    </style>
</head>
<body>
    <!-- HEADER -->
    <div class="header">
        <div class="header-brand">
            <div class="header-logo">🍷</div>
            <div>
                <div class="header-name">LY's Cellars</div>
                <div class="header-sub">FINE WINE SPECIALIST</div>
            </div>
        </div>
        <div class="header-info">
            <strong>CÔNG TY TNHH LY'S CELLARS</strong>
            MST: 0312345678<br/>
            123 Đường Pasteur, Quận 1, TP. Hồ Chí Minh<br/>
            ☎ 028 1234 5678 &nbsp;|&nbsp; ✉ info@lyscellars.com
        </div>
    </div>

    <!-- TITLE BAR -->
    <div class="title-bar">
        <div>
            <div class="title-text">BÁO GIÁ / QUOTATION</div>
            <div class="title-no">${qt.quotationNo}</div>
        </div>
        <div class="title-dates">
            Ngày lập: <strong>${fmtDate(qt.createdAt)}</strong><br/>
            Hiệu lực đến: <strong style="color: ${t.accent}">${fmtDate(qt.validUntil)}</strong>
        </div>
    </div>

    <!-- CUSTOMER INFO -->
    <div class="info-grid">
        <div class="info-box">
            <div class="info-label">Kính gửi</div>
            <div class="info-value">${qt.contactPerson || qt.customer.name}</div>
            ${qt.companyName ? `<div class="info-detail">${qt.companyName}</div>` : ''}
            <div class="info-detail">Mã KH: ${qt.customer.code} &nbsp;·&nbsp; Kênh: ${qt.channel}</div>
        </div>
        <div class="info-box">
            <div class="info-label">Điều khoản</div>
            <div class="info-detail" style="margin-top:0">
                Thanh toán: <strong style="color:${t.textStrong}">${qt.paymentTerm}</strong><br/>
                NV phụ trách: <strong style="color:${t.textStrong}">${qt.salesRep.name}</strong><br/>
                ${qt.salesRep.email ? `<span style="color:${t.accent}">${qt.salesRep.email}</span>` : ''}
            </div>
        </div>
    </div>

    <!-- PRODUCT TABLE -->
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th class="th-center">#</th>
                    <th></th>
                    <th>Sản Phẩm</th>
                    <th class="th-center">SL</th>
                    <th class="th-right">Đơn Giá (₫)</th>
                    <th class="th-center">CK</th>
                    <th class="th-right">Thành Tiền (₫)</th>
                </tr>
            </thead>
            <tbody>
                ${productRows}
            </tbody>
        </table>
    </div>

    <!-- TOTALS -->
    <div class="totals-wrap">
        <div class="totals-box">
            <div class="totals-row">
                <span class="label">Tạm tính (${qt.lines.length} sản phẩm)</span>
                <span class="value">${fmt(subtotal)}</span>
            </div>
            ${Number(qt.orderDiscount) > 0 ? `
            <div class="totals-row discount">
                <span class="label">Chiết khấu ${qt.orderDiscount}%</span>
                <span class="value">−${fmt(discountAmount)}</span>
            </div>` : ''}
            ${!qt.vatIncluded ? `
            <div class="totals-row">
                <span class="label">VAT 10%</span>
                <span class="value">${fmt(vatAmount)}</span>
            </div>` : ''}
            <div class="totals-grand">
                <span class="label">TỔNG CỘNG</span>
                <span class="value">${fmt(grandTotal)} ₫</span>
            </div>
            <div class="vat-note">${qt.vatIncluded ? 'Giá đã bao gồm VAT' : 'Giá chưa bao gồm VAT 10%'}</div>
        </div>
    </div>

    <!-- TERMS & NOTES -->
    ${qt.terms ? `
    <div class="terms-section">
        <div class="terms-title">Điều khoản & Điều kiện</div>
        <div class="terms-content">${qt.terms}</div>
    </div>` : ''}
    ${qt.deliveryTerms ? `
    <div class="terms-section">
        <div class="terms-title">Giao hàng</div>
        <div class="terms-content">${qt.deliveryTerms}</div>
    </div>` : ''}
    ${qt.notes ? `
    <div class="terms-section">
        <div class="terms-title">Ghi chú</div>
        <div class="terms-content">${qt.notes}</div>
    </div>` : ''}

    <!-- FOOTER -->
    <div class="footer">
        Báo giá được tạo bởi hệ thống LY's Cellars ERP &nbsp;·&nbsp; © ${new Date().getFullYear()} LY's Cellars
    </div>

    <!-- PRINT BUTTONS -->
    <div class="no-print">
        <button class="btn-print btn-print-secondary" onclick="location.href=location.href.replace('style=${style}','style=${style === 'elegant' ? 'professional' : 'elegant'}')">
            ${style === 'elegant' ? '☀️ Bản Trắng' : '🌙 Bản Tối'}
        </button>
        <button class="btn-print btn-print-primary" onclick="window.print()">
            🖨️ In / Lưu PDF
        </button>
    </div>
</body>
</html>`

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
}
