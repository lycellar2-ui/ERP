import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    proofOfDelivery: { upsert: vi.fn() },
    deliveryStop: {
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
    },
    deliveryRoute: { update: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (ops: any) => {
        if (Array.isArray(ops)) return Promise.all(ops)
        return ops()
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { recordEPOD, recordDeliveryFailure, getRouteStops, getShipperManifest } = await import('@/app/dashboard/delivery/actions')

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
                pod: expect.objectContaining({
                    upsert: expect.objectContaining({
                        create: expect.objectContaining({
                            confirmedBy: 'SYSTEM',
                            notes: '[Lý do: REFUSED] KH từ chối nhận',
                        }),
                    }),
                }),
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

// ═══════════════════════════════════════════════════
// DLV-03: Customer Phone in Stops and Manifest
// ═══════════════════════════════════════════════════

describe('DLV-03: Customer Phone Resolution', () => {
    it('should include customerPhone and receiverName in getRouteStops', async () => {
        mockPrisma.deliveryStop.findMany.mockResolvedValue([
            {
                id: 'stop-1',
                sequence: 1,
                address: '123 Ba Dinh, Ha Noi',
                status: 'PENDING',
                codAmount: 500000,
                podSignedAt: null,
                pod: null,
                do: {
                    so: {
                        soNo: 'SO-001',
                        customer: {
                            name: 'Nha Hang Sen',
                            receiverName: 'Anh Tuan',
                            receiverPhone: '0912345678',
                            purchasingPhone: '0987654321',
                            contacts: [{ phone: '0900000000', isPrimary: true }],
                        },
                        lines: [{ id: 'line-1' }, { id: 'line-2' }],
                    },
                },
            },
            {
                id: 'stop-2',
                sequence: 2,
                address: '456 Hoan Kiem, Ha Noi',
                status: 'PENDING',
                codAmount: 0,
                podSignedAt: null,
                pod: null,
                do: {
                    so: {
                        soNo: 'SO-002',
                        customer: {
                            name: 'Khach Hang VIP',
                            receiverName: null,
                            receiverPhone: null,
                            purchasingPhone: null,
                            contacts: [{ phone: '0933333333', isPrimary: true }],
                        },
                        lines: [{ id: 'line-3' }],
                    },
                },
            },
        ])

        const stops = await getRouteStops('route-1')

        expect(stops).toHaveLength(2)
        expect(stops[0].customerPhone).toBe('0912345678')
        expect(stops[0].receiverName).toBe('Anh Tuan')
        expect(stops[1].customerPhone).toBe('0933333333')
        expect(stops[1].receiverName).toBe('Khach Hang VIP')
    })

    it('should include customerPhone and receiverName in getShipperManifest', async () => {
        mockPrisma.deliveryRoute.findFirst.mockResolvedValue({
            id: 'route-1',
            routeDate: new Date('2026-08-14'),
            driver: { name: 'Nguyen Van Tai' },
            vehicle: { plateNo: '29C-12345', type: 'VAN' },
            status: 'IN_PROGRESS',
            stops: [
                {
                    id: 'stop-1',
                    sequence: 1,
                    address: '789 Cau Giay, Ha Noi',
                    codAmount: 1000000,
                    status: 'PENDING',
                    podSignedAt: null,
                    pod: null,
                    do: {
                        so: {
                            soNo: 'SO-003',
                            customer: {
                                name: 'Bar Sunset',
                                receiverName: 'Chi Lan',
                                receiverPhone: '0988888888',
                                purchasingPhone: null,
                                contacts: [],
                            },
                            lines: [{ id: 'l1' }],
                        },
                    },
                },
            ],
        })

        const manifest = await getShipperManifest('driver-1')

        expect(manifest).not.toBeNull()
        expect(manifest?.stops[0].customerPhone).toBe('0988888888')
        expect(manifest?.stops[0].receiverName).toBe('Chi Lan')
    })
})

