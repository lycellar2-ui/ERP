import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}))

// Mock session and auth checks to return super admin
vi.mock('@/lib/session', () => ({
    requirePermission: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Flow Auditor', email: 'audit@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Flow Auditor', email: 'audit@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Flow Auditor', email: 'audit@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    hasRole: vi.fn((user: any, ...roles: string[]) => true),
}))

// Mock notifications to prevent external calls
vi.mock('@/lib/notifications', () => ({
    notifySOApprovalRequired: vi.fn().mockResolvedValue(undefined),
    notifySOCreated: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAdmin: vi.fn().mockResolvedValue(undefined),
    notifySOPendingCEO: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAccounting: vi.fn().mockResolvedValue(undefined),
    notifySOConfirmed: vi.fn().mockResolvedValue(undefined),
}))

// Mock audit logging
vi.mock('@/lib/audit', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    logAuditWithDiff: vi.fn().mockResolvedValue(undefined),
}))

// Mock lib/cache
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    cachedWithTiming: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))

describe('Full Flow Audit: Customer -> Pricing -> Sales Order -> Warehouse Export', () => {
    let prisma: any
    let createProduct: any
    let createCustomer: any
    let updateCustomer: any
    let checkCustomerDuplicates: any
    let createCustomerPriceRule: any
    let approveCustomerPriceRule: any
    let resolveCustomerProductPrice: any
    let getCustomerResolvedPrices: any
    let createSalesOrder: any
    let updateSalesOrder: any
    let confirmSalesOrder: any
    let approveSalesOrder: any
    let accountingApproveSO: any
    let getSOsForDelivery: any
    let createDeliveryOrder: any
    let confirmDeliveryOrder: any

    // Prerequisite references
    let legalEntityId: string
    let otherLegalEntityId: string
    let warehouseId: string
    let otherWarehouseId: string
    let locationId: string
    let producerId: string
    let salesRepId: string

    // Dynamic test records for cleanup
    const parentCode = `HOLD-${Date.now().toString().slice(-6)}`
    const childCode = `REST-${Date.now().toString().slice(-6)}`
    const testTaxId = `TAX-${Date.now().toString().slice(-7)}`

    let parentCustomerId: string
    let childCustomerId: string
    let productAId: string
    let productBId: string
    let productCId: string
    let lotAId: string
    let lotBId: string
    let lotCId: string
    let priceListId: string
    let createdSOIds: string[] = []
    let createdDOIds: string[] = []
    let createdRuleIds: string[] = []
    let createdTemplateId: string | null = null

    beforeAll(async () => {
        const dbMod = await import('@/lib/db')
        prisma = dbMod.prisma

        const prodMod = await import('@/app/dashboard/products/actions')
        createProduct = prodMod.createProduct

        const custMod = await import('@/app/dashboard/customers/actions')
        createCustomer = custMod.createCustomer
        updateCustomer = custMod.updateCustomer
        checkCustomerDuplicates = custMod.checkCustomerDuplicates

        const pricingMod = await import('@/app/dashboard/price-list/customer-rules-actions')
        createCustomerPriceRule = pricingMod.createCustomerPriceRule
        approveCustomerPriceRule = pricingMod.approveCustomerPriceRule
        resolveCustomerProductPrice = pricingMod.resolveCustomerProductPrice
        getCustomerResolvedPrices = pricingMod.getCustomerResolvedPrices

        const salesMod = await import('@/app/dashboard/sales/actions')
        createSalesOrder = salesMod.createSalesOrder
        updateSalesOrder = salesMod.updateSalesOrder
        confirmSalesOrder = salesMod.confirmSalesOrder
        approveSalesOrder = salesMod.approveSalesOrder
        accountingApproveSO = salesMod.accountingApproveSO

        const doMod = await import('@/app/dashboard/warehouse/actions-do')
        getSOsForDelivery = doMod.getSOsForDelivery
        createDeliveryOrder = doMod.createDeliveryOrder
        confirmDeliveryOrder = doMod.confirmDeliveryOrder

        // Setup prerequisites in real DB
        let le = await prisma.legalEntity.findFirst()
        if (!le) {
            le = await prisma.legalEntity.create({
                data: { code: 'LE-AUDIT-1', name: 'Audit Primary Entity', taxId: '0100000001' }
            })
        }
        legalEntityId = le.id

        let otherLe = await prisma.legalEntity.findFirst({ where: { id: { not: legalEntityId } } })
        if (!otherLe) {
            otherLe = await prisma.legalEntity.create({
                data: { code: 'LE-AUDIT-2', name: 'Audit Secondary Entity', taxId: '0100000002' }
            })
        }
        otherLegalEntityId = otherLe.id

        let wh = await prisma.warehouse.findFirst({
            where: { legalEntityId, allowSales: true, code: { not: 'WH-TA-TT' } }
        })
        if (!wh) {
            wh = await prisma.warehouse.create({
                data: {
                    code: `WH-AUD-${Date.now().toString().slice(-4)}`,
                    name: 'Audit Main Warehouse',
                    address: '100 Audit Blvd',
                    legalEntityId,
                    allowSales: true,
                }
            })
        }
        warehouseId = wh.id

        let otherWh = await prisma.warehouse.findFirst({
            where: { legalEntityId: otherLegalEntityId, allowSales: true }
        })
        if (!otherWh) {
            otherWh = await prisma.warehouse.create({
                data: {
                    code: `WH-OTH-${Date.now().toString().slice(-4)}`,
                    name: 'Audit Other Warehouse',
                    address: '200 Audit Blvd',
                    legalEntityId: otherLegalEntityId,
                    allowSales: true,
                }
            })
        }
        otherWarehouseId = otherWh.id

        let loc = await prisma.location.findFirst({ where: { warehouseId } })
        if (!loc) {
            loc = await prisma.location.create({
                data: { warehouseId, zone: 'A', rack: '01', bin: '01', locationCode: 'AUD-A-01' }
            })
        }
        locationId = loc.id

        let prodUser = await prisma.user.findFirst()
        salesRepId = prodUser ? prodUser.id : 'u1'

        const sessionMod = await import('@/lib/session')
        const mockUser = {
            id: salesRepId,
            name: prodUser?.name || 'Audit User',
            email: prodUser?.email || 'audit@test.com',
            roles: ['Admin', 'CEO', 'Kế Toán', 'Sales Admin', 'Sales Manager'],
            permissions: []
        }
        vi.mocked(sessionMod.requirePermission).mockResolvedValue(mockUser as any)
        vi.mocked(sessionMod.getCurrentUser).mockResolvedValue(mockUser as any)
        vi.mocked(sessionMod.requireAuth).mockResolvedValue(mockUser as any)

        let prodProducer = await prisma.producer.findFirst()
        if (!prodProducer) {
            prodProducer = await prisma.producer.create({
                data: { code: 'PROD-AUD-1', name: 'Audit Producer', country: 'FR' }
            })
        }
        producerId = prodProducer.id

        // Approval template for sales orders
        let template = await prisma.approvalTemplate.findFirst({
            where: { docType: 'SALES_ORDER' },
            include: { steps: true }
        })
        if (!template || template.steps.length === 0) {
            template = await prisma.approvalTemplate.create({
                data: {
                    name: 'SO Audit Flow Template',
                    docType: 'SALES_ORDER',
                    steps: {
                        create: [
                            { stepOrder: 1, approverRole: 'Sales Admin', threshold: 0 },
                            { stepOrder: 2, approverRole: 'CEO', threshold: 50000000 },
                        ]
                    }
                }
            })
            createdTemplateId = template.id
        }
    }, 40000)

    afterAll(async () => {
        try {
            // Clean DOs
            for (const soId of createdSOIds) {
                await prisma.deliveryOrderLine.deleteMany({ where: { do: { soId } } })
                await prisma.deliveryOrder.deleteMany({ where: { soId } })
                await prisma.salesOrderLine.deleteMany({ where: { soId } })
                await prisma.approvalLog.deleteMany({ where: { request: { docId: soId } } })
                await prisma.approvalRequest.deleteMany({ where: { docId: soId } })
                await prisma.salesOrder.deleteMany({ where: { id: soId } })
            }

            // Clean price rules & price list
            if (createdRuleIds.length > 0) {
                await prisma.customerPriceRule.deleteMany({ where: { id: { in: createdRuleIds } } })
            }
            if (priceListId) {
                await prisma.priceListLine.deleteMany({ where: { priceListId } })
                await prisma.priceList.deleteMany({ where: { id: priceListId } })
            }

            // Clean stock lots
            if (lotAId) await prisma.stockLot.deleteMany({ where: { id: lotAId } })
            if (lotBId) await prisma.stockLot.deleteMany({ where: { id: lotBId } })
            if (lotCId) await prisma.stockLot.deleteMany({ where: { id: lotCId } })

            // Clean products
            const pIds = [productAId, productBId, productCId].filter(Boolean) as string[]
            if (pIds.length > 0) {
                await prisma.product.deleteMany({ where: { id: { in: pIds } } })
            }

            // Clean customers
            if (childCustomerId) {
                await prisma.customerAddress.deleteMany({ where: { customerId: childCustomerId } })
                await prisma.customerContact.deleteMany({ where: { customerId: childCustomerId } })
                await prisma.customer.deleteMany({ where: { id: childCustomerId } })
            }
            if (parentCustomerId) {
                await prisma.customerAddress.deleteMany({ where: { customerId: parentCustomerId } })
                await prisma.customerContact.deleteMany({ where: { customerId: parentCustomerId } })
                await prisma.customer.deleteMany({ where: { id: parentCustomerId } })
            }

            if (createdTemplateId) {
                await prisma.approvalStep.deleteMany({ where: { templateId: createdTemplateId } })
                await prisma.approvalTemplate.deleteMany({ where: { id: createdTemplateId } })
            }
        } catch (err) {
            console.error('Cleanup error:', err)
        }
    })

    // ───────────────────────────────────────────────────
    // STEP 1: CUSTOMER CREATION & MODIFICATION LOGIC
    // ───────────────────────────────────────────────────
    describe('1. Customer Creation, Hierarchy, Tax ID & Modification', () => {
        it('should create a Parent Holding Company with allowDirectSO = false', async () => {
            const res = await createCustomer({
                code: parentCode,
                name: 'Tập Đoàn Khách Sạn Red Wine Group',
                taxId: testTaxId,
                customerType: 'HORECA',
                channel: 'HORECA',
                paymentTerm: 'NET30',
                creditLimit: 200_000_000,
                entityType: 'COMPANY',
                allowDirectSO: false,
                status: 'ACTIVE',
            })

            expect(res.success).toBe(true)

            const parentCust = await prisma.customer.findUnique({ where: { code: parentCode } })
            expect(parentCust).not.toBeNull()
            parentCustomerId = parentCust!.id
            expect(parentCust!.allowDirectSO).toBe(false)
            expect(parentCust!.entityType).toBe('COMPANY')
        })

        it('should allow Child Restaurant to share Tax ID with its Parent Company', async () => {
            const dupCheck = await checkCustomerDuplicates({
                taxId: testTaxId,
                parentId: parentCustomerId,
            })
            expect(dupCheck.success).toBe(true)
            // Should NOT flag duplicate warnings because it belongs to the parent holding company
            expect(dupCheck.warnings).toHaveLength(0)

            const res = await createCustomer({
                code: childCode,
                name: 'Nhà Hàng Red Wine Q1',
                taxId: testTaxId, // Shared with parent
                parentId: parentCustomerId,
                customerType: 'HORECA',
                channel: 'HORECA',
                paymentTerm: 'NET15',
                creditLimit: 50_000_000,
                entityType: 'RESTAURANT',
                status: 'ACTIVE',
                address: '123 Hai Bà Trưng, Q1, TP.HCM',
                phone: '0901234567',
            })

            expect(res.success).toBe(true)

            const childCust = await prisma.customer.findUnique({ where: { code: childCode } })
            expect(childCust).not.toBeNull()
            childCustomerId = childCust!.id
            expect(childCust!.parentId).toBe(parentCustomerId)
        })

        it('should block an unrelated customer from using the same Tax ID', async () => {
            const dupRes = await createCustomer({
                code: `OTHER-${Date.now().toString().slice(-5)}`,
                name: 'Công ty Đối thủ Unrelated',
                taxId: testTaxId, // Reusing tax ID without parent link
                customerType: 'HORECA',
                channel: 'HORECA',
                entityType: 'RESTAURANT',
            })

            expect(dupRes.success).toBe(false)
            expect(dupRes.error).toContain('đã tồn tại')
        })

        it('should update customer credit limit, terms, and address via updateCustomer', async () => {
            const updateRes = await updateCustomer(childCustomerId, {
                creditLimit: 80_000_000,
                paymentTerm: 'NET30',
                phone: '0988776655',
                brandGroup: 'LUXURY_DINING',
            })

            expect(updateRes.success).toBe(true)

            const updated = await prisma.customer.findUnique({ where: { id: childCustomerId } })
            expect(Number(updated?.creditLimit)).toBe(80_000_000)
            expect(updated?.paymentTerm).toBe('NET30')
            expect(updated?.brandGroup).toBe('LUXURY_DINING')

            const primaryContact = await prisma.customerContact.findFirst({
                where: { customerId: childCustomerId, isPrimary: true }
            })
            expect(primaryContact?.phone).toBe('0988776655')
        })
    })

    // ───────────────────────────────────────────────────
    // STEP 2: PRICING CONFIGURATION & RESOLUTION ENGINE
    // ───────────────────────────────────────────────────
    describe('2. Pricing Setup: Wholesale List, Default Discount & SKU Rules', () => {
        it('should setup Products and Channel Wholesale Price List', async () => {
            // Create 3 products
            const pA = await createProduct({
                skuCode: `WINE-A-${Date.now().toString().slice(-5)}`,
                productName: 'Château Margaux Grand Cru A',
                producerId,
                country: 'FR',
                abvPercent: 13.5,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'RED',
            })
            productAId = pA.id!

            const pB = await createProduct({
                skuCode: `WINE-B-${Date.now().toString().slice(-5)}`,
                productName: 'Domaine Leflaive Puligny B',
                producerId,
                country: 'FR',
                abvPercent: 13.0,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'WHITE',
            })
            productBId = pB.id!

            const pC = await createProduct({
                skuCode: `WINE-C-${Date.now().toString().slice(-5)}`,
                productName: 'Barolo DOCG Riserva C',
                producerId,
                country: 'IT',
                abvPercent: 14.0,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'RED',
            })
            productCId = pC.id!

            // Create Wholesale Price List with current effectiveDate
            const pl = await prisma.priceList.create({
                data: {
                    name: `Bảng Giá Buôn Test ${Date.now()}`,
                    channel: 'WHOLESALE_DISTRIBUTOR',
                    effectiveDate: new Date(),
                    lines: {
                        create: [
                            { productId: productAId, unitPrice: 2_000_000 },
                            { productId: productBId, unitPrice: 1_500_000 },
                            { productId: productCId, unitPrice: 1_000_000 },
                        ]
                    }
                }
            })
            priceListId = pl.id
        })

        it('should set customer default pricing (Wholesale with 10% discount)', async () => {
            await prisma.customer.update({
                where: { id: childCustomerId },
                data: {
                    basePriceType: 'WHOLESALE',
                    defaultDiscountPct: 10,
                }
            })

            const updated = await prisma.customer.findUnique({ where: { id: childCustomerId } })
            expect(updated?.basePriceType).toBe('WHOLESALE')
            expect(Number(updated?.defaultDiscountPct)).toBe(10)
        })

        it('should set specific SKU pricing: Product A SPECIAL_PRICE, Product B FIXED_PRICE', async () => {
            // Product A: SPECIAL_PRICE = 1,700,000 (Overrides everything)
            const rA = await createCustomerPriceRule({
                customerId: childCustomerId,
                productId: productAId,
                ruleType: 'SPECIAL_PRICE',
                value: 1_700_000,
                startDate: '2020-01-01',
            })
            expect(rA.success).toBe(true)
            if (rA.id) {
                createdRuleIds.push(rA.id)
                const appA = await approveCustomerPriceRule(rA.id)
                expect(appA.success).toBe(true)
            }

            // Product B: FIXED_PRICE = 1_250_000
            const rB = await createCustomerPriceRule({
                customerId: childCustomerId,
                productId: productBId,
                ruleType: 'FIXED_PRICE',
                value: 1_250_000,
                startDate: '2020-01-01',
            })
            expect(rB.success).toBe(true)
            if (rB.id) {
                createdRuleIds.push(rB.id)
                const appB = await approveCustomerPriceRule(rB.id)
                expect(appB.success).toBe(true)
            }
        })

        it('should resolve prices accurately based on hierarchy and rule precedence', async () => {
            // Product A: Has SPECIAL_PRICE 1,700,000
            const resA = await resolveCustomerProductPrice(childCustomerId, productAId)
            expect(resA.price).toBe(1_700_000)
            expect(resA.source).toBe('SPECIAL_PRICE')

            // Product B: Has FIXED_PRICE 1,250,000
            const resB = await resolveCustomerProductPrice(childCustomerId, productBId)
            expect(resB.price).toBe(1_250_000)
            expect(resB.source).toBe('FIXED_PRICE')

            // Product C: No SKU rule -> Wholesale 1,000,000 with 10% default discount = 900,000
            const resC = await resolveCustomerProductPrice(childCustomerId, productCId)
            expect(resC.price).toBe(900_000)
            expect(resC.source).toBe('CUSTOMER_DEFAULT_DISCOUNT')

            // Bulk resolver test
            const bulkPrices = await getCustomerResolvedPrices(childCustomerId)
            expect(bulkPrices[productAId].price).toBe(1_700_000)
            expect(bulkPrices[productAId].source).toBe('SPECIAL_PRICE')
            expect(bulkPrices[productBId].price).toBe(1_250_000)
            expect(bulkPrices[productBId].source).toBe('FIXED_PRICE')
            expect(bulkPrices[productCId].price).toBe(900_000)
            expect(bulkPrices[productCId].source).toBe('CUSTOMER_DEFAULT_DISCOUNT')
        })
    })

    // ───────────────────────────────────────────────────
    // STEP 3: SALES ORDER CREATION & APPROVAL WORKFLOW
    // ───────────────────────────────────────────────────
    describe('3. Sales Order Flow: Direct SO Blocking, Line Calculation & Multi-tier Approval', () => {
        let testSOId: string

        it('should BLOCK direct SO creation for Parent Holding Company when allowDirectSO is false', async () => {
            const blockedSO = await createSalesOrder({
                customerId: parentCustomerId,
                salesRepId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [{ productId: productAId, qtyOrdered: 5, unitPrice: 1_700_000 }],
            })

            expect(blockedSO.success).toBe(false)
            expect(blockedSO.error).toContain('Không thể tạo đơn hàng trực tiếp cho công ty')
        })

        it('should successfully create Sales Order for Child Restaurant with resolved prices', async () => {
            const soRes = await createSalesOrder({
                customerId: childCustomerId,
                salesRepId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                warehouseId,
                orderDiscount: 5, // 5% total order discount
                lines: [
                    { productId: productAId, qtyOrdered: 10, unitPrice: 1_700_000, vatRate: 10 }, // 17,000,000
                    { productId: productBId, qtyOrdered: 10, unitPrice: 1_250_000, vatRate: 10 }, // 12,500,000
                    { productId: productCId, qtyOrdered: 10, unitPrice: 900_000, vatRate: 10 },   //  9,000,000
                ],
            })

            expect(soRes.success).toBe(true)
            testSOId = soRes.soId!
            createdSOIds.push(testSOId)

            // Gross total = 38,500,000
            // Order discount 5% = 1,925,000 -> Net = 36,575,000
            // VAT 10% = 3,657,500
            const createdSO = await prisma.salesOrder.findUnique({ where: { id: testSOId } })
            expect(createdSO?.status).toBe('DRAFT')
            expect(Number(createdSO?.totalAmount)).toBe(36_575_000)
            expect(Number(createdSO?.vatAmount)).toBe(3_657_500)
            expect(Number(createdSO?.orderDiscount)).toBe(5)
        })

        it('should allow editing the Sales Order while in DRAFT status', async () => {
            // Update line quantity for product C from 10 to 20
            const editRes = await updateSalesOrder({
                soId: testSOId,
                customerId: childCustomerId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [
                    { productId: productAId, qtyOrdered: 10, unitPrice: 1_700_000, vatRate: 10 }, // 17,000,000
                    { productId: productBId, qtyOrdered: 10, unitPrice: 1_250_000, vatRate: 10 }, // 12,500,000
                    { productId: productCId, qtyOrdered: 20, unitPrice: 900_000, vatRate: 10 },   // 18,000,000
                ],
                orderDiscount: 0,
            })

            expect(editRes.success).toBe(true)

            const updatedSO = await prisma.salesOrder.findUnique({
                where: { id: testSOId },
                include: { lines: true }
            })
            // Total = 17M + 12.5M + 18M = 47.5M
            expect(Number(updatedSO?.totalAmount)).toBe(47_500_000)
            expect(updatedSO?.lines).toHaveLength(3)
        })

        it('should confirm SO and transition through approval steps to CONFIRMED', async () => {
            const confRes = await confirmSalesOrder(testSOId)
            expect(confRes.success).toBe(true)

            let so = await prisma.salesOrder.findUnique({ where: { id: testSOId } })
            // If approval template triggers, walk through approval steps
            let maxSteps = 5
            while (so?.status === 'PENDING_APPROVAL' && maxSteps > 0) {
                const appRes = await approveSalesOrder(testSOId)
                expect(appRes.success).toBe(true)
                so = await prisma.salesOrder.findUnique({ where: { id: testSOId } })
                maxSteps--
            }

            if (so?.status === 'PENDING_ACCOUNTING') {
                const acctRes = await accountingApproveSO(testSOId)
                expect(acctRes.success).toBe(true)
                so = await prisma.salesOrder.findUnique({ where: { id: testSOId } })
            }

            expect(so?.status).toBe('CONFIRMED')
        })
    })

    // ───────────────────────────────────────────────────
    // STEP 4: WAREHOUSE DISPATCH, FIFO & FULFILLMENT LOGIC
    // ───────────────────────────────────────────────────
    describe('4. Warehouse Export (DO), Legal Entity Validation & Inventory Deduction', () => {
        let confirmedSOId: string

        beforeAll(async () => {
            confirmedSOId = createdSOIds[0]

            // Seed inventory stock lots for Product A, Product B, Product C
            const lotA = await prisma.stockLot.create({
                data: {
                    lotNo: `LOTA-${Date.now().toString().slice(-6)}`,
                    productId: productAId,
                    locationId,
                    ownerEntityId: legalEntityId, // Matches SO entity
                    qtyReceived: 50,
                    qtyAvailable: 50,
                    unitLandedCost: 1_200_000,
                    receivedDate: new Date('2026-01-01'),
                    status: 'AVAILABLE',
                }
            })
            lotAId = lotA.id

            const lotB = await prisma.stockLot.create({
                data: {
                    lotNo: `LOTB-${Date.now().toString().slice(-6)}`,
                    productId: productBId,
                    locationId,
                    ownerEntityId: legalEntityId,
                    qtyReceived: 50,
                    qtyAvailable: 50,
                    unitLandedCost: 800_000,
                    receivedDate: new Date('2026-01-02'),
                    status: 'AVAILABLE',
                }
            })
            lotBId = lotB.id

            const lotC = await prisma.stockLot.create({
                data: {
                    lotNo: `LOTC-${Date.now().toString().slice(-6)}`,
                    productId: productCId,
                    locationId,
                    ownerEntityId: legalEntityId,
                    qtyReceived: 50,
                    qtyAvailable: 50,
                    unitLandedCost: 600_000,
                    receivedDate: new Date('2026-01-03'),
                    status: 'AVAILABLE',
                }
            })
            lotCId = lotC.id
        })

        it('should show the confirmed SO in getSOsForDelivery', async () => {
            const deliverySOs = await getSOsForDelivery()
            const found = deliverySOs.find((s: any) => s.id === confirmedSOId)
            expect(found).toBeDefined()
            expect(found?.customerName).toContain('Nhà Hàng Red Wine')
        })

        it('should BLOCK Delivery Order creation when Warehouse Legal Entity does not match SO', async () => {
            const mismatchDO = await createDeliveryOrder({
                soId: confirmedSOId,
                warehouseId: otherWarehouseId, // Belongs to otherLegalEntityId
                lines: [{ productId: productAId, lotId: lotAId, locationId, qtyPicked: 5 }],
            })

            expect(mismatchDO.success).toBe(false)
            expect(mismatchDO.error).toContain('không khớp với Pháp Nhân Đơn Hàng')
        })

        it('should BLOCK Delivery Order when requested qty exceeds available stock lot qty', async () => {
            const overDO = await createDeliveryOrder({
                soId: confirmedSOId,
                warehouseId,
                lines: [{ productId: productAId, lotId: lotAId, locationId, qtyPicked: 9999 }],
            })

            expect(overDO.success).toBe(false)
            expect(overDO.error).toContain('Không đủ tồn kho')
        })

        it('should execute Partial Delivery Order: lot stock decreases and SO becomes PARTIALLY_DELIVERED', async () => {
            // Partial dispatch: 5 of Product A (out of 10 ordered)
            const partialDO = await createDeliveryOrder({
                soId: confirmedSOId,
                warehouseId,
                lines: [
                    { productId: productAId, lotId: lotAId, locationId, qtyPicked: 5 },
                ]
            })

            expect(partialDO.success).toBe(true)
            const doId1 = partialDO.doId!
            createdDOIds.push(doId1)

            // Lot stock immediately decremented from 50 to 45
            const lotAfterPick = await prisma.stockLot.findUnique({ where: { id: lotAId } })
            expect(Number(lotAfterPick?.qtyAvailable)).toBe(45)

            // Confirm DO
            const shipRes = await confirmDeliveryOrder(doId1)
            expect(shipRes.success).toBe(true)

            // SO status must be PARTIALLY_DELIVERED
            const soAfterPartial = await prisma.salesOrder.findUnique({ where: { id: confirmedSOId } })
            expect(soAfterPartial?.status).toBe('PARTIALLY_DELIVERED')
        })

        it('should execute Final Delivery Order and automatically transition SO to DELIVERED', async () => {
            // Dispatch remaining: 5 of Product A, 10 of Product B, 20 of Product C
            const finalDO = await createDeliveryOrder({
                soId: confirmedSOId,
                warehouseId,
                lines: [
                    { productId: productAId, lotId: lotAId, locationId, qtyPicked: 5 },  // remaining 5
                    { productId: productBId, lotId: lotBId, locationId, qtyPicked: 10 }, // remaining 10
                    { productId: productCId, lotId: lotCId, locationId, qtyPicked: 20 }, // remaining 20
                ]
            })

            expect(finalDO.success).toBe(true)
            const doId2 = finalDO.doId!
            createdDOIds.push(doId2)

            // Confirm DO -> Marks shipped and calculates total shipped >= total ordered
            const shipRes2 = await confirmDeliveryOrder(doId2)
            expect(shipRes2.success).toBe(true)

            // SO status must transition to DELIVERED
            const soFinal = await prisma.salesOrder.findUnique({ where: { id: confirmedSOId } })
            expect(soFinal?.status).toBe('DELIVERED')
        })
    })
})
