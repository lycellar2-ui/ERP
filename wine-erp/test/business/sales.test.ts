import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/utils', () => ({ generateSoNo: vi.fn((n: number) => `SO-2603-${String(n).padStart(4, '0')}`) }))

const mockPrisma = {
    salesOrder: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    salesOrderLine: { findMany: vi.fn() },
    allocationCampaign: { findMany: vi.fn() },
    allocationQuota: { update: vi.fn(), create: vi.fn() },
    allocationLog: { create: vi.fn() },
    aRInvoice: { aggregate: vi.fn() },
    stockLot: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: any) => Promise.all(ops)),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/approval', () => ({ submitForApproval: vi.fn().mockResolvedValue({ success: true }) }))

const {
    createSalesOrder,
    confirmSalesOrder,
    advanceSalesOrderStatus,
    checkAllocationQuota,
    getSOMarginData,
    getCustomerARBalance,
} = await import('@/app/dashboard/sales/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// SLS: Create Sales Order + Quota Check
// ═══════════════════════════════════════════════════

describe('SLS-01: createSalesOrder with Allocation Quota', () => {
    it('should block SO if quota exceeded', async () => {
        // Active campaign with quota for sales rep — available = 10-8=2, requesting 5
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([{
            id: 'camp-1', productId: 'p-grand-cru',
            status: 'ACTIVE', startDate: new Date('2020-01-01'), endDate: new Date('2030-01-01'),
            quotas: [{ id: 'q-1', targetType: 'SALES_REP', targetId: 'rep-1', qtyAllocated: 10, qtySold: 8 }],
        }])

        const result = await createSalesOrder({
            customerId: 'cust-1', salesRepId: 'rep-1', channel: 'HORECA',
            paymentTerm: 'NET30',
            lines: [{ productId: 'p-grand-cru', qtyOrdered: 5, unitPrice: 2_000_000 }],
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Vượt quota')
    })

    it('should create SO when quota allows', async () => {
        // No active campaigns → no quota restriction
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([])
        mockPrisma.salesOrder.count.mockResolvedValue(42)
        mockPrisma.salesOrder.create.mockResolvedValue({
            id: 'so-new', soNo: 'SO-2603-0043',
            lines: [{ id: 'line-1', productId: 'p-1' }],
        })

        const result = await createSalesOrder({
            customerId: 'cust-1', salesRepId: 'rep-1', channel: 'VIP_RETAIL',
            paymentTerm: 'NET30',
            lines: [{ productId: 'p-1', qtyOrdered: 6, unitPrice: 1_500_000 }],
        })

        expect(result.success).toBe(true)
        expect(result.soNo).toBe('SO-2603-0043')
    })

    it('should calculate totalAmount with line discounts + order discount', async () => {
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([])
        mockPrisma.salesOrder.count.mockResolvedValue(0)
        mockPrisma.salesOrder.create.mockResolvedValue({ id: 'so-1', soNo: 'SO-01', lines: [] })

        await createSalesOrder({
            customerId: 'c-1', salesRepId: 'r-1', channel: 'HORECA',
            paymentTerm: 'NET30',
            orderDiscount: 5, // 5% overall discount
            lines: [
                { productId: 'p-1', qtyOrdered: 10, unitPrice: 1_000_000, lineDiscountPct: 10 },
            ],
        })

        // Line total: 10 * 1M = 10M, minus 10% = 9M
        // Order discount 5%: 9M * 0.95 = 8.55M
        expect(mockPrisma.salesOrder.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    totalAmount: 8_550_000,
                }),
            }),
        )
    })
})

// ═══════════════════════════════════════════════════
// SYS-02: SO Confirm → Approval Threshold
// ═══════════════════════════════════════════════════

describe('SYS-02: confirmSalesOrder — Approval Threshold', () => {
    it('should route to approval engine when SO >= 100M VND', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({
            totalAmount: 150_000_000, salesRepId: 'rep-1', soNo: 'SO-01', status: 'DRAFT',
        })
        mockPrisma.salesOrder.update.mockResolvedValue({})

        const result = await confirmSalesOrder('so-big')

        expect(result.success).toBe(true)
        expect(result.needsApproval).toBe(true)
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-big' },
            data: { status: 'PENDING_APPROVAL' },
        })
    })

    it('should directly confirm SO under threshold (<100M)', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({
            totalAmount: 50_000_000, salesRepId: 'rep-1', soNo: 'SO-02', status: 'DRAFT',
        })
        mockPrisma.salesOrder.update.mockResolvedValue({})

        const result = await confirmSalesOrder('so-small')

        expect(result.success).toBe(true)
        expect(result.needsApproval).toBeUndefined()
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-small' },
            data: { status: 'CONFIRMED' },
        })
    })

    it('should reject if SO is not DRAFT', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({
            totalAmount: 10_000_000, status: 'CONFIRMED', salesRepId: 'r-1', soNo: 'SO-03',
        })
        const result = await confirmSalesOrder('so-already-confirmed')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Không thể xác nhận')
    })
})

// ═══════════════════════════════════════════════════
// SLS: SO Status Transitions
// ═══════════════════════════════════════════════════

describe('advanceSalesOrderStatus', () => {
    it('should allow CONFIRMED → DELIVERED', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ status: 'CONFIRMED' })
        mockPrisma.salesOrder.update.mockResolvedValue({})
        const result = await advanceSalesOrderStatus('so-1', 'DELIVERED')
        expect(result.success).toBe(true)
    })

    it('should allow DELIVERED → INVOICED', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ status: 'DELIVERED' })
        mockPrisma.salesOrder.update.mockResolvedValue({})
        const result = await advanceSalesOrderStatus('so-1', 'INVOICED')
        expect(result.success).toBe(true)
    })

    it('should allow INVOICED → PAID', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ status: 'INVOICED' })
        mockPrisma.salesOrder.update.mockResolvedValue({})
        const result = await advanceSalesOrderStatus('so-1', 'PAID')
        expect(result.success).toBe(true)
    })

    it('should BLOCK DRAFT → DELIVERED (invalid transition)', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ status: 'DRAFT' })
        const result = await advanceSalesOrderStatus('so-1', 'DELIVERED')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Không thể chuyển')
    })

    it('should BLOCK CONFIRMED → PAID (skip DELIVERED/INVOICED)', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ status: 'CONFIRMED' })
        const result = await advanceSalesOrderStatus('so-1', 'PAID')
        expect(result.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════
// SLS-01: Quota Check Engine
// ═══════════════════════════════════════════════════

describe('SLS-01: checkAllocationQuota', () => {
    it('should allow when no campaigns exist', async () => {
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([])
        const result = await checkAllocationQuota({
            productId: 'p-1', salesRepId: 'r-1', customerId: 'c-1', channel: 'HORECA', qtyRequested: 50,
        })
        expect(result.allowed).toBe(true)
    })

    it('should block when rep quota exceeded', async () => {
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([{
            id: 'camp-1', productId: 'p-grand',
            quotas: [{ id: 'q-1', targetType: 'SALES_REP', targetId: 'rep-1', qtyAllocated: 20, qtySold: 18 }],
        }])

        const result = await checkAllocationQuota({
            productId: 'p-grand', salesRepId: 'rep-1', customerId: 'c-1', channel: 'HORECA', qtyRequested: 5,
        })

        expect(result.allowed).toBe(false)
        expect(result.availableQty).toBe(2) // 20 - 18
        expect(result.reason).toContain('Quota còn 2')
    })

    it('should check customer quota after sales rep', async () => {
        mockPrisma.allocationCampaign.findMany.mockResolvedValue([{
            id: 'camp-1', productId: 'p-rare',
            quotas: [
                // No rep quota → falls through to customer
                { id: 'q-2', targetType: 'CUSTOMER', targetId: 'cust-vip', qtyAllocated: 30, qtySold: 25 },
            ],
        }])

        const result = await checkAllocationQuota({
            productId: 'p-rare', salesRepId: 'rep-other', customerId: 'cust-vip', channel: 'VIP_RETAIL', qtyRequested: 3,
        })

        expect(result.allowed).toBe(true)
        expect(result.availableQty).toBe(5) // 30 - 25
    })
})

// ═══════════════════════════════════════════════════
// SLS-02: Margin Analysis
// ═══════════════════════════════════════════════════

describe('SLS-02: getSOMarginData', () => {
    it('should detect negative margin and flag isNegative', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({
            id: 'so-1',
            lines: [{
                id: 'line-1', productId: 'p-1', qtyOrdered: 10, unitPrice: 200_000, lineDiscountPct: 0,
                product: { skuCode: 'CM-2018', productName: 'Chateau Test' },
            }],
        })

        // Avg cost is HIGHER than selling price → negative margin
        mockPrisma.stockLot.findMany.mockResolvedValue([
            { qtyAvailable: 50, unitLandedCost: 300_000 }, // Cost > Price (200k)
        ])

        const result = await getSOMarginData('so-1')

        expect(result).not.toBeNull()
        expect(result!.hasNegativeMargin).toBe(true)
        expect(result!.lines[0].isNegative).toBe(true)
        expect(result!.lines[0].margin).toBeLessThan(0)
    })

    it('should return null for nonexistent SO', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
        const result = await getSOMarginData('so-ghost')
        expect(result).toBeNull()
    })
})

// ═══════════════════════════════════════════════════
// SLS-03: Credit Limit Check
// ═══════════════════════════════════════════════════

describe('SLS-03: getCustomerARBalance', () => {
    it('should return total AR outstanding', async () => {
        mockPrisma.aRInvoice.aggregate.mockResolvedValue({ _sum: { amount: 150_000_000 } })
        const balance = await getCustomerARBalance('cust-1')
        expect(balance).toBe(150_000_000)
    })

    it('should return 0 when no outstanding', async () => {
        mockPrisma.aRInvoice.aggregate.mockResolvedValue({ _sum: { amount: null } })
        const balance = await getCustomerARBalance('cust-clean')
        expect(balance).toBe(0)
    })
})
