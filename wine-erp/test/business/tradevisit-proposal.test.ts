import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseTradeVisitScope } from '@/app/dashboard/proposals/constants'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    revalidateCache: vi.fn(),
}))
vi.mock('@/lib/notifications', () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
    triggerNotificationForRole: vi.fn().mockResolvedValue(undefined),
    notifySOApprovalRequired: vi.fn().mockResolvedValue(undefined),
    notifySOCreated: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAdmin: vi.fn().mockResolvedValue(undefined),
    notifySOPendingCEO: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAccounting: vi.fn().mockResolvedValue(undefined),
    notifySOConfirmed: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/approval', () => ({
    submitForApproval: vi.fn().mockResolvedValue({ success: true, requestId: 'req-tv-1' }),
}))

const mockGetCurrentUser = vi.fn()
const mockRequireAuth = vi.fn()
const mockRequirePermission = vi.fn()

const mockPrisma = {
    approvalConfig: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
    },
    proposal: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    customer: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
    },
    product: {
        findMany: vi.fn(),
    },
    customerPriceRule: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
    },
    legalEntity: {
        findMany: vi.fn(),
    },
    salesOrder: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
    },
    allocationCampaign: {
        findMany: vi.fn(),
    },
    warehouse: {
        findFirst: vi.fn(),
    },
    customerProductCode: {
        findMany: vi.fn(),
    },
    aRInvoice: {
        aggregate: vi.fn(),
    },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/session', async () => {
    const actual = await vi.importActual<typeof import('@/lib/session')>('@/lib/session')
    return {
        ...actual,
        getCurrentUser: mockGetCurrentUser,
        requireAuth: mockRequireAuth,
        requirePermission: mockRequirePermission,
    }
})

const {
    getCreatableProposalCategories,
    createProposal,
    getProposals,
    getProposalDetail,
    syncProposalToCustomerPriceRules,
} = await import('@/app/dashboard/proposals/actions')

const {
    getProposalWithItemsForSO,
    createBulkTradeVisitDraftSOs,
} = await import('@/app/dashboard/sales/actions')

const salesRepUser = {
    id: 'user-sales-rep-1',
    email: 'sales@lyscellars.com',
    name: 'Nguyen Sales Rep',
    status: 'ACTIVE',
    roles: ['SALES_REP'],
    permissions: ['SLS:READ', 'SLS:WRITE'],
}

const warehouseUser = {
    id: 'user-kho-1',
    email: 'kho@lyscellars.com',
    name: 'Thu Kho',
    status: 'ACTIVE',
    roles: ['THU_KHO'],
    permissions: ['WMS:READ', 'WMS:WRITE'],
}

const sampleTradeVisitScopeObj = {
    subType: 'TRADE_VISIT' as const,
    customers: [
        {
            customerId: 'cust-a',
            customerCode: 'HR001',
            customerName: 'Nha Hang Alpha',
            visitDate: '2026-11-25',
            purpose: 'Thu ruou danh muc mua le hoi',
            items: [
                { productId: 'prod-1', quantity: 2 },
                { productId: 'prod-2', quantity: 1 },
            ],
        },
        {
            customerId: 'cust-b',
            customerCode: 'HR002',
            customerName: 'Khach San Beta',
            visitDate: '2026-11-26',
            purpose: 'Gioi thieu vang Y moi',
            items: [
                { productId: 'prod-3', quantity: 3 },
            ],
        },
    ],
}

const sampleTradeVisitScopeJson = JSON.stringify(sampleTradeVisitScopeObj)

beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue(salesRepUser)
    mockRequireAuth.mockResolvedValue(salesRepUser)
    mockRequirePermission.mockResolvedValue(salesRepUser)
    mockPrisma.approvalConfig.findMany.mockResolvedValue([])
    mockPrisma.approvalConfig.findUnique.mockResolvedValue(null)
    mockPrisma.allocationCampaign.findMany.mockResolvedValue([])
    mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-gvm' })
    mockPrisma.customerProductCode.findMany.mockResolvedValue([])
    mockPrisma.aRInvoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
})

// ═══════════════════════════════════════════════════
// 1. parseTradeVisitScope
// ═══════════════════════════════════════════════════

describe('TV-01: parseTradeVisitScope', () => {
    it('parses valid TRADE_VISIT multi-customer JSON scope', () => {
        const parsed = parseTradeVisitScope(sampleTradeVisitScopeJson)

        expect(parsed).not.toBeNull()
        expect(parsed?.subType).toBe('TRADE_VISIT')
        expect(parsed?.customers).toHaveLength(2)
        expect(parsed?.customers[0]).toMatchObject({
            customerId: 'cust-a',
            visitDate: '2026-11-25',
            purpose: 'Thu ruou danh muc mua le hoi',
        })
        expect(parsed?.customers[0].items).toEqual([
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 1 },
        ])
    })

    it('returns null safely for non-TradeVisit scopes or malformed JSON', () => {
        expect(parseTradeVisitScope(null)).toBeNull()
        expect(parseTradeVisitScope(undefined)).toBeNull()
        expect(parseTradeVisitScope('ENTIRE_PORTFOLIO')).toBeNull()
        expect(parseTradeVisitScope(JSON.stringify({ promoType: 'BUY_X_GET_Y' }))).toBeNull()
        expect(parseTradeVisitScope('{broken-json')).toBeNull()
    })
})

// ═══════════════════════════════════════════════════
// 2. Proposals Actions (TRADE_VISIT)
// ═══════════════════════════════════════════════════

describe('TV-02: Proposal permissions, creation, listing, detail & price-sync guard', () => {
    it('allows SALES_REP to create TRADE_VISIT and hides it from THU_KHO', async () => {
        mockGetCurrentUser.mockResolvedValueOnce(salesRepUser)
        const salesCategories = await getCreatableProposalCategories()
        expect(salesCategories).toContain('TRADE_VISIT')

        mockGetCurrentUser.mockResolvedValueOnce(warehouseUser)
        const warehouseCategories = await getCreatableProposalCategories()
        expect(warehouseCategories).not.toContain('TRADE_VISIT')
        expect(warehouseCategories).toContain('INTERNAL_TRAINING')
    })

    it('blocks unauthorized role when creating TRADE_VISIT proposal', async () => {
        mockGetCurrentUser.mockResolvedValueOnce(warehouseUser)

        const result = await createProposal({
            category: 'TRADE_VISIT',
            title: 'Ke hoach Trade Visit',
            content: 'Noi dung',
            createdBy: warehouseUser.id,
            scope: sampleTradeVisitScopeJson,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('không có quyền tạo loại tờ trình này')
        expect(mockPrisma.proposal.create).not.toHaveBeenCalled()
    })

    it('creates TRADE_VISIT proposal mapped to INTERNAL_TRAINING in DB with aggregated priceItems', async () => {
        mockPrisma.proposal.findMany.mockResolvedValue([])
        mockPrisma.proposal.findUnique.mockResolvedValue(null)
        mockPrisma.proposal.create.mockResolvedValue({ id: 'prop-tv-1' })

        const result = await createProposal({
            category: 'TRADE_VISIT',
            title: 'To trinh Trade Visit Thang 11',
            content: 'Ke hoach tham 2 khach hang',
            createdBy: salesRepUser.id,
            customerId: 'cust-a',
            scope: sampleTradeVisitScopeJson,
            priceItems: [
                { productId: 'prod-1', proposedPrice: 0, quantity: 2 },
                { productId: 'prod-2', proposedPrice: 0, quantity: 1 },
                { productId: 'prod-3', proposedPrice: 0, quantity: 3 },
            ],
        })

        expect(result).toEqual({ success: true, id: 'prop-tv-1' })
        expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    category: 'INTERNAL_TRAINING',
                    customerId: 'cust-a',
                    scope: sampleTradeVisitScopeJson,
                    priceItems: {
                        createMany: {
                            data: [
                                { productId: 'prod-1', proposedPrice: 0, quantity: 2 },
                                { productId: 'prod-2', proposedPrice: 0, quantity: 1 },
                                { productId: 'prod-3', proposedPrice: 0, quantity: 3 },
                            ],
                        },
                    },
                }),
            })
        )
    })

    it('separates TRADE_VISIT from INTERNAL_TRAINING in getProposals and formats multi-customer label', async () => {
        const dbRows = [
            {
                id: 'prop-tv-1',
                proposalNo: 'TT-2026-101',
                category: 'INTERNAL_TRAINING',
                priority: 'NORMAL',
                title: 'Trade Visit T11',
                estimatedAmount: 5_000_000,
                currency: 'VND',
                deadline: null,
                startDate: null,
                endDate: null,
                status: 'APPROVED',
                currentLevel: 3,
                creator: { name: 'Nguyen Sales Rep', email: 'sales@lyscellars.com' },
                department: { name: 'Kinh Doanh' },
                customer: { name: 'Nha Hang Alpha' },
                _count: { attachments: 0, comments: 0 },
                scope: sampleTradeVisitScopeJson,
                discountPct: null,
                submittedAt: new Date('2026-11-19T10:00:00Z'),
                resolvedAt: new Date('2026-11-19T12:00:00Z'),
                createdAt: new Date('2026-11-19T09:00:00Z'),
            },
            {
                id: 'prop-train-1',
                proposalNo: 'TT-2026-102',
                category: 'INTERNAL_TRAINING',
                priority: 'NORMAL',
                title: 'Dao tao noi bo Q4',
                estimatedAmount: 2_000_000,
                currency: 'VND',
                deadline: null,
                startDate: null,
                endDate: null,
                status: 'APPROVED',
                currentLevel: 3,
                creator: { name: 'HCNS', email: 'hr@lyscellars.com' },
                department: { name: 'Nhan Su' },
                customer: null,
                _count: { attachments: 0, comments: 0 },
                scope: null,
                discountPct: null,
                submittedAt: new Date('2026-11-18T10:00:00Z'),
                resolvedAt: new Date('2026-11-18T12:00:00Z'),
                createdAt: new Date('2026-11-18T09:00:00Z'),
            },
        ]
        mockPrisma.proposal.findMany.mockResolvedValue(dbRows)

        const tvList = await getProposals({ category: 'TRADE_VISIT' })
        expect(tvList).toHaveLength(1)
        expect(tvList[0].id).toBe('prop-tv-1')
        expect(tvList[0].category).toBe('TRADE_VISIT')
        expect(tvList[0].customerName).toBe('Nha Hang Alpha (+1 KH)')

        const trainingList = await getProposals({ category: 'INTERNAL_TRAINING' })
        expect(trainingList).toHaveLength(1)
        expect(trainingList[0].id).toBe('prop-train-1')
        expect(trainingList[0].category).toBe('INTERNAL_TRAINING')
    })

    it('hydrates tradeVisitCustomers with per-customer SKUs and prices in getProposalDetail', async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
            id: 'prop-tv-1',
            proposalNo: 'TT-2026-101',
            category: 'INTERNAL_TRAINING',
            priority: 'NORMAL',
            title: 'Trade Visit T11',
            content: 'Noi dung',
            justification: null,
            expectedOutcome: null,
            estimatedAmount: 5_000_000,
            currency: 'VND',
            deadline: null,
            startDate: null,
            endDate: null,
            createdBy: salesRepUser.id,
            departmentId: null,
            status: 'APPROVED',
            currentLevel: 3,
            linkedDocType: null,
            linkedDocId: null,
            customerId: 'cust-a',
            scope: sampleTradeVisitScopeJson,
            discountPct: null,
            submittedAt: new Date(),
            resolvedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: { id: salesRepUser.id, name: 'Nguyen Sales Rep', email: 'sales@lyscellars.com' },
            department: { name: 'Kinh Doanh' },
            customer: { id: 'cust-a', name: 'Nha Hang Alpha', code: 'HR001' },
            priceItems: [
                {
                    id: 'pi-1',
                    productId: 'prod-1',
                    proposedPrice: 0,
                    quantity: 2,
                    product: { id: 'prod-1', skuCode: 'SKU-01', productName: 'Barolo 2019', country: 'Italy', marginPrice: { wholesalePrice: 1_200_000 } },
                },
                {
                    id: 'pi-2',
                    productId: 'prod-2',
                    proposedPrice: 0,
                    quantity: 1,
                    product: { id: 'prod-2', skuCode: 'SKU-02', productName: 'Chianti Classico', country: 'Italy', marginPrice: { wholesalePrice: 800_000 } },
                },
            ],
            attachments: [],
            comments: [],
            approvalLogs: [],
            salesOrders: [],
        })
        mockPrisma.customer.findMany.mockResolvedValue([
            { id: 'cust-a', code: 'HR001', name: 'Nha Hang Alpha (DB)' },
            { id: 'cust-b', code: 'HR002', name: 'Khach San Beta (DB)' },
        ])
        mockPrisma.product.findMany.mockResolvedValue([
            { id: 'prod-3', skuCode: 'SKU-03', productName: 'Amarone 2018', country: 'Italy', marginPrice: { wholesalePrice: 2_000_000 } },
        ])

        const detail = await getProposalDetail('prop-tv-1')

        expect(detail).not.toBeNull()
        expect(detail?.category).toBe('TRADE_VISIT')
        expect(detail?.tradeVisitCustomers).toHaveLength(2)
        expect(detail?.tradeVisitCustomers[0]).toMatchObject({
            customerId: 'cust-a',
            customerCode: 'HR001',
            customerName: 'Nha Hang Alpha (DB)',
            visitDate: '2026-11-25',
            purpose: 'Thu ruou danh muc mua le hoi',
        })
        expect(detail?.tradeVisitCustomers[0].items).toEqual([
            { productId: 'prod-1', skuCode: 'SKU-01', productName: 'Barolo 2019', country: 'Italy', wholesalePrice: 1_200_000, quantity: 2 },
            { productId: 'prod-2', skuCode: 'SKU-02', productName: 'Chianti Classico', country: 'Italy', wholesalePrice: 800_000, quantity: 1 },
        ])
        expect(detail?.tradeVisitCustomers[1].items).toEqual([
            { productId: 'prod-3', skuCode: 'SKU-03', productName: 'Amarone 2018', country: 'Italy', wholesalePrice: 2_000_000, quantity: 3 },
        ])
    })

    it('never writes CustomerPriceRule when syncProposalToCustomerPriceRules runs for TRADE_VISIT', async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
            id: 'prop-tv-1',
            proposalNo: 'TT-2026-101',
            category: 'INTERNAL_TRAINING',
            customerId: 'cust-a',
            scope: sampleTradeVisitScopeJson,
            discountPct: null,
            priceItems: [{ productId: 'prod-1', proposedPrice: 0, quantity: 2 }],
            customer: { id: 'cust-a', parentId: null },
            approvalLogs: [],
        })

        const syncRes = await syncProposalToCustomerPriceRules('prop-tv-1')

        expect(syncRes).toEqual({ count: 0 })
        expect(mockPrisma.customerPriceRule.create).not.toHaveBeenCalled()
        expect(mockPrisma.customerPriceRule.update).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════
// 3. Sales Integration (Single & Bulk 0 VND Draft SOs)
// ═══════════════════════════════════════════════════

describe('TV-03: Sales Order integration for multi-customer TRADE_VISIT', () => {
    it('loads per-customer SKUs and quantities in getProposalWithItemsForSO(proposalId, targetCustomerId)', async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
            id: 'prop-tv-1',
            proposalNo: 'TT-2026-101',
            title: 'Trade Visit T11',
            category: 'INTERNAL_TRAINING',
            customerId: 'cust-a',
            scope: sampleTradeVisitScopeJson,
            estimatedAmount: 5_000_000,
            customer: { id: 'cust-a', name: 'Nha Hang Alpha', code: 'HR001', channel: 'HORECA', paymentTerm: 'NET30' },
            priceItems: [
                { id: 'pi-1', productId: 'prod-1', proposedPrice: 0, quantity: 2, product: { id: 'prod-1', skuCode: 'SKU-01', productName: 'Barolo 2019', marginPrice: { wholesalePrice: 1_200_000 } } },
                { id: 'pi-2', productId: 'prod-2', proposedPrice: 0, quantity: 1, product: { id: 'prod-2', skuCode: 'SKU-02', productName: 'Chianti Classico', marginPrice: { wholesalePrice: 800_000 } } },
                { id: 'pi-3', productId: 'prod-3', proposedPrice: 0, quantity: 3, product: { id: 'prod-3', skuCode: 'SKU-03', productName: 'Amarone 2018', marginPrice: { wholesalePrice: 2_000_000 } } },
            ],
        })
        mockPrisma.customer.findUnique
            .mockResolvedValueOnce({ id: 'cust-a', name: 'Nha Hang Alpha', code: 'HR001', channel: 'HORECA', paymentTerm: 'NET30' })
            .mockResolvedValueOnce({ id: 'cust-b', name: 'Khach San Beta', code: 'HR002', channel: 'HORECA', paymentTerm: 'NET30' })

        const resA = await getProposalWithItemsForSO('prop-tv-1', 'cust-a')
        expect(resA?.category).toBe('TRADE_VISIT')
        expect(resA?.customerId).toBe('cust-a')
        expect(resA?.purpose).toBe('Thu ruou danh muc mua le hoi')
        expect(resA?.priceItems.map(i => ({ productId: i.productId, quantity: i.quantity }))).toEqual([
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 1 },
        ])

        const resB = await getProposalWithItemsForSO('prop-tv-1', 'cust-b')
        expect(resB?.category).toBe('TRADE_VISIT')
        expect(resB?.customerId).toBe('cust-b')
        expect(resB?.purpose).toBe('Gioi thieu vang Y moi')
        expect(resB?.priceItems.map(i => ({ productId: i.productId, quantity: i.quantity }))).toEqual([
            { productId: 'prod-3', quantity: 3 },
        ])
    })

    it('rejects bulk draft SO creation if proposal is not yet APPROVED', async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
            id: 'prop-tv-1',
            proposalNo: 'TT-2026-101',
            title: 'Trade Visit T11',
            status: 'SUBMITTED',
            scope: sampleTradeVisitScopeJson,
            createdBy: salesRepUser.id,
            salesOrders: [],
        })

        const result = await createBulkTradeVisitDraftSOs('prop-tv-1')

        expect(result.success).toBe(false)
        expect(result.error).toContain('sau khi tờ trình đã được phê duyệt')
        expect(mockPrisma.salesOrder.create).not.toHaveBeenCalled()
    })

    it('creates 0 VND TASTING draft SOs for remaining customers and skips customers that already have SOs', async () => {
        mockPrisma.proposal.findUnique.mockResolvedValue({
            id: 'prop-tv-1',
            proposalNo: 'TT-2026-101',
            title: 'Trade Visit T11',
            status: 'APPROVED',
            scope: sampleTradeVisitScopeJson,
            createdBy: salesRepUser.id,
            // cust-a already has an active SO, cust-b does not
            salesOrders: [
                { id: 'so-existing-a', soNo: 'SO-2611-0001', customerId: 'cust-a' },
            ],
        })
        mockPrisma.legalEntity.findMany.mockResolvedValue([
            { id: 'le-ta', code: 'TA', name: 'Thang An' },
        ])
        mockPrisma.customer.findMany.mockResolvedValue([
            {
                id: 'cust-a',
                name: 'Nha Hang Alpha',
                code: 'HR001',
                channel: 'HORECA',
                entityType: 'BRANCH',
                allowDirectSO: true,
                addresses: [{ id: 'addr-a' }],
            },
            {
                id: 'cust-b',
                name: 'Khach San Beta',
                code: 'HR002',
                channel: 'HORECA',
                entityType: 'BRANCH',
                allowDirectSO: true,
                addresses: [{ id: 'addr-b' }],
            },
        ])
        mockPrisma.customer.findUnique.mockResolvedValue({
            creditLimit: 0,
            name: 'Khach San Beta',
            parentId: null,
            entityType: 'BRANCH',
            allowDirectSO: true,
            parent: null,
        })
        mockPrisma.salesOrder.findFirst.mockResolvedValue({ soNo: 'SO-2611-0009' })
        mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
        mockPrisma.salesOrder.create.mockResolvedValue({
            id: 'so-created-b',
            soNo: 'SO-2611-0010',
            lines: [{ id: 'sol-1', productId: 'prod-3' }],
        })

        const result = await createBulkTradeVisitDraftSOs('prop-tv-1')

        expect(result.success).toBe(true)
        expect(result.skippedCount).toBe(1)
        expect(result.errors).toEqual([])
        expect(result.created).toHaveLength(1)
        expect(result.created?.[0]).toMatchObject({
            customerId: 'cust-b',
            customerName: 'Khach San Beta',
            soId: 'so-created-b',
        })

        expect(mockPrisma.salesOrder.create).toHaveBeenCalledTimes(1)
        expect(mockPrisma.salesOrder.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    customerId: 'cust-b',
                    orderType: 'TASTING',
                    paymentTerm: 'TASTING - Không thu tiền',
                    proposalId: 'prop-tv-1',
                    legalEntityId: 'le-ta',
                    shippingAddressId: 'addr-b',
                    totalAmount: 0,
                    vatAmount: 0,
                    status: 'DRAFT',
                    lines: {
                        create: [
                            expect.objectContaining({
                                productId: 'prod-3',
                                qtyOrdered: 3,
                                unitPrice: 0,
                                priceSource: 'TASTING_FREE',
                            }),
                        ],
                    },
                }),
            })
        )
    })
})
