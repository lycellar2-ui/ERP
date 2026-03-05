import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    stockCountSession: { update: vi.fn() }
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { startStockCount } = await import('@/app/dashboard/stock-count/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('STK-01: Stock Count Management', () => {
    it('should mark session IN_PROGRESS', async () => {
        mockPrisma.stockCountSession.update.mockResolvedValue({})
        const result = await startStockCount('session-1')
        expect(result.success).toBe(true)
        expect(mockPrisma.stockCountSession.update).toHaveBeenCalledWith({
            where: { id: 'session-1' },
            data: expect.objectContaining({ status: 'IN_PROGRESS' })
        })
    })
})
