import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/utils', () => ({ generateSoNo: vi.fn((n) => `POS-SO-${n}`) }))

const mockTx = {
    salesOrder: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
    salesOrderLine: { create: vi.fn() },
    aRInvoice: { create: vi.fn(), update: vi.fn() },
    aRPayment: { create: vi.fn() },
    stockLot: { findMany: vi.fn(), update: vi.fn() },
    deliveryOrder: { create: vi.fn() },
    deliveryOrderLine: { create: vi.fn() },
    journalEntry: { count: vi.fn(), create: vi.fn() },
    accountingPeriod: { findFirst: vi.fn() },
    vatInvoice: { create: vi.fn() },
}

const mockPrisma = {
    salesOrder: { findUnique: vi.fn(), aggregate: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
    stockLot: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findUnique: vi.fn(), findFirst: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
    priceList: { findFirst: vi.fn() },
    priceListLine: { findFirst: vi.fn(), findMany: vi.fn() },
    aRInvoice: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    processPOSSale,
    generatePOSVATInvoice,
    lookupByBarcode,
} = await import('@/app/dashboard/pos/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('POS-01: processPOSSale', () => {
    it('should reject if cart is empty', async () => {
        const result = await processPOSSale({ items: [], paymentMethod: 'CASH' })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Giỏ hàng trống')
    })

    it('should reject if CASH but not enough cashReceived', async () => {
        const result = await processPOSSale({
            items: [{ productId: 'p1', skuCode: 'SKU1', productName: 'P1', qty: 2, unitPrice: 500000, discountPct: 0 }],
            paymentMethod: 'CASH',
            cashReceived: 900000, // total is 1,000,000
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('nhỏ hơn tổng tiền')
    })

    it('should create SO, AR, Payment, DO, and COGS journal in transaction', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({ id: 'c1' })
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1' })
        mockPrisma.salesOrder.count.mockResolvedValue(1)

        mockTx.accountingPeriod.findFirst.mockResolvedValue({ id: 'p1' })
        mockTx.journalEntry.count.mockResolvedValue(1)
        mockTx.salesOrder.count.mockResolvedValue(1)
        mockTx.salesOrder.create.mockResolvedValue({ id: 'so-pos-1', soNo: 'POS-SO-2' })
        mockTx.stockLot.findMany.mockResolvedValue([{ id: 'lot-1', qtyAvailable: 5, unitLandedCost: 200000 }])
        mockTx.stockLot.update.mockResolvedValue({})

        const result = await processPOSSale({
            items: [{ productId: 'p1', skuCode: 'SKU1', productName: 'P1', qty: 2, unitPrice: 500000, discountPct: 10 }],
            paymentMethod: 'CASH',
            cashReceived: 1000000,
        })

        if (!result.success) {
            console.error('POS Error:', result.error)
        }

        expect(result.success).toBe(true)
        // 2 * 500k = 1M, 10% discount -> 900k
        expect(result.totalAmount).toBe(900000)
        expect(result.change).toBe(100000)

        // Verifies SO created with correct total
        expect(mockTx.salesOrder.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ totalAmount: 900000, status: 'PAID' })
        }))
        // Verifies StockLot updated
        expect(mockTx.stockLot.update).toHaveBeenCalled()
    })
})

describe('POS-02: lookupByBarcode', () => {
    it('should find product by SKU and aggregate stock', async () => {
        mockPrisma.product.findFirst.mockResolvedValue({
            id: 'p1', skuCode: 'BC123', productName: 'Test', wineType: 'RED', category: 'WINE',
            stockLots: [{ qtyAvailable: 3 }, { qtyAvailable: 2 }],
        })
        mockPrisma.priceList.findFirst.mockResolvedValue({ id: 'pl-1' })
        mockPrisma.priceListLine.findFirst.mockResolvedValue({ unitPrice: 100000 })

        const result = await lookupByBarcode('BC123')
        expect(result).toBeDefined()
        expect(result?.qtyAvailable).toBe(5)
        expect(result?.unitPrice).toBe(100000)
    })
})

describe('POS-03: generatePOSVATInvoice', () => {
    it('should generate VAT invoice for paid POS SO', async () => {
        mockPrisma.salesOrder.findFirst.mockResolvedValue({
            id: 'so-1', totalAmount: 1100000, status: 'PAID', vatInvoices: []
        })
        mockPrisma.aRInvoice.findFirst.mockResolvedValue(null)
        mockPrisma.aRInvoice.count.mockResolvedValue(0)
        mockPrisma.aRInvoice.create.mockResolvedValue({ invoiceNo: 'VAT-POS-000001' })

        const result = await generatePOSVATInvoice({ soNo: 'POS-1', customerName: 'Khach le' })
        expect(result.success).toBe(true)
        expect(mockPrisma.aRInvoice.create).toHaveBeenCalled()
    })
})
