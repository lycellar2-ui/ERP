import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildCustomerDetailExcelBuffer } from '@/lib/customer-report-excel'
import type { CustomerPurchaseHistoryResult } from '@/app/dashboard/actions'

function makeRichFixture(): CustomerPurchaseHistoryResult {
    return {
        customer: {
            id: 'cust-1',
            code: 'HR-001',
            name: 'Park Hyatt Saigon Holding',
            channel: 'HORECA',
            paymentTerm: 'NET30',
            creditLimit: 500_000_000,
            entityType: 'COMPANY',
            status: 'ACTIVE',
            basePriceType: 'HORECA',
            defaultDiscountPct: 10,
            salesRepName: 'Nguyen Van A',
            parentName: null,
            childrenCount: 2,
            purchasingName: 'Tran Thi B',
            purchasingPhone: '0909123456',
            receiverName: 'Le Van C',
            receiverPhone: '0909654321',
            deliveryNotes: 'Deliver before 11am',
        },
        kpis: {
            totalRevenue: 45_000_000,
            totalOrders: 2,
            totalBottles: 30,
            lastOrderDate: '2026-11-15T10:00:00.000Z',
            lastOrderNo: 'SO-2611-001',
            totalPaidAmount: 30_000_000,
            totalArDebt: 15_000_000,
            overdueArDebt: 5_000_000,
        },
        pricing: {
            basePriceType: 'HORECA',
            defaultDiscountPct: 10,
            specialRules: [
                {
                    id: 'rule-1',
                    productId: 'prod-1',
                    skuCode: 'L10001',
                    productName: 'Sartori Amarone della Valpolicella',
                    wineType: 'RED',
                    country: 'Italy',
                    ruleType: 'FIXED_PRICE',
                    value: 1_200_000,
                    retailPrice: 1_600_000,
                    wholesalePrice: 1_400_000,
                    specialPrice: 1_200_000,
                    discountAmount: 200_000,
                    discountPct: 14,
                    startDate: '2026-01-01T00:00:00.000Z',
                    endDate: '2026-12-31T00:00:00.000Z',
                    isExpired: false,
                    isExpiringSoon: false,
                    notes: 'Annual contract rate',
                },
            ],
            proposals: [
                {
                    id: 'prop-1',
                    proposalNo: 'TT-2026-012',
                    title: 'Park Hyatt Q4 Special Menu Pricing',
                    status: 'APPROVED',
                    startDate: '2026-10-01T00:00:00.000Z',
                    endDate: '2026-12-31T00:00:00.000Z',
                    resolvedAt: '2026-09-28T00:00:00.000Z',
                    notes: 'Approved by CEO',
                },
            ],
        },
        health: {
            status: 'HEALTHY',
            statusLabel: 'Nhập hàng đều',
            daysSinceLastOrder: 13,
            averageOrderCycleDays: 20,
            delayDays: 0,
        },
        orderBreakdown: {
            commercialCount: 1,
            commercialRevenue: 45_000_000,
            commercialBottles: 24,
            tastingCount: 1,
            tastingBottles: 6,
        },
        preferences: {
            wineTypes: [
                { type: 'RED', label: 'Vang Đỏ', bottles: 24, revenue: 40_000_000, pct: 80 },
                { type: 'WHITE', label: 'Vang Trắng', bottles: 6, revenue: 5_000_000, pct: 20 },
            ],
            priceBrackets: [
                { label: 'Phổ thông (< 500k)', bottles: 0, revenue: 0, pct: 0 },
                { label: 'Trung cấp (500k – 1.5M)', bottles: 18, revenue: 20_000_000, pct: 60 },
                { label: 'Cao cấp (> 1.5M)', bottles: 12, revenue: 25_000_000, pct: 40 },
            ],
            countries: [
                { country: 'Italy', bottles: 24, revenue: 40_000_000, pct: 80 },
                { country: 'France', bottles: 6, revenue: 5_000_000, pct: 20 },
            ],
        },
        orders: [
            {
                id: 'so-1',
                soNo: 'SO-2611-001',
                createdAt: '2026-11-15T10:00:00.000Z',
                orderType: 'STANDARD',
                orderDiscountPct: 5,
                legalEntityName: "Ly's Cellars",
                totalAmount: 45_000_000,
                paidAmount: 30_000_000,
                unpaidAmount: 15_000_000,
                status: 'INVOICED',
                deliveryStatus: 'DELIVERED',
                salesRepName: 'Nguyen Van A',
                branchName: 'HR-001-B1 - Park Hyatt Opera',
                totalBottles: 24,
                lineCount: 1,
                shippingAddress: '2 Lam Son Square, D1, HCMC',
                receiverName: 'Le Van C',
                receiverPhone: '0909654321',
                deliveryNotes: null,
                deliveryOrders: [{ id: 'do-1', doNo: 'DO-001', status: 'DELIVERED' }],
                arInvoices: [
                    { id: 'inv-1', invoiceNo: 'INV-2611-01', status: 'PARTIALLY_PAID', amount: 45_000_000, paidAmount: 30_000_000 },
                ],
                lines: [
                    {
                        id: 'sol-1',
                        skuCode: 'L10001',
                        productName: 'Sartori Amarone della Valpolicella',
                        wineType: 'RED',
                        country: 'Italy',
                        vintage: 2019,
                        listPrice: 2_200_000,
                        qtyOrdered: 24,
                        unitPrice: 2_000_000,
                        lineDiscountPct: 5,
                        orderDiscountPct: 5,
                        effectiveDiscountPct: 9.75,
                        discountAmount: 4_680_000,
                        lineTotal: 43_320_000,
                    },
                ],
            },
            {
                id: 'so-2',
                soNo: 'SO-2610-009',
                createdAt: '2026-10-25T10:00:00.000Z',
                orderType: 'TASTING',
                orderDiscountPct: 0,
                legalEntityName: "Ly's Cellars",
                totalAmount: 0,
                paidAmount: 0,
                unpaidAmount: 0,
                status: 'DELIVERED',
                deliveryStatus: 'DELIVERED',
                salesRepName: 'Nguyen Van A',
                branchName: null,
                totalBottles: 6,
                lineCount: 1,
                shippingAddress: null,
                receiverName: null,
                receiverPhone: null,
                deliveryNotes: 'Tasting event',
                deliveryOrders: [],
                arInvoices: [],
                lines: [
                    {
                        id: 'sol-2',
                        skuCode: 'L20034',
                        productName: 'Saget La Perriere Sancerre',
                        wineType: 'WHITE',
                        country: 'France',
                        vintage: 2023,
                        listPrice: 900_000,
                        qtyOrdered: 6,
                        unitPrice: 0,
                        lineDiscountPct: 0,
                        orderDiscountPct: 0,
                        effectiveDiscountPct: 0,
                        discountAmount: 0,
                        lineTotal: 0,
                    },
                ],
            },
        ],
        topProducts: [
            {
                productId: 'prod-1',
                skuCode: 'L10001',
                name: 'Sartori Amarone della Valpolicella',
                wineType: 'RED',
                originCountry: 'Italy',
                orderCount: 1,
                totalQty: 24,
                totalSpend: 43_320_000,
                avgNetPrice: 1_805_000,
                lastUnitPrice: 2_000_000,
                lastPurchasedAt: '2026-11-15T10:00:00.000Z',
            },
            {
                productId: 'prod-2',
                skuCode: 'L20034',
                name: 'Saget La Perriere Sancerre',
                wineType: 'WHITE',
                originCountry: 'France',
                orderCount: 1,
                totalQty: 6,
                totalSpend: 0,
                avgNetPrice: 0,
                lastUnitPrice: 0,
                lastPurchasedAt: '2026-10-25T10:00:00.000Z',
            },
        ],
        monthlyTrend: [
            { month: '2026-10', label: 'T10/26', revenue: 0, bottles: 6, commercialBottles: 0, tastingBottles: 6, orders: 1 },
            { month: '2026-11', label: 'T11/26', revenue: 45_000_000, bottles: 24, commercialBottles: 24, tastingBottles: 0, orders: 1 },
        ],
    }
}

describe('buildCustomerDetailExcelBuffer', () => {
    it('generates 4 bilingual worksheets with Anh J 6 core columns and SUM/SUMIF formulas', async () => {
        const fixture = makeRichFixture()
        const buf = await buildCustomerDetailExcelBuffer(fixture, {
            timeRange: 'CUSTOM',
            customFrom: '2026-10-01',
            customTo: '2026-11-28',
        })

        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buf as unknown as ArrayBuffer)

        expect(wb.worksheets.map(w => w.name)).toEqual([
            'Overview & Insights',
            'Purchase Detail',
            'Top Wines & Pricing',
            'Monthly Trend',
        ])

        const ws2 = wb.getWorksheet('Purchase Detail')!
        const firstSixHeaders = [1, 2, 3, 4, 5, 6].map(c => ws2.getRow(4).getCell(c).value)
        expect(firstSixHeaders).toEqual([
            'Date / Ngày',
            'Code / Mã SKU',
            'Product / Tên Sản Phẩm',
            'Quantity / Số Lượng',
            'Price / Đơn Giá',
            'Discount (%) / Chiết Khấu',
        ])

        const totalQtyVal = ws2.getRow(7).getCell(4).value as { formula?: string }
        const commQtyVal = ws2.getRow(8).getCell(4).value as { formula?: string }
        expect(totalQtyVal?.formula).toBe('SUM(D5:D6)')
        expect(commQtyVal?.formula).toBe('SUMIF(J5:J6,"Sales / Đơn bán",D5:D6)')
    })

    it('handles empty orders cleanly without generating broken formulas', async () => {
        const base = makeRichFixture()
        const emptyFixture: CustomerPurchaseHistoryResult = {
            ...base,
            kpis: {
                totalRevenue: 0,
                totalOrders: 0,
                totalBottles: 0,
                lastOrderDate: null,
                lastOrderNo: null,
                totalPaidAmount: 0,
                totalArDebt: 0,
                overdueArDebt: 0,
            },
            pricing: { basePriceType: 'BY_CHANNEL', defaultDiscountPct: 0, specialRules: [], proposals: [] },
            health: { status: 'NEW', statusLabel: 'Khách mới', daysSinceLastOrder: null, averageOrderCycleDays: null, delayDays: 0 },
            orderBreakdown: { commercialCount: 0, commercialRevenue: 0, commercialBottles: 0, tastingCount: 0, tastingBottles: 0 },
            preferences: { wineTypes: [], priceBrackets: [], countries: [] },
            orders: [],
            topProducts: [],
            monthlyTrend: [],
        }

        const buf = await buildCustomerDetailExcelBuffer(emptyFixture, { timeRange: 'ALL' })
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(buf as unknown as ArrayBuffer)

        expect(wb.worksheets.map(w => w.name)).toEqual([
            'Overview & Insights',
            'Purchase Detail',
            'Top Wines & Pricing',
            'Monthly Trend',
        ])
    })
})
