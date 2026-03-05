import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    journalLine: { findMany: vi.fn() },
    salesOrder: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    stockLot: { findMany: vi.fn() },
    approvalRequest: { count: vi.fn(), findMany: vi.fn() },
    shipment: { findMany: vi.fn() },
    aRPayment: { aggregate: vi.fn() },
    aPPayment: { aggregate: vi.fn() },
    expense: { aggregate: vi.fn() },
    aRInvoice: { aggregate: vi.fn(), findMany: vi.fn() },
    aPInvoice: { aggregate: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { getPLSummary, getARAgingChart, approveSO, rejectSO } = await import('@/app/dashboard/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('getPLSummary', () => {
    it('should calculate revenue, COGS, gross/net profit correctly', async () => {
        mockPrisma.journalLine.findMany.mockResolvedValue([
            { account: '511 - Doanh thu', debit: 0, credit: 100_000_000 },
            { account: '511 - Doanh thu', debit: 0, credit: 50_000_000 },
            { account: '632 - Giá vốn', debit: 60_000_000, credit: 0 },
            { account: '641 - CP bán hàng', debit: 10_000_000, credit: 0 },
            { account: '642 - CP QLDN', debit: 5_000_000, credit: 0 },
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
        mockPrisma.journalLine.findMany.mockResolvedValue([])
        const r = await getPLSummary()
        expect(r.revenue).toBe(0)
        expect(r.grossMargin).toBe(0)
    })

    it('should handle TK 635 and TK 811', async () => {
        mockPrisma.journalLine.findMany.mockResolvedValue([
            { account: '511 - Rev', debit: 0, credit: 200_000_000 },
            { account: '632 - COGS', debit: 100_000_000, credit: 0 },
            { account: '635 - CP TC', debit: 20_000_000, credit: 0 },
            { account: '811 - CP khác', debit: 5_000_000, credit: 0 },
        ])
        const r = await getPLSummary()
        expect(r.expenses).toBe(25_000_000)
        expect(r.netProfit).toBe(75_000_000)
    })
})

describe('getARAgingChart', () => {
    it('should bucket invoices by days past due', async () => {
        const now = new Date()
        const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)
        mockPrisma.aRInvoice.findMany.mockResolvedValue([
            { totalAmount: 10_000_000, dueDate: new Date(now.getTime() + 86400000), status: 'UNPAID' },
            { totalAmount: 20_000_000, dueDate: daysAgo(15), status: 'OVERDUE' },
            { totalAmount: 30_000_000, dueDate: daysAgo(45), status: 'OVERDUE' },
            { totalAmount: 15_000_000, dueDate: daysAgo(75), status: 'OVERDUE' },
            { totalAmount: 50_000_000, dueDate: daysAgo(120), status: 'OVERDUE' },
        ])
        const r = await getARAgingChart()
        expect(r.invoiceCount).toBe(5)
        expect(r.totalOutstanding).toBe(125_000_000)
        expect(r.buckets[0].amount).toBe(10_000_000)
        expect(r.buckets[1].amount).toBe(20_000_000)
        expect(r.buckets[4].amount).toBe(50_000_000)
    })

    it('should return zeros when no invoices', async () => {
        mockPrisma.aRInvoice.findMany.mockResolvedValue([])
        const r = await getARAgingChart()
        expect(r.invoiceCount).toBe(0)
        expect(r.totalOutstanding).toBe(0)
    })
})

describe('approveSO', () => {
    it('should update SO status to CONFIRMED', async () => {
        mockPrisma.salesOrder.update.mockResolvedValue({})
        await approveSO('so-001')
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-001' }, data: { status: 'CONFIRMED' },
        })
    })
})

describe('rejectSO', () => {
    it('should update SO status to CANCELLED', async () => {
        mockPrisma.salesOrder.update.mockResolvedValue({})
        await rejectSO('so-001')
        expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
            where: { id: 'so-001' }, data: { status: 'CANCELLED' },
        })
    })
})
