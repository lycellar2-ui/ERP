import { prisma } from '../src/lib/db';

async function checkAllMovements() {
    try {
        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        const fromDate = new Date('2026-08-01T00:00:00.000Z');

        console.log('=== CHECKING ALL MOVEMENTS FOR KHO TT SINCE 2026-08-01 ===');

        // 1. Transfer Orders
        const transfersFrom = await prisma.transferOrder.findMany({
            where: { fromWarehouseId: warehouse!.id, createdAt: { gte: fromDate } },
            include: { lines: { include: { product: true } } }
        });
        const transfersTo = await prisma.transferOrder.findMany({
            where: { toWarehouseId: warehouse!.id, createdAt: { gte: fromDate } },
            include: { lines: { include: { product: true } } }
        });
        console.log('Transfers OUT of Kho TT:', transfersFrom.length);
        console.log('Transfers IN to Kho TT:', transfersTo.length);

        // 2. Delivery Orders (DO)
        const dos = await prisma.deliveryOrder.findMany({
            where: { warehouseId: warehouse!.id, createdAt: { gte: fromDate } },
            include: { lines: { include: { product: true } } }
        });
        console.log('Delivery Orders from Kho TT:', dos.length);
        for (const doItem of dos) {
            console.log(`DO: ${doItem.doNo}, Status: ${doItem.status}, CreatedAt: ${doItem.createdAt}`);
            console.table(doItem.lines.map(l => ({
                sku: l.product.skuCode,
                name: l.product.productName,
                qtyPicked: Number(l.qtyPicked),
                qtyShipped: Number(l.qtyShipped)
            })));
        }

        // 3. Goods Receipts (GR)
        const grs = await prisma.goodsReceipt.findMany({
            where: { warehouseId: warehouse!.id, createdAt: { gte: fromDate } },
            include: { lines: { include: { product: true } } }
        });
        console.log('Goods Receipts to Kho TT:', grs.length);

        // 4. Stock Count adjustments
        const stockCounts = await prisma.stockCountSession.findMany({
            where: { warehouseId: warehouse!.id, createdAt: { gte: fromDate } },
            include: { lines: { include: { product: true } } }
        });
        console.log('Stock count sessions:', stockCounts.length);

        // 5. StockLot changes / Audit Logs
        const audits = await prisma.auditLog.findMany({
            where: {
                createdAt: { gte: fromDate },
                entityType: { in: ['StockLot', 'TransferOrder', 'DeliveryOrder', 'GoodsReceipt', 'StockTransfer'] }
            },
            take: 20
        });
        console.log('Audit logs since Aug 1:', audits.length);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkAllMovements();
