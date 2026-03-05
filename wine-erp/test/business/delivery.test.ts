import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    proofOfDelivery: { upsert: vi.fn() },
    deliveryStop: {
        update: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
    },
    deliveryRoute: { update: vi.fn() },
    $transaction: vi.fn(async (ops: any) => {
        if (Array.isArray(ops)) return Promise.all(ops)
        return ops()
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { recordEPOD, recordDeliveryFailure } = await import('@/app/dashboard/delivery/actions')

beforeEach(() => { vi.clearAllMocks() })

// ═══════════════════════════════════════════════════
// DLV-01: E-POD — Proof of Delivery
// ═══════════════════════════════════════════════════

describe('DLV-01: recordEPOD', () => {
    it('should call proofOfDelivery.upsert + deliveryStop.update in transaction', async () => {
        mockPrisma.proofOfDelivery.upsert.mockResolvedValue({})
        mockPrisma.deliveryStop.update.mockResolvedValue({})

        const result = await recordEPOD({ stopId: 'stop-1', confirmedBy: 'driver-1', notes: 'KH nhận đầy đủ' })

        expect(result.success).toBe(true)
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('should fail gracefully on transaction error', async () => {
        mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB error'))

        const result = await recordEPOD({ stopId: 'stop-bad', confirmedBy: 'driver-1' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('DB error')
    })
})

// ═══════════════════════════════════════════════════
// DLV-02: Delivery Failure — Reverse Logistics
// ═══════════════════════════════════════════════════

describe('DLV-02: recordDeliveryFailure', () => {
    it('should mark stop FAILED and auto-complete route when all stops done', async () => {
        mockPrisma.deliveryStop.update.mockResolvedValue({})
        mockPrisma.deliveryStop.findUnique.mockResolvedValue({ routeId: 'route-1' })
        mockPrisma.deliveryStop.count.mockResolvedValue(0) // no pending stops left

        const result = await recordDeliveryFailure({
            stopId: 'stop-1', reason: 'REFUSED', notes: 'KH từ chối nhận',
        })

        expect(result.success).toBe(true)
        expect(mockPrisma.deliveryStop.update).toHaveBeenCalledWith({
            where: { id: 'stop-1' },
            data: expect.objectContaining({
                status: 'FAILED',
                failureReason: 'REFUSED',
                notes: 'KH từ chối nhận',
            }),
        })
        // Route auto-completed
        expect(mockPrisma.deliveryRoute.update).toHaveBeenCalledWith({
            where: { id: 'route-1' },
            data: { status: 'COMPLETED' },
        })
    })

    it('should NOT complete route when pending stops remain', async () => {
        mockPrisma.deliveryStop.update.mockResolvedValue({})
        mockPrisma.deliveryStop.findUnique.mockResolvedValue({ routeId: 'route-2' })
        mockPrisma.deliveryStop.count.mockResolvedValue(3) // 3 pending stops left

        const result = await recordDeliveryFailure({ stopId: 'stop-2', reason: 'CUSTOMER_ABSENT' })

        expect(result.success).toBe(true)
        expect(mockPrisma.deliveryRoute.update).not.toHaveBeenCalled()
    })

    it('should handle error gracefully', async () => {
        mockPrisma.deliveryStop.update.mockRejectedValue(new Error('Connection lost'))

        const result = await recordDeliveryFailure({ stopId: 'stop-err', reason: 'OTHER' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Connection lost')
    })
})
