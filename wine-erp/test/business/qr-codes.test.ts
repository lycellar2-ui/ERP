import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('crypto', () => ({ randomUUID: () => 'uuid-1234' }))

const mockPrisma = {
    goodsReceipt: { findUnique: vi.fn() },
    qRCode: { createMany: vi.fn(), findFirst: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { generateQRCodesForGR, verifyQRCode } = await import('@/app/dashboard/qr-codes/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('QR-01: QR Code Generation', () => {
    it('should generate QR codes equal to received quantity for GR', async () => {
        mockPrisma.goodsReceipt.findUnique.mockResolvedValue({
            id: 'gr-1', grNo: 'GR-01', status: 'CONFIRMED',
            warehouse: { name: 'Main' },
            lines: [
                { lot: { lotNo: 'lot-1', receivedDate: new Date() }, product: { skuCode: 'p1' } },
                { lot: { lotNo: 'lot-2', receivedDate: new Date() }, product: { skuCode: 'p2' } },
            ]
        })
        mockPrisma.qRCode.createMany.mockResolvedValue({ count: 2 })

        const result = await generateQRCodesForGR('gr-1')

        expect(result.success).toBe(true)
        expect(result.count).toBe(2)
        expect(mockPrisma.qRCode.createMany).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ lotNo: 'lot-1' }),
                expect.objectContaining({ lotNo: 'lot-2' }),
            ])
        })
    })

    it('should reject if GR not found', async () => {
        mockPrisma.goodsReceipt.findUnique.mockResolvedValue(null)
        const result = await generateQRCodesForGR('gr-ghost')
        expect(result.success).toBe(false)
    })
})
