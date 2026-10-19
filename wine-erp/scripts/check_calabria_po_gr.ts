import { prisma } from '../src/lib/db';

async function checkCalabriaShipment() {
    try {
        const skus = ['L40010', 'L40011', 'L40012', 'L40013', 'L40014'];
        
        console.log('=== CHECKING PO, GR, SHIPMENT FOR CALABRIA L40010-L40014 ===');
        const poLines = await prisma.purchaseOrderLine.findMany({
            where: { product: { skuCode: { in: skus } } },
            include: { po: true, product: true }
        });
        console.log('PO Lines:', poLines.map(p => ({
            poNo: p.po.poNo,
            supplier: p.po.supplierId,
            sku: p.product.skuCode,
            qty: Number(p.quantity),
            status: p.po.status,
            orderDate: p.po.orderDate
        })));

        const grLines = await prisma.goodsReceiptLine.findMany({
            where: { product: { skuCode: { in: skus } } },
            include: { gr: { include: { warehouse: true } }, product: true }
        });
        console.log('GR Lines:', grLines.map(g => ({
            grNo: g.gr.grNo,
            warehouse: g.gr.warehouse.name,
            sku: g.product.skuCode,
            qtyExpected: Number(g.qtyExpected),
            qtyReceived: Number(g.qtyReceived),
            status: g.gr.status,
            createdAt: g.gr.createdAt
        })));

        const stockLots = await prisma.stockLot.findMany({
            where: { product: { skuCode: { in: skus } } },
            include: { location: { include: { warehouse: true } }, product: true }
        });
        console.log('Stock Lots in DB:');
        console.table(stockLots.map(l => ({
            lotNo: l.lotNo,
            sku: l.product.skuCode,
            warehouse: l.location.warehouse.name,
            location: l.location.locationCode,
            qtyAvailable: Number(l.qtyAvailable),
            qtyReceived: Number(l.qtyReceived),
            receivedDate: l.receivedDate
        })));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkCalabriaShipment();
