import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}))

// Mock session and auth
vi.mock('@/lib/session', () => ({
    requirePermission: vi.fn().mockResolvedValue({ id: 'u1', name: 'Edge Case Tester', email: 'tester@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'Edge Case Tester', email: 'tester@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1', name: 'Edge Case Tester', email: 'tester@test.com', roles: ['Admin', 'CEO', 'Kế Toán'] }),
    hasRole: vi.fn(() => true),
}))

// Mock notifications
vi.mock('@/lib/notifications', () => ({
    notifySOApprovalRequired: vi.fn().mockResolvedValue(undefined),
    notifySOCreated: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAdmin: vi.fn().mockResolvedValue(undefined),
    notifySOPendingCEO: vi.fn().mockResolvedValue(undefined),
    notifySOPendingAccounting: vi.fn().mockResolvedValue(undefined),
    notifySOConfirmed: vi.fn().mockResolvedValue(undefined),
}))

// Mock audit
vi.mock('@/lib/audit', () => ({
    logAudit: vi.fn().mockResolvedValue(undefined),
    logAuditWithDiff: vi.fn().mockResolvedValue(undefined),
}))

// Mock cache
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    cachedWithTiming: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))

describe('Exhaustive Edge Cases & Defense-in-Depth Audit', () => {
    let prisma: any
    let createCustomer: any
    let updateCustomer: any
    let deleteCustomer: any
    let createProduct: any
    let createCustomerPriceRule: any
    let approveCustomerPriceRule: any
    let resolveCustomerProductPrice: any
    let createSalesOrder: any
    let updateSalesOrder: any
    let confirmSalesOrder: any
    let rejectSO: any
    let createDeliveryOrder: any
    let confirmDeliveryOrder: any

    let legalEntityId: string
    let otherLegalEntityId: string
    let warehouseId: string
    let otherWarehouseId: string
    let storageWarehouseId: string
    let locationId: string
    let producerId: string
    let salesRepId: string

    // Tracking for cleanup
    let createdCustomerIds: string[] = []
    let createdProductIds: string[] = []
    let createdPriceListIds: string[] = []
    let createdLotIds: string[] = []
    let createdSOIds: string[] = []
    let createdDOIds: string[] = []
    let createdRuleIds: string[] = []

    beforeAll(async () => {
        const dbMod = await import('@/lib/db')
        prisma = dbMod.prisma

        const custMod = await import('@/app/dashboard/customers/actions')
        createCustomer = custMod.createCustomer
        updateCustomer = custMod.updateCustomer
        deleteCustomer = custMod.deleteCustomer

        const prodMod = await import('@/app/dashboard/products/actions')
        createProduct = prodMod.createProduct

        const pricingMod = await import('@/app/dashboard/price-list/customer-rules-actions')
        createCustomerPriceRule = pricingMod.createCustomerPriceRule
        approveCustomerPriceRule = pricingMod.approveCustomerPriceRule
        resolveCustomerProductPrice = pricingMod.resolveCustomerProductPrice

        const salesMod = await import('@/app/dashboard/sales/actions')
        createSalesOrder = salesMod.createSalesOrder
        updateSalesOrder = salesMod.updateSalesOrder
        confirmSalesOrder = salesMod.confirmSalesOrder

        const dashMod = await import('@/app/dashboard/actions')
        rejectSO = dashMod.rejectSO

        const doMod = await import('@/app/dashboard/warehouse/actions-do')
        createDeliveryOrder = doMod.createDeliveryOrder
        confirmDeliveryOrder = doMod.confirmDeliveryOrder

        // Setup base entities
        let le = await prisma.legalEntity.findFirst()
        if (!le) {
            le = await prisma.legalEntity.create({
                data: { code: 'LE-EDGE-1', name: 'Edge Test Primary Entity', taxId: '0100000010' }
            })
        }
        legalEntityId = le.id

        let otherLe = await prisma.legalEntity.findFirst({ where: { id: { not: legalEntityId } } })
        if (!otherLe) {
            otherLe = await prisma.legalEntity.create({
                data: { code: 'LE-EDGE-2', name: 'Edge Test Other Entity', taxId: '0100000020' }
            })
        }
        otherLegalEntityId = otherLe.id

        let wh = await prisma.warehouse.findFirst({
            where: { legalEntityId, allowSales: true, code: { not: 'WH-TA-TT' } }
        })
        if (!wh) {
            wh = await prisma.warehouse.create({
                data: {
                    code: `WH-EDG-${Date.now().toString().slice(-4)}`,
                    name: 'Edge Sales Warehouse',
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
                    code: `WH-OTHE-${Date.now().toString().slice(-4)}`,
                    name: 'Edge Other Entity Warehouse',
                    legalEntityId: otherLegalEntityId,
                    allowSales: true,
                }
            })
        }
        otherWarehouseId = otherWh.id

        let storageWh = await prisma.warehouse.findFirst({
            where: { legalEntityId, allowSales: false }
        })
        if (!storageWh) {
            storageWh = await prisma.warehouse.create({
                data: {
                    code: `WH-STOR-${Date.now().toString().slice(-4)}`,
                    name: 'Edge Central Reserve Storage (No Sales)',
                    legalEntityId,
                    allowSales: false,
                }
            })
        }
        storageWarehouseId = storageWh.id

        let loc = await prisma.location.findFirst({ where: { warehouseId } })
        if (!loc) {
            loc = await prisma.location.create({
                data: { warehouseId, zone: 'Z', rack: '99', bin: '99', locationCode: 'EDG-Z-99' }
            })
        }
        locationId = loc.id

        let user = await prisma.user.findFirst()
        salesRepId = user ? user.id : 'u1'

        const sessionMod = await import('@/lib/session')
        const mockUser = {
            id: salesRepId,
            name: user?.name || 'Edge Tester',
            email: user?.email || 'tester@test.com',
            roles: ['Admin', 'CEO', 'Kế Toán', 'Sales Admin', 'Sales Manager'],
            permissions: []
        }
        vi.mocked(sessionMod.requirePermission).mockResolvedValue(mockUser as any)
        vi.mocked(sessionMod.getCurrentUser).mockResolvedValue(mockUser as any)
        vi.mocked(sessionMod.requireAuth).mockResolvedValue(mockUser as any)

        let producer = await prisma.producer.findFirst()
        if (!producer) {
            producer = await prisma.producer.create({
                data: { code: 'PROD-EDG-1', name: 'Edge Producer', country: 'IT' }
            })
        }
        producerId = producer.id
    }, 40000)

    afterAll(async () => {
        try {
            for (const soId of createdSOIds) {
                await prisma.deliveryOrderLine.deleteMany({ where: { do: { soId } } })
                await prisma.deliveryOrder.deleteMany({ where: { soId } })
                await prisma.salesOrderLine.deleteMany({ where: { soId } })
                await prisma.approvalLog.deleteMany({ where: { request: { docId: soId } } })
                await prisma.approvalRequest.deleteMany({ where: { docId: soId } })
                await prisma.salesOrder.deleteMany({ where: { id: soId } })
            }
            if (createdRuleIds.length > 0) {
                await prisma.customerPriceRule.deleteMany({ where: { id: { in: createdRuleIds } } })
            }
            if (createdPriceListIds.length > 0) {
                await prisma.priceListLine.deleteMany({ where: { priceListId: { in: createdPriceListIds } } })
                await prisma.priceList.deleteMany({ where: { id: { in: createdPriceListIds } } })
            }
            if (createdLotIds.length > 0) {
                await prisma.stockLot.deleteMany({ where: { id: { in: createdLotIds } } })
            }
            if (createdProductIds.length > 0) {
                await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
            }
            for (const cid of createdCustomerIds) {
                await prisma.customerAddress.deleteMany({ where: { customerId: cid } })
                await prisma.customerContact.deleteMany({ where: { customerId: cid } })
                await prisma.customer.deleteMany({ where: { id: cid } })
            }
        } catch (e) {
            console.error('Edge cleanup error:', e)
        }
    })

    // ═══════════════════════════════════════════════════
    // 1. CUSTOMER EDGE CASES
    // ═══════════════════════════════════════════════════
    describe('1. Customer Edge Cases', () => {
        it('should REJECT customer creation with invalid email format', async () => {
            const res = await createCustomer({
                name: 'Bad Email Customer',
                channel: 'HORECA',
                email: 'not-an-email',
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('Email không hợp lệ')
        })

        it('should REJECT customer creation with name shorter than 2 characters', async () => {
            const res = await createCustomer({
                name: 'A',
                channel: 'HORECA',
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('Tên KH bắt buộc')
        })

        it('should REJECT customer updating its parentId to itself (Self-Parenting)', async () => {
            const cust = await prisma.customer.create({
                data: {
                    code: `SELF-${Date.now().toString().slice(-5)}`,
                    name: 'Self Parent Customer',
                    channel: 'HORECA',
                }
            })
            createdCustomerIds.push(cust.id)

            const updateRes = await updateCustomer(cust.id, {
                parentId: cust.id,
            })
            expect(updateRes.success).toBe(false)
            expect(updateRes.error).toContain('Không thể chọn chính mình làm cha')
        })

        it('should REJECT circular hierarchy when choosing a child as parent', async () => {
            // Parent: P
            const parent = await prisma.customer.create({
                data: { code: `P-${Date.now().toString().slice(-5)}`, name: 'Parent Company P', channel: 'HORECA' }
            })
            createdCustomerIds.push(parent.id)

            // Child: C (parentId = P)
            const child = await prisma.customer.create({
                data: { code: `C-${Date.now().toString().slice(-5)}`, name: 'Child Branch C', channel: 'HORECA', parentId: parent.id }
            })
            createdCustomerIds.push(child.id)

            // Attempt to set P's parentId to C
            const circularRes = await updateCustomer(parent.id, {
                parentId: child.id,
            })
            expect(circularRes.success).toBe(false)
            expect(circularRes.error).toContain('đang là con của khách hàng này')
        })

        it('should BLOCK soft-delete of customer if it has active child branches', async () => {
            const pId = createdCustomerIds[createdCustomerIds.length - 2]
            const delRes = await deleteCustomer(pId)
            expect(delRes.success).toBe(false)
            expect(delRes.error).toContain('đang có 1 cơ sở/nhà hàng con trực thuộc')
        })

        it('should BLOCK soft-delete of customer if it has unfinalized Sales Orders', async () => {
            const cust = await prisma.customer.create({
                data: { code: `DELSO-${Date.now().toString().slice(-5)}`, name: 'Customer With Active SO', channel: 'HORECA' }
            })
            createdCustomerIds.push(cust.id)

            const so = await prisma.salesOrder.create({
                data: {
                    soNo: `SO-DEL-${Date.now().toString().slice(-5)}`,
                    customerId: cust.id,
                    salesRepId,
                    legalEntityId,
                    channel: 'HORECA',
                    paymentTerm: 'NET30',
                    totalAmount: 5_000_000,
                    status: 'CONFIRMED',
                }
            })
            createdSOIds.push(so.id)

            const delRes = await deleteCustomer(cust.id)
            expect(delRes.success).toBe(false)
            expect(delRes.error).toContain('đang có 1 đơn hàng chưa hoàn tất')
        })
    })

    // ═══════════════════════════════════════════════════
    // 2. PRICING EDGE CASES
    // ═══════════════════════════════════════════════════
    describe('2. Pricing Engine Edge Cases', () => {
        let testProduct: any
        let testCust: any

        beforeAll(async () => {
            testProduct = await createProduct({
                skuCode: `PRC-EDGE-${Date.now().toString().slice(-5)}`,
                productName: 'Edge Pinot Noir 2026',
                producerId,
                country: 'IT',
                abvPercent: 13.5,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'RED',
            })
            createdProductIds.push(testProduct.id!)

            testCust = await prisma.customer.create({
                data: {
                    code: `CUST-PRC-${Date.now().toString().slice(-5)}`,
                    name: 'Pricing Edge Customer',
                    channel: 'HORECA',
                }
            })
            createdCustomerIds.push(testCust.id)

            // Setup Wholesale Price List
            const pl = await prisma.priceList.create({
                data: {
                    name: `Base PriceList ${Date.now()}`,
                    channel: 'WHOLESALE_DISTRIBUTOR',
                    effectiveDate: new Date(),
                    lines: {
                        create: [{ productId: testProduct.id!, unitPrice: 1_000_000 }]
                    }
                }
            })
            createdPriceListIds.push(pl.id)
        })

        it('should REJECT price rule with negative value', async () => {
            const res = await createCustomerPriceRule({
                customerId: testCust.id,
                productId: testProduct.id!,
                ruleType: 'FIXED_PRICE',
                value: -50000,
                startDate: '2026-01-01',
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('không được âm')
        })

        it('should REJECT FIXED_DISCOUNT rule with discount percentage > 100%', async () => {
            const res = await createCustomerPriceRule({
                customerId: testCust.id,
                productId: testProduct.id!,
                ruleType: 'FIXED_DISCOUNT',
                value: 120, // 120% discount
                startDate: '2026-01-01',
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('không được vượt quá 100%')
        })

        it('should IGNORE unapproved price rules (PENDING_APPROVAL)', async () => {
            const unapproved = await createCustomerPriceRule({
                customerId: testCust.id,
                productId: testProduct.id!,
                ruleType: 'SPECIAL_PRICE',
                value: 600_000,
                startDate: '2026-01-01',
            })
            expect(unapproved.success).toBe(true)
            createdRuleIds.push(unapproved.id!)

            // Pricing engine must NOT use this unapproved rule! It falls back to base wholesale = 1,000,000
            const resolved = await resolveCustomerProductPrice(testCust.id, testProduct.id!)
            expect(resolved.price).toBe(1_000_000)
            expect(resolved.source).toBe('CHANNEL_BASE')
        })

        it('should IGNORE price rules that have expired (endDate in the past)', async () => {
            const expiredRule = await prisma.customerPriceRule.create({
                data: {
                    customerId: testCust.id,
                    productId: testProduct.id!,
                    ruleType: 'FIXED_PRICE',
                    value: 700_000,
                    startDate: new Date('2025-01-01'),
                    endDate: new Date('2025-12-31'), // Expired
                    status: 'APPROVED',
                    requestedBy: salesRepId,
                }
            })
            createdRuleIds.push(expiredRule.id)

            const resolved = await resolveCustomerProductPrice(testCust.id, testProduct.id!)
            expect(resolved.price).toBe(1_000_000) // Fallback to base
            expect(resolved.source).toBe('CHANNEL_BASE')
        })

        it('should prioritize SPECIAL_PRICE over FIXED_PRICE and FIXED_DISCOUNT', async () => {
            // Create APPROVED FIXED_DISCOUNT 20% -> 800,000
            const rDisc = await prisma.customerPriceRule.create({
                data: {
                    customerId: testCust.id,
                    productId: testProduct.id!,
                    ruleType: 'FIXED_DISCOUNT',
                    value: 20,
                    startDate: new Date('2026-01-01'),
                    status: 'APPROVED',
                    requestedBy: salesRepId,
                }
            })
            createdRuleIds.push(rDisc.id)

            // Create APPROVED SPECIAL_PRICE 550,000
            const rSpecial = await prisma.customerPriceRule.create({
                data: {
                    customerId: testCust.id,
                    productId: testProduct.id!,
                    ruleType: 'SPECIAL_PRICE',
                    value: 550_000,
                    startDate: new Date('2026-01-01'),
                    status: 'APPROVED',
                    requestedBy: salesRepId,
                }
            })
            createdRuleIds.push(rSpecial.id)

            const resolved = await resolveCustomerProductPrice(testCust.id, testProduct.id!)
            expect(resolved.price).toBe(550_000)
            expect(resolved.source).toBe('SPECIAL_PRICE')
        })
    })

    // ═══════════════════════════════════════════════════
    // 3. SALES ORDER EDGE CASES
    // ═══════════════════════════════════════════════════
    describe('3. Sales Order Edge Cases', () => {
        let testCust: any
        let testProd: any

        beforeAll(async () => {
            testCust = await prisma.customer.create({
                data: {
                    code: `CUST-SOE-${Date.now().toString().slice(-5)}`,
                    name: 'SO Edge Customer',
                    channel: 'HORECA',
                    entityType: 'RESTAURANT',
                }
            })
            createdCustomerIds.push(testCust.id)

            testProd = await createProduct({
                skuCode: `PROD-SOE-${Date.now().toString().slice(-5)}`,
                productName: 'SO Edge Cabernet',
                producerId,
                country: 'IT',
                abvPercent: 14.0,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'RED',
            })
            createdProductIds.push(testProd.id!)
        })

        it('should REJECT Sales Order creation with empty lines array', async () => {
            const res = await createSalesOrder({
                customerId: testCust.id,
                salesRepId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('ít nhất 1 dòng')
        })

        it('should REJECT Sales Order creation with non-positive line quantity', async () => {
            const res = await createSalesOrder({
                customerId: testCust.id,
                salesRepId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [{ productId: testProd.id!, qtyOrdered: 0, unitPrice: 100000 }],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('Số lượng phải > 0')
        })

        it('should ALLOW Parent Company to receive direct SO when allowDirectSO is TRUE', async () => {
            const parentDirect = await prisma.customer.create({
                data: {
                    code: `HOLD-DIR-${Date.now().toString().slice(-5)}`,
                    name: 'Holding Allowed Direct SO',
                    channel: 'HORECA',
                    entityType: 'COMPANY',
                    allowDirectSO: true, // Explicitly allowed
                }
            })
            createdCustomerIds.push(parentDirect.id)

            const res = await createSalesOrder({
                customerId: parentDirect.id,
                salesRepId,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [{ productId: testProd.id!, qtyOrdered: 5, unitPrice: 200000 }],
            })

            expect(res.success).toBe(true)
            if (res.soId) createdSOIds.push(res.soId)
        })

        it('should BLOCK updateSalesOrder when SO is in CONFIRMED or PENDING_APPROVAL status', async () => {
            const so = await prisma.salesOrder.create({
                data: {
                    soNo: `SO-CONF-${Date.now().toString().slice(-5)}`,
                    customerId: testCust.id,
                    salesRepId,
                    legalEntityId,
                    channel: 'HORECA',
                    paymentTerm: 'NET30',
                    totalAmount: 10_000_000,
                    status: 'CONFIRMED',
                }
            })
            createdSOIds.push(so.id)

            const updateRes = await updateSalesOrder({
                soId: so.id,
                customerId: testCust.id,
                channel: 'HORECA',
                paymentTerm: 'NET30',
                legalEntityId,
                lines: [{ productId: testProd.id!, qtyOrdered: 10, unitPrice: 1000000 }],
            })

            expect(updateRes.success).toBe(false)
            expect(updateRes.error).toContain('Chỉ có thể sửa SO ở trạng thái DRAFT')
        })

        it('should transition PENDING_APPROVAL SO to CANCELLED upon rejectSO', async () => {
            const pendingSO = await prisma.salesOrder.create({
                data: {
                    soNo: `SO-REJ-${Date.now().toString().slice(-5)}`,
                    customerId: testCust.id,
                    salesRepId,
                    legalEntityId,
                    channel: 'HORECA',
                    paymentTerm: 'NET30',
                    totalAmount: 20_000_000,
                    status: 'PENDING_APPROVAL',
                }
            })
            createdSOIds.push(pendingSO.id)

            const rejRes = await rejectSO(pendingSO.id, 'Chính sách chiết khấu không hợp lệ')
            expect(rejRes.success).toBe(true)

            const cancelled = await prisma.salesOrder.findUnique({ where: { id: pendingSO.id } })
            expect(cancelled?.status).toBe('CANCELLED')
        })
    })

    // ═══════════════════════════════════════════════════
    // 4. WAREHOUSE EXPORT (DO) EDGE CASES
    // ═══════════════════════════════════════════════════
    describe('4. Warehouse Export (DO) Edge Cases', () => {
        let confirmedSO: any
        let testProduct: any
        let validLot: any

        beforeAll(async () => {
            testProduct = await createProduct({
                skuCode: `PROD-DOE-${Date.now().toString().slice(-5)}`,
                productName: 'DO Edge Merlot',
                producerId,
                country: 'FR',
                abvPercent: 13.0,
                volumeMl: 750,
                hsCode: '2204211000',
                wineType: 'RED',
            })
            createdProductIds.push(testProduct.id!)

            const cust = await prisma.customer.create({
                data: { code: `CUST-DOE-${Date.now().toString().slice(-5)}`, name: 'DO Edge Customer', channel: 'HORECA' }
            })
            createdCustomerIds.push(cust.id)

            confirmedSO = await prisma.salesOrder.create({
                data: {
                    soNo: `SO-DOE-${Date.now().toString().slice(-5)}`,
                    customerId: cust.id,
                    salesRepId,
                    legalEntityId,
                    channel: 'HORECA',
                    paymentTerm: 'NET30',
                    totalAmount: 15_000_000,
                    status: 'CONFIRMED',
                    lines: {
                        create: [{ productId: testProduct.id!, qtyOrdered: 10, unitPrice: 1_500_000 }]
                    }
                }
            })
            createdSOIds.push(confirmedSO.id)

            validLot = await prisma.stockLot.create({
                data: {
                    lotNo: `LOT-VAL-${Date.now().toString().slice(-5)}`,
                    productId: testProduct.id!,
                    locationId,
                    ownerEntityId: legalEntityId,
                    qtyReceived: 20,
                    qtyAvailable: 20,
                    receivedDate: new Date(),
                    status: 'AVAILABLE',
                }
            })
            createdLotIds.push(validLot.id)
        })

        it('should BLOCK DO creation when SO is still in DRAFT status', async () => {
            const draftSO = await prisma.salesOrder.create({
                data: {
                    soNo: `SO-DR-${Date.now().toString().slice(-5)}`,
                    customerId: createdCustomerIds[0],
                    salesRepId,
                    legalEntityId,
                    channel: 'HORECA',
                    paymentTerm: 'NET30',
                    totalAmount: 1_000_000,
                    status: 'DRAFT',
                }
            })
            createdSOIds.push(draftSO.id)

            const res = await createDeliveryOrder({
                soId: draftSO.id,
                warehouseId,
                lines: [{ productId: testProduct.id!, lotId: validLot.id, locationId, qtyPicked: 1 }],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('không cho phép xuất kho')
        })

        it('should BLOCK DO creation from non-sales central reserve warehouse (WH-TA-TT / allowSales: false)', async () => {
            const res = await createDeliveryOrder({
                soId: confirmedSO.id,
                warehouseId: storageWarehouseId, // allowSales = false
                lines: [{ productId: testProduct.id!, lotId: validLot.id, locationId, qtyPicked: 1 }],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('không cho phép bán hàng')
        })

        it('should BLOCK DO creation if lot owner legal entity does not match SO legal entity', async () => {
            const otherEntityLot = await prisma.stockLot.create({
                data: {
                    lotNo: `LOT-OTH-${Date.now().toString().slice(-5)}`,
                    productId: testProduct.id!,
                    locationId,
                    ownerEntityId: otherLegalEntityId, // Mismatched legal entity!
                    qtyReceived: 10,
                    qtyAvailable: 10,
                    receivedDate: new Date(),
                    status: 'AVAILABLE',
                }
            })
            createdLotIds.push(otherEntityLot.id)

            const res = await createDeliveryOrder({
                soId: confirmedSO.id,
                warehouseId,
                lines: [{ productId: testProduct.id!, lotId: otherEntityLot.id, locationId, qtyPicked: 2 }],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('thuộc sở hữu của pháp nhân khác')
        })

        it('should BLOCK DO creation if lot location is not within the specified export warehouse', async () => {
            // Location in other warehouse
            let otherLoc = await prisma.location.findFirst({ where: { warehouseId: otherWarehouseId } })
            if (!otherLoc) {
                otherLoc = await prisma.location.create({
                    data: { warehouseId: otherWarehouseId, zone: 'X', rack: '01', bin: '01', locationCode: 'X-01' }
                })
            }

            const wrongLocLot = await prisma.stockLot.create({
                data: {
                    lotNo: `LOT-WLOC-${Date.now().toString().slice(-5)}`,
                    productId: testProduct.id!,
                    locationId: otherLoc.id,
                    ownerEntityId: legalEntityId,
                    qtyReceived: 10,
                    qtyAvailable: 10,
                    receivedDate: new Date(),
                    status: 'AVAILABLE',
                }
            })
            createdLotIds.push(wrongLocLot.id)

            const res = await createDeliveryOrder({
                soId: confirmedSO.id,
                warehouseId, // picking from warehouseId, but lot is at otherWarehouseId
                lines: [{ productId: testProduct.id!, lotId: wrongLocLot.id, locationId: otherLoc.id, qtyPicked: 2 }],
            })
            expect(res.success).toBe(false)
            expect(res.error).toContain('không nằm trong Kho xuất hàng của phiếu DO')
        })

        it('should REJECT confirming a Delivery Order twice (Idempotency Guard)', async () => {
            const doRes = await createDeliveryOrder({
                soId: confirmedSO.id,
                warehouseId,
                lines: [{ productId: testProduct.id!, lotId: validLot.id, locationId, qtyPicked: 5 }],
            })
            expect(doRes.success).toBe(true)
            const doId = doRes.doId!
            createdDOIds.push(doId)

            // Confirm 1st time -> SHIPPED
            const firstConfirm = await confirmDeliveryOrder(doId)
            expect(firstConfirm.success).toBe(true)

            // Confirm 2nd time -> MUST BE REJECTED
            const secondConfirm = await confirmDeliveryOrder(doId)
            expect(secondConfirm.success).toBe(false)
            expect(secondConfirm.error).toContain('không ở trạng thái DRAFT')
        })
    })
})
