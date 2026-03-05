import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))

// Dynamic imports mocked at module level
vi.mock('@/app/dashboard/finance/actions', () => ({
    generateGoodsReceiptJournal: vi.fn().mockResolvedValue({ success: true }),
    generateDeliveryOrderCOGSJournal: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/app/dashboard/qr-codes/actions', () => ({
    generateQRCodesForGR: vi.fn().mockResolvedValue({ success: true }),
}))

const mockTx = {
    goodsReceipt: { create: vi.fn(), update: vi.fn() },
    goodsReceiptLine: { create: vi.fn() },
    stockLot: { create: vi.fn(), count: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    purchaseOrderLine: { findMany: vi.fn() },
    deliveryOrder: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
    deliveryOrderLine: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    salesOrder: { update: vi.fn(), findUnique: vi.fn() },
}

const mockPrisma = {
    purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
    goodsReceipt: { count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    salesOrder: { findUnique: vi.fn() },
    deliveryOrder: { count: vi.fn(), findMany: vi.fn() },
    stockLot: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    warehouse: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    location: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    }),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    createGoodsReceipt,
    confirmGoodsReceipt,
    createDeliveryOrder,
    confirmDeliveryOrder,
    transferStock,
    deleteLocation,
} = await import('@/app/dashboard/warehouse/actions')

beforeEach(() => {
    vi.clearAllMocks()
    // Restore default $transaction mock (some tests override it)
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') return cb(mockTx)
        return Promise.all(cb)
    })
})

// ═══════════════════════════════════════════════════
// WMS-01: Goods Receipt — Nhập kho từ PO
// ═══════════════════════════════════════════════════

describe('WMS-01: createGoodsReceipt', () => {
    it('should reject if no lines provided', async () => {
        const result = await createGoodsReceipt({ poId: 'po-1', warehouseId: 'wh-1', lines: [] })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Cần ít nhất 1 dòng')
    })

    it('should reject if PO not found', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null)
        const result = await createGoodsReceipt({
            poId: 'po-nonexist', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', qtyReceived: 10, locationId: 'loc-1' }],
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('PO không tồn tại')
    })

    it('should reject if PO status is DRAFT', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', status: 'DRAFT', lines: [] })
        const result = await createGoodsReceipt({
            poId: 'po-1', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', qtyReceived: 10, locationId: 'loc-1' }],
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('DRAFT không cho phép nhập kho')
    })

    it('should create GR with StockLots when PO is APPROVED', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
            id: 'po-1', status: 'APPROVED',
            lines: [{ productId: 'p-1', qtyOrdered: 100 }],
        })
        mockPrisma.goodsReceipt.count.mockResolvedValue(5)
        mockTx.goodsReceipt.create.mockResolvedValue({ id: 'gr-new', grNo: 'GR-2603-0006' })
        mockTx.stockLot.count.mockResolvedValue(10)
        mockTx.stockLot.create.mockResolvedValue({ id: 'lot-new' })

        const result = await createGoodsReceipt({
            poId: 'po-1', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', qtyReceived: 100, locationId: 'loc-1', unitLandedCost: 250000 }],
        })

        expect(result.success).toBe(true)
        expect(result.grNo).toMatch(/^GR-/)
        expect(mockTx.stockLot.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                productId: 'p-1',
                qtyReceived: 100,
                qtyAvailable: 100,
                unitLandedCost: 250000,
                status: 'AVAILABLE',
            }),
        })
    })

    it('should calculate variance = received - expected', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
            id: 'po-1', status: 'APPROVED',
            lines: [{ productId: 'p-1', qtyOrdered: 100 }],
        })
        mockPrisma.goodsReceipt.count.mockResolvedValue(0)
        mockTx.goodsReceipt.create.mockResolvedValue({ id: 'gr-1', grNo: 'GR-2603-0001' })
        mockTx.stockLot.count.mockResolvedValue(0)
        mockTx.stockLot.create.mockResolvedValue({ id: 'lot-1' })

        await createGoodsReceipt({
            poId: 'po-1', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', qtyReceived: 95, locationId: 'loc-1' }],
        })

        expect(mockTx.goodsReceiptLine.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                qtyExpected: 100,
                qtyReceived: 95,
                variance: -5,  // Short shipment
            }),
        })
    })
})

// ═══════════════════════════════════════════════════
// WMS-01b: Confirm GR → PO status update + Journal DR 156 / CR 331
// ═══════════════════════════════════════════════════

describe('WMS-01b: confirmGoodsReceipt', () => {
    it('should update PO to RECEIVED when all qty is received', async () => {
        mockTx.goodsReceipt.update = mockPrisma.goodsReceipt.update
        mockPrisma.goodsReceipt.update.mockResolvedValue({ id: 'gr-1', grNo: 'GR-01', poId: 'po-1', po: {} })

        // Mock so tx uses real prisma
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            if (typeof cb !== 'function') return
            // Simulate transaction internals
            const txProxy = {
                goodsReceipt: { update: vi.fn().mockResolvedValue({ id: 'gr-1', grNo: 'GR-01', poId: 'po-1', po: {} }) },
                purchaseOrderLine: { findMany: vi.fn().mockResolvedValue([{ qtyOrdered: 100 }]) },
                goodsReceiptLine: { findMany: vi.fn().mockResolvedValue([{ qtyReceived: 100 }]) },
                purchaseOrder: { update: vi.fn() },
            }
            await cb(txProxy)
            // Verify PO updated to RECEIVED
            expect(txProxy.purchaseOrder.update).toHaveBeenCalledWith({
                where: { id: 'po-1' },
                data: { status: 'RECEIVED' },
            })
        })

        await confirmGoodsReceipt('gr-1', 'user-001')
    })

    it('should update PO to PARTIALLY_RECEIVED when partial receipt', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            if (typeof cb !== 'function') return
            const txProxy = {
                goodsReceipt: { update: vi.fn().mockResolvedValue({ id: 'gr-1', grNo: 'GR-01', poId: 'po-1', po: {} }) },
                purchaseOrderLine: { findMany: vi.fn().mockResolvedValue([{ qtyOrdered: 200 }]) },
                goodsReceiptLine: { findMany: vi.fn().mockResolvedValue([{ qtyReceived: 80 }]) },
                purchaseOrder: { update: vi.fn() },
            }
            await cb(txProxy)
            expect(txProxy.purchaseOrder.update).toHaveBeenCalledWith({
                where: { id: 'po-1' },
                data: { status: 'PARTIALLY_RECEIVED' },
            })
        })

        await confirmGoodsReceipt('gr-1', 'user-001')
    })
})

// ═══════════════════════════════════════════════════
// WMS: Delivery Order — Xuất kho từ SO
// ═══════════════════════════════════════════════════

describe('createDeliveryOrder', () => {
    it('should reject if no lines', async () => {
        const result = await createDeliveryOrder({ soId: 'so-1', warehouseId: 'wh-1', lines: [] })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Cần ít nhất 1 dòng')
    })

    it('should reject if SO not found', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
        const result = await createDeliveryOrder({
            soId: 'so-nonexist', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', lotId: 'lot-1', locationId: 'loc-1', qtyPicked: 5 }],
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('SO không tồn tại')
    })

    it('should reject if SO status is DRAFT', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'so-1', status: 'DRAFT' })
        const result = await createDeliveryOrder({
            soId: 'so-1', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', lotId: 'lot-1', locationId: 'loc-1', qtyPicked: 5 }],
        })
        expect(result.success).toBe(false)
        expect(result.error).toContain('DRAFT không cho phép xuất kho')
    })

    it('should create DO and reserve stock (decrement qtyAvailable)', async () => {
        mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'so-1', status: 'CONFIRMED' })
        mockPrisma.deliveryOrder.count.mockResolvedValue(3)
        mockTx.deliveryOrder.create.mockResolvedValue({ id: 'do-new', doNo: 'DO-2603-0004' })

        const result = await createDeliveryOrder({
            soId: 'so-1', warehouseId: 'wh-1',
            lines: [{ productId: 'p-1', lotId: 'lot-1', locationId: 'loc-1', qtyPicked: 12 }],
        })

        expect(result.success).toBe(true)
        expect(mockTx.stockLot.update).toHaveBeenCalledWith({
            where: { id: 'lot-1' },
            data: { qtyAvailable: { decrement: 12 } },
        })
    })
})

// ═══════════════════════════════════════════════════
// WMS: Stock Transfer — Di chuyển giữa locations
// ═══════════════════════════════════════════════════

describe('transferStock', () => {
    it('should reject if lot not found', async () => {
        mockPrisma.stockLot.findUnique.mockResolvedValue(null)
        const result = await transferStock({ lotId: 'lot-ghost', fromLocationId: 'L1', toLocationId: 'L2', qty: 5 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Lot không tồn tại')
    })

    it('should reject if insufficient stock', async () => {
        mockPrisma.stockLot.findUnique.mockResolvedValue({ id: 'lot-1', qtyAvailable: 3, productId: 'p-1' })
        const result = await transferStock({ lotId: 'lot-1', fromLocationId: 'L1', toLocationId: 'L2', qty: 10 })
        expect(result.success).toBe(false)
        expect(result.error).toContain('Không đủ tồn')
    })

    it('should decrement source and create new lot at destination', async () => {
        mockPrisma.stockLot.findUnique.mockResolvedValue({
            id: 'lot-1', qtyAvailable: 50, productId: 'p-1', shipmentId: 'ship-1', unitLandedCost: 300000,
        })
        mockTx.stockLot.update = vi.fn()
        mockTx.stockLot.findFirst.mockResolvedValue(null) // No existing lot at destination
        mockTx.stockLot.count.mockResolvedValue(100)
        mockTx.stockLot.create = vi.fn()

        const result = await transferStock({ lotId: 'lot-1', fromLocationId: 'L1', toLocationId: 'L2', qty: 20 })

        expect(result.success).toBe(true)
        expect(mockTx.stockLot.update).toHaveBeenCalledWith({
            where: { id: 'lot-1' },
            data: { qtyAvailable: { decrement: 20 } },
        })
        expect(mockTx.stockLot.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                productId: 'p-1',
                locationId: 'L2',
                qtyAvailable: 20,
                unitLandedCost: 300000,
            }),
        })
    })
})

// ═══════════════════════════════════════════════════
// WMS-04: Delete Location Guard
// ═══════════════════════════════════════════════════

describe('WMS-04: deleteLocation', () => {
    it('should reject deletion if location has stock', async () => {
        mockPrisma.location.findUnique.mockResolvedValue({
            id: 'loc-1',
            stockLots: [{ id: 'lot-1' }],
        })
        const result = await deleteLocation('loc-1')
        expect(result.success).toBe(false)
        expect(result.error).toContain('đang chứa hàng')
    })

    it('should allow deletion of empty location', async () => {
        mockPrisma.location.findUnique.mockResolvedValue({ id: 'loc-1', stockLots: [] })
        mockPrisma.location.delete.mockResolvedValue({})
        const result = await deleteLocation('loc-1')
        expect(result.success).toBe(true)
    })
})
