import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))

const mockPrisma = {
    salesQuotation: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { getQuotationByToken, acceptQuotationPublic, rejectQuotationPublic } = await import(
    '@/app/verify/quotation/[token]/actions'
)

beforeEach(() => {
    vi.clearAllMocks()
})

describe('Public Quotation Actions', () => {
    const testToken = 'token-uuid-12345'
    const futureDate = new Date(Date.now() + 86400000 * 7)

    it('getQuotationByToken should return quotation and increment viewCount', async () => {
        const mockQt = {
            id: 'qt-1',
            publicToken: testToken,
            quotationNo: 'QT-202610-001',
            validUntil: futureDate,
            firstViewedAt: null,
            lines: [],
        }
        mockPrisma.salesQuotation.findUnique.mockResolvedValue(mockQt)
        mockPrisma.salesQuotation.update.mockResolvedValue({ ...mockQt, viewCount: 1 })

        const result = await getQuotationByToken(testToken)
        expect(result).not.toBeNull()
        expect(result?.quotationNo).toBe('QT-202610-001')
        expect(mockPrisma.salesQuotation.update).toHaveBeenCalled()
    })

    it('acceptQuotationPublic should accept quotation if status is SENT or DRAFT and valid', async () => {
        const mockQt = {
            id: 'qt-1',
            publicToken: testToken,
            status: 'SENT',
            validUntil: futureDate,
        }
        mockPrisma.salesQuotation.findUnique.mockResolvedValue(mockQt)
        mockPrisma.salesQuotation.update.mockResolvedValue({ ...mockQt, status: 'ACCEPTED' })

        const res = await acceptQuotationPublic(testToken)
        expect(res.success).toBe(true)
        expect(mockPrisma.salesQuotation.update).toHaveBeenCalledWith({
            where: { id: 'qt-1' },
            data: { status: 'ACCEPTED' },
        })
    })

    it('acceptQuotationPublic should reject if quotation has expired', async () => {
        const expiredDate = new Date(Date.now() - 86400000)
        const mockQt = {
            id: 'qt-1',
            publicToken: testToken,
            status: 'SENT',
            validUntil: expiredDate,
        }
        mockPrisma.salesQuotation.findUnique.mockResolvedValue(mockQt)

        const res = await acceptQuotationPublic(testToken)
        expect(res.success).toBe(false)
        expect(res.error).toBe('Báo giá đã hết hạn')
    })

    it('rejectQuotationPublic should set CANCELLED with rejectedReason', async () => {
        const mockQt = {
            id: 'qt-1',
            publicToken: testToken,
            status: 'SENT',
            validUntil: futureDate,
        }
        mockPrisma.salesQuotation.findUnique.mockResolvedValue(mockQt)
        mockPrisma.salesQuotation.update.mockResolvedValue({ ...mockQt, status: 'CANCELLED' })

        const res = await rejectQuotationPublic(testToken, 'Giá quá cao')
        expect(res.success).toBe(true)
        expect(mockPrisma.salesQuotation.update).toHaveBeenCalledWith({
            where: { id: 'qt-1' },
            data: { status: 'CANCELLED', rejectedReason: 'Giá quá cao' },
        })
    })
})
