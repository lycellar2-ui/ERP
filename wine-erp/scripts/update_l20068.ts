import { prisma } from '../src/lib/db';
import { revalidateCache } from '../src/lib/cache';

async function updateL20068AndTransferOrder() {
    try {
        console.log('=== 1. CẬP NHẬT VINTAGE L20068 THÀNH 2023 ===');

        const product = await prisma.product.findFirst({
            where: { skuCode: 'L20068' }
        });

        if (!product) throw new Error('Không tìm thấy L20068');

        // Update all stock lots of L20068 across all warehouses to vintage 2023
        const updateLots = await prisma.stockLot.updateMany({
            where: { productId: product.id },
            data: { vintage: 2023 }
        });

        console.log(`Đã cập nhật ${updateLots.count} lô hàng của L20068 về Vintage 2023!`);

        // Also update stock count lines notes if any
        await prisma.stockCountLine.updateMany({
            where: { productId: product.id },
            data: { notes: 'Niên vụ 2023' }
        });

        // 2. Update the latest transfer order lines with proper vintages
        console.log('\n=== 2. CẬP NHẬT VINTAGE TRÊN PHIẾU CHUYỂN KHO MỚI TẠO ===');
        const latestTO = await prisma.transferOrder.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { lines: { include: { product: true } } }
        });

        if (latestTO) {
            console.log(`Đơn chuyển kho: ${latestTO.transferNo || (latestTO as any).toNo} (ID: ${latestTO.id})`);
            for (const line of latestTO.lines) {
                let targetVintage: number | null = null;
                const sku = line.product.skuCode.toUpperCase();

                if (sku === 'L20068') {
                    targetVintage = 2023;
                } else if (sku.startsWith('L400')) {
                    targetVintage = sku === 'L40014' ? 2022 : 2025;
                } else if (sku === 'L10007') {
                    // Check if L10007 has vintage in stock lots
                    const lot = await prisma.stockLot.findFirst({
                        where: { productId: line.productId, vintage: { not: null } },
                        select: { vintage: true }
                    });
                    targetVintage = lot?.vintage ?? 2023;
                }

                if (targetVintage) {
                    await prisma.transferOrderLine.update({
                        where: { id: line.id },
                        data: { vintage: targetVintage }
                    });
                    console.log(`  - SKU: ${sku} -> Đã gán Vintage ${targetVintage}`);
                }
            }
        }

        // 3. In `receiveTransferOrder`, ensure `sourceLot?.vintage` is copied to the newly created StockLot
        revalidateCache('transfers');
        revalidateCache('wms');
        revalidateCache('stock');
        revalidateCache('products');

        console.log('\n✅ CẬP NHẬT THÀNH CÔNG!');

        // Check lots again
        const lots = await prisma.stockLot.findMany({
            where: { productId: product.id },
            include: { location: { include: { warehouse: true } } }
        });
        console.table(lots.map(l => ({
            lotNo: l.lotNo,
            wh: l.location.warehouse.name,
            vintage: l.vintage,
            qty: Number(l.qtyAvailable)
        })));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

updateL20068AndTransferOrder();
