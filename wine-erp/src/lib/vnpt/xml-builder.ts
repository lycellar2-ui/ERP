import { InvoicePayload } from './types'

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
 * Builds the <DSHDon> XML string for VNPT V5 Webservice (TT78 / NĐ70)
 */
export function buildVnptDraftInvoiceXml(payload: InvoicePayload): string {
    const { fkey, buyer, items, totalNet, totalVat, totalDiscount, totalAmount, paymentMethod } = payload
    const amountInWords = payload.totalAmountInWords || readVndMoneyToWords(totalAmount)

    // Group items by VAT rate for <THTTLTSuat>
    const vatGroups: Record<string, { net: number; vat: number }> = {}
    for (const item of items) {
        const rate = item.vatRate || '10%'
        if (!vatGroups[rate]) {
            vatGroups[rate] = { net: 0, vat: 0 }
        }
        vatGroups[rate].net += item.amount
        vatGroups[rate].vat += item.vatAmount
    }

    const itemsXml = items.map((item, idx) => `
                <HHDVu>
                    <TChat>1</TChat>
                    <STT>${item.lineNo || (idx + 1)}</STT>
                    <MHHDVu>${escapeXml(item.productCode)}</MHHDVu>
                    <THHDVu>${escapeXml(item.productName)}</THHDVu>
                    <DVTinh>${escapeXml(item.unit || 'Chai')}</DVTinh>
                    <SLuong>${item.quantity}</SLuong>
                    <DGia>${Math.round(item.unitPrice)}</DGia>
                    <TLCKhau>${item.discountPct || 0}</TLCKhau>
                    <STCKhau>${Math.round(item.discountAmount || 0)}</STCKhau>
                    <ThTien>${Math.round(item.amount)}</ThTien>
                    <TSuat>${escapeXml(item.vatRate)}</TSuat>
                    <TThue>${Math.round(item.vatAmount)}</TThue>
                    <TSThue>${Math.round(item.amount + item.vatAmount)}</TSThue>
                </HHDVu>`).join('')

    const vatSummaryXml = Object.entries(vatGroups).map(([rate, vals]) => `
                        <LTSuat>
                            <TSuat>${escapeXml(rate)}</TSuat>
                            <ThTien>${Math.round(vals.net)}</ThTien>
                            <TThue>${Math.round(vals.vat)}</TThue>
                        </LTSuat>`).join('')

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
                    <TgTCThue>${Math.round(totalNet)}</TgTCThue>
                    <TgTThue>${Math.round(totalVat)}</TgTThue>
                    ${totalDiscount ? `<TTCKTMai>${Math.round(totalDiscount)}</TTCKTMai>` : ''}
                    <TgTTTBSo>${Math.round(totalAmount)}</TgTTTBSo>
                    <TgTTTBChu>${escapeXml(amountInWords)}</TgTTTBChu>
                </TToan>
            </NDHDon>
        </DLHDon>
    </HDon>
</DSHDon>`.trim()
}
