import { prisma } from '../src/lib/db';

async function checkL20068() {
    try {
        console.log('=== 1. TÌM SẢN PHẨM L20068 ===');
        const product = await prisma.product.findFirst({
            where: { skuCode: { equals: 'L20068', mode: 'insensitive' } },
            include: {
                stockLots: {
                    include: {
                        location: { include: { warehouse: true } }
                    }
                }
            }
        });

        if (!product) {
            console.log('Không tìm thấy sản phẩm L20068!');
            return;
        }

        console.log(`Product: ${product.skuCode} - ${product.productName} (ID: ${product.id})`);
        console.log('StockLots:');
        console.table(product.stockLots.map(l => ({
            lotId: l.id,
            lotNo: l.lotNo,
            warehouse: l.location.warehouse.name,
            whCode: l.location.warehouse.code,
            location: l.location.locationCode,
            vintage: l.vintage,
            qtyAvailable: Number(l.qtyAvailable),
            qtyReceived: Number(l.qtyReceived),
            status: l.status
        })));

        console.log('\n=== 2. KIỂM TRA CÁC ĐƠN CHUYỂN KHO GẦN ĐÂY (TRANSFER ORDERS) ===');
        const recentTOs = await prisma.transferOrder.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                fromWarehouse: { select: { name: true, code: true } },
                toWarehouse: { select: { name: true, code: true } },
                lines: {
                    include: {
                        product: { select: { skuCode: true, productName: true } }
                    }
                }
            }
        });

        for (const to of recentTOs) {
            console.log(`TO: ${to.toNo} | Status: ${to.status} | From: ${to.fromWarehouse.code} -> To: ${to.toWarehouse.code} | Created: ${to.createdAt}`);
            for (const line of to.lines) {
                console.log(`  - Line SKU: ${line.product.skuCode} | QtyTransferred: ${line.qtyTransferred} | QtyReceived: ${line.qtyReceived}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkL20068();
