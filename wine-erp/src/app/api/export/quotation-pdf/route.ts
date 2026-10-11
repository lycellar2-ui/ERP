import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    const token = req.nextUrl.searchParams.get('token')
    const style = req.nextUrl.searchParams.get('style') || 'professional'

    if (!id && !token) return NextResponse.json({ error: 'Missing id or token' }, { status: 400 })

    const qt = await prisma.salesQuotation.findUnique({
        where: token ? { publicToken: token } : { id: id! },
        include: {
            customer: { select: { name: true, code: true, channel: true } },
            salesRep: { select: { name: true, email: true } },
            lines: {
                include: {
                    product: {
                        select: {
                            skuCode: true, productName: true, wineType: true, volumeMl: true,
                            country: true, abvPercent: true, profile: true,
                            classification: true, format: true, packagingType: true,
                            producer: { select: { name: true } },
                            supplier: { select: { name: true } },
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

    const origin = req.nextUrl.origin
    const html = renderHtml(qt, style, origin)
    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
}

export async function POST(req: NextRequest) {
    try {
        let data: any
        const contentType = req.headers.get('content-type') || ''
        if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
            const formData = await req.formData()
            const dataStr = formData.get('data') as string
            data = JSON.parse(dataStr)
        } else {
            data = await req.json()
        }

        const style = data.pdfStyle || 'professional'

        // Fetch customer and salesRep and products
        let customer: any = null
        if (data.customerId && data.customerId !== 'TEMP_CUSTOMER') {
            customer = await prisma.customer.findUnique({
                where: { id: data.customerId },
                select: { name: true, code: true, channel: true }
            })
        }
        if (!customer) {
            customer = {
                name: data.companyName || data.contactPerson || 'Khách Hàng Mới',
                code: 'TEMP',
                channel: data.channel || 'HORECA'
            }
        }

        let salesRep: any = null
        if (data.salesRepId) {
            salesRep = await prisma.user.findUnique({
                where: { id: data.salesRepId },
                select: { name: true, email: true }
            })
        }
        if (!salesRep) {
            salesRep = { name: 'Chưa chỉ định', email: '' }
        }

        const productIds = data.lines?.map((l: any) => l.productId).filter(Boolean) || []
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                skuCode: true, productName: true, wineType: true, volumeMl: true,
                country: true, abvPercent: true, profile: true,
                classification: true, format: true, packagingType: true,
                producer: { select: { name: true } },
                supplier: { select: { name: true } },
                appellation: { select: { name: true, region: { select: { name: true } } } },
                media: { where: { isPrimary: true }, select: { url: true }, take: 1 },
                awards: { select: { source: true, score: true, medal: true }, take: 2 },
            }
        })

        // Build qt object resembling SalesQuotation structure
        const qt = {
            quotationNo: 'QT-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-PREVIEW',
            createdAt: new Date(),
            validUntil: data.validUntil ? new Date(data.validUntil) : new Date(Date.now() + 30 * 86400000),
            orderDiscount: Number(data.orderDiscount) || 0,
            vatIncluded: data.vatIncluded || false,
            showQuantity: data.showQuantity || false,
            paymentTerm: data.paymentTerm || 'NET30',
            notes: data.notes || '',
            terms: data.terms || '',
            deliveryTerms: data.deliveryTerms || '',
            companyName: data.companyName || '',
            contactPerson: data.contactPerson || '',
            customer,
            salesRep,
            channel: data.channel || 'HORECA',
            lines: (data.lines || []).map((l: any) => {
                const product = dbProducts.find(p => p.id === l.productId)
                return {
                    qtyOrdered: Number(l.qtyOrdered || l.qty || 1),
                    unitPrice: Number(l.unitPrice || l.price || 0),
                    lineDiscountPct: Number(l.lineDiscountPct || l.discount || 0),
                    product: product || {
                        productName: 'Sản phẩm chưa chọn',
                        skuCode: '—',
                        wineType: 'OTHER',
                        volumeMl: 750,
                        country: '—',
                        abvPercent: 0,
                        media: []
                    }
                }
            })
        }

        const origin = req.nextUrl.origin
        const html = renderHtml(qt, style, origin)
        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

function renderHtml(qt: any, style: string, origin?: string): string {
    const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
    const fmtDate = (d: Date) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const subtotal = qt.lines.reduce((s: number, l: any) => {
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

    // Luxury Fine Wine Theme Tokens (strictly respecting Purple Ban)
    const t = isDark ? {
        pageBg: '#0B1924',
        cardBg: '#112232',
        headerBg: '#07121B',
        headerText: '#FFFFFF',
        text: '#E2E8F0',
        textStrong: '#FFFFFF',
        textMuted: '#94A3B8',
        goldAccent: '#D4AF37',
        goldAccentMuted: '#997F29',
        tealAccent: '#2DD4BF',
        border: '#1E3547',
        borderLight: '#182C3C',
        tableBg: '#112232',
        tableAlt: '#142738',
        tableHover: '#1A334A',
        awardBg: 'rgba(212, 175, 55, 0.12)',
        awardText: '#F3D068',
        awardBorder: 'rgba(212, 175, 55, 0.3)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    } : {
        pageBg: '#FDFCF9',
        cardBg: '#FFFFFF',
        headerBg: '#0B1924',
        headerText: '#FFFFFF',
        text: '#1E293B',
        textStrong: '#0F172A',
        textMuted: '#64748B',
        goldAccent: '#C5A059',
        goldAccentMuted: '#92400E',
        tealAccent: '#0E7490',
        border: '#E2E8F0',
        borderLight: '#F1F5F9',
        tableBg: '#FFFFFF',
        tableAlt: '#FAFAF8',
        tableHover: '#F4F3EF',
        awardBg: '#FFFBEB',
        awardText: '#92400E',
        awardBorder: '#FDE68A',
        boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
    }

    // Group lines by Supplier and Country
    const groups: Record<string, { supplierName: string; country: string; lines: any[] }> = {}
    for (const l of qt.lines) {
        const supplierName = l.product.supplier?.name || "Ly's Cellars"
        const country = l.product.country || "Other"
        const key = `${supplierName} - ${country}`
        if (!groups[key]) {
            groups[key] = { supplierName, country, lines: [] }
        }
        groups[key].lines.push(l)
    }

    let globalIdx = 0
    const productRows = Object.entries(groups).map(([groupKey, group]) => {
        const groupHeaderRow = `
        <tr class="group-header">
            <td colspan="${qt.showQuantity ? 7 : 6}" class="group-header-cell">
                <div class="group-title-inner">
                    <span class="group-badge">MAISON</span>
                    <span class="group-name">${group.supplierName}</span>
                    <span class="group-sep">✦</span>
                    <span class="group-origin">TERROIR: ${group.country.toUpperCase()}</span>
                </div>
            </td>
        </tr>`

        const lineRows = group.lines.map((l) => {
            globalIdx++
            const qty = Number(l.qtyOrdered)
            const price = Number(l.unitPrice)
            const disc = Number(l.lineDiscountPct)
            const lineTotal = qty * price * (1 - disc / 100)
            const imgUrl = l.product.media?.[0]?.url
            const awards = l.product.awards?.map((a: any) =>
                `${a.source} ${a.score ? `${Number(a.score)} pts` : (a.medal?.replace('_', ' ') || '')}`
            ).join(' · ')

            const originParts = [
                l.product.appellation?.name,
                l.product.appellation?.region?.name !== l.product.appellation?.name ? l.product.appellation?.region?.name : null,
                l.product.country
            ].filter(Boolean).join(' · ')

            const profile = l.product.profile
            const tastingParts = profile ? [
                profile.grapes ? `Nho: ${profile.grapes}` : null,
                profile.aromas ? `Hương: ${profile.aromas}` : null,
                profile.palate ? `Vị: ${profile.palate}` : null,
                profile.servingTemp ? `Phục vụ: ${profile.servingTemp}` : null,
                profile.foodPairings ? `Ẩm thực: ${profile.foodPairings}` : null,
            ].filter(Boolean).join(' • ') : ''

            return `
            <tr class="item-row ${globalIdx % 2 === 0 ? 'alt' : ''}">
                <td class="cell-center cell-num">${String(globalIdx).padStart(2, '0')}</td>
                <td class="cell-img">
                    ${imgUrl
                    ? `<img src="${imgUrl}" alt="${l.product.productName}" class="product-img" />`
                    : `<div class="product-img-placeholder">
                        <svg width="20" height="24" viewBox="0 0 24 28" fill="none" stroke="${t.goldAccent}" stroke-width="1.5">
                            <path d="M4 2 Q4 13 12 17 Q20 13 20 2 Z" />
                            <line x1="12" y1="17" x2="12" y2="25" />
                            <line x1="7" y1="25" x2="17" y2="25" />
                        </svg>
                       </div>`
                    }
                </td>
                <td class="cell-product">
                    ${l.product.producer?.name ? `
                        <div style="font-size: 8.5px; font-weight: 700; letter-spacing: 0.14em; color: ${t.goldAccent}; text-transform: uppercase; margin-bottom: 2px;">
                            MAISON &bull; ${l.product.producer.name}
                        </div>
                    ` : ''}
                    <div class="product-title-row">
                        <span class="product-name font-display">${l.product.productName}</span>
                    </div>
                    ${originParts ? `<div class="product-origin">${originParts}</div>` : ''}
                    <div class="product-meta">
                        <span class="meta-tag font-mono">SKU: ${l.product.skuCode}</span>
                        <span class="meta-dot">·</span>
                        <span>${l.product.wineType}</span>
                        <span class="meta-dot">·</span>
                        <span>${l.product.volumeMl}ml</span>
                        <span class="meta-dot">·</span>
                        <span>${Number(l.product.abvPercent)}% ABV</span>
                        ${l.product.classification ? `
                            <span class="meta-dot">·</span>
                            <span class="classification-badge">${l.product.classification}</span>
                        ` : ''}
                        ${l.product.packagingType ? `
                            <span class="meta-dot">·</span>
                            <span style="color:${t.textMuted}; font-size:9px;">Quy cách: ${String(l.product.packagingType).replace('_', ' ')}</span>
                        ` : ''}
                    </div>
                    ${awards ? `
                        <div class="product-awards">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="${t.goldAccent}" stroke="none" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <span>${awards}</span>
                        </div>
                    ` : ''}
                    ${tastingParts ? `
                        <div class="product-tasting">
                            <span class="tasting-label font-display">Sommelier Notes:</span> <em>${tastingParts}</em>
                        </div>
                    ` : ''}
                </td>
                ${qt.showQuantity ? `
                <td class="cell-center cell-qty font-mono">${qty}</td>
                <td class="cell-right cell-price font-mono">${fmt(price)}</td>
                <td class="cell-center cell-disc font-mono">${disc > 0 ? `−${disc}%` : '—'}</td>
                <td class="cell-right cell-total font-mono">${fmt(lineTotal)}</td>
                ` : `
                <td class="cell-right cell-price font-mono">${fmt(price)}</td>
                <td class="cell-center cell-disc font-mono">${disc > 0 ? `−${disc}%` : '—'}</td>
                <td class="cell-right cell-total font-mono">${fmt(price * (1 - disc / 100))}</td>
                `}
            </tr>`
        }).join('')

        return groupHeaderRow + lineRows
    }).join('')

    const isPreview = qt.quotationNo.endsWith('-PREVIEW')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Báo Giá ${qt.quotationNo} — LY's Cellars Fine Wine</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* ═══════════ LUXURY A4 PRINT SPECIFICATION ═══════════ */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11.5px;
            line-height: 1.5;
            color: ${t.text};
            background: ${t.pageBg};
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .font-display {
            font-family: 'Cormorant Garamond', Garamond, 'Georgia', serif;
        }

        .font-mono {
            font-family: 'Inter', -apple-system, sans-serif;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.01em;
        }

        .proposal-container {
            max-width: 210mm;
            margin: 0 auto;
            background: ${t.cardBg};
            box-shadow: ${isDark ? 'none' : '0 10px 40px rgba(0,0,0,0.06)'};
            border: 1px solid ${t.border};
            position: relative;
        }

        /* ═══════════ TOP GOLD ORNAMENTAL BORDER ═══════════ */
        .gold-hairstripe {
            height: 4px;
            background: linear-gradient(90deg, ${t.goldAccent} 0%, #F5E6AB 50%, ${t.goldAccent} 100%);
            width: 100%;
        }

        /* ═══════════ HEADER ═══════════ */
        .header {
            background: ${t.headerBg};
            color: ${t.headerText};
            padding: 24px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(197, 160, 89, 0.4);
            position: relative;
        }
        .header-brand {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .header-crest {
            width: 44px;
            height: 44px;
            border: 1.5px solid ${t.goldAccent};
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(197, 160, 89, 0.08);
            border-radius: 50%;
        }
        .header-title-wrap {
            display: flex;
            flex-direction: column;
        }
        .header-name {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.06em;
            color: #FFFFFF;
            line-height: 1.1;
        }
        .header-tagline {
            font-size: 8.5px;
            letter-spacing: 0.28em;
            color: ${t.goldAccent};
            text-transform: uppercase;
            margin-top: 3px;
            font-weight: 600;
        }
        .header-corp-info {
            text-align: right;
            font-size: 10px;
            line-height: 1.6;
            color: #CBD5E1;
        }
        .header-corp-info strong {
            display: block;
            font-size: 11px;
            color: #FFFFFF;
            letter-spacing: 0.04em;
        }

        /* ═══════════ DOCUMENT BANNER ═══════════ */
        .banner-bar {
            padding: 20px 32px;
            background: ${isDark ? '#0D1C2A' : '#F9F8F5'};
            border-bottom: 1px solid ${t.border};
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
        }
        .doc-type-eyebrow {
            font-size: 9px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: ${t.goldAccent};
            font-weight: 700;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .doc-type-eyebrow::before {
            content: '❖';
            font-size: 8px;
        }
        .doc-main-title {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 26px;
            font-weight: 700;
            color: ${t.textStrong};
            letter-spacing: 0.03em;
            line-height: 1;
        }
        .doc-code-pill {
            display: inline-block;
            margin-top: 6px;
            font-size: 11px;
            font-weight: 700;
            color: ${t.goldAccent};
            background: ${isDark ? 'rgba(212,175,55,0.12)' : 'rgba(197,160,89,0.12)'};
            border: 1px solid ${t.goldAccent};
            padding: 2px 10px;
            border-radius: 2px;
            letter-spacing: 0.05em;
        }
        .banner-metadata {
            text-align: right;
            font-size: 11px;
            line-height: 1.8;
            color: ${t.textMuted};
        }
        .banner-metadata strong {
            color: ${t.textStrong};
            font-weight: 600;
        }

        /* ═══════════ PARTIES & COMMERCIAL TERMS ═══════════ */
        .parties-grid {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            border-bottom: 1px solid ${t.border};
            background: ${t.cardBg};
        }
        .party-col {
            padding: 18px 32px;
        }
        .party-col:first-child {
            border-right: 1px solid ${t.border};
        }
        .party-section-label {
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: ${t.goldAccent};
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .party-primary-name {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 19px;
            font-weight: 700;
            color: ${t.textStrong};
            line-height: 1.2;
            margin-bottom: 4px;
        }
        .party-detail {
            font-size: 11px;
            color: ${t.textMuted};
            line-height: 1.6;
        }
        .party-detail strong {
            color: ${t.textStrong};
        }

        /* ═══════════ PORTFOLIO TABLE ═══════════ */
        .table-wrap {
            padding: 0;
            background: ${t.cardBg};
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        thead th {
            padding: 10px 14px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-weight: 700;
            color: ${isDark ? '#94B3C8' : '#64748B'};
            background: ${isDark ? '#0D1C2A' : '#F7F6F2'};
            border-bottom: 1.5px solid ${t.border};
            border-top: 1px solid ${t.border};
            text-align: left;
        }
        thead th.th-center { text-align: center; }
        thead th.th-right { text-align: right; }

        tbody tr.item-row {
            border-bottom: 1px solid ${t.borderLight};
            page-break-inside: avoid;
        }
        tbody tr.item-row.alt {
            background: ${t.tableAlt};
        }

        tbody td {
            padding: 12px 14px;
            vertical-align: top;
            font-size: 11px;
        }

        .cell-center { text-align: center; }
        .cell-right { text-align: right; }
        .cell-num { width: 30px; color: ${t.textMuted}; font-size: 10px; padding-top: 14px; }
        .cell-img { width: 56px; text-align: center; padding: 10px 8px; }
        .cell-product { min-width: 220px; }
        .cell-qty { width: 44px; font-weight: 600; color: ${t.textStrong}; font-size: 11.5px; }
        .cell-price { width: 105px; color: ${t.textStrong}; font-size: 11px; }
        .cell-disc { width: 54px; color: ${isDark ? '#F87171' : '#B91C1C'}; font-weight: 600; font-size: 11px; }
        .cell-total { width: 115px; font-weight: 700; color: ${t.textStrong}; font-size: 12px; }

        .product-img {
            width: 40px;
            height: 52px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
            border-radius: 2px;
            background: ${isDark ? '#07121B' : '#FFFFFF'};
            border: 1px solid ${t.border};
            padding: 2px;
        }
        .product-img-placeholder {
            width: 40px;
            height: 52px;
            border-radius: 2px;
            background: ${isDark ? '#07121B' : '#F7F6F2'};
            border: 1px dashed ${t.border};
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .group-header {
            page-break-after: avoid;
        }
        .group-header-cell {
            padding: 8px 14px !important;
            background: ${isDark ? 'rgba(212,175,55,0.06)' : 'rgba(197,160,89,0.08)'} !important;
            border-top: 1px solid ${t.border} !important;
            border-bottom: 1px solid ${t.border} !important;
        }
        .group-title-inner {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 10.5px;
        }
        .group-badge {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.15em;
            background: ${t.goldAccent};
            color: #FFFFFF;
            padding: 1px 6px;
            border-radius: 1px;
        }
        .group-name {
            font-weight: 700;
            color: ${t.textStrong};
            letter-spacing: 0.04em;
        }
        .group-sep {
            color: ${t.goldAccent};
            font-size: 8px;
        }
        .group-origin {
            font-size: 9.5px;
            color: ${t.textMuted};
            letter-spacing: 0.06em;
            font-weight: 500;
        }

        .product-name {
            font-size: 14.5px;
            font-weight: 700;
            color: ${t.textStrong};
            line-height: 1.25;
            display: block;
            margin-bottom: 2px;
        }
        .product-origin {
            font-size: 10.5px;
            color: ${t.goldAccentMuted};
            font-weight: 500;
            margin-bottom: 3px;
        }
        .product-meta {
            font-size: 9.5px;
            color: ${t.textMuted};
            display: flex;
            align-items: center;
            gap: 4px;
            flex-wrap: wrap;
        }
        .meta-dot {
            color: ${t.border};
            font-weight: bold;
        }
        .meta-tag {
            font-weight: 600;
            color: ${t.text};
        }
        .classification-badge {
            font-size: 8.5px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: ${t.goldAccent};
            border: 1px solid ${t.goldAccent};
            padding: 0 4px;
            border-radius: 1px;
        }
        .product-awards {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            font-size: 9px;
            font-weight: 600;
            color: ${t.awardText};
            background: ${t.awardBg};
            border: 1px solid ${t.awardBorder};
            padding: 1px 6px;
            border-radius: 2px;
        }
        .product-tasting {
            margin-top: 4px;
            font-size: 9.5px;
            color: ${t.textMuted};
            line-height: 1.45;
            padding-left: 8px;
            border-left: 2px solid ${t.goldAccent};
        }
        .tasting-label {
            font-weight: 600;
            color: ${t.textStrong};
            font-style: normal;
        }

        /* ═══════════ TOTALS & FINANCIAL SUMMARY ═══════════ */
        .financial-section {
            padding: 16px 32px 20px;
            display: flex;
            justify-content: flex-end;
            background: ${t.cardBg};
            border-top: 1px solid ${t.border};
            page-break-inside: avoid;
        }
        .totals-matrix {
            width: 340px;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 11.5px;
        }
        .totals-row .label {
            color: ${t.textMuted};
        }
        .totals-row .val {
            color: ${t.textStrong};
            font-weight: 500;
        }
        .totals-row.discount .val {
            color: ${isDark ? '#F87171' : '#B91C1C'};
            font-weight: 600;
        }
        .totals-grand-row {
            margin-top: 8px;
            padding-top: 10px;
            border-top: 2px solid ${t.goldAccent};
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .totals-grand-row .grand-label {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 15px;
            font-weight: 700;
            color: ${t.textStrong};
            letter-spacing: 0.05em;
        }
        .totals-grand-row .grand-val {
            font-size: 20px;
            font-weight: 700;
            color: ${t.goldAccent};
            letter-spacing: -0.01em;
        }
        .vat-indicator {
            text-align: right;
            font-size: 9.5px;
            color: ${t.textMuted};
            margin-top: 3px;
            font-style: italic;
        }

        /* ═══════════ BANKING & LOGISTICS CARDS ═══════════ */
        .terms-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            padding: 16px 32px;
            background: ${isDark ? '#0D1C2A' : '#F9F8F5'};
            border-top: 1px solid ${t.border};
            border-bottom: 1px solid ${t.border};
            page-break-inside: avoid;
        }
        .terms-card-title {
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: ${t.goldAccent};
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .terms-card-body {
            font-size: 10.5px;
            color: ${t.text};
            line-height: 1.6;
        }

        /* ═══════════ FORMAL EXECUTIVE SIGNATURE BLOCK ═══════════ */
        .signature-block {
            padding: 24px 32px 32px;
            background: ${t.cardBg};
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
        }
        .sign-col {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .sign-title {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: ${t.textStrong};
        }
        .sign-sub {
            font-size: 9px;
            color: ${t.textMuted};
            letter-spacing: 0.05em;
            margin-top: 2px;
        }
        .sign-space {
            height: 70px;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .sign-stamp-seal {
            width: 64px;
            height: 64px;
            border: 1.5px dashed ${isDark ? '#D4AF37' : '#B91C1C'};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            color: ${isDark ? '#D4AF37' : '#B91C1C'};
            text-align: center;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.04em;
            opacity: 0.75;
            padding: 4px;
            transform: rotate(-8deg);
        }
        .sign-name {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-size: 14px;
            font-weight: 700;
            color: ${t.textStrong};
            border-top: 1px dotted ${t.border};
            padding-top: 6px;
            min-width: 180px;
        }
        .sign-role {
            font-size: 9.5px;
            color: ${t.textMuted};
            margin-top: 2px;
        }

        /* ═══════════ FOOTER & DISCLOSURE ═══════════ */
        .footer {
            padding: 12px 32px;
            background: ${t.headerBg};
            color: #94A3B8;
            font-size: 9px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid rgba(197, 160, 89, 0.3);
        }
        .footer-left {
            letter-spacing: 0.04em;
        }
        .footer-right {
            font-size: 8.5px;
            letter-spacing: 0.08em;
            color: ${t.goldAccent};
        }

        /* ═══════════ ACTION TOOLBAR ═══════════ */
        .no-print {
            position: fixed;
            bottom: 24px;
            right: 28px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(12px);
            padding: 8px 12px;
            border-radius: 30px;
            border: 1px solid rgba(197,160,89,0.4);
            box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        }
        .btn-action {
            padding: 9px 18px;
            border-radius: 20px;
            border: none;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }
        .btn-primary {
            background: linear-gradient(135deg, ${t.goldAccent} 0%, #A88238 100%);
            color: #FFFFFF;
            box-shadow: 0 4px 12px rgba(197, 160, 89, 0.4);
        }
        .btn-primary:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.12);
            color: #FFFFFF;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        @media print {
            .no-print { display: none !important; }
            body { background: #FFFFFF !important; }
            .proposal-container {
                box-shadow: none !important;
                border: none !important;
                max-width: 100% !important;
                margin: 0 !important;
            }
        }
    </style>
</head>
<body>
    <div class="proposal-container">
        <!-- TOP GOLD ORNAMENTAL ACCENT -->
        <div class="gold-hairstripe"></div>

        <!-- HEADER -->
        <div class="header">
            <div class="header-brand">
                <div class="header-crest">
                    <svg width="22" height="26" viewBox="0 0 40 48" fill="none">
                        <path d="M8 4 Q8 20 20 26 Q32 20 32 4 Z" stroke="${t.goldAccent}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                        <line x1="20" y1="26" x2="20" y2="40" stroke="${t.goldAccent}" stroke-width="2.5" stroke-linecap="round" />
                        <line x1="13" y1="40" x2="27" y2="40" stroke="${t.goldAccent}" stroke-width="2.5" stroke-linecap="round" />
                        <path d="M20 22 Q16 16 18 10 Q20 6 22 10" stroke="${t.goldAccent}" stroke-width="1.8" fill="none" stroke-linecap="round" />
                    </svg>
                </div>
                <div class="header-title-wrap">
                    <div class="header-name">LY's Cellars</div>
                    <div class="header-tagline">Fine Wine Specialist &bull; Grand Cru Selection</div>
                </div>
            </div>
            <div class="header-corp-info">
                <strong>CÔNG TY TNHH LY'S CELLARS</strong>
                Mã Số Thuế: 0313456789<br/>
                123 Đường Pasteur, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh<br/>
                Hotline: 090 9999 999 &nbsp;|&nbsp; concierge@lyscellars.com
            </div>
        </div>

        <!-- DOCUMENT TITLE BANNER -->
        <div class="banner-bar">
            <div>
                <div class="doc-type-eyebrow">
                    ${qt.showQuantity ? 'BẢN CHÀO GIÁ CHÍNH THỨC &bull; EXCLUSIVE COMMERCIAL PROPOSAL' : 'BẢNG GIÁ KHUNG &bull; EXCLUSIVE PRICE LIST'}
                </div>
                <div class="doc-main-title">
                    ${qt.showQuantity ? 'BÁO GIÁ ĐẶC QUYỀN' : 'BẢNG GIÁ ĐẶC QUYỀN'}
                </div>
                <div class="doc-code-pill font-mono">${qt.quotationNo}</div>
            </div>
            <div class="banner-metadata" style="display:flex; align-items:center; gap:16px;">
                <div style="text-align:right;">
                    Ngày phát hành / Date: <strong>${fmtDate(qt.createdAt)}</strong><br/>
                    Hiệu lực đến / Valid Until: <strong style="color: ${t.goldAccent}">${fmtDate(qt.validUntil)}</strong><br/>
                    Trạng thái: <strong style="color:${t.textStrong}">XÁC THỰC &bull; VERIFIED</strong>
                </div>
                ${qt.publicToken ? `
                <div style="text-align:center; padding:3px; background:#FFFFFF; border:1px solid ${t.border}; border-radius:3px; line-height:1;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=3&data=${encodeURIComponent(((origin || process.env.NEXTAUTH_URL || 'https://wine.lyscellars.com').replace(/\/$/, '')) + '/verify/quotation/' + qt.publicToken)}" alt="QR Code Xác Thực Báo Giá" style="width:46px; height:46px; display:block;" />
                    <span style="font-size:6.5px; color:#64748B; letter-spacing:0.04em; text-transform:uppercase; font-weight:700; display:block; margin-top:2px;">Quét tra cứu</span>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- PARTIES & COMMERCIAL TERMS -->
        <div class="parties-grid">
            <div class="party-col">
                <div class="party-section-label">KÍNH GỬI / PREPARED FOR</div>
                <div class="party-primary-name">${qt.contactPerson || qt.customer.name}</div>
                ${qt.companyName ? `<div class="party-detail" style="font-weight:600; color:${t.textStrong};">${qt.companyName}</div>` : ''}
                <div class="party-detail">
                    Mã khách hàng: <strong>${qt.customer.code}</strong> &nbsp;✦&nbsp; Phân khúc: <strong>${qt.channel}</strong>
                </div>
            </div>
            <div class="party-col">
                <div class="party-section-label">CHUYÊN VIÊN TƯ VẤN & THANH TOÁN</div>
                <div class="party-detail">
                    Chuyên viên rượu vang: <strong>${qt.salesRep.name}</strong><br/>
                    ${qt.salesRep.email ? `Email: <strong style="color:${t.goldAccent}">${qt.salesRep.email}</strong><br/>` : ''}
                    Phương thức thanh toán: <strong>${qt.paymentTerm}</strong>
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
                        <th>Danh Mục Vang Tuyển Chọn / Wine Portfolio</th>
                        ${qt.showQuantity ? `
                        <th class="th-center">SL</th>
                        <th class="th-right">Đơn Giá (₫)</th>
                        <th class="th-center">CK</th>
                        <th class="th-right">Thành Tiền (₫)</th>
                        ` : `
                        <th class="th-right">Đơn Giá Niêm Yết (₫)</th>
                        <th class="th-center">Ưu Đãi</th>
                        <th class="th-right">Giá Đề Xuất (₫)</th>
                        `}
                    </tr>
                </thead>
                <tbody>
                    ${productRows}
                </tbody>
            </table>
        </div>

        <!-- TOTALS & FINANCIAL MATRIX -->
        ${qt.showQuantity ? `
        <div class="financial-section">
            <div class="totals-matrix">
                <div class="totals-row">
                    <span class="label">Tổng giá trị danh mục (${qt.lines.length} sản phẩm):</span>
                    <span class="val font-mono">${fmt(subtotal)} ₫</span>
                </div>
                ${Number(qt.orderDiscount) > 0 ? `
                <div class="totals-row discount">
                    <span class="label">Chiết khấu đặc quyền (${qt.orderDiscount}%):</span>
                    <span class="val font-mono">−${fmt(discountAmount)} ₫</span>
                </div>` : ''}
                ${!qt.vatIncluded ? `
                <div class="totals-row">
                    <span class="label">Thuế Giá Trị Gia Tăng (VAT 10%):</span>
                    <span class="val font-mono">${fmt(vatAmount)} ₫</span>
                </div>` : ''}
                <div class="totals-grand-row">
                    <span class="grand-label">TỔNG CỘNG THANH TOÁN:</span>
                    <span class="grand-val font-mono">${fmt(grandTotal)} ₫</span>
                </div>
                <div class="vat-indicator">${qt.vatIncluded ? 'Đã bao gồm thuế GTGT (VAT Included)' : 'Chưa bao gồm thuế GTGT (VAT Excluded)'}</div>
            </div>
        </div>` : ''}

        <!-- BANKING & LOGISTICS SECTION -->
        <div class="terms-grid">
            <div>
                <div class="terms-card-title">✦ Thông Tin Thanh Toán (Banking Protocol)</div>
                <div class="terms-card-body">
                    Tên thụ hưởng: <strong>CÔNG TY TNHH LY'S CELLARS</strong><br/>
                    Số tài khoản: <strong class="font-mono" style="color: ${t.goldAccent}; font-size:12px;">1023456789</strong><br/>
                    Ngân hàng: <strong>Vietcombank (VCB)</strong> — Chi nhánh TP. Hồ Chí Minh<br/>
                    Nội dung chuyển khoản: <strong>Thanh toán ${qt.quotationNo}</strong>
                </div>
            </div>
            <div>
                <div class="terms-card-title">✦ Điều Khoản Lưu Kho & Vận Chuyển</div>
                <div class="terms-card-body">
                    ${qt.deliveryTerms || 'Giao hàng tận nơi bằng phương tiện chuyên dụng kiểm soát nhiệt độ 16-18°C. Miễn phí vận chuyển nội thành TP.HCM cho các đơn hàng rượu vang Grand Cru.'}
                </div>
            </div>
        </div>

        ${qt.terms || qt.notes ? `
        <div style="padding: 12px 32px; background: ${t.cardBg}; font-size: 10px; color: ${t.textMuted}; line-height: 1.6; border-bottom: 1px solid ${t.border};">
            ${qt.terms ? `<div><strong>Điều khoản thương mại:</strong> ${qt.terms}</div>` : ''}
            ${qt.notes ? `<div style="margin-top:4px;"><strong>Ghi chú đặc biệt:</strong> ${qt.notes}</div>` : ''}
        </div>
        ` : ''}

        <!-- CELLAR MASTER 4 PILLARS OF QUALITY ASSURANCE -->
        <div style="padding: 12px 32px; background: ${isDark ? '#0D1C2A' : '#FAFAF8'}; border-bottom: 1px solid ${t.border}; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; text-align: center; page-break-inside: avoid;">
            <div style="font-size: 8.5px; color: ${t.textMuted}; line-height: 1.4;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${t.goldAccent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; margin-bottom:3px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg><br/>
                <strong style="color: ${t.textStrong}; font-size: 9px;">100% CHÍNH NGẠCH</strong><br/>
                Tem Hải Quan &bull; CO/CQ Điền Trang
            </div>
            <div style="font-size: 8.5px; color: ${t.textMuted}; line-height: 1.4;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${t.goldAccent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; margin-bottom:3px;"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg><br/>
                <strong style="color: ${t.textStrong}; font-size: 9px;">HẦM LẠNH 14-16°C</strong><br/>
                Độ ẩm 70% kiểm soát 24/7
            </div>
            <div style="font-size: 8.5px; color: ${t.textMuted}; line-height: 1.4;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${t.goldAccent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; margin-bottom:3px;"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg><br/>
                <strong style="color: ${t.textStrong}; font-size: 9px;">GIAO XE CHUYÊN DỤNG</strong><br/>
                Thùng lạnh chống sốc nhiệt
            </div>
            <div style="font-size: 8.5px; color: ${t.textMuted}; line-height: 1.4;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${t.goldAccent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; margin-bottom:3px;"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg><br/>
                <strong style="color: ${t.textStrong}; font-size: 9px;">BẢO HIỂM NÚT BẦN</strong><br/>
                Đổi mới nếu lỗi oxy hóa
            </div>
        </div>

        <!-- FORMAL EXECUTIVE SIGNATURE & SEAL BLOCK -->
        <div class="signature-block">
            <div class="sign-col">
                <div class="sign-title">ĐẠI DIỆN KHÁCH HÀNG</div>
                <div class="sign-sub">Client Representative (Ký, ghi rõ họ tên)</div>
                <div class="sign-space"></div>
                <div class="sign-name">${qt.contactPerson || qt.customer.name}</div>
                <div class="sign-role">${qt.companyName || 'Khách Hàng Quý Tộc / Đối Tác'}</div>
            </div>
            <div class="sign-col">
                <div class="sign-title">CÔNG TY TNHH LY'S CELLARS</div>
                <div class="sign-sub">Authorized Executive Signatory</div>
                <div class="sign-space">
                    <div class="sign-stamp-seal">
                        LY'S CELLARS<br/>★ DẤU PHÁP NHÂN ★<br/>APPROVED
                    </div>
                </div>
                <div class="sign-name">BAN GIÁM ĐỐC &amp; DUYỆT BÁO GIÁ</div>
                <div class="sign-role">Private Client Division &bull; Sommelier Service</div>
            </div>
        </div>

        <!-- FOOTER & LEGAL STATEMENT -->
        <div class="footer">
            <div class="footer-left">
                © ${new Date().getFullYear()} LY's Cellars. Tài liệu kinh doanh bảo mật dành riêng cho Quý khách.
            </div>
            <div class="footer-right">
                VERIFIED AUTHENTIC PROPOSAL &bull; ERP CODE: ${qt.quotationNo}
            </div>
        </div>
    </div>

    <!-- FLOATING ACTION BUTTONS (NO-PRINT) -->
    <div class="no-print">
        ${!isPreview ? `
        <button class="btn-action btn-secondary" onclick="location.href=location.href.replace('style=' + '${style}', 'style=' + ('${style}' === 'elegant' ? 'professional' : 'elegant'))">
            ${style === 'elegant' ? 'Chuyển Sang Bản Sáng (Professional)' : 'Chuyển Sang Bản Tối (Sommelier Slate)'}
        </button>
        ` : ''}
        <button class="btn-action btn-primary" onclick="window.print()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>In / Lưu PDF A4</span>
        </button>
    </div>
</body>
</html>`

    return html
}
