import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    allocationCampaign: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    allocationQuota: { create: vi.fn(), findMany: vi.fn() },
    product: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    customer: { findUnique: vi.fn(), findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    createAllocCampaign,
    addAllocQuota,
    getAllocQuotas,
} = await import('@/app/dashboard/allocation/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('ALC-01: Allocation Campaigns', () => {
    it('should create new campaign', async () => {
        mockPrisma.allocationCampaign.create.mockResolvedValue({})
        const result = await createAllocCampaign({
            name: 'Grand Cru Q1', productId: 'p1', totalQty: 100, unit: 'BOTTLE',
            startDate: '2026-01-01', endDate: '2026-03-31'
        })
        expect(result.success).toBe(true)
        expect(mockPrisma.allocationCampaign.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ name: 'Grand Cru Q1', totalQty: 100 })
        })
    })
})

describe('ALC-02: Allocation Quotas', () => {
    it('should add quota to campaign', async () => {
        mockPrisma.allocationQuota.create.mockResolvedValue({})
        const result = await addAllocQuota({
            campaignId: 'c1', targetType: 'SALES_REP', targetId: 'user1', qtyAllocated: 20
        })
        expect(result.success).toBe(true)
        expect(mockPrisma.allocationQuota.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ targetType: 'SALES_REP', qtyAllocated: 20 })
        })
    })

    it('should fetch quotas with joined target names', async () => {
        mockPrisma.allocationQuota.findMany.mockResolvedValue([
            { id: 'q1', targetType: 'SALES_REP', targetId: 'user1', qtyAllocated: 10, qtySold: 2 },
            { id: 'q2', targetType: 'CUSTOMER', targetId: 'cust1', qtyAllocated: 5, qtySold: 5 }
        ])
        mockPrisma.user.findUnique.mockResolvedValue({ name: 'John Doe' })
        mockPrisma.customer.findUnique.mockResolvedValue({ name: 'VIP Hotel' })

        const quotas = await getAllocQuotas('camp1')

        expect(quotas).toHaveLength(2)
        expect(quotas[0].targetName).toBe('John Doe')
        expect(quotas[0].remaining).toBe(8)

        expect(quotas[1].targetName).toBe('VIP Hotel')
        expect(quotas[1].remaining).toBe(0)
    })
})
