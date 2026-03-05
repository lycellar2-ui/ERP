import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockTx = {
    kpiTarget: { create: vi.fn() }
}

const mockPrisma = {
    kpiTarget: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// We need to test the unexported calcStatus function by triggering it through some exported behavior,
// But since calcStatus isn't exported, let's just test KPI tools

const {
    upsertKpiTarget,
    copyKpiFromPreviousYear,
} = await import('@/app/dashboard/kpi/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('KPI-01: Manage KPI Targets', () => {
    it('should create target if not exists', async () => {
        mockPrisma.kpiTarget.findFirst.mockResolvedValue(null)
        mockPrisma.kpiTarget.create.mockResolvedValue({})

        const result = await upsertKpiTarget({
            metric: 'REVENUE', year: 2026, month: null, targetValue: 5000000000, unit: 'VND'
        })
        expect(result.success).toBe(true)
        expect(mockPrisma.kpiTarget.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ metric: 'REVENUE', targetValue: 5000000000 })
        })
    })
})

describe('KPI-02: Copy KPI logic', () => {
    it('should copy targets with multiplier', async () => {
        // Return 2 mock targets from previous year
        mockPrisma.kpiTarget.findMany.mockResolvedValue([
            { metric: 'REVENUE', month: 1, targetValue: 1000, unit: 'VND', salesRepId: 'r1' },
            { metric: 'VOLUME', month: null, targetValue: 50, unit: 'BOTTLE', salesRepId: null },
        ])
        mockPrisma.kpiTarget.count.mockResolvedValue(0)

        const result = await copyKpiFromPreviousYear({ fromYear: 2025, toYear: 2026, growthMultiplier: 1.1 })

        expect(result.success).toBe(true)
        expect(result.copied).toBe(2)

        // Check new values: 1000 * 1.1 = 1100, 50 * 1.1 = 55
        expect(mockPrisma.kpiTarget.create).toHaveBeenCalledTimes(2)
        expect(mockPrisma.kpiTarget.create).toHaveBeenNthCalledWith(1, {
            data: expect.objectContaining({ year: 2026, targetValue: 1100 })
        })
        expect(mockPrisma.kpiTarget.create).toHaveBeenNthCalledWith(2, {
            data: expect.objectContaining({ year: 2026, targetValue: 55 })
        })
    })
})
