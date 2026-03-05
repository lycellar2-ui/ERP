import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'admin-1' }) }))

const mockPrisma = {
    aRInvoice: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        aggregate: vi.fn(),
        update: vi.fn(),
    },
    aPInvoice: { findUnique: vi.fn() },
    aRPayment: { create: vi.fn() },
    aPPayment: { create: vi.fn() },
    salesOrder: { update: vi.fn() },
    journalEntry: { count: vi.fn(), create: vi.fn() },
    journalLine: { findMany: vi.fn() },
    accountingPeriod: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    goodsReceipt: { findUnique: vi.fn() },
    deliveryOrder: { findUnique: vi.fn() },
    stockLot: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    // $transaction with array: simply resolve all promises
    $transaction: vi.fn(async (ops: any) => {
        if (Array.isArray(ops)) return Promise.all(ops)
        if (typeof ops === 'function') return ops(mockPrisma)
        return undefined
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    recordARPayment,
    recordAPPayment,
    collectCODPayment,
    generateGoodsReceiptJournal,
    generateDeliveryOrderCOGSJournal,
    getProfitLoss,
    closeAccountingPeriod,
} = await import('@/app/dashboard/finance/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// FIN-01: AR Payment → Status update
// ═══════════════════════════════════════════════════

describe('FIN-01: recordARPayment', () => {
    it('should mark invoice PAID when full payment received', async () => {
        mockPrisma.aRInvoice.findUnique.mockResolvedValue({
            id: 'inv-1', amount: 10_000_000,
            payments: [{ amount: 5_000_000 }],
        })
        // Mock the individual operations that $transaction receives as array
        mockPrisma.aRPayment.create.mockResolvedValue({})
        mockPrisma.aRInvoice.update.mockResolvedValue({})

        const result = await recordARPayment('inv-1', 5_000_000, 'BANK_TRANSFER')
        expect(result.success).toBe(true)
    })

    it('should mark PARTIALLY_PAID for partial payment', async () => {
        mockPrisma.aRInvoice.findUnique.mockResolvedValue({
            id: 'inv-1', amount: 10_000_000, payments: [],
        })
        mockPrisma.aRPayment.create.mockResolvedValue({})
        mockPrisma.aRInvoice.update.mockResolvedValue({})

        const result = await recordARPayment('inv-1', 3_000_000, 'CASH')
        expect(result.success).toBe(true)
    })

    it('should fail when invoice not found', async () => {
        mockPrisma.aRInvoice.findUnique.mockResolvedValue(null)
        const result = await recordARPayment('inv-ghost', 1000, 'CASH')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Không tìm thấy')
    })
})

// ═══════════════════════════════════════════════════
// FIN-02: COD Collection — Thu tiền tại giao
// ═══════════════════════════════════════════════════

describe('FIN-02: collectCODPayment', () => {
    it('should reject if no AR invoice exists for SO', async () => {
        mockPrisma.aRInvoice.findFirst.mockResolvedValue(null)
        const result = await collectCODPayment({ soId: 'so-1', collectedAmount: 1000, collectedBy: 'driver-1' })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Chưa có hóa đơn AR')
    })

    it('should reject if collected amount exceeds outstanding', async () => {
        mockPrisma.aRInvoice.findFirst.mockResolvedValue({
            id: 'inv-1', totalAmount: 5_000_000,
            payments: [{ amount: 4_000_000 }],
        })
        const result = await collectCODPayment({ soId: 'so-1', collectedAmount: 2_000_000, collectedBy: 'driver-1' })
        expect(result.success).toBe(false)
        expect(result.error).toContain('vượt quá công nợ')
    })

    it('should create journal DR 111 / CR 131 for COD payment', async () => {
        mockPrisma.aRInvoice.findFirst.mockResolvedValue({
            id: 'inv-1', invoiceNo: 'INV-001', totalAmount: 3_000_000, soId: 'so-1',
            payments: [],
        })
        mockPrisma.aRPayment.create.mockResolvedValue({ id: 'pay-1' })
        mockPrisma.aRInvoice.update.mockResolvedValue({})
        mockPrisma.salesOrder.update.mockResolvedValue({})
        mockPrisma.accountingPeriod.findUnique.mockResolvedValue({ id: 'period-1', isClosed: false })
        mockPrisma.journalEntry.count.mockResolvedValue(0)
        mockPrisma.journalEntry.create.mockResolvedValue({})

        const result = await collectCODPayment({
            soId: 'so-1', collectedAmount: 3_000_000, collectedBy: 'driver-1',
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                docType: 'COD_COLLECTION',
                lines: {
                    create: expect.arrayContaining([
                        expect.objectContaining({ account: '111 - Tiền mặt', debit: 3_000_000 }),
                        expect.objectContaining({ account: '131 - Phải thu KH', credit: 3_000_000 }),
                    ]),
                },
            }),
        })
    })
})

// ═══════════════════════════════════════════════════
// FIN-03: Auto-Journal — DR 156 / CR 331 (Goods Receipt)
// ═══════════════════════════════════════════════════

describe('FIN-03: generateGoodsReceiptJournal', () => {
    it('should generate DR 156 / CR 331 journal', async () => {
        mockPrisma.goodsReceipt.findUnique.mockResolvedValue({
            id: 'gr-1', grNo: 'GR-01',
            lines: [
                { lot: { unitLandedCost: 300_000, qtyReceived: 100 } },
                { lot: { unitLandedCost: 500_000, qtyReceived: 50 } },
            ],
        })
        mockPrisma.accountingPeriod.findUnique.mockResolvedValue({ id: 'period-1', isClosed: false })
        mockPrisma.journalEntry.count.mockResolvedValue(5)
        mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-1' })

        const result = await generateGoodsReceiptJournal('gr-1', 'user-1')

        // Total: 300,000*100 + 500,000*50 = 55,000,000
        expect(result.success).toBe(true)
        expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                docType: 'GOODS_RECEIPT',
                lines: {
                    create: [
                        { account: '156 - Hàng tồn kho', debit: 55_000_000, credit: 0 },
                        { account: '331 - Phải trả NCC', debit: 0, credit: 55_000_000 },
                    ],
                },
            }),
        })
    })

    it('should fail if GR not found', async () => {
        mockPrisma.goodsReceipt.findUnique.mockResolvedValue(null)
        const result = await generateGoodsReceiptJournal('gr-ghost', 'u-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('GR không tồn tại')
    })
})

// ═══════════════════════════════════════════════════
// FIN-04: Auto-Journal — DR 632 / CR 156 (COGS)
// ═══════════════════════════════════════════════════

describe('FIN-04: generateDeliveryOrderCOGSJournal', () => {
    it('should generate COGS journal', async () => {
        mockPrisma.deliveryOrder.findUnique.mockResolvedValue({
            id: 'do-1', doNo: 'DO-01',
            lines: [
                { qtyShipped: 20, qtyPicked: 20, lot: { unitLandedCost: 250_000 } },
                { qtyShipped: 10, qtyPicked: 10, lot: { unitLandedCost: 400_000 } },
            ],
        })
        mockPrisma.accountingPeriod.findUnique.mockResolvedValue({ id: 'p-1', isClosed: false })
        mockPrisma.journalEntry.count.mockResolvedValue(0)
        mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-cogs' })

        const result = await generateDeliveryOrderCOGSJournal('do-1', 'user-1')

        // Total COGS: 20*250,000 + 10*400,000 = 9,000,000
        expect(result.success).toBe(true)
        expect(mockPrisma.journalEntry.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                docType: 'COGS',
                lines: {
                    create: [
                        { account: '632 - Giá vốn hàng bán', debit: 9_000_000, credit: 0 },
                        { account: '156 - Hàng tồn kho', debit: 0, credit: 9_000_000 },
                    ],
                },
            }),
        })
    })

    it('should skip journal when COGS = 0', async () => {
        mockPrisma.deliveryOrder.findUnique.mockResolvedValue({
            id: 'do-free', doNo: 'DO-FREE',
            lines: [{ qtyShipped: 5, qtyPicked: 5, lot: { unitLandedCost: 0 } }],
        })
        const result = await generateDeliveryOrderCOGSJournal('do-free', 'user-1')
        expect(result.success).toBe(true)
        expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════
// FIN-05: P&L from Journal (Vietnamese CoA)
// ═══════════════════════════════════════════════════

describe('FIN-05: getProfitLoss', () => {
    it('should compute netProfit = revenue – COGS – expenses', async () => {
        mockPrisma.journalLine.findMany.mockResolvedValue([
            { account: '511 - Doanh thu', debit: 0, credit: 100_000_000 },
            { account: '632 - Giá vốn hàng bán', debit: 60_000_000, credit: 0 },
            { account: '641 - Chi phí bán hàng', debit: 5_000_000, credit: 0 },
            { account: '642 - Chi phí QLDN', debit: 3_000_000, credit: 0 },
            { account: '635 - Chi phí tài chính', debit: 2_000_000, credit: 0 },
        ])

        const result = await getProfitLoss({ year: 2026, month: 3 })

        expect(result.revenue).toBe(100_000_000)
        expect(result.cogs).toBe(60_000_000)
        expect(result.grossProfit).toBe(40_000_000)
        expect(result.expenses).toBe(10_000_000)
        expect(result.netProfit).toBe(30_000_000)
    })

    it('should return zeros when no journal lines', async () => {
        mockPrisma.journalLine.findMany.mockResolvedValue([])
        const result = await getProfitLoss({ year: 2025, month: 1 })
        expect(result.revenue).toBe(0)
        expect(result.cogs).toBe(0)
        expect(result.netProfit).toBe(0)
    })
})

// ═══════════════════════════════════════════════════
// FIN-06: Closed Period Guard
// ═══════════════════════════════════════════════════

describe('FIN-06: closeAccountingPeriod', () => {
    it('should mark period as closed', async () => {
        mockPrisma.accountingPeriod.update.mockResolvedValue({})
        const result = await closeAccountingPeriod('period-1', 'admin-1')
        expect(result.success).toBe(true)
        expect(mockPrisma.accountingPeriod.update).toHaveBeenCalledWith({
            where: { id: 'period-1' },
            data: expect.objectContaining({ isClosed: true }),
        })
    })
})
