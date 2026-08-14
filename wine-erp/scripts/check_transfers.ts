import { prisma } from '../src/lib/db';

async function test() {
    try {
        const transfers = await prisma.transferOrder.findMany({
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                lines: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log('Total TransferOrders:', transfers.length);
        for (const t of transfers) {
            console.log('\n=============================================');
            console.log('Transfer No:', t.transferNo, 'Status:', t.status);
            console.log('From:', t.fromWarehouse.name, '--> To:', t.toWarehouse.name);
            console.log('Created At:', t.createdAt);
            console.log('Transfer Date:', t.transferDate);
            console.log('Accounting Approved At:', t.accountingApprovedAt);
            console.log('Dispatched At:', t.dispatchedAt);
            console.log('Received At:', t.receivedAt);
            console.log('Total Lines:', t.lines.length);
            console.log('Lines detail:');
            console.table(t.lines.map(l => ({
                sku: l.product.skuCode,
                name: l.product.productName,
                vintage: l.vintage,
                qtyTransferred: Number(l.qtyTransferred),
                qtyReceived: Number(l.qtyReceived)
            })));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

test();
