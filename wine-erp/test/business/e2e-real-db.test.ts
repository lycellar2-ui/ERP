import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}))

// Mock session and auth checks to return a super admin user
vi.mock('@/lib/session', () => ({
    requirePermission: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Super Admin', email: 'admin@test.com' }),
    getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Super Admin', email: 'admin@test.com' }),
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1', name: 'E2E Super Admin', email: 'admin@test.com' }),
    hasRole: vi.fn((user: any, ...roles: string[]) => true),
}))

// Mock notifications to prevent sending real messages during E2E test
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
}))

// Mock lib/cache
vi.mock('@/lib/cache', () => ({
    cached: vi.fn((key, fn) => fn()),
    revalidateCache: vi.fn(),
}))

describe('E2E Real Database Flow: New Product, Customer, Sales Order, and Delivery', () => {
    let prisma: any
    let createProduct: any
    let createCustomer: any
    let createSalesOrder: any
    let confirmSalesOrder: any
    let approveSalesOrder: any
    let accountingApproveSO: any
    let createDeliveryOrder: any
    let confirmDeliveryOrder: any

    let producerId: string
    let warehouseId: string
    let locationId: string
    let legalEntityId: string
    let salesRepId: string

    let productId: string
    let customerId: string
    let lotId: string
    let soId: string
    let doId: string
    let createdTemplateId: string | null = null
    let createdUserId: string | null = null

    beforeAll(async () => {
        // Dynamically import backend modules after dotenv config executes
        const dbMod = await import('@/lib/db')
        prisma = dbMod.prisma

        const prodMod = await import('@/app/dashboard/products/actions')
        createProduct = prodMod.createProduct

        const custMod = await import('@/app/dashboard/customers/actions')
        createCustomer = custMod.createCustomer

        const salesMod = await import('@/app/dashboard/sales/actions')
        createSalesOrder = salesMod.createSalesOrder
        confirmSalesOrder = salesMod.confirmSalesOrder
        approveSalesOrder = salesMod.approveSalesOrder
        accountingApproveSO = salesMod.accountingApproveSO

        const doMod = await import('@/app/dashboard/warehouse/actions-do')
        createDeliveryOrder = doMod.createDeliveryOrder
        confirmDeliveryOrder = doMod.confirmDeliveryOrder

        // Fetch prerequisite records
        // 1. Legal Entity
        let legalEntity = await prisma.legalEntity.findFirst()
        if (!legalEntity) {
            legalEntity = await prisma.legalEntity.create({
                data: { code: 'E2E-LE-1', name: 'E2E Legal Entity 1', taxId: '123456789' }
            })
        }
        legalEntityId = legalEntity.id

        // 2. Producer
        let producer = await prisma.producer.findFirst()
        if (!producer) {
            producer = await prisma.producer.create({
                data: { code: 'E2E-PROD-1', name: 'E2E Producer 1', country: 'FR' }
            })
        }
        producerId = producer.id

        // 3. Warehouse
        let warehouse = await prisma.warehouse.findFirst()
        if (!warehouse) {
            warehouse = await prisma.warehouse.create({
                data: { code: 'E2E-WH-1', name: 'E2E Warehouse 1', address: '123 E2E St' }
            })
        }
        warehouseId = warehouse.id

        // 4. Warehouse Location
        let location = await prisma.location.findFirst({ where: { warehouseId } })
        if (!location) {
            location = await prisma.location.create({
                data: {
                    warehouseId,
                    zone: 'A',
                    rack: '01',
                    bin: '01',
                    locationCode: 'A-01-01',
                }
            })
        }
        locationId = location.id

        // 5. User / Sales Rep
        let user = await prisma.user.findFirst()
        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: 'e2e-admin-user',
                    name: 'E2E Super Admin',
                    email: 'admin@test.com',
                    passwordHash: 'hashedpassword',
                }
            })
            createdUserId = 'e2e-admin-user'
        }
        
        const realUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            status: 'ACTIVE' as const,
            roles: ['Admin'],
            permissions: [] as string[]
        }
        salesRepId = user.id

        // Dynamically override the mocked functions to return the real user
        const sessionMod = await import('@/lib/session')
        vi.mocked(sessionMod.requirePermission).mockResolvedValue(realUser)
        vi.mocked(sessionMod.getCurrentUser).mockResolvedValue(realUser)
        vi.mocked(sessionMod.requireAuth).mockResolvedValue(realUser)

        // 6. Sales Order Approval Template
        let template = await prisma.approvalTemplate.findFirst({
            where: { docType: 'SALES_ORDER' },
            include: { steps: true }
        })
        if (!template || template.steps.length === 0) {
            if (template) {
                await prisma.approvalStep.deleteMany({ where: { templateId: template.id } })
                await prisma.approvalTemplate.delete({ where: { id: template.id } })
            }
            template = await prisma.approvalTemplate.create({
                data: {
                    name: 'E2E Sales Order Approval Template',
                    docType: 'SALES_ORDER',
                    steps: {
                        create: [
                            { stepOrder: 1, approverRole: 'Sales Admin', threshold: 0 },
                            { stepOrder: 2, approverRole: 'CEO', threshold: 100000 }
                        ]
                    }
                }
            })
            createdTemplateId = template.id
        }
    }, 30000)

    afterAll(async () => {
        // Cleanup all records created during the test in reverse dependency order
        try {
            if (soId) {
                // Delete DeliveryOrderLine first, then DeliveryOrder, then SalesOrderLine...
                await prisma.deliveryOrderLine.deleteMany({ where: { do: { soId } } })
                await prisma.deliveryOrder.deleteMany({ where: { soId } })
                
                await prisma.salesOrderLine.deleteMany({ where: { soId } })
                await prisma.approvalLog.deleteMany({ where: { request: { docId: soId } } })
                await prisma.approvalRequest.deleteMany({ where: { docId: soId } })
                await prisma.salesOrder.deleteMany({ where: { id: soId } })
            }
            if (lotId) {
                const usages = await prisma.wineStampUsage.findMany({ where: { lotId } })
                const purchaseIds = usages.map((u: any) => u.purchaseId)
                await prisma.wineStampUsage.deleteMany({ where: { lotId } })
                if (purchaseIds.length > 0) {
                    await prisma.wineStampPurchase.deleteMany({ where: { id: { in: purchaseIds } } })
                }
                await prisma.stockLot.deleteMany({ where: { id: lotId } })
            }
            if (customerId) {
                await prisma.customer.deleteMany({ where: { id: customerId } })
            }
            if (productId) {
                await prisma.product.deleteMany({ where: { id: productId } })
            }
            if (createdTemplateId) {
                await prisma.approvalStep.deleteMany({ where: { templateId: createdTemplateId } })
                await prisma.approvalTemplate.deleteMany({ where: { id: createdTemplateId } })
            }
            if (createdUserId) {
                await prisma.user.deleteMany({ where: { id: createdUserId } })
            }
        } catch (cleanupErr) {
            console.error('Error cleaning up E2E records:', cleanupErr)
        }
    })

    it('should complete the entire flow successfully', async () => {
        // 1. Create a new Product
        const skuCode = `E2E-PROD-${Date.now().toString().slice(-6)}`
        const prodResult = await createProduct({
            skuCode,
            productName: 'E2E Test Vintage Wine 2026',
            producerId,
            country: 'FR',
            abvPercent: 14.5,
            volumeMl: 750,
            format: 'STANDARD',
            packagingType: 'CARTON',
            unitsPerCase: 6,
            hsCode: '2204211000',
            wineType: 'RED',
            vatRate: 10,
        })

        expect(prodResult.success).toBe(true)
        productId = prodResult.id || ''
        expect(productId).toBeDefined()

        // 2. Create a new Customer
        const customerCode = `E2E-CUST-${Date.now().toString().slice(-6)}`
        const custResult = await createCustomer({
            code: customerCode,
            name: 'E2E Test Horeca Customer Corp',
            customerType: 'HORECA',
            channel: 'HORECA',
            paymentTerm: 'NET30',
            creditLimit: 500000000, // 500M VND limit to bypass credit hold checks
            salesRepId,
            status: 'ACTIVE',
            entityType: 'RESTAURANT',
        })

        expect(custResult.success).toBe(true)
        const customer = await prisma.customer.findUnique({ where: { code: customerCode } })
        customerId = customer?.id || ''
        expect(customerId).toBeDefined()

        // 3. Create a Stock Lot (mocking goods receipt / inventory inflow)
        const lotNo = `LOT-E2E-${Date.now().toString().slice(-6)}`
        const stockLot = await prisma.stockLot.create({
            data: {
                lotNo,
                productId,
                locationId,
                ownerEntityId: legalEntityId, // Matches SO entity
                vintage: 2023,
                qtyReceived: 500,
                qtyAvailable: 500,
                unitLandedCost: 250000, // 250k VND unit cost
                receivedDate: new Date(),
                status: 'AVAILABLE',
            }
        })
        lotId = stockLot.id

        // Create stamp usage since the product has ABV >= 15% (Wait, we set ABV to 14.5, which is < 15, so stamp check is optional but let's test with stamp check enabled by setting ABV = 15.5!)
        // Let's update product ABV to 15.5 to verify our custom stamp check works!
        await prisma.product.update({
            where: { id: productId },
            data: { abvPercent: 15.5 }
        })

        // 4. Create a Sales Order (SO)
        const soResult = await createSalesOrder({
            customerId,
            salesRepId,
            channel: 'HORECA',
            paymentTerm: 'NET30',
            legalEntityId,
            lines: [
                {
                    productId,
                    qtyOrdered: 300,
                    unitPrice: 1000000, // 1M VND unit price -> Total 300M VND triggers both steps
                    vatRate: 10,
                }
            ]
        })

        expect(soResult.success).toBe(true)
        soId = soResult.soId || ''
        expect(soId).toBeDefined()

        // 5. Confirm the Sales Order
        const confirmResult = await confirmSalesOrder(soId)
        console.log('confirmResult:', confirmResult)

        const allTemplates = await prisma.approvalTemplate.findMany({ include: { steps: true } })
        console.log('all templates:', JSON.stringify(allTemplates, null, 2))

        const createdRequests = await prisma.approvalRequest.findMany({ where: { docId: soId } })
        console.log('created requests:', createdRequests)

        expect(confirmResult.success).toBe(true)

        // 6. Process approval request workflow steps
        let maxSteps = 10
        let currentSo = await prisma.salesOrder.findUnique({ where: { id: soId } })
        while (currentSo?.status === 'PENDING_APPROVAL' && maxSteps > 0) {
            const approveResult = await approveSalesOrder(soId)
            if (!approveResult.success) {
                console.error('approveSalesOrder failed with error:', approveResult.error)
            }
            expect(approveResult.success).toBe(true)
            currentSo = await prisma.salesOrder.findUnique({ where: { id: soId } })
            maxSteps--
        }

        expect(currentSo?.status).toBe('PENDING_ACCOUNTING')

        // 7. Accounting approval (transitions from PENDING_ACCOUNTING to CONFIRMED)
        const acctResult = await accountingApproveSO(soId)
        expect(acctResult.success).toBe(true)

        currentSo = await prisma.salesOrder.findUnique({ where: { id: soId } })
        expect(currentSo?.status).toBe('CONFIRMED')

        // 8. Create Delivery Order (DO)
        const doResult = await createDeliveryOrder({
            soId,
            warehouseId,
            lines: [
                {
                    productId,
                    lotId,
                    locationId,
                    qtyPicked: 300,
                }
            ]
        })
        expect(doResult.success).toBe(true)
        doId = doResult.doId || ''
        expect(doId).toBeDefined()

        // Verify that the lot's available qty is decremented during picking
        let updatedLot = await prisma.stockLot.findUnique({ where: { id: lotId } })
        expect(Number(updatedLot?.qtyAvailable)).toBe(200) // 500 - 300

        // 9. Confirm / Ship the Delivery Order (this confirms delivery)
        const shipResult = await confirmDeliveryOrder(doId)
        expect(shipResult.success).toBe(true)

        // Verify that the Sales Order status transitioned to DELIVERED
        currentSo = await prisma.salesOrder.findUnique({ where: { id: soId } })
        expect(currentSo?.status).toBe('DELIVERED')
    }, 30000)
})
