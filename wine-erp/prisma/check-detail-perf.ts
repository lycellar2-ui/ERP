import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    console.log('--- Measuring sales detail raw queries ---')
    const { prisma } = await import('../src/lib/db')
    
    const order = await prisma.salesOrder.findFirst({ select: { id: true, soNo: true } })
    if (!order) {
        console.log('No sales order found')
        return
    }
    const id = order.id
    console.log('Testing for SO:', order.soNo, 'ID:', id)

    // 1. SalesOrder.findUnique Query
    console.time('1. SalesOrder.findUnique')
    const detail = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, code: true, creditLimit: true, paymentTerm: true, channel: true } },
            salesRep: { select: { id: true, name: true } },
            shippingAddress: true,
            lines: {
                include: {
                    product: {
                        include: {
                            media: {
                                where: { isPrimary: true },
                                select: { url: true }
                            },
                            profile: {
                                select: { grapes: true }
                            }
                        }
                    },
                },
            },
            deliveryOrders: { select: { id: true, doNo: true, status: true } },
            arInvoices: { select: { id: true, invoiceNo: true, status: true, amount: true, dueDate: true } },
        },
    })
    console.timeEnd('1. SalesOrder.findUnique')
    if (!detail) {
        console.log("Detail not found")
        return
    }
    console.log('Lines count:', detail.lines.length)

    // 2. StockLot Query (Margin calculation)
    console.time('2. StockLot.findMany')
    const productIds = [...new Set(detail.lines.map(l => l.productId))]
    const allLots = await prisma.stockLot.findMany({
        where: { productId: { in: productIds }, qtyAvailable: { gt: 0 } },
        select: { productId: true, qtyAvailable: true, unitLandedCost: true },
    })
    console.timeEnd('2. StockLot.findMany')
    console.log('Lots count:', allLots.length)

    // 3. ApprovalRequest Query
    console.time('3. ApprovalRequest.findFirst')
    const approvalReq = await prisma.approvalRequest.findFirst({
        where: { docType: 'SALES_ORDER', docId: id, status: 'PENDING' },
        select: { currentStep: true }
    })
    console.timeEnd('3. ApprovalRequest.findFirst')

    // 4. AuditLog Timeline Query
    console.time('4. AuditLog.findMany')
    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { entityType: 'SalesOrder', entityId: id },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, action: true, userName: true, createdAt: true, newValue: true },
    })
    console.timeEnd('4. AuditLog.findMany')
    console.log('Logs count:', logs.length)
}

test()
    .catch(console.error)
    .finally(async () => {
        const { prisma } = await import('../src/lib/db')
        await prisma.$disconnect()
    })
