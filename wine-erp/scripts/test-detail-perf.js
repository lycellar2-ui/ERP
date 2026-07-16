const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Connecting to database...");
    const order = await prisma.salesOrder.findFirst({
        select: { id: true, soNo: true }
    });
    if (!order) {
        console.log("No sales order found in the database");
        return;
    }
    console.log("Measuring queries for SO:", order.soNo, "(ID:", order.id, ")");
    
    // 1. Measure SalesOrder query
    const t0 = Date.now();
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
    });
    console.log("1. SalesOrder.findUnique took:", Date.now() - t0, "ms");
    
    // 2. Measure StockLot query
    const t1 = Date.now();
    const productIds = [...new Set(detail.lines.map(l => l.productId))];
    const allLots = await prisma.stockLot.findMany({
        where: { productId: { in: productIds }, qtyAvailable: { gt: 0 } },
        select: { productId: true, qtyAvailable: true, unitLandedCost: true },
    });
    console.log("2. StockLot.findMany took:", Date.now() - t1, "ms");
    
    // 3. Measure AuditLog timeline query
    const t2 = Date.now();
    const logs = await prisma.auditLog.findMany({
        where: { entityType: 'SalesOrder', entityId: order.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, action: true, userName: true, createdAt: true, newValue: true },
    });
    console.log("3. AuditLog.findMany took:", Date.now() - t2, "ms");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
