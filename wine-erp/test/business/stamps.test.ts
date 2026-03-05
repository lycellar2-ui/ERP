import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    wineStampPurchase: { findUnique: vi.fn(), update: vi.fn() },
    wineStampUsage: { create: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        const tx = {
            wineStampUsage: { create: vi.fn() },
            wineStampPurchase: { update: vi.fn() },
        }
        return cb(tx)
    })
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { safeRecordStampUsage } = await import('@/app/dashboard/stamps/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('STM-01: Stamp Usage Management', () => {
    it('should reject if qtyUsed > available stamps', async () => {
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'purchase-1', totalQty: 1000, usedQty: 900
        })

        // 1000 total - 900 used = 100 available. Trying to use 200 -> fail.
        const result = await safeRecordStampUsage({
            purchaseId: 'purchase-1', qtyUsed: 200, qtyDamaged: 0, reportedBy: 'user1'
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Vượt quá số lượng')
    })

    it('should record usage and decrement if valid', async () => {
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'purchase-1', totalQty: 1000, usedQty: 500
        })

        const result = await safeRecordStampUsage({
            purchaseId: 'purchase-1', qtyUsed: 400, qtyDamaged: 0, reportedBy: 'user1'
        })

        expect(result.success).toBe(true)
    })
})
