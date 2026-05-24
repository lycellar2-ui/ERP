import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))
vi.mock('@/lib/session', () => ({
    getCurrentUser: vi.fn(),
    requirePermission: vi.fn(),
}))

const mockPrisma = {
    customer: { findUnique: vi.fn() },
    customerPriceRule: { findMany: vi.fn(), create: vi.fn() },
    priceList: { findFirst: vi.fn() },
    priceListLine: { findMany: vi.fn() },
    approvalConfig: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const {
    resolveCustomerProductPrice,
    getCustomerResolvedPrices,
    createCustomerPriceRule,
    updateCustomerPriceRule,
} = await import('@/app/dashboard/price-list/customer-rules-actions')

beforeEach(() => {
    vi.clearAllMocks()
    // Default mock behavior for config to return null (using DEFAULT_CHANNEL_MAPPING)
    mockPrisma.approvalConfig.findUnique.mockResolvedValue(null)
})

describe('Pricing Engine: resolveCustomerProductPrice', () => {
    const productId = 'prod-chateau-margaux'
    const customerId = 'cust-horeca-abc'

    it('should fall back to retail and return 0 if customer not found and retail list has no price', async () => {
        // No customer (retail mode), no retail price list found
        mockPrisma.priceList.findFirst.mockResolvedValue(null)

        const result = await resolveCustomerProductPrice(null, productId)

        expect(result.price).toBe(0)
        expect(result.source).toBe('DEFAULT_ZERO')
    })

    it('should fall back to retail price list if customer not found', async () => {
        // No customer, retail price exists (DIRECT_INDIVIDUAL)
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-retail',
            channel: 'DIRECT_INDIVIDUAL',
            lines: [{ productId, unitPrice: 2500000 }]
        })

        const result = await resolveCustomerProductPrice(null, productId)

        expect(result.price).toBe(2500000)
        expect(result.source).toBe('RETAIL_FALLBACK')
    })

    it('should apply channel base price mapped from customer channel', async () => {
        // Customer is HORECA (maps to WHOLESALE_DISTRIBUTOR by default)
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        // Mapped channel WHOLESALE_DISTRIBUTOR has a price
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId, unitPrice: 2000000 }]
        })
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([])

        const result = await resolveCustomerProductPrice(customerId, productId)

        expect(result.price).toBe(2000000)
        expect(result.source).toBe('CHANNEL_BASE')
    })

    it('should apply FIXED_DISCOUNT rule (percentage off base price)', async () => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        // Base wholesale price: 2,000,000
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId, unitPrice: 2000000 }]
        })
        // 5% fixed discount rule
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([
            { id: 'rule-disc-5', ruleType: 'FIXED_DISCOUNT', value: 5, status: 'APPROVED' }
        ])

        const result = await resolveCustomerProductPrice(customerId, productId)

        // 2,000,000 * 0.95 = 1,900,000
        expect(result.price).toBe(1900000)
        expect(result.source).toBe('FIXED_DISCOUNT')
        expect(result.discountPct).toBe(5)
        expect(result.basePrice).toBe(2000000)
    })

    it('should apply FIXED_PRICE rule and override FIXED_DISCOUNT + CHANNEL_BASE', async () => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId, unitPrice: 2000000 }]
        })
        // Both FIXED_PRICE (1,850,000) and FIXED_DISCOUNT (5%) rule present
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([
            { id: 'rule-fixed-185', ruleType: 'FIXED_PRICE', value: 1850000, status: 'APPROVED' },
            { id: 'rule-disc-5', ruleType: 'FIXED_DISCOUNT', value: 5, status: 'APPROVED' }
        ])

        const result = await resolveCustomerProductPrice(customerId, productId)

        // FIXED_PRICE has higher priority than FIXED_DISCOUNT
        expect(result.price).toBe(1850000)
        expect(result.source).toBe('FIXED_PRICE')
    })

    it('should apply SPECIAL_PRICE rule and override everything else', async () => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId, unitPrice: 2000000 }]
        })
        // SPECIAL_PRICE (1,700,000), FIXED_PRICE (1,850,000), and FIXED_DISCOUNT (5%) rules present
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([
            { id: 'rule-special-170', ruleType: 'SPECIAL_PRICE', value: 1700000, status: 'APPROVED' },
            { id: 'rule-fixed-185', ruleType: 'FIXED_PRICE', value: 1850000, status: 'APPROVED' },
            { id: 'rule-disc-5', ruleType: 'FIXED_DISCOUNT', value: 5, status: 'APPROVED' }
        ])

        const result = await resolveCustomerProductPrice(customerId, productId)

        // SPECIAL_PRICE has the absolute highest priority
        expect(result.price).toBe(1700000)
        expect(result.source).toBe('SPECIAL_PRICE')
    })
})

describe('Pricing Engine: getCustomerResolvedPrices (Optimized Batch)', () => {
    const p1 = 'prod-1'
    const p2 = 'prod-2'
    const customerId = 'cust-wholesale'

    it('should bulk resolve prices for multiple products correctly', async () => {
        // Mock products list
        mockPrisma.product.findMany.mockResolvedValue([
            { id: p1 },
            { id: p2 }
        ])

        // Mock retail fallback price list
        mockPrisma.priceList.findFirst.mockImplementation(async (query: any) => {
            if (query.where.channel === 'DIRECT_INDIVIDUAL') {
                return { id: 'retail-list' }
            }
            if (query.where.channel === 'WHOLESALE_DISTRIBUTOR') {
                return { id: 'wholesale-list' }
            }
            return null
        })

        // Mock price list lines
        mockPrisma.priceListLine.findMany.mockImplementation(async (query: any) => {
            if (query.where.priceListId === 'retail-list') {
                return [
                    { productId: p1, unitPrice: 100000 },
                    { productId: p2, unitPrice: 200000 }
                ]
            }
            if (query.where.priceListId === 'wholesale-list') {
                return [
                    { productId: p1, unitPrice: 80000 },
                    { productId: p2, unitPrice: 160000 }
                ]
            }
            return []
        })

        // Mock customer channel HORECA (which maps to WHOLESALE_DISTRIBUTOR)
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })

        // Mock rules: p1 has SPECIAL_PRICE (70,000), p2 has FIXED_DISCOUNT (10% off wholesale price 160k = 144k)
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([
            { id: 'rule-1', productId: p1, ruleType: 'SPECIAL_PRICE', value: 70000, status: 'APPROVED' },
            { id: 'rule-2', productId: p2, ruleType: 'FIXED_DISCOUNT', value: 10, status: 'APPROVED' }
        ])

        const results = await getCustomerResolvedPrices(customerId)

        // p1: SPECIAL_PRICE active (70,000)
        expect(results[p1]).toBeDefined()
        expect(results[p1].price).toBe(70000)
        expect(results[p1].source).toBe('SPECIAL_PRICE')

        // p2: FIXED_DISCOUNT active (10% off 160k = 144k)
        expect(results[p2]).toBeDefined()
        expect(results[p2].price).toBe(144000)
        expect(results[p2].source).toBe('FIXED_DISCOUNT')
        expect(results[p2].discountPct).toBe(10)
        expect(results[p2].basePrice).toBe(160000)
    })

    it('should resolve to the newest rule when multiple rules of the same type exist (precedence tie-breaker)', async () => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId: p1, unitPrice: 2000000 }]
        })

        // Two approved SPECIAL_PRICE rules for the same product, rule-newest is newer
        const newestRule = { id: 'rule-newest', productId: p1, ruleType: 'SPECIAL_PRICE', value: 1200000, status: 'APPROVED', createdAt: new Date('2026-05-23T12:00:00Z') }
        const oldestRule = { id: 'rule-oldest', productId: p1, ruleType: 'SPECIAL_PRICE', value: 1500000, status: 'APPROVED', createdAt: new Date('2026-05-23T10:00:00Z') }
        
        // Mock prisma return sorted by createdAt desc
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([newestRule, oldestRule])

        // Act & Assert 1: Single Resolution (should find the newest rule)
        const resultSingle = await resolveCustomerProductPrice(customerId, p1)
        expect(resultSingle.price).toBe(1200000)
        expect(resultSingle.ruleId).toBe('rule-newest')

        // Act & Assert 2: Batch Resolution (should find the newest rule)
        mockPrisma.product.findMany.mockResolvedValue([{ id: p1 }])
        // Mock list line queries for batch
        mockPrisma.priceListLine.findMany.mockResolvedValue([{ productId: p1, unitPrice: 2000000 }])
        
        const resultsBatch = await getCustomerResolvedPrices(customerId)
        expect(resultsBatch[p1].price).toBe(1200000)
        expect(resultsBatch[p1].ruleId).toBe('rule-newest')
    })

    it('should respect custom channel mapping from database config', async () => {
        // Mock custom mapping in database HORECA -> DIRECT_INDIVIDUAL (Retail)
        mockPrisma.approvalConfig.findUnique.mockResolvedValue({
            configKey: 'pricing.channel_mapping',
            value: { HORECA: 'DIRECT_INDIVIDUAL' }
        })

        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })

        // Mock price lists
        mockPrisma.priceList.findFirst.mockImplementation(async (query: any) => {
            if (query.where.channel === 'DIRECT_INDIVIDUAL') {
                return { id: 'retail-list', channel: 'DIRECT_INDIVIDUAL', lines: [{ productId: p1, unitPrice: 3000000 }] }
            }
            if (query.where.channel === 'WHOLESALE_DISTRIBUTOR') {
                return { id: 'wholesale-list', channel: 'WHOLESALE_DISTRIBUTOR', lines: [{ productId: p1, unitPrice: 2000000 }] }
            }
            return null
        })
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([])

        // Act
        const result = await resolveCustomerProductPrice(customerId, p1)

        // Assert
        // Since HORECA is mapped to DIRECT_INDIVIDUAL, it should resolve to 3,000,000 (Retail)
        // instead of 2,000,000 (Wholesale)
        expect(result.price).toBe(3000000)
        expect(result.source).toBe('CHANNEL_BASE')
    })

    it('should fall back to retail price list and apply FIXED_DISCOUNT if wholesale price is missing', async () => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })

        // Mock price lists for batch: retail-list has p1 (100k), wholesale-list exists but does NOT have p1
        mockPrisma.product.findMany.mockResolvedValue([{ id: p1 }])
        
        mockPrisma.priceList.findFirst.mockImplementation(async (query: any) => {
            if (query.where.channel === 'DIRECT_INDIVIDUAL') return { id: 'retail-list' }
            if (query.where.channel === 'WHOLESALE_DISTRIBUTOR') return { id: 'wholesale-list' }
            return null
        })

        mockPrisma.priceListLine.findMany.mockImplementation(async (query: any) => {
            if (query.where.priceListId === 'retail-list') {
                return [{ productId: p1, unitPrice: 100000 }]
            }
            if (query.where.priceListId === 'wholesale-list') {
                return [] // No wholesale price line for p1
            }
            return []
        })

        // 10% discount rule for p1
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([
            { id: 'rule-disc-10', productId: p1, ruleType: 'FIXED_DISCOUNT', value: 10, status: 'APPROVED' }
        ])

        // Act
        const resultsBatch = await getCustomerResolvedPrices(customerId)

        // Assert
        // Since there is no wholesale price, it should apply the 10% discount on the retail fallback price (100k)
        // 100k * 0.90 = 90k
        expect(resultsBatch[p1]).toBeDefined()
        expect(resultsBatch[p1].price).toBe(90000)
        expect(resultsBatch[p1].source).toBe('FIXED_DISCOUNT')
        expect(resultsBatch[p1].basePrice).toBe(100000)
    })
})

describe('Pricing Engine: Date Boundaries', () => {
    const productId = 'prod-1'
    const customerId = 'cust-1'

    beforeEach(() => {
        mockPrisma.customer.findUnique.mockResolvedValue({ id: customerId, channel: 'HORECA' })
        mockPrisma.priceList.findFirst.mockResolvedValue({
            id: 'list-wholesale',
            channel: 'WHOLESALE_DISTRIBUTOR',
            lines: [{ productId, unitPrice: 100000 }]
        })
    })

    it('should ignore rule if start date is in the future', async () => {
        // Since the rule is in the future, the database query (which filters by startDate <= now) will return empty.
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([])

        const result = await resolveCustomerProductPrice(customerId, productId)
        expect(result.price).toBe(100000) // Fallback to base price
        expect(result.source).toBe('CHANNEL_BASE')

        // Verify the database query parameters are built correctly with correct date filters
        expect(mockPrisma.customerPriceRule.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    customerId,
                    productId,
                    status: 'APPROVED',
                    startDate: expect.objectContaining({
                        lte: expect.any(Date)
                    })
                })
            })
        )
    })

    it('should ignore rule if end date is in the past', async () => {
        // Since the rule is expired, the database query (which filters by endDate >= now) will return empty.
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([])

        const result = await resolveCustomerProductPrice(customerId, productId)
        expect(result.price).toBe(100000) // Fallback to base price
        expect(result.source).toBe('CHANNEL_BASE')

        expect(mockPrisma.customerPriceRule.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: expect.arrayContaining([
                        { endDate: null },
                        expect.objectContaining({
                            endDate: expect.objectContaining({
                                gte: expect.any(Date)
                            })
                        })
                    ])
                })
            })
        )
    })

    it('should apply rule if within valid range', async () => {
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)

        const activeRule = { id: 'rule-active', ruleType: 'SPECIAL_PRICE', value: 50000, status: 'APPROVED', startDate: start, endDate: end }
        mockPrisma.customerPriceRule.findMany.mockResolvedValue([activeRule])

        const result = await resolveCustomerProductPrice(customerId, productId)
        expect(result.price).toBe(50000)
        expect(result.source).toBe('SPECIAL_PRICE')
    })
})

describe('Pricing Actions: Rule Validations', () => {
    it('should validate and reject negative values or invalid discounts in createCustomerPriceRule', async () => {
        const { requirePermission } = await import('@/lib/session')
        
        // Mock prisma customer and product query check if needed (or check code logic)
        mockPrisma.customerPriceRule.create = vi.fn().mockResolvedValue({ id: 'new-rule-id' })

        // Test negative price
        const res1 = await createCustomerPriceRule({
            customerId: 'c1',
            productId: 'p1',
            ruleType: 'SPECIAL_PRICE',
            value: -5000,
            startDate: '2026-05-23'
        })
        expect(res1.success).toBe(false)
        expect(res1.error).toContain('không được âm')

        // Test discount > 100%
        const res2 = await createCustomerPriceRule({
            customerId: 'c1',
            productId: 'p1',
            ruleType: 'FIXED_DISCOUNT',
            value: 105,
            startDate: '2026-05-23'
        })
        expect(res2.success).toBe(false)
        expect(res2.error).toContain('không được vượt quá 100%')

        // Test end date before start date
        const res3 = await createCustomerPriceRule({
            customerId: 'c1',
            productId: 'p1',
            ruleType: 'FIXED_PRICE',
            value: 12000,
            startDate: '2026-05-23',
            endDate: '2026-05-22'
        })
        expect(res3.success).toBe(false)
        expect(res3.error).toContain('phải sau hoặc bằng')
    })
})
