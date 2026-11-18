import { describe, it, expect } from 'vitest'
import {
    buildVnptDraftInvoiceXml,
    calculateVnptInvoiceTotals,
    formatXmlNumber,
} from '@/lib/vnpt/xml-builder'
import { getVnptInvoiceProductName, VNPT_PRODUCT_INVOICE_NAMES } from '@/lib/vnpt/product-invoice-names'
import { parseVnptResponse } from '@/lib/vnpt/vnpt-client'

describe('VNPT e-Invoice Calculation, XML Builder & Client Parser', () => {
    it('extracts pre-VAT unit price and totals for RETAIL VAT-inclusive orders (SO-2608-0153)', () => {
        const totals = calculateVnptInvoiceTotals({
            channel: 'RETAIL',
            orderType: 'STANDARD',
            orderDiscountPct: 0,
            defaultVatRate: 10,
            lines: [
                {
                    skuCode: 'L60001',
                    productName: 'Sandy Cove Sauvignon Blanc Marlborough',
                    wineType: 'WHITE',
                    unit: 'Chai',
                    qtyOrdered: 10,
                    unitPrice: 670000,
                    lineDiscountPct: 30,
                    vatRate: 10,
                },
            ],
        })

        expect(totals.isVatInclusive).toBe(true)
        expect(totals.totalNet).toBe(4263636)
        expect(totals.totalVat).toBe(426364)
        expect(totals.totalAmount).toBe(4690000)
        expect(totals.items[0].unitPrice).toBe(609090.91)
        expect(totals.items[0].discountPct).toBe(30)
        expect(totals.items[0].productName).toBe('Rượu vang trắng Sandy Cove Sauvignon Blanc Marlborough')

        const xml = buildVnptDraftInvoiceXml({
            fkey: 'SO_SO-2608-0153',
            pattern: '1/001',
            serial: 'C26TTA',
            paymentMethod: 'Chuyển khoản/Tiền mặt',
            buyer: {
                companyName: 'Khách lẻ Showroom',
                address: 'Hà Nội',
            },
            items: totals.items,
            totalNet: totals.totalNet,
            totalVat: totals.totalVat,
            totalDiscount: totals.totalDiscount,
            totalAmount: totals.totalAmount,
            note: 'Xuất hóa đơn GTGT đơn hàng SO-2608-0153',
        })

        expect(xml).toContain('<DGia>609090.91</DGia>')
        expect(xml).toContain('<ThTien>4263636</ThTien>')
        expect(xml).toContain('<TThue>426364</TThue>')
        expect(xml).toContain('<TgTCThue>4263636</TgTCThue>')
        expect(xml).toContain('<TgTThue>426364</TgTThue>')
        expect(xml).toContain('<TgTTTBSo>4690000</TgTTTBSo>')
    })

    it('applies combined lineDiscountPct + orderDiscountPct and balances integer sums in XML', () => {
        const totals = calculateVnptInvoiceTotals({
            channel: 'HORECA',
            orderType: 'STANDARD',
            orderDiscountPct: 5,
            defaultVatRate: 10,
            lines: [
                {
                    skuCode: 'L20001',
                    productName: 'Maison Blanche Bordeaux Rouge',
                    wineType: 'RED',
                    qtyOrdered: 3,
                    unitPrice: 333333,
                    lineDiscountPct: 7.5,
                    vatRate: 10,
                },
                {
                    skuCode: 'L20002',
                    productName: 'Maison Blanche Bordeaux Blanc',
                    wineType: 'WHITE',
                    qtyOrdered: 5,
                    unitPrice: 271111,
                    lineDiscountPct: 12.5,
                    vatRate: 10,
                },
            ],
        })

        expect(totals.isVatInclusive).toBe(false)
        // Effective discount for line 1: 1 - (1 - 0.075)*(1 - 0.05) = 1 - 0.87875 = 12.125% -> 12.13%
        expect(totals.items[0].discountPct).toBe(12.13)

        const xml = buildVnptDraftInvoiceXml({
            fkey: 'SO_SO-2611-0001',
            pattern: '1/001',
            serial: 'C26TTA',
            paymentMethod: 'Chuyển khoản/Tiền mặt',
            buyer: {
                companyName: 'Công ty TNHH Test HORECA',
                taxId: '0101234567',
                address: 'Hà Nội',
            },
            items: totals.items,
            totalNet: totals.totalNet,
            totalVat: totals.totalVat,
            totalDiscount: totals.totalDiscount,
            totalAmount: totals.totalAmount,
        })

        const lineNets = [...xml.matchAll(/<HHDVu>[\s\S]*?<ThTien>(\d+)<\/ThTien>[\s\S]*?<\/HHDVu>/g)].map(m => Number(m[1]))
        const lineVats = [...xml.matchAll(/<HHDVu>[\s\S]*?<TThue>(\d+)<\/TThue>[\s\S]*?<\/HHDVu>/g)].map(m => Number(m[1]))
        const ltNet = Number(xml.match(/<LTSuat>[\s\S]*?<ThTien>(\d+)<\/ThTien>/)?.[1] || 0)
        const ltVat = Number(xml.match(/<LTSuat>[\s\S]*?<TThue>(\d+)<\/TThue>/)?.[1] || 0)
        const tgTCThue = Number(xml.match(/<TgTCThue>(\d+)<\/TgTCThue>/)?.[1] || 0)
        const tgTThue = Number(xml.match(/<TgTThue>(\d+)<\/TgTThue>/)?.[1] || 0)
        const tgTTTBSo = Number(xml.match(/<TgTTTBSo>(\d+)<\/TgTTTBSo>/)?.[1] || 0)

        const sumLineNets = lineNets.reduce((a, b) => a + b, 0)
        const sumLineVats = lineVats.reduce((a, b) => a + b, 0)

        expect(sumLineNets).toBe(ltNet)
        expect(ltNet).toBe(tgTCThue)
        expect(sumLineVats).toBe(ltVat)
        expect(ltVat).toBe(tgTThue)
        expect(tgTCThue + tgTThue).toBe(tgTTTBSo)
    })

    it('supports mixed 10% and 8% VAT rates with Nước uống không cồn naming for L10035/L10036', () => {
        const totals = calculateVnptInvoiceTotals({
            channel: 'HORECA',
            orderType: 'STANDARD',
            lines: [
                {
                    skuCode: 'L10035',
                    productName: 'La Jara Offbeat ZERO Sparkling White',
                    qtyOrdered: 2,
                    unitPrice: 243000,
                    vatRate: 8,
                },
                {
                    skuCode: 'L10036',
                    productName: 'La Jara Offbeat ZERO Sparkling Rosé',
                    qtyOrdered: 2,
                    unitPrice: 243000,
                    vatRate: 8,
                },
                {
                    skuCode: 'L20006',
                    productName: 'Oh La Vache Rouge',
                    qtyOrdered: 1,
                    unitPrice: 300000,
                    vatRate: 10,
                },
            ],
        })

        expect(totals.items[0].productName).toBe('Nước uống không cồn La Jara Offbeat ZERO Sparkling White')
        expect(totals.items[1].productName).toBe('Nước uống không cồn La Jara Offbeat ZERO Sparkling Rosé')
        expect(totals.totalNet).toBe(1272000)
        expect(totals.totalVat).toBe(107760)
        expect(totals.totalAmount).toBe(1379760)

        const xml = buildVnptDraftInvoiceXml({
            fkey: 'SO_MIXED_VAT',
            pattern: '1/001',
            serial: 'C26TTA',
            paymentMethod: 'Chuyển khoản/Tiền mặt',
            buyer: {
                companyName: 'HỘ KINH DOANH TEST',
                taxId: '8786584065-001',
                address: 'Hà Nội',
            },
            items: totals.items,
            totalNet: totals.totalNet,
            totalVat: totals.totalVat,
            totalDiscount: totals.totalDiscount,
            totalAmount: totals.totalAmount,
        })

        expect(xml).toContain('<TSuat>8%</TSuat>')
        expect(xml).toContain('<TSuat>10%</TSuat>')
        expect(xml).toContain('<TgTTTBSo>1379760</TgTTTBSo>')
    })

    it('maps all 18 newly added SKUs and applies wineType TCB prefix fallback', () => {
        const expectedNewSkus = [
            'L10002', 'L10003', 'L10006', 'L10012', 'L10013',
            'L20005', 'L20008', 'L20027', 'L30004',
            'MOUTON-2016-1500', 'MOUTON-NV-750', 'DRC-CC-NV-750',
            'VEUVE-YL-750', 'SASSICAIA-NV-750', 'KRUG-MV-750',
            'CMARGAUX-NV-750', 'OPUSONE-NV-750', 'PETRUS-NV-750',
        ]
        for (const sku of expectedNewSkus) {
            expect(VNPT_PRODUCT_INVOICE_NAMES[sku]).toBeTruthy()
            expect(getVnptInvoiceProductName(sku, 'Fallback')).toBe(VNPT_PRODUCT_INVOICE_NAMES[sku])
        }

        expect(getVnptInvoiceProductName('UNKNOWN-RED', 'Château Demo', 'RED')).toBe('Rượu vang đỏ Château Demo')
        expect(getVnptInvoiceProductName('UNKNOWN-SPK', 'Champagne Demo', 'SPARKLING')).toBe('Rượu vang nổ Champagne Demo')
        expect(getVnptInvoiceProductName('UNKNOWN-PRE', 'Rượu vang đỏ Đã Có Tiền Tố', 'RED')).toBe('Rượu vang đỏ Đã Có Tiền Tố')
        expect(getVnptInvoiceProductName('L20046', 'Domaine de Rochebin Bourgogne Pinot Noir', 'RED', 'Rượu vang đỏ Custom Từ ERP')).toBe('Rượu vang đỏ Custom Từ ERP')
        expect(getVnptInvoiceProductName('L20046', 'Domaine de Rochebin Bourgogne Pinot Noir', 'RED', '   ')).toBe('Rượu vang đỏ Domaine de Rochebin Bourgogne Pinot Noir')
    })

    it('sets <TChat>2</TChat> for 0 VND sample/tasting items and renders <TTKhac> note', () => {
        const totals = calculateVnptInvoiceTotals({
            channel: 'HORECA',
            orderType: 'SAMPLE',
            lines: [
                {
                    skuCode: 'L20001',
                    productName: 'Maison Blanche Bordeaux Rouge',
                    qtyOrdered: 1,
                    unitPrice: 0,
                    vatRate: 10,
                },
            ],
        })

        expect(totals.items[0].itemType).toBe(2)

        const xml = buildVnptDraftInvoiceXml({
            fkey: 'SO_SAMPLE_01',
            pattern: '1/001',
            serial: 'C26TTA',
            paymentMethod: 'Chuyển khoản/Tiền mặt',
            buyer: {
                companyName: 'Khách Tasting',
                address: 'Hà Nội',
            },
            items: totals.items,
            totalNet: totals.totalNet,
            totalVat: totals.totalVat,
            totalDiscount: totals.totalDiscount,
            totalAmount: totals.totalAmount,
            note: 'Hàng mẫu không thu tiền',
        })

        expect(xml).toContain('<TChat>2</TChat>')
        expect(xml).not.toContain('<TTKhac>')
        expect(formatXmlNumber(609090.9000)).toBe('609090.9')
        expect(formatXmlNumber(500000.00)).toBe('500000')
    })

    it('parses VNPT responses with hyphenated and versioned FKeys accurately', () => {
        const resDraft = parseVnptResponse('OK:1/001;C26TTA-SO_SO-2609-0105', 'SO_SO-2609-0105')
        expect(resDraft.success).toBe(true)
        expect(resDraft.pattern).toBe('1/001')
        expect(resDraft.serial).toBe('C26TTA')
        expect(resDraft.fkey).toBe('SO_SO-2609-0105')
        expect(resDraft.invoiceNo).toBe('')

        const resVersioned = parseVnptResponse('OK:1/001;C26TTA-SO_SO-2609-0105_V2', 'SO_SO-2609-0105_V2')
        expect(resVersioned.success).toBe(true)
        expect(resVersioned.fkey).toBe('SO_SO-2609-0105_V2')
        expect(resVersioned.invoiceNo).toBe('')

        const resPublished = parseVnptResponse('OK:1/001;C26TTA-SO_SO-2609-0105_00001234', 'SO_SO-2609-0105')
        expect(resPublished.success).toBe(true)
        expect(resPublished.fkey).toBe('SO_SO-2609-0105')
        expect(resPublished.invoiceNo).toBe('00001234')

        const resErr13 = parseVnptResponse('ERR:13')
        expect(resErr13.success).toBe(false)
        expect(resErr13.errorCode).toBe('ERR:13')

        const resErr23 = parseVnptResponse('ERR:23')
        expect(resErr23.success).toBe(false)
        expect(resErr23.errorCode).toBe('ERR:23')
    })
})
