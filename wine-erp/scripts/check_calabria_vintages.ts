import { prisma } from '../src/lib/db';

async function checkCalabriaVintages() {
    try {
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { skuCode: { startsWith: 'L400' } },
                    { producer: { name: { contains: 'Calabria', mode: 'insensitive' } } }
                ]
            },
            include: {
                producer: true,
                stockLots: {
                    include: {
                        location: {
                            include: { warehouse: true }
                        }
                    }
                }
            },
            orderBy: { skuCode: 'asc' }
        });

        console.log(`Found ${products.length} Calabria products:`);
        for (const p of products) {
            console.log(`\nProduct: ${p.skuCode} | ${p.productName} (Producer: ${p.producer?.name})`);
            console.table(p.stockLots.map(l => ({
                lotNo: l.lotNo,
                warehouse: l.location.warehouse.name,
                location: l.location.locationCode,
                vintage: l.vintage,
                qtyAvailable: Number(l.qtyAvailable)
            })));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkCalabriaVintages();
