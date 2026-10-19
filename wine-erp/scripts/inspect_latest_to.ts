import { prisma } from '../src/lib/db';

async function inspectLatestTransferOrder() {
    try {
        const latestTO = await prisma.transferOrder.findFirst({
            orderBy: { createdAt: 'desc' },
            include: {
                fromWarehouse: true,
                toWarehouse: true,
                lines: {
                    include: {
                        product: true
                    }
                }
            }
        });

        console.log('=== LATEST TRANSFER ORDER ===');
        console.log('TO ID:', latestTO?.id);
        console.log('TO Code:', latestTO?.transferNo, (latestTO as any)?.toNo);
        console.log('Status:', latestTO?.status);
        console.log('Created At:', latestTO?.createdAt);
        console.log('Lines count:', latestTO?.lines.length);
        console.log(JSON.stringify(latestTO?.lines, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

inspectLatestTransferOrder();
