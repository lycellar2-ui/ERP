import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/export/quotation-pdf?id=xxx&style=professional|elegant|minimal
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
                            appellation: { select: { name: true, region: true } },
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

    // Style themes
    const themes: Record<string, { bg: string; headerBg: string; headerColor: string; accentColor: string; textColor: string; mutedColor: string; borderColor: string; tableBg: string; tableAltBg: string }> = {
        professional: {
            bg: '#FFFFFF', headerBg: '#1B2E3D', headerColor: '#FFFFFF', accentColor: '#87CBB9',
            textColor: '#1A1A1A', mutedColor: '#666666', borderColor: '#E5E7EB',
            tableBg: '#FFFFFF', tableAltBg: '#F9FAFB',
        },
        elegant: {
            bg: '#0A1926', headerBg: '#142433', headerColor: '#E8F1F2', accentColor: '#87CBB9',
            textColor: '#E8F1F2', mutedColor: '#8AAEBB', borderColor: '#2A4355',
            tableBg: '#142433', tableAltBg: '#1B2E3D',
        },
        minimal: {
            bg: '#FFFFFF', headerBg: '#FFFFFF', headerColor: '#111827', accentColor: '#0D9488',
            textColor: '#111827', mutedColor: '#9CA3AF', borderColor: '#E5E7EB',
            tableBg: '#FFFFFF', tableAltBg: '#F3F4F6',
        },
    }

    const t = themes[style] || themes.professional

    const productRows = qt.lines.map((l, i) => {
        const qty = Number(l.qtyOrdered)
        const price = Number(l.unitPrice)
        const disc = Number(l.lineDiscountPct)
        const lineTotal = qty * price * (1 - disc / 100)
        const imgUrl = l.product.media?.[0]?.url
        const awards = l.product.awards?.map(a => `${a.source} ${a.score ? Number(a.score) : a.medal?.replace('_', ' ') || ''}`).join(', ')

        return `
            <tr style="background:${i % 2 === 0 ? t.tableBg : t.tableAltBg}">
                <td style="padding:12px 8px;color:${t.mutedColor};font-size:12px;text-align:center;border-bottom:1px solid ${t.borderColor}">${i + 1}</td>
                <td style="padding:12px 8px;border-bottom:1px solid ${t.borderColor};width:60px">
                    ${imgUrl ? `<img src="${imgUrl}" style="width:50px;height:70px;object-fit:cover;border-radius:4px" />` : '<div style="width:50px;height:70px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px">🍷</div>'}
                </td>
                <td style="padding:12px 8px;border-bottom:1px solid ${t.borderColor}">
                    <div style="color:${t.textColor};font-weight:600;font-size:13px">${l.product.productName}</div>
                    <div style="color:${t.mutedColor};font-size:11px;margin-top:2px">
                        ${l.product.vintage ? `<strong>${l.product.vintage}</strong> · ` : ''}${l.product.appellation?.name || ''} ${l.product.appellation?.region ? `· ${l.product.appellation.region}` : ''} · ${l.product.country}
                    </div>
                    <div style="color:${t.mutedColor};font-size:10px;margin-top:2px">
                        ${l.product.skuCode} · ${l.product.wineType} · ${l.product.volumeMl}ml · ABV ${Number(l.product.abvPercent)}%${l.product.classification ? ` · ${l.product.classification}` : ''}
                    </div>
                    ${awards ? `<div style="color:#EAB308;font-size:10px;margin-top:3px">🏅 ${awards}</div>` : ''}
                    ${l.product.tastingNotes ? `<div style="color:${t.mutedColor};font-size:10px;font-style:italic;margin-top:3px">${l.product.tastingNotes.slice(0, 100)}${l.product.tastingNotes.length > 100 ? '…' : ''}</div>` : ''}
                </td>
                <td style="padding:12px 8px;text-align:center;color:${t.textColor};font-size:13px;border-bottom:1px solid ${t.borderColor}">${qty}</td>
                <td style="padding:12px 8px;text-align:right;color:${t.textColor};font-size:13px;border-bottom:1px solid ${t.borderColor}">${fmt(price)}</td>
                <td style="padding:12px 8px;text-align:center;color:${disc > 0 ? t.accentColor : t.mutedColor};font-size:13px;border-bottom:1px solid ${t.borderColor}">${disc > 0 ? `${disc}%` : '—'}</td>
                <td style="padding:12px 8px;text-align:right;color:${t.textColor};font-weight:600;font-size:13px;border-bottom:1px solid ${t.borderColor}">${fmt(lineTotal)}</td>
            </tr>
        `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Báo Giá ${qt.quotationNo} — LY's Cellars</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Inter',system-ui,sans-serif; background:${t.bg}; color:${t.textColor}; }
        @media print {
            body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
            .no-print { display:none !important; }
            @page { margin:10mm; size:A4; }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div style="background:${t.headerBg};padding:28px 32px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:16px">
            <svg width="42" height="42" viewBox="0 0 40 48" fill="none">
                <path d="M8 4 Q8 20 20 26 Q32 20 32 4 Z" stroke="${t.accentColor}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <line x1="20" y1="26" x2="20" y2="40" stroke="${t.accentColor}" stroke-width="1.8" stroke-linecap="round" />
                <line x1="13" y1="40" x2="27" y2="40" stroke="${t.accentColor}" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <div>
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:${t.headerColor}">LY's Cellars</div>
                <div style="font-size:10px;letter-spacing:0.15em;color:${t.mutedColor}">FINE WINE SPECIALIST</div>
            </div>
        </div>
        <div style="text-align:right;color:${style === 'elegant' ? t.mutedColor : t.mutedColor};font-size:12px;line-height:1.8">
            <div>CÔNG TY TNHH LY'S CELLARS</div>
            <div>MST: 0312345678</div>
            <div>📍 123 Đường Pasteur, Q.1, TP.HCM</div>
            <div>📞 028 1234 5678 | 📧 info@lyscellars.com</div>
        </div>
    </div>

    <!-- Title -->
    <div style="padding:24px 32px;border-bottom:2px solid ${t.accentColor}">
        <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:${t.textColor}">BÁO GIÁ / QUOTATION</div>
                <div style="font-size:14px;color:${t.accentColor};font-weight:600;margin-top:2px">${qt.quotationNo}</div>
            </div>
            <div style="text-align:right;font-size:13px;color:${t.mutedColor};line-height:1.8">
                <div>Ngày: <strong style="color:${t.textColor}">${fmtDate(qt.createdAt)}</strong></div>
                <div>Hiệu lực đến: <strong style="color:${t.accentColor}">${fmtDate(qt.validUntil)}</strong></div>
            </div>
        </div>
    </div>

    <!-- Customer info -->
    <div style="padding:20px 32px;display:flex;gap:32px;border-bottom:1px solid ${t.borderColor}">
        <div style="flex:1">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${t.mutedColor};margin-bottom:6px">KÍNH GỬI</div>
            <div style="font-size:16px;font-weight:600;color:${t.textColor}">${qt.contactPerson || qt.customer.name}</div>
            ${qt.companyName ? `<div style="font-size:13px;color:${t.mutedColor};margin-top:2px">${qt.companyName}</div>` : ''}
            <div style="font-size:12px;color:${t.mutedColor};margin-top:2px">Mã KH: ${qt.customer.code} · Kênh: ${qt.channel}</div>
        </div>
        <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${t.mutedColor};margin-bottom:6px">ĐIỀU KHOẢN</div>
            <div style="font-size:13px;color:${t.textColor};line-height:1.8">
                <div>Thanh toán: <strong>${qt.paymentTerm}</strong></div>
                <div>NV phụ trách: <strong>${qt.salesRep.name}</strong></div>
                ${qt.salesRep.email ? `<div style="color:${t.accentColor};font-size:12px">${qt.salesRep.email}</div>` : ''}
            </div>
        </div>
    </div>

    <!-- Product table -->
    <div style="padding:16px 32px">
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="border-bottom:2px solid ${t.borderColor}">
                    <th style="padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:30px">#</th>
                    <th style="padding:10px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:60px"></th>
                    <th style="padding:10px 8px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor}">Sản Phẩm</th>
                    <th style="padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:50px">SL</th>
                    <th style="padding:10px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:110px">Đơn Giá (₫)</th>
                    <th style="padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:50px">CK</th>
                    <th style="padding:10px 8px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};width:130px">Thành Tiền (₫)</th>
                </tr>
            </thead>
            <tbody>
                ${productRows}
            </tbody>
        </table>
    </div>

    <!-- Totals -->
    <div style="padding:0 32px 24px;display:flex;justify-content:flex-end">
        <div style="width:320px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:${t.mutedColor}">Tạm tính</span>
                <span style="color:${t.textColor}">${fmt(subtotal)} ₫</span>
            </div>
            ${Number(qt.orderDiscount) > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:${t.accentColor}">Chiết khấu (${qt.orderDiscount}%)</span>
                <span style="color:${t.accentColor}">−${fmt(discountAmount)} ₫</span>
            </div>` : ''}
            ${!qt.vatIncluded ? `
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px">
                <span style="color:${t.mutedColor}">VAT (10%)</span>
                <span style="color:${t.textColor}">${fmt(vatAmount)} ₫</span>
            </div>` : ''}
            <div style="border-top:2px solid ${t.accentColor};margin-top:8px;padding-top:12px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:16px;font-weight:600">TỔNG CỘNG</span>
                <span style="font-size:24px;font-weight:700;color:${t.accentColor};font-family:'Cormorant Garamond',Georgia,serif">${fmt(grandTotal)} ₫</span>
            </div>
            ${qt.vatIncluded ? `<div style="text-align:right;font-size:11px;color:${t.mutedColor};margin-top:4px">Giá đã bao gồm VAT</div>` : `<div style="text-align:right;font-size:11px;color:${t.mutedColor};margin-top:4px">Giá chưa bao gồm VAT</div>`}
        </div>
    </div>

    <!-- Terms -->
    ${(qt.terms || qt.deliveryTerms || qt.notes) ? `
    <div style="padding:16px 32px;margin:0 32px;border-top:1px solid ${t.borderColor}">
        ${qt.terms ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};margin-bottom:4px">Điều Khoản & Điều Kiện</div><div style="font-size:13px;color:${t.textColor};line-height:1.7;white-space:pre-line">${qt.terms}</div></div>` : ''}
        ${qt.deliveryTerms ? `<div style="margin-bottom:12px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};margin-bottom:4px">Giao Hàng</div><div style="font-size:13px;color:${t.textColor}">${qt.deliveryTerms}</div></div>` : ''}
        ${qt.notes ? `<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${t.mutedColor};margin-bottom:4px">Ghi Chú</div><div style="font-size:13px;color:${t.textColor};white-space:pre-line">${qt.notes}</div></div>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:20px 32px;margin-top:16px;border-top:1px solid ${t.borderColor};text-align:center">
        <div style="font-size:11px;color:${t.mutedColor}">
            Báo giá được tạo tự động bởi LY's Cellars ERP · © ${new Date().getFullYear()} LY's Cellars
        </div>
    </div>

    <!-- Print button (no-print) -->
    <div class="no-print" style="position:fixed;bottom:24px;right:24px;display:flex;gap:8px">
        <button onclick="window.print()" style="padding:12px 24px;border-radius:8px;background:${t.accentColor};color:#0A1926;border:none;font-weight:600;cursor:pointer;font-size:14px">
            🖨️ In / Tải PDF
        </button>
    </div>
</body>
</html>`

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    })
}
