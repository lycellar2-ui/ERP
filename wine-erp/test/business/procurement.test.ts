import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    purchaseOrder: {
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
    },
    purchaseOrderLine: { findMany: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    department: { findFirst: vi.fn(), create: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { createPurchaseOrder, updatePOStatus, getPOStats } = await import('@/app/dashboard/procurement/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// PRC-01: Create Purchase Order
// ═══════════════════════════════════════════════════

describe('PRC-01: createPurchaseOrder', () => {
    it('should generate PO number PO-YYMM-NNNN', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'sys-user' })
        mockPrisma.purchaseOrder.count.mockResolvedValue(15)
        mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-new', poNo: 'PO-2603-0016' })

        const result = await createPurchaseOrder({
            supplierId: 'sup-1',
            currency: 'EUR' as any,
            exchangeRate: 28000,
            lines: [{ productId: 'p-1', qtyOrdered: 100, unitPrice: 50, uom: 'BOTTLE' }],
        })

        expect(result.success).toBe(true)
        expect(result.poNo).toMatch(/^PO-\d{4}-\d{4}$/)
    })

    it('should create PO with DRAFT status', async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'sys-user' })
        mockPrisma.purchaseOrder.count.mockResolvedValue(0)
        mockPrisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', poNo: 'PO-2603-0001' })

        await createPurchaseOrder({
            supplierId: 'sup-bordeaux',
            currency: 'USD' as any,
            exchangeRate: 25000,
            lines: [{ productId: 'p-wine', qtyOrdered: 200, unitPrice: 25, uom: 'BOTTLE' }],
        })

        expect(mockPrisma.purchaseOrder.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                status: 'DRAFT',
                supplierId: 'sup-bordeaux',
                currency: 'USD',
                exchangeRate: 25000,
            }),
        })
    })

    it('should reject invalid input (no lines)', async () => {
        try {
            await createPurchaseOrder({
                supplierId: 'sup-1',
                currency: 'USD' as any,
                exchangeRate: 25000,
                lines: [],
            })
            expect.fail('Should have thrown')
        } catch (err: any) {
            expect(err.message || err.toString()).toContain('Cần ít nhất 1 dòng')
        }
    })
})

// ═══════════════════════════════════════════════════
// PRC-02: PO Status Update
// ═══════════════════════════════════════════════════

describe('PRC-02: updatePOStatus', () => {
    it('should update PO status', async () => {
        mockPrisma.purchaseOrder.update.mockResolvedValue({})
        const result = await updatePOStatus('po-1', 'APPROVED')
        expect(result.success).toBe(true)
        expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
            where: { id: 'po-1' },
            data: { status: 'APPROVED' },
        })
    })
})

// ═══════════════════════════════════════════════════
// PRC-03: PO Dashboard Stats
// ═══════════════════════════════════════════════════

describe('PRC-03: getPOStats', () => {
    it('should return aggregated PO counts', async () => {
        mockPrisma.purchaseOrder.count
            .mockResolvedValueOnce(50)  // total
            .mockResolvedValueOnce(10)  // draft
            .mockResolvedValueOnce(25)  // approved
            .mockResolvedValueOnce(8)   // inTransit

        const stats = await getPOStats()

        expect(stats).toEqual({ total: 50, draft: 10, approved: 25, inTransit: 8 })
    })
})
