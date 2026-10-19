import { prisma } from '../src/lib/db';
import { revalidateCache } from '../src/lib/cache';

async function alignWarehouseLocations() {
    try {
        console.log('=== SẮP XẾP LẠI TỌA ĐỘ VỊ TRÍ KHO THƯỜNG TÍN GỌN GÀNG, CHUẨN ĐẸP ===');

        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        if (!warehouse) throw new Error('Không tìm thấy Kho Thường Tín');

        // Define clean orderly layout:
        // ZONE A: Khu Pallet Mới (Pallet 1 - 12 + Pallet Cửa)
        // ZONE B: Khu Kho Cũ & Kệ Sắt (Kho cũ Pallet 1 - 14 + Kệ Sắt)

        const locLayouts: { code: string; zone: string; posX: number; posY: number; width: number; height: number }[] = [
            // --- ROW 1 (ZONE A: Pallet 1 - 6) ---
            { code: 'LOC-TT-PALLET-1', zone: 'A', posX: 60, posY: 80, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-2', zone: 'A', posX: 230, posY: 80, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-3', zone: 'A', posX: 400, posY: 80, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-4', zone: 'A', posX: 570, posY: 80, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-5', zone: 'A', posX: 740, posY: 80, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-6', zone: 'A', posX: 910, posY: 80, width: 140, height: 90 },

            // --- ROW 2 (ZONE A: Pallet 7 - 12 + Pallet Cửa) ---
            { code: 'LOC-TT-PALLET-7', zone: 'A', posX: 60, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-8', zone: 'A', posX: 230, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-9', zone: 'A', posX: 400, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-10', zone: 'A', posX: 570, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-11', zone: 'A', posX: 740, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-12', zone: 'A', posX: 910, posY: 210, width: 140, height: 90 },
            { code: 'LOC-TT-PALLET-CUA', zone: 'A', posX: 1080, posY: 210, width: 140, height: 90 },

            // --- ROW 3 (ZONE B: Kho Cũ - Pallet 1 - 7) ---
            { code: 'LOC-TT-KHO-CU-PALLET-1', zone: 'B', posX: 60, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-2', zone: 'B', posX: 230, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-3', zone: 'B', posX: 400, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-4', zone: 'B', posX: 570, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-5', zone: 'B', posX: 740, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-6', zone: 'B', posX: 910, posY: 400, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-7', zone: 'B', posX: 1080, posY: 400, width: 140, height: 90 },

            // --- ROW 4 (ZONE B: Kho Cũ - Pallet 8 - 14 + Kệ Sắt) ---
            { code: 'LOC-TT-KHO-CU-PALLET-8', zone: 'B', posX: 60, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-9', zone: 'B', posX: 230, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-10', zone: 'B', posX: 400, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-11', zone: 'B', posX: 570, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-12', zone: 'B', posX: 740, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-13', zone: 'B', posX: 910, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-PALLET-14', zone: 'B', posX: 1080, posY: 530, width: 140, height: 90 },
            { code: 'LOC-TT-KHO-CU-KE-SAT', zone: 'B', posX: 1250, posY: 530, width: 140, height: 90 },
        ];

        for (const item of locLayouts) {
            await prisma.location.updateMany({
                where: { warehouseId: warehouse.id, locationCode: item.code },
                data: {
                    zone: item.zone,
                    posX: item.posX,
                    posY: item.posY,
                    width: item.width,
                    height: item.height,
                    capacityCases: 50
                }
            });
        }

        // Clean up LOC-TT-MAIN if unused
        await prisma.location.deleteMany({
            where: { warehouseId: warehouse.id, locationCode: 'LOC-TT-MAIN', stockLots: { none: {} } }
        });

        // Set clean architectural layout boundaries (width: 1460, height: 680)
        const layoutConfig = {
            boundary: { width: 1460, height: 680 },
            walls: [
                // Dividing wall between ZONE A and ZONE B
                { id: 'wall-divider', x1: 40, y1: 340, x2: 1420, y2: 340, thickness: 8 }
            ],
            doors: [
                { id: 'door-main', x: 1150, y: 320, width: 60, rotation: 0 }
            ],
            labels: [
                { id: 'lbl-zone-a', x: 60, y: 55, text: 'KHU VỰC PALLET MỚI (ZONE A)', fontSize: 16 },
                { id: 'lbl-zone-b', x: 60, y: 375, text: 'KHU VỰC KHO CŨ & KỆ SẮT (ZONE B)', fontSize: 16 }
            ]
        };

        await prisma.warehouse.update({
            where: { id: warehouse.id },
            data: { layoutConfig: layoutConfig as any }
        });

        revalidateCache('wms');
        revalidateCache('stock');

        console.log('✅ ĐÃ CẬP NHẬT TỌA ĐỘ VÀ SẮP XẾP SƠ ĐỒ KHO THƯỜNG TÍN THÀNH CÔNG!');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

alignWarehouseLocations();
