import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockPrisma = {
    wineStampPurchase: { findUnique: vi.fn(), update: vi.fn() },
    wineStampUsage: { create: vi.fn() },
    purchaseOrder: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: any) => {
        const tx = {
            wineStampUsage: { create: vi.fn() },
            wineStampPurchase: { 
                findUnique: mockPrisma.wineStampPurchase.findUnique,
                update: vi.fn() 
            },
        }
        return cb(tx)
    })
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const { safeRecordStampUsage, allocateStampsToPO } = await import('@/app/dashboard/stamps/actions')

beforeEach(() => { vi.clearAllMocks() })

describe('STM-01: Stamp Usage Management', () => {
    it('should reject if qtyUsed > available stamps', async () => {
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'purchase-1', totalQty: 1000, usedQty: 900
        })

        // 1000 total - 900 used = 100 available. Trying to use 200 -> fail.
        const result = await safeRecordStampUsage({
            purchaseId: 'purchase-1', qtyUsed: 200, qtyDamaged: 0, reportedBy: 'user1'
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Vượt quá số lượng')
    })

    it('should record usage and decrement if valid', async () => {
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'purchase-1', totalQty: 1000, usedQty: 500
        })

        const result = await safeRecordStampUsage({
            purchaseId: 'purchase-1', qtyUsed: 400, qtyDamaged: 0, reportedBy: 'user1'
        })

        expect(result.success).toBe(true)
    })
})

describe('STM-02: PO Stamp Allocation', () => {
    it('should reject if items list is empty or total is 0', async () => {
        const res = await allocateStampsToPO({
            purchaseId: 'p-1',
            poId: 'po-1',
            items: [],
        })
        expect(res.success).toBe(false)
        expect(res.error).toContain('Không có sản phẩm')
    })

    it('should reject if product line is missing start or end serial', async () => {
        const res = await allocateStampsToPO({
            purchaseId: 'p-1',
            poId: 'po-1',
            items: [
                { productId: 'prod-1', qty: 100, serialStart: '001001', serialEnd: '' }
            ],
        })
        expect(res.success).toBe(false)
        expect(res.error).toContain('số seri đầu và cuối')
    })

    it('should reject if PO does not exist', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null)

        const res = await allocateStampsToPO({
            purchaseId: 'p-1',
            poId: 'po-non-existent',
            items: [
                { productId: 'prod-1', qty: 100, serialStart: '001001', serialEnd: '001100' }
            ],
        })
        expect(res.success).toBe(false)
        expect(res.error).toContain('PO) không tồn tại')
    })

    it('should reject if total required exceeds available stamps', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
            id: 'po-1',
            poNo: 'PO-2609-0001',
            shipments: [],
            lines: [{ productId: 'prod-1', product: { skuCode: 'SKU1', productName: 'Wine 1' } }],
        })
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'p-1',
            symbol: 'AA/24P',
            totalQty: 500,
            usedQty: 450, // only 50 left
        })

        const res = await allocateStampsToPO({
            purchaseId: 'p-1',
            poId: 'po-1',
            items: [
                { productId: 'prod-1', qty: 100, serialStart: '001001', serialEnd: '001100' }
            ],
        })
        expect(res.success).toBe(false)
        expect(res.error).toContain('Vượt quá tồn kho tem khả dụng')
    })

    it('should successfully allocate stamps across PO product lines', async () => {
        mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
            id: 'po-1',
            poNo: 'PO-2609-0001',
            shipments: [{ id: 'ship-1' }],
            lines: [
                { productId: 'prod-1', product: { skuCode: 'L10007', productName: 'Pinot Grigio' } },
                { productId: 'prod-2', product: { skuCode: 'L10046', productName: 'Soave Doc' } },
            ],
        })
        mockPrisma.wineStampPurchase.findUnique.mockResolvedValue({
            id: 'p-1',
            symbol: 'AA/24P',
            totalQty: 2000,
            usedQty: 0,
        })
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-admin' })

        const res = await allocateStampsToPO({
            purchaseId: 'p-1',
            poId: 'po-1',
            items: [
                { productId: 'prod-1', qty: 396, serialStart: '001001', serialEnd: '001396' },
                { productId: 'prod-2', qty: 324, serialStart: '001397', serialEnd: '001720' },
            ],
            notes: 'Phân tem nhập kho tháng 10',
        })

        expect(res.success).toBe(true)
    })
})

