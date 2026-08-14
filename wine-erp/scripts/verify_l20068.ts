import { prisma } from '../src/lib/db';
import { revalidateCache } from '../src/lib/cache';

async function verifyL20068() {
    try {
        const product = await prisma.product.findFirst({
            where: { skuCode: 'L20068' },
            include: {
                stockLots: {
                    include: {
                        location: {
                            include: { warehouse: true }
                        }
                    }
                }
            }
        });

        console.log('=== THÔNG TIN L20068 SAU CẬP NHẬT ===');
        console.log(`SKU: ${product?.skuCode} | Tên: ${product?.productName}`);
        console.table(product?.stockLots.map(l => ({
            lotNo: l.lotNo,
            wh: l.location.warehouse.name,
            location: l.location.locationCode,
            vintage: l.vintage,
            qtyAvailable: Number(l.qtyAvailable)
        })));

        revalidateCache('transfers');
        revalidateCache('wms');
        revalidateCache('stock');
        revalidateCache('products');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyL20068();
