import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    cachedWithTiming: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn()
}))
vi.mock('@/lib/session', () => ({
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1', roles: ['CEO'] }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', roles: ['CEO'] }),
    hasRole: vi.fn(() => true),
}))
vi.mock('@/lib/audit', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/app/dashboard/sales/actions', () => ({
    approveSalesOrder: vi.fn().mockResolvedValue({ success: false, error: 'no-template' }),
}))

const mockPrisma = {
    journalLine: { findMany: vi.fn(), groupBy: vi.fn() },
    salesOrder: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    stockLot: { findMany: vi.fn() },
    approvalRequest: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    approvalLog: { create: vi.fn() },
    shipment: { findMany: vi.fn() },
    aRPayment: { aggregate: vi.fn() },
    aPPayment: { aggregate: vi.fn() },
    expense: { aggregate: vi.fn() },
    aRInvoice: { aggregate: vi.fn(), findMany: vi.fn() },
    aPInvoice: { aggregate: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { getPLSummary, getARAgingChart, approveSO, rejectSO } = await import('@/app/dashboard/actions')

beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
})

describe('getPLSummary', () => {
    it('should calculate revenue, COGS, gross/net profit correctly', async () => {
        mockPrisma.journalLine.groupBy.mockResolvedValue([
            { account: '511 - Doanh thu', _sum: { debit: 0, credit: 150_000_000 } },
            { account: '632 - Giá vốn', _sum: { debit: 60_000_000, credit: 0 } },
            { account: '641 - CP bán hàng', _sum: { debit: 10_000_000, credit: 0 } },
            { account: '642 - CP QLDN', _sum: { debit: 5_000_000, credit: 0 } },
        ])
        const r = await getPLSummary()
        expect(r.revenue).toBe(150_000_000)
        expect(r.cogs).toBe(60_000_000)
        expect(r.grossProfit).toBe(90_000_000)
        expect(r.expenses).toBe(15_000_000)
        expect(r.netProfit).toBe(75_000_000)
        expect(r.grossMargin).toBeCloseTo(60)
    })

    it('should handle zero revenue without division error', async () => {
        mockPrisma.journalLine.groupBy.mockResolvedValue([])
        const r = await getPLSummary()
        expect(r.revenue).toBe(0)
        expect(r.grossMargin).toBe(0)
    })

    it('should handle TK 635 (financial expense) in total expenses', async () => {
        mockPrisma.journalLine.groupBy.mockResolvedValue([
            { account: '511', _sum: { debit: 0, credit: 100_000_000 } },
            { account: '632', _sum: { debit: 40_000_000, credit: 0 } },
            { account: '635 - CP tài chính', _sum: { debit: 5_000_000, credit: 0 } },
            { account: '642', _sum: { debit: 10_000_000, credit: 0 } },
        ])
        const r = await getPLSummary()
        expect(r.expenses).toBe(15_000_000) // 5M + 10M
        expect(r.netProfit).toBe(45_000_000) // 60M - 15M
    })
})

describe('getARAgingChart', () => {
    it('should group overdue invoices into buckets correctly', async () => {
        const now = new Date()
        const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000)

        mockPrisma.aRInvoice.findMany.mockResolvedValue([
            { id: '1', totalAmount: 10_000_000, paidAmount: 0, dueDate: daysAgo(10) },  // 1-30 days
            { id: '2', totalAmount: 20_000_000, paidAmount: 0, dueDate: daysAgo(45) },  // 31-60 days
            { id: '3', totalAmount: 15_000_000, paidAmount: 0, dueDate: daysAgo(75) },  // 61-90 days
            { id: '4', totalAmount: 30_000_000, paidAmount: 0, dueDate: daysAgo(100) }, // 91-120 days
            { id: '5', totalAmount: 50_000_000, paidAmount: 0, dueDate: daysAgo(150) }, // 120+ days
        ])

        const r = await getARAgingChart()
        expect(r.invoiceCount).toBe(5)
        expect(r.totalOutstanding).toBe(125_000_000)
        expect(r.buckets[0].amount).toBe(0) // Chưa đến hạn
        expect(r.buckets[1].amount).toBe(10_000_000) // 1-30 days
        expect(r.buckets[2].amount).toBe(20_000_000) // 31-60 days
        expect(r.buckets[4].amount).toBe(80_000_000) // >90 days (30M + 50M)
    })

    it('should return zeros when no invoices', async () => {
        mockPrisma.aRInvoice.findMany.mockResolvedValue([])
        const r = await getARAgingChart()
        expect(r.invoiceCount).toBe(0)
        expect(r.totalOutstanding).toBe(0)
    })
})

describe('approveSO', () => {
    it('should update SO status to CONFIRMED via fallback', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'so-001', status: 'PENDING_APPROVAL', soNo: 'SO-001' })
        mockPrisma.salesOrder.update.mockResolvedValue({})
        await approveSO('so-001')
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-001' }, data: { status: 'CONFIRMED' },
        })
    })
})

describe('rejectSO', () => {
    it('should update SO status to CANCELLED', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'so-001', status: 'PENDING_APPROVAL', soNo: 'SO-001', totalAmount: 1000000 })
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null)
        mockPrisma.salesOrder.update.mockResolvedValue({})
        await rejectSO('so-001')
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-001' }, data: { status: 'CANCELLED' },
        })
    })
})
