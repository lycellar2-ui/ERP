import * as dotenv from 'dotenv'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function test() {
    const { prisma } = await import('../src/lib/db')
    const orders = await prisma.salesOrder.findMany({
        take: 50,
        select: { id: true, soNo: true, _count: { select: { lines: true } } }
    })
    
    console.log(`Found ${orders.length} orders to benchmark.`)
    const timings: { soNo: string, linesCount: number, timeMs: number }[] = []

    for (const order of orders) {
        const start = Date.now()
        // Run the findUnique details query
        const detail = await prisma.salesOrder.findUnique({
            where: { id: order.id },
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
        
        if (detail) {
            const productIds = [...new Set(detail.lines.map(l => l.productId))]
            await prisma.stockLot.findMany({
                where: { productId: { in: productIds }, qtyAvailable: { gt: 0 } },
                select: { productId: true, qtyAvailable: true, unitLandedCost: true },
            })
        }
        
        const elapsed = Date.now() - start
        timings.push({ soNo: order.soNo, linesCount: order._count.lines, timeMs: elapsed })
    }

    // Sort by time descending
    timings.sort((a, b) => b.timeMs - a.timeMs)

    console.log('\n--- Top 10 Slowest Orders ---')
    timings.slice(0, 10).forEach((t, i) => {
        console.log(`${i+1}. SO: ${t.soNo} | Lines: ${t.linesCount} | Time: ${t.timeMs}ms`)
    })
}

test()
    .catch(console.error)
    .finally(async () => {
        const { prisma } = await import('../src/lib/db')
        await prisma.$disconnect()
    })
