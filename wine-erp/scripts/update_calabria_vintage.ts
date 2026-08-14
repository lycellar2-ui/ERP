import { prisma } from '../src/lib/db';
import { revalidateCache } from '../src/lib/cache';

async function updateCalabriaVintages() {
    try {
        console.log('=== CẬP NHẬT VINTAGE CÁC DÒNG RƯỢU CALABRIA ===');

        const calabriaProducts = await prisma.product.findMany({
            where: {
                OR: [
                    { skuCode: { startsWith: 'L400' } },
                    { producer: { name: { contains: 'Calabria', mode: 'insensitive' } } }
                ]
            },
            include: { stockLots: true }
        });

        console.log(`Found ${calabriaProducts.length} Calabria products to update.`);

        let totalLotsUpdated = 0;

        for (const p of calabriaProducts) {
            const isMoscato = p.skuCode.toUpperCase() === 'L40014' || p.productName.toLowerCase().includes('moscato');
            const targetVintage = isMoscato ? 2022 : 2025;

            // 1. Update all StockLots for this product
            const lotUpdate = await prisma.stockLot.updateMany({
                where: { productId: p.id },
                data: { vintage: targetVintage }
            });

            totalLotsUpdated += lotUpdate.count;

            // 2. Update StockCountLines notes if present
            await prisma.stockCountLine.updateMany({
                where: { productId: p.id },
                data: { notes: `Niên vụ ${targetVintage}` }
            });

            console.log(`- ${p.skuCode} | ${p.productName} -> Vintage: ${targetVintage} (${lotUpdate.count} lô hàng đã cập nhật)`);
        }

        revalidateCache('wms');
        revalidateCache('stock');
        revalidateCache('products');

        console.log(`\n✅ CẬP NHẬT THÀNH CÔNG ${totalLotsUpdated} LÔ HÀNG CALABRIA!`);

        // Verify update
        console.log('\n=== KIỂM TRA LẠI DỮ LIỆU SAU CẬP NHẬT ===');
        const updatedLots = await prisma.stockLot.findMany({
            where: { product: { skuCode: { startsWith: 'L400' } } },
            include: {
                product: { select: { skuCode: true, productName: true } },
                location: { include: { warehouse: { select: { name: true } } } }
            },
            orderBy: [{ product: { skuCode: 'asc' } }, { location: { warehouse: { name: 'asc' } } }]
        });

        console.table(updatedLots.map(l => ({
            lotNo: l.lotNo,
            sku: l.product.skuCode,
            name: l.product.productName,
            warehouse: l.location.warehouse.name,
            location: l.location.locationCode,
            vintage: l.vintage,
            qtyAvailable: Number(l.qtyAvailable)
        })));

    } catch (err) {
        console.error('Lỗi khi cập nhật vintage:', err);
    } finally {
        await prisma.$disconnect();
    }
}

updateCalabriaVintages();
