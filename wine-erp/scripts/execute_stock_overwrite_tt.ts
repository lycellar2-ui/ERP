import XLSX from 'xlsx';
import { prisma } from '../src/lib/db';
import { revalidateCache } from '../src/lib/cache';

async function executeStockOverwrite() {
    try {
        console.log('=== BẮT ĐẦU GHI ĐÈ DỮ LIỆU TỒN KHO THƯỜNG TÍN NGÀY 01.08.2026 ===');

        const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
        const wb = XLSX.readFile(filePath);
        const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Warehouse Kho Thường Tín
        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        if (!warehouse) throw new Error('Không tìm thấy Kho Thường Tín (WH-TA-TT)');

        // Legal Entity Thắng Ân
        const legalEntity = await prisma.legalEntity.findFirst();
        if (!legalEntity) throw new Error('Không tìm thấy LegalEntity');

        // Ensure all required Locations exist
        const newLocations = [
            { code: 'LOC-TT-PALLET-10', name: 'Pallet 10' },
            { code: 'LOC-TT-PALLET-11', name: 'Pallet 11' },
            { code: 'LOC-TT-PALLET-12', name: 'Pallet 12' }
        ];
        for (const locItem of newLocations) {
            const loc = await prisma.location.findFirst({
                where: { warehouseId: warehouse.id, locationCode: locItem.code }
            });
            if (!loc) {
                await prisma.location.create({
                    data: {
                        warehouseId: warehouse.id,
                        zone: 'ZONE-A',
                        locationCode: locItem.code,
                        type: 'STORAGE',
                        tempControlled: true
                    }
                });
                console.log(`Created location: ${locItem.code}`);
            }
        }

        // Fetch all locations for warehouse
        const allLocations = await prisma.location.findMany({
            where: { warehouseId: warehouse.id }
        });
        const locMapByCode = new Map(allLocations.map(l => [l.locationCode, l]));

        // Helper to normalize header to location code
        function getLocCode(rawHeader: string): string | null {
            if (!rawHeader) return null;
            const h = rawHeader.trim();
            if (h === 'Pallet 1') return 'LOC-TT-PALLET-1';
            if (h === 'Pallet 2') return 'LOC-TT-PALLET-2';
            if (h === 'Pallet 3') return 'LOC-TT-PALLET-3';
            if (h === 'Pallet cửa') return 'LOC-TT-PALLET-CUA';
            if (h === 'Pallet 4') return 'LOC-TT-PALLET-4';
            if (h === 'Pallet 5') return 'LOC-TT-PALLET-5';
            if (h === 'Pallet 6') return 'LOC-TT-PALLET-6';
            if (h === 'Pallet 7') return 'LOC-TT-PALLET-7';
            if (h === 'Pallet 8') return 'LOC-TT-PALLET-8';
            if (h === 'Pallet 9') return 'LOC-TT-PALLET-9';
            if (h === 'Pallet 10') return 'LOC-TT-PALLET-10';
            if (h === 'Pallet 11') return 'LOC-TT-PALLET-11';
            if (h === 'Pallet 12') return 'LOC-TT-PALLET-12';
            if (h === 'Kho cũ - Pallet 1') return 'LOC-TT-KHO-CU-PALLET-1';
            if (h === 'Kho cũ - Pallet 2') return 'LOC-TT-KHO-CU-PALLET-2';
            if (h === 'Kho cũ - Pallet 3') return 'LOC-TT-KHO-CU-PALLET-3';
            if (h === 'Kho cũ - Pallet 4') return 'LOC-TT-KHO-CU-PALLET-4';
            if (h === 'Kho cũ - Pallet 5') return 'LOC-TT-KHO-CU-PALLET-5';
            if (h === 'Kho cũ - Pallet 6') return 'LOC-TT-KHO-CU-PALLET-6';
            if (h === 'Kho cũ - Pallet 7') return 'LOC-TT-KHO-CU-PALLET-7';
            if (h === 'Kho cũ - Pallet 8') return 'LOC-TT-KHO-CU-PALLET-8';
            if (h === 'Kho cũ - Pallet 9') return 'LOC-TT-KHO-CU-PALLET-9';
            if (h === 'Kho cũ - Pallet 10') return 'LOC-TT-KHO-CU-PALLET-10';
            if (h === 'Kho cũ - Pallet 11') return 'LOC-TT-KHO-CU-PALLET-11';
            if (h === 'Kho cũ - Pallet 12') return 'LOC-TT-KHO-CU-PALLET-12';
            if (h === 'Kho cũ - Pallet 13') return 'LOC-TT-KHO-CU-PALLET-13';
            if (h === 'Kho cũ - Pallet 14') return 'LOC-TT-KHO-CU-PALLET-14';
            if (h === 'Kho cũ - Kệ sắt') return 'LOC-TT-KHO-CU-KE-SAT';
            return null;
        }

        const headerRow = data[0];

        // Build pallet column map
        const palletColMap: { colThung: number; colChai: number; locCode: string; name: string }[] = [];
        for (let col = 5; col < headerRow.length; col += 2) {
            const h = headerRow[col];
            if (h) {
                const locCode = getLocCode(h);
                if (locCode) {
                    palletColMap.push({
                        colThung: col,
                        colChai: col + 1,
                        locCode,
                        name: h
                    });
                }
            }
        }

        console.log(`Mapped ${palletColMap.length} Pallet columns in Excel.`);

        // Fetch all products
        const allProducts = await prisma.product.findMany();
        const productMapBySku = new Map(allProducts.map(p => [p.skuCode.toUpperCase(), p]));

        // Get average unit cost from existing lots or ProductMarginPrice
        const marginPrices = await prisma.productMarginPrice.findMany();
        const marginMap = new Map(marginPrices.map(m => [m.skuCode.toUpperCase(), Number(m.costPrice)]));

        // Transfer order reductions from 13.08 (TO-2608-0001)
        const transferReductions = new Map<string, number>();
        transferReductions.set('L40006_LOC-TT-KHO-CU-PALLET-8', 30);
        transferReductions.set('L20017_LOC-TT-PALLET-CUA', 30);
        transferReductions.set('L10007_LOC-TT-PALLET-4', 24);
        transferReductions.set('L20063_LOC-TT-KHO-CU-PALLET-12', 18);
        transferReductions.set('L20019_LOC-TT-PALLET-6', 18);

        // Prepare lot records
        interface NewLotData {
            sku: string;
            productId: string;
            locationId: string;
            locationCode: string;
            vintage: number | null;
            qtyReceived0108: number;
            qtyAvailableCurrent: number;
            unitCost: number;
        }

        const newLots: NewLotData[] = [];
        let totalReceived0108 = 0;
        let totalAvailableCurrent = 0;

        for (let r = 2; r < data.length; r++) {
            const row = data[r];
            if (!row || !row[0]) continue;
            const rawSku = String(row[0]).trim().toUpperCase();
            if (!rawSku || rawSku.includes('MÃ') || rawSku.includes('TỔNG')) continue;

            const product = productMapBySku.get(rawSku);
            if (!product) {
                console.warn(`Product SKU ${rawSku} not found in database!`);
                continue;
            }

            const vintage = row[2] ? Number(row[2]) : null;
            const packSize = row[3] ? Number(row[3]) : 6;
            const cost = marginMap.get(rawSku) || 0;

            for (const p of palletColMap) {
                const thungVal = row[p.colThung] !== undefined && row[p.colThung] !== null ? Number(row[p.colThung]) : 0;
                const chaiVal = row[p.colChai] !== undefined && row[p.colChai] !== null ? Number(row[p.colChai]) : 0;

                let qtyBottles = chaiVal;
                if (qtyBottles === 0 && thungVal > 0) {
                    qtyBottles = thungVal * packSize;
                }

                if (qtyBottles > 0) {
                    const loc = locMapByCode.get(p.locCode);
                    if (!loc) {
                        console.error(`Location ${p.locCode} not found in DB!`);
                        continue;
                    }

                    const reductionKey = `${rawSku}_${p.locCode}`;
                    const reduction = transferReductions.get(reductionKey) || 0;
                    const qtyAvail = Math.max(0, qtyBottles - reduction);

                    totalReceived0108 += qtyBottles;
                    totalAvailableCurrent += qtyAvail;

                    newLots.push({
                        sku: rawSku,
                        productId: product.id,
                        locationId: loc.id,
                        locationCode: p.locCode,
                        vintage,
                        qtyReceived0108: qtyBottles,
                        qtyAvailableCurrent: qtyAvail,
                        unitCost: cost
                    });
                }
            }
        }

        console.log(`\n=== TỔNG HỢP DỮ LIỆU GHI ĐÈ ===`);
        console.log(`Tổng số Lô hàng (StockLot) sẽ tạo: ${newLots.length} lô`);
        console.log(`Tổng số chai tồn ngày 01.08 (qtyReceived): ${totalReceived0108.toLocaleString('vi-VN')} chai`);
        console.log(`Tổng số chai khả dụng hiện tại sau chuyển kho (qtyAvailable): ${totalAvailableCurrent.toLocaleString('vi-VN')} chai`);

        // Execute Transaction with 60s timeout
        await prisma.$transaction(async (tx) => {
            // 1. Delete existing StockLots in Kho Thường Tín
            const deletedLots = await tx.stockLot.deleteMany({
                where: {
                    location: {
                        warehouseId: warehouse.id
                    }
                }
            });
            console.log(`Deleted ${deletedLots.count} old StockLots in Kho Thường Tín.`);

            // 2. Insert new StockLots in batch using createMany
            const lotsToCreate = newLots.map((lot, i) => ({
                lotNo: `LOT-TT-20260801-${lot.sku}-${String(i + 1).padStart(3, '0')}`,
                ownerEntityId: legalEntity.id,
                productId: lot.productId,
                locationId: lot.locationId,
                qtyReceived: lot.qtyReceived0108,
                qtyAvailable: lot.qtyAvailableCurrent,
                unitLandedCost: lot.unitCost,
                receivedDate: new Date('2026-08-01T00:00:00.000Z'),
                vintage: lot.vintage,
                status: 'AVAILABLE' as const
            }));

            await tx.stockLot.createMany({
                data: lotsToCreate
            });
            console.log(`Created ${lotsToCreate.length} new StockLots in database.`);

            // 3. Create or update StockCountSession
            const sessionNo = 'KK-TT-20260801-001';
            const session = await tx.stockCountSession.upsert({
                where: { sessionNo },
                update: {
                    title: 'Kiểm kê định kỳ Kho Thường Tín ngày 01.08.2026',
                    status: 'COMPLETED',
                    completedAt: new Date('2026-08-01T17:00:00.000Z')
                },
                create: {
                    sessionNo,
                    title: 'Kiểm kê định kỳ Kho Thường Tín ngày 01.08.2026',
                    warehouseId: warehouse.id,
                    type: 'FULL',
                    scopeType: 'FULL_WAREHOUSE',
                    status: 'COMPLETED',
                    startedAt: new Date('2026-08-01T08:00:00.000Z'),
                    completedAt: new Date('2026-08-01T17:00:00.000Z'),
                    notes: 'Đồng bộ từ file Tồn kho TT 1.8.xlsx'
                }
            });

            // Insert stock count lines
            await tx.stockCountLine.deleteMany({ where: { sessionId: session.id } });
            const countLinesToCreate = newLots.map(lot => ({
                sessionId: session.id,
                productId: lot.productId,
                locationId: lot.locationId,
                locationCode: lot.locationCode,
                qtySystem: lot.qtyReceived0108,
                qtyActual: lot.qtyReceived0108,
                variance: 0,
                countedAt: new Date('2026-08-01T17:00:00.000Z'),
                notes: `Niên vụ ${lot.vintage || 'NV'}`
            }));

            await tx.stockCountLine.createMany({
                data: countLinesToCreate
            });
            console.log(`Created ${countLinesToCreate.length} StockCountLines in session.`);

            // 4. Log Audit
            await tx.auditLog.create({
                data: {
                    action: 'UPDATE',
                    entityType: 'WarehouseStock',
                    entityId: warehouse.id,
                    newValue: {
                        message: 'Ghi đè tồn kho Thường Tín từ file Tồn kho TT 1.8.xlsx ngày 01.08.2026',
                        totalLots: newLots.length,
                        totalBottles0108: totalReceived0108,
                        totalBottlesCurrent: totalAvailableCurrent
                    }
                }
            });
        }, {
            timeout: 60000,
            maxWait: 10000
        });

        revalidateCache('wms');
        revalidateCache('stock');
        console.log('\n✅ GHI ĐÈ THÀNH CÔNG TOÀN BỘ DỮ LIỆU TỒN KHO THƯỜNG TÍN!');

    } catch (err) {
        console.error('Lỗi khi ghi đè:', err);
    } finally {
        await prisma.$disconnect();
    }
}

executeStockOverwrite();
