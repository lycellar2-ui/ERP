import { prisma } from '../src/lib/db';

async function checkLocationCoords() {
    try {
        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        const locs = await prisma.location.findMany({
            where: { warehouseId: warehouse!.id },
            include: {
                stockLots: true
            },
            orderBy: { locationCode: 'asc' }
        });

        console.log(`=== LOCATIONS FOR KHO THƯỜNG TÍN (${locs.length} locations) ===`);
        console.table(locs.map(l => ({
            code: l.locationCode,
            zone: l.zone,
            posX: l.posX,
            posY: l.posY,
            width: l.width,
            height: l.height,
            lotsCount: l.stockLots.length,
            totalBottles: l.stockLots.reduce((s, lot) => s + Number(lot.qtyAvailable), 0)
        })));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkLocationCoords();
