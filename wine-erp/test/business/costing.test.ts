import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockTx = {
    landedCostAllocation: { deleteMany: vi.fn() },
    stockLot: { updateMany: vi.fn() },
    landedCostCampaign: { update: vi.fn() },
}

const mockPrisma = {
    landedCostCampaign: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    landedCostAllocation: {
        deleteMany: vi.fn(),
        create: vi.fn(),
    },
    stockLot: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
    },
    shipment: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    createLandedCostCampaign,
    calculateLandedCostProration,
    finalizeLandedCostCampaign,
    updateLandedCostCampaign,
} = await import('@/app/dashboard/costing/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// COST-01: Create Landed Cost Campaign
// ═══════════════════════════════════════════════════

describe('COST-01: createLandedCostCampaign', () => {
    it('should reject duplicate campaign for same shipment', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({ id: 'existing' })
        const result = await createLandedCostCampaign({
            shipmentId: 'ship-1', totalImportTax: 1000, totalSct: 500, totalVat: 200, totalOtherCost: 100,
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('đã có Landed Cost Campaign')
    })

    it('should create campaign with DRAFT status', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue(null)
        mockPrisma.landedCostCampaign.create.mockResolvedValue({ id: 'camp-new' })

        const result = await createLandedCostCampaign({
            shipmentId: 'ship-new', totalImportTax: 10_000_000, totalSct: 5_000_000,
            totalVat: 2_000_000, totalOtherCost: 1_000_000,
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.landedCostCampaign.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                shipmentId: 'ship-new',
                status: 'DRAFT',
            }),
        })
    })
})

// ═══════════════════════════════════════════════════
// COST-02: Landed Cost Proration Engine
// ═══════════════════════════════════════════════════

describe('COST-02: calculateLandedCostProration', () => {
    it('should reject if campaign already ALLOCATED', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({ id: 'camp-1', status: 'ALLOCATED' })
        const result = await calculateLandedCostProration('camp-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('không thể tính lại')
    })

    it('should reject if shipment has no stock lots', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({
            id: 'camp-1', status: 'DRAFT', shipmentId: 'ship-1',
            totalImportTax: 100, totalSct: 50, totalVat: 30, totalOtherCost: 20,
        })
        mockPrisma.stockLot.findMany.mockResolvedValue([])
        const result = await calculateLandedCostProration('camp-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('chưa có StockLot')
    })

    it('should prorate costs proportionally by quantity', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({
            id: 'camp-1', status: 'DRAFT', shipmentId: 'ship-1',
            totalImportTax: 6_000_000, totalSct: 2_000_000, totalVat: 1_000_000, totalOtherCost: 1_000_000,
        })

        // 2 products, total qty: 100+50 = 150
        mockPrisma.stockLot.findMany.mockResolvedValue([
            { productId: 'p-bordeaux', qtyReceived: 100, product: { productName: 'Bordeaux', skuCode: 'BDX-19' } },
            { productId: 'p-barolo', qtyReceived: 50, product: { productName: 'Barolo', skuCode: 'BRL-20' } },
        ])
        mockPrisma.landedCostAllocation.deleteMany.mockResolvedValue({})
        mockPrisma.landedCostAllocation.create
            .mockResolvedValueOnce({ id: 'alloc-1' })
            .mockResolvedValueOnce({ id: 'alloc-2' })
        mockPrisma.landedCostCampaign.update.mockResolvedValue({})

        const result = await calculateLandedCostProration('camp-1')

        expect(result.success).toBe(true)
        expect(result.allocations).toHaveLength(2)

        // Total cost: 6M + 2M + 1M + 1M = 10M
        // Bordeaux: 100/150 * 10M = 6,666,666.67 → unit = 66,666.67
        // Barolo: 50/150 * 10M = 3,333,333.33 → unit = 66,666.67
        const bordeaux = result.allocations!.find(a => a.productId === 'p-bordeaux')!
        const barolo = result.allocations!.find(a => a.productId === 'p-barolo')!

        expect(bordeaux.qty).toBe(100)
        expect(barolo.qty).toBe(50)
        // Both should have same unit cost (proportional by qty)
        expect(bordeaux.unitLandedCost).toBeCloseTo(barolo.unitLandedCost, 0)
    })
})

// ═══════════════════════════════════════════════════
// COST-03: Finalize Campaign → Update StockLot costs
// ═══════════════════════════════════════════════════

describe('COST-03: finalizeLandedCostCampaign', () => {
    it('should reject if already ALLOCATED', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({
            id: 'camp-1', status: 'ALLOCATED', allocations: [],
        })
        const result = await finalizeLandedCostCampaign('camp-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('đã được Finalize')
    })

    it('should reject if no allocations exist', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({
            id: 'camp-1', status: 'CONFIRMED', allocations: [], shipmentId: 'ship-1',
        })
        const result = await finalizeLandedCostCampaign('camp-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Chưa có allocation')
    })

    it('should update StockLot unitLandedCost and mark campaign ALLOCATED', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({
            id: 'camp-1', status: 'CONFIRMED', shipmentId: 'ship-1',
            allocations: [
                { productId: 'p-1', unitLandedCost: 66_666.67 },
                { productId: 'p-2', unitLandedCost: 66_666.67 },
            ],
        })

        const result = await finalizeLandedCostCampaign('camp-1')

        expect(result.success).toBe(true)
        // Should update each product's lots
        expect(mockTx.stockLot.updateMany).toHaveBeenCalledTimes(2)
        expect(mockTx.stockLot.updateMany).toHaveBeenCalledWith({
            where: { shipmentId: 'ship-1', productId: 'p-1' },
            data: { unitLandedCost: 66_666.67 },
        })
        // Should mark campaign ALLOCATED
        expect(mockTx.landedCostCampaign.update).toHaveBeenCalledWith({
            where: { id: 'camp-1' },
            data: { status: 'ALLOCATED' },
        })
    })
})

// ═══════════════════════════════════════════════════
// COST-04: Update Campaign Guard (no edit after ALLOCATED)
// ═══════════════════════════════════════════════════

describe('COST-04: updateLandedCostCampaign', () => {
    it('should reject update if campaign is ALLOCATED', async () => {
        mockPrisma.landedCostCampaign.findUnique.mockResolvedValue({ id: 'camp-1', status: 'ALLOCATED' })
        const result = await updateLandedCostCampaign({
            id: 'camp-1', totalImportTax: 0, totalSct: 0, totalVat: 0, totalOtherCost: 0,
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('không thể chỉnh sửa')
    })
})
