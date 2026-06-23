import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    console.log('--- Benchmarking all actions for SO Drawer ---')
    const { 
        getCustomersForSO, getProductsWithStock, getLegalEntities, 
        getSalesOrderDetailWithMargin, getSOTimeline, getCustomerARBalance 
    } = await import('../src/app/dashboard/sales/actions')
    const { getCustomerResolvedPrices } = await import('../src/app/dashboard/price-list/customer-rules-actions')
    const { prisma } = await import('../src/lib/db')
    
    const order = await prisma.salesOrder.findFirst({ select: { id: true, customerId: true, channel: true } })
    if (!order) {
        console.log('No sales order found')
        return
    }
    const soId = order.id
    const customerId = order.customerId
    console.log('Using SO ID:', soId, 'Customer ID:', customerId)

    // Bypassing auth checks inside test wrapper
    // Since these actions call requireAuth(), we can measure the DB query speeds inside them,
    // or run them directly if they don't block.
    // Let's measure each one.
    
    console.log('\n--- 1. Reference Data Queries ---')
    try {
        console.time('getCustomersForSO')
        await getCustomersForSO()
        console.timeEnd('getCustomersForSO')
    } catch(e: any) { console.log('getCustomersForSO failed:', e.message) }

    try {
        console.time('getProductsWithStock')
        const prods = await getProductsWithStock()
        console.timeEnd('getProductsWithStock')
        console.log('Products count:', prods.length)
    } catch(e: any) { console.log('getProductsWithStock failed:', e.message) }

    try {
        console.time('getLegalEntities')
        await getLegalEntities()
        console.timeEnd('getLegalEntities')
    } catch(e: any) { console.log('getLegalEntities failed:', e.message) }

    console.log('\n--- 2. Customer Specific Queries ---')
    try {
        console.time('getCustomerARBalance')
        await getCustomerARBalance(customerId)
        console.timeEnd('getCustomerARBalance')
    } catch(e: any) { console.log('getCustomerARBalance failed:', e.message) }

    try {
        console.time('getCustomerResolvedPrices')
        const prices = await getCustomerResolvedPrices(customerId)
        console.timeEnd('getCustomerResolvedPrices')
        console.log('Resolved prices count:', Object.keys(prices).length)
    } catch(e: any) { console.log('getCustomerResolvedPrices failed:', e.message) }

    console.log('\n--- 3. Raw Database Queries representing detail + margin + timeline ---')
    // We run raw db queries representing detail and timeline since they call requireAuth()
    
    console.time('DB: SalesOrder.findUnique')
    const detail = await prisma.salesOrder.findUnique({
        where: { id: soId },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { id: true, name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: {
                        include: {
                            media: { where: { isPrimary: true }, select: { url: true } },
                            profile: { select: { grapes: true } }
                        }
                    },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
    console.timeEnd('DB: SalesOrder.findUnique')

    if (detail) {
        console.time('DB: StockLot.findMany (Margin cost)')
        const productIds = [...new Set(detail.lines.map(l => l.productId))]
        await prisma.stockLot.findMany({
            where: { productId: { in: productIds }, qtyAvailable: { gt: 0 } },
            select: { productId: true, qtyAvailable: true, unitLandedCost: true },
        })
        console.timeEnd('DB: StockLot.findMany (Margin cost)')
    }

    console.time('DB: AuditLog.findMany (Timeline)')
    await prisma.auditLog.findMany({
        where: { entityType: 'SalesOrder', entityId: soId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, action: true, userName: true, createdAt: true, newValue: true },
    })
    console.timeEnd('DB: AuditLog.findMany (Timeline)')
}

test()
    .catch(console.error)
    .finally(async () => {
        const { prisma } = await import('../src/lib/db')
        await prisma.$disconnect()
    })
