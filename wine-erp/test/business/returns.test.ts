import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockTx = {
    returnOrder: { update: vi.fn() },
    creditNote: { create: vi.fn() },
    stockLot: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}

const mockPrisma = {
    salesOrder: { findUnique: vi.fn() },
    returnOrder: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    creditNote: { count: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { createReturnOrder, approveReturnOrder } = await import('@/app/dashboard/returns/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// RET-01: Create Return Order
// ═══════════════════════════════════════════════════

describe('RET-01: createReturnOrder', () => {
    it('should reject if SO not found', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
        const result = await createReturnOrder({
            soId: 'so-ghost', reason: 'Damaged',
            lines: [{ productId: 'p-1', qtyReturned: 2, unitPrice: 500_000 }],
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('SO not found')
    })

    it('should calculate totalAmount from lines', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ soNo: 'SO-01', customerId: 'c-1' })
        mockPrisma.returnOrder.count.mockResolvedValue(5)
        mockPrisma.returnOrder.create.mockResolvedValue({})

        await createReturnOrder({
            soId: 'so-1', reason: 'Wrong product',
            lines: [
                { productId: 'p-1', qtyReturned: 3, unitPrice: 1_000_000 },
                { productId: 'p-2', qtyReturned: 2, unitPrice: 500_000 },
            ],
        })

        expect(mockPrisma.returnOrder.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                returnNo: 'RET-000006',
                totalAmount: 4_000_000, // 3*1M + 2*500K
            }),
        })
    })
})

// ═══════════════════════════════════════════════════
// RET-02: Approve Return → Credit Note + QUARANTINE lots
// ═══════════════════════════════════════════════════

describe('RET-02: approveReturnOrder', () => {
    it('should reject if return order not found', async () => {
        mockPrisma.returnOrder.findUnique.mockResolvedValue(null)
        const result = await approveReturnOrder('ret-ghost')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Return order not found')
    })

    it('should reject if status is APPROVED (already processed)', async () => {
        mockPrisma.returnOrder.findUnique.mockResolvedValue({ id: 'ret-1', status: 'APPROVED', lines: [] })
        const result = await approveReturnOrder('ret-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Can only approve DRAFT')
    })

    it('should create credit note + quarantine stock lots on approval', async () => {
        mockPrisma.returnOrder.findUnique.mockResolvedValue({
            id: 'ret-1', status: 'DRAFT', customerId: 'c-1', totalAmount: 2_000_000,
            lines: [{
                productId: 'p-wine', qtyReturned: 5, unitPrice: 400_000,
                product: { skuCode: 'W-01', productName: 'Wine Test' },
            }],
            so: { soNo: 'SO-01' },
        })
        mockPrisma.creditNote.count.mockResolvedValue(0)
        mockTx.stockLot.findFirst.mockResolvedValue({ locationId: 'loc-q', shipmentId: 'ship-1', unitLandedCost: 350_000 })
        mockTx.stockLot.count.mockResolvedValue(100)

        const result = await approveReturnOrder('ret-1')

        expect(result.success).toBe(true)

        // Verify credit note created
        expect(mockTx.creditNote.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                creditNoteNo: 'CN-000001',
                customerId: 'c-1',
                amount: 2_000_000,
                status: 'ISSUED',
            }),
        })

        // Verify QUARANTINE stock lot created
        expect(mockTx.stockLot.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                lotNo: expect.stringContaining('QRT-RET-'),
                productId: 'p-wine',
                qtyReceived: 5,
                qtyAvailable: 5,
                status: 'QUARANTINE',
            }),
        })
    })
})
