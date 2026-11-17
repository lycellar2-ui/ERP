import { InvoiceItem, InvoicePayload } from './types'
import { getVnptInvoiceProductName } from './product-invoice-names'

/**
 * Escapes characters for XML compliance
 */
export function escapeXml(str?: string | null): string {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/**
 * Convert integer VND money amount to Vietnamese words
 */
export function readVndMoneyToWords(amount: number): string {
    const n = Math.round(Math.abs(amount))
    if (n === 0) return 'Không đồng'

    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']

    function readTriple(triple: number, showZeroHundred: boolean): string {
        const h = Math.floor(triple / 100)
        const t = Math.floor((triple % 100) / 10)
        const u = triple % 10
        let res = ''

        if (h > 0 || showZeroHundred) {
            res += digits[h] + ' trăm '
        }

        if (t === 0) {
            if (u > 0 && (h > 0 || showZeroHundred)) {
                res += 'lẻ ' + digits[u]
            } else if (u > 0) {
                res += digits[u]
            }
        } else if (t === 1) {
            res += 'mười '
            if (u === 1) res += 'một'
            else if (u === 5) res += 'lăm'
            else if (u > 0) res += digits[u]
        } else {
            res += digits[t] + ' mươi '
            if (u === 1) res += 'mốt'
            else if (u === 4) res += 'tư'
            else if (u === 5) res += 'lăm'
            else if (u > 0) res += digits[u]
        }

        return res.trim()
    }

    const groups: number[] = []
    let temp = n
    while (temp > 0) {
        groups.push(temp % 1000)
        temp = Math.floor(temp / 1000)
    }

    const words: string[] = []
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i]
        if (group > 0) {
            const showZeroHundred = (i < groups.length - 1)
            const text = readTriple(group, showZeroHundred)
            words.push(text + (units[i] ? ' ' + units[i] : ''))
        }
    }

    let result = words.join(' ').replace(/\s+/g, ' ').trim()
    result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng'
    if (amount < 0) result = 'Âm ' + result.toLowerCase()
    return result
}

/**
 * Formats numeric fields for VNPT XML without trailing unnecessary decimals
 */
export function formatXmlNumber(val: number, maxDecimals = 2): string {
    if (!Number.isFinite(val)) return '0'
    if (Number.isInteger(val)) return String(val)
    return String(Number(val.toFixed(maxDecimals)))
}

export interface VnptLineCalcInput {
    skuCode: string
    productName: string
    wineType?: string | null
    unit?: string | null
    qtyOrdered: number
    unitPrice: number
    lineDiscountPct?: number
    vatRate?: number | null
}

export interface VnptOrderCalcInput {
    channel: string
    orderType?: string | null
    orderDiscountPct?: number
    defaultVatRate?: number
    lines: VnptLineCalcInput[]
}

export interface CalculatedVnptLine extends InvoiceItem {
    preVatBeforeDisc: number
}

export interface CalculatedVnptTotals {
    isVatInclusive: boolean
    items: CalculatedVnptLine[]
    totalNet: number
    totalVat: number
    totalDiscount: number
    totalAmount: number
}

const VAT_INCLUSIVE_CHANNELS = new Set(['RETAIL', 'DIRECT_INDIVIDUAL', 'POS'])

/**
 * Computes VNPT pre-VAT unit prices, discounts, VAT amounts, and integer-balanced totals
 * consistent with SalesOrder pricing rules (VAT-inclusive for RETAIL/DIRECT_INDIVIDUAL/POS).
 */
export function calculateVnptInvoiceTotals(input: VnptOrderCalcInput): CalculatedVnptTotals {
    const isVatInclusive = VAT_INCLUSIVE_CHANNELS.has(String(input.channel || '').toUpperCase())
    const orderDiscPct = Math.max(0, Math.min(100, Number(input.orderDiscountPct || 0)))
    const defaultVatRate = Number(input.defaultVatRate ?? 10)

    let totalNet = 0
    let totalVat = 0
    let totalDiscount = 0

    const items: CalculatedVnptLine[] = input.lines.map((line, idx) => {
        const qty = Number(line.qtyOrdered || 0)
        const rawPrice = Number(line.unitPrice || 0)
        const lineDiscPct = Math.max(0, Math.min(100, Number(line.lineDiscountPct || 0)))

        const effectiveDiscFactor = 1 - (1 - lineDiscPct / 100) * (1 - orderDiscPct / 100)
        const effectiveDiscPct = Math.round((effectiveDiscFactor * 100 + 1e-9) * 100) / 100
        const rateNum = Number(line.vatRate ?? defaultVatRate)
        const vatRateStr = `${rateNum}%`

        let preVatUnitPrice = 0
        let preVatBeforeDisc = 0
        let netAmount = 0
        let vatAmount = 0
        let discountAmount = 0

        if (isVatInclusive) {
            const grossAfterDisc = Math.round(qty * rawPrice * (1 - effectiveDiscFactor))
            preVatUnitPrice = rawPrice === 0 ? 0 : Number((rawPrice / (1 + rateNum / 100)).toFixed(2))
            netAmount = Math.round(grossAfterDisc / (1 + rateNum / 100))
            vatAmount = grossAfterDisc - netAmount
            preVatBeforeDisc = Math.round(qty * preVatUnitPrice)
            discountAmount = Math.max(0, preVatBeforeDisc - netAmount)
        } else {
            preVatUnitPrice = Number(rawPrice.toFixed(2))
            preVatBeforeDisc = Math.round(qty * preVatUnitPrice)
            netAmount = Math.round(qty * rawPrice * (1 - effectiveDiscFactor))
            discountAmount = Math.max(0, preVatBeforeDisc - netAmount)
            vatAmount = Math.round(netAmount * (rateNum / 100))
        }

        const isFreeItem =
            netAmount === 0 &&
            (rawPrice === 0 || input.orderType === 'SAMPLE' || input.orderType === 'TASTING')

        totalNet += netAmount
        totalVat += vatAmount
        totalDiscount += discountAmount

        return {
            lineNo: idx + 1,
            itemType: isFreeItem ? 2 : 1,
            productCode: line.skuCode,
            productName: getVnptInvoiceProductName(line.skuCode, line.productName, line.wineType),
            unit: line.unit || 'Chai',
            quantity: qty,
            unitPrice: preVatUnitPrice,
            discountPct: effectiveDiscPct,
            discountAmount,
            amount: netAmount,
            vatRate: vatRateStr,
            vatAmount,
            totalAmount: netAmount + vatAmount,
            preVatBeforeDisc,
        }
    })

    return {
        isVatInclusive,
        items,
        totalNet,
        totalVat,
        totalDiscount,
        totalAmount: totalNet + totalVat,
    }
}

/**
 * Builds the <DSHDon> XML string for VNPT V5 Webservice (TT78 / NĐ70)
 */
export function buildVnptDraftInvoiceXml(payload: InvoicePayload): string {
    const { fkey, buyer, items, paymentMethod } = payload

    const normalizedItems = items.map((item, idx) => {
        const roundedAmount = Math.round(item.amount)
        const roundedVat = Math.round(item.vatAmount)
        const roundedDisc = Math.round(item.discountAmount || 0)
        return {
            item,
            idx,
            roundedAmount,
            roundedVat,
            roundedDisc,
            itemTotal: roundedAmount + roundedVat,
        }
    })

    // Group rounded line totals by VAT rate so <HHDVu>, <LTSuat>, and <TToan> match exactly
    const vatGroups: Record<string, { net: number; vat: number }> = {}
    let sumNet = 0
    let sumVat = 0
    let sumDisc = 0

    for (const entry of normalizedItems) {
        const rate = entry.item.vatRate || '10%'
        if (!vatGroups[rate]) {
            vatGroups[rate] = { net: 0, vat: 0 }
        }
        vatGroups[rate].net += entry.roundedAmount
        vatGroups[rate].vat += entry.roundedVat
        sumNet += entry.roundedAmount
        sumVat += entry.roundedVat
        sumDisc += entry.roundedDisc
    }

    const resolvedTotalNet = normalizedItems.length > 0 ? sumNet : Math.round(payload.totalNet)
    const resolvedTotalVat = normalizedItems.length > 0 ? sumVat : Math.round(payload.totalVat)
    const resolvedTotalDiscount = normalizedItems.length > 0 ? sumDisc : Math.round(payload.totalDiscount || 0)
    const resolvedTotalAmount = normalizedItems.length > 0 ? sumNet + sumVat : Math.round(payload.totalAmount)
    const amountInWords = payload.totalAmountInWords || readVndMoneyToWords(resolvedTotalAmount)

    const itemsXml = normalizedItems.map(({ item, idx, roundedAmount, roundedVat, roundedDisc, itemTotal }) => `
                <HHDVu>
                    <TChat>${item.itemType || 1}</TChat>
                    <STT>${item.lineNo || (idx + 1)}</STT>
                    <MHHDVu>${escapeXml(item.productCode)}</MHHDVu>
                    <THHDVu>${escapeXml(item.productName)}</THHDVu>
                    <DVTinh>${escapeXml(item.unit || 'Chai')}</DVTinh>
                    <SLuong>${formatXmlNumber(item.quantity, 2)}</SLuong>
                    <DGia>${formatXmlNumber(item.unitPrice, 2)}</DGia>
                    <TLCKhau>${formatXmlNumber(item.discountPct || 0, 2)}</TLCKhau>
                    <STCKhau>${roundedDisc}</STCKhau>
                    <ThTien>${roundedAmount}</ThTien>
                    <TSuat>${escapeXml(item.vatRate)}</TSuat>
                    <TThue>${roundedVat}</TThue>
                    <TSThue>${itemTotal}</TSThue>
                </HHDVu>`).join('')

    const vatSummaryXml = Object.entries(vatGroups).map(([rate, vals]) => `
                        <LTSuat>
                            <TSuat>${escapeXml(rate)}</TSuat>
                            <ThTien>${vals.net}</ThTien>
                            <TThue>${vals.vat}</TThue>
                        </LTSuat>`).join('')

    const noteXml = payload.note?.trim()
        ? `\n                <TTKhac>\n                    <TTin>\n                        <TTruong>GhiChu</TTruong>\n                        <KDLieu>string</KDLieu>\n                        <DLieu>${escapeXml(payload.note.trim())}</DLieu>\n                    </TTin>\n                </TTKhac>`
        : ''

    return `<?xml version="1.0" encoding="utf-8"?>
<DSHDon>
    <HDon>
        <key>${escapeXml(fkey)}</key>
        <DLHDon>
            <TTChung>
                <DVTTe>VND</DVTTe>
                <TGia>1</TGia>
                <HTTToan>${escapeXml(paymentMethod || 'Chuyển khoản/Tiền mặt')}</HTTToan>
            </TTChung>
            <NDHDon>
                <NMua>
                    <Ten>${escapeXml(buyer.companyName || buyer.buyerName)}</Ten>
                    ${buyer.taxId ? `<MST>${escapeXml(buyer.taxId)}</MST>` : ''}
                    <DChi>${escapeXml(buyer.address)}</DChi>
                    ${buyer.customerCode ? `<MKHang>${escapeXml(buyer.customerCode)}</MKHang>` : ''}
                    ${buyer.phone ? `<SDThoai>${escapeXml(buyer.phone)}</SDThoai>` : ''}
                    ${buyer.email ? `<DCTDTu>${escapeXml(buyer.email)}</DCTDTu>` : ''}
                    ${buyer.buyerName ? `<HVTNMHang>${escapeXml(buyer.buyerName)}</HVTNMHang>` : ''}
                </NMua>
                <DSHHDVu>${itemsXml}
                </DSHHDVu>
                <TToan>
                    <THTTLTSuat>${vatSummaryXml}
                    </THTTLTSuat>
                    <TgTCThue>${resolvedTotalNet}</TgTCThue>
                    <TgTThue>${resolvedTotalVat}</TgTThue>
                    ${resolvedTotalDiscount > 0 ? `<TTCKTMai>${resolvedTotalDiscount}</TTCKTMai>` : ''}
                    <TgTTTBSo>${resolvedTotalAmount}</TgTTTBSo>
                    <TgTTTBChu>${escapeXml(amountInWords)}</TgTTTBChu>
                </TToan>
            </NDHDon>${noteXml}
        </DLHDon>
    </HDon>
</DSHDon>`.trim()
}
