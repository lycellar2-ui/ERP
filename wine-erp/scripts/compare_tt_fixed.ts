import XLSX from 'xlsx';
import { prisma } from '../src/lib/db';

async function run() {
    try {
        const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
        const wb = XLSX.readFile(filePath);
        
        console.log('=== READING EXCEL FILE ===');
        const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Parse excel rows
        // Headers at row index 1:
        // Col 0: Mã hàng (SKU)
        // Col 1: Tên hàng (Name)
        // Col 2: Vintage / Niên vụ
        // Col 3: Quy cách
        // Col 4: Tổng kiểm (Actual Count)
        
        const excelRows: {
            sku: string;
            name: string;
            vintage: number | null;
            packSize: number | null;
            count: number;
        }[] = [];

        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;
            const rawSku = String(row[0]).trim();
            if (!rawSku || rawSku.toLowerCase().includes('mã') || rawSku.toLowerCase().includes('tổng')) continue;

            const name = row[1] ? String(row[1]).trim() : '';
            const vintage = row[2] ? Number(row[2]) : null;
            const packSize = row[3] ? Number(row[3]) : null;
            const count = row[4] !== undefined && row[4] !== null ? Number(row[4]) : 0;

            excelRows.push({
                sku: rawSku,
                name,
                vintage,
                packSize,
                count
            });
        }

        console.log(`Parsed ${excelRows.length} rows from Excel sheet.`);

        // Aggregate Excel by SKU
        const excelBySku = new Map<string, {
            sku: string;
            name: string;
            totalCount: number;
            details: { vintage: number | null; count: number }[];
        }>();

        for (const item of excelRows) {
            const existing = excelBySku.get(item.sku) || {
                sku: item.sku,
                name: item.name,
                totalCount: 0,
                details: []
            };
            existing.totalCount += item.count;
            existing.details.push({ vintage: item.vintage, count: item.count });
            excelBySku.set(item.sku, existing);
        }

        // Warehouse WH-TA-TT
        const warehouse = await prisma.warehouse.findFirst({
            where: {
                OR: [
                    { code: 'WH-TA-TT' },
                    { name: { contains: 'Thường Tín' } }
                ]
            }
        });

        if (!warehouse) {
            console.error('Kho Thường Tín not found in database!');
            return;
        }

        console.log(`Warehouse: ${warehouse.name} (${warehouse.code}, ID: ${warehouse.id})`);

        // Fetch current StockLots in Kho TT
        const stockLots = await prisma.stockLot.findMany({
            where: {
                location: {
                    warehouseId: warehouse.id
                }
            },
            include: {
                product: true,
                location: true
            }
        });

        console.log(`Found ${stockLots.length} stock lot records in database for Kho TT.`);

        // Aggregate DB stock by SKU
        const dbBySku = new Map<string, {
            sku: string;
            name: string;
            qtyAvailable: number;
            qtyReceived: number;
            lots: { lotNo: string; location: string; vintage: number | null; qtyAvailable: number; qtyReceived: number }[];
        }>();

        for (const lot of stockLots) {
            const sku = lot.product.skuCode;
            const existing = dbBySku.get(sku) || {
                sku,
                name: lot.product.productName,
                qtyAvailable: 0,
                qtyReceived: 0,
                lots: []
            };
            const avail = Number(lot.qtyAvailable);
            const recv = Number(lot.qtyReceived);

            existing.qtyAvailable += avail;
            existing.qtyReceived += recv;
            existing.lots.push({
                lotNo: lot.lotNo,
                location: lot.location.locationCode,
                vintage: lot.vintage,
                qtyAvailable: avail,
                qtyReceived: recv
            });
            dbBySku.set(sku, existing);
        }

        // Check movements since 2026-08-01
        const aug1 = new Date('2026-08-01T00:00:00Z');
        
        // DO lines from Kho TT created/delivered since Aug 1
        const doLinesSinceAug1 = await prisma.deliveryOrderLine.findMany({
            where: {
                do: {
                    warehouseId: warehouse.id,
                    createdAt: { gte: aug1 }
                }
            },
            include: {
                product: true,
                do: true
            }
        });

        console.log(`DO lines since 2026-08-01: ${doLinesSinceAug1.length}`);

        // GR lines to Kho TT since Aug 1
        const grLinesSinceAug1 = await prisma.goodsReceiptLine.findMany({
            where: {
                gr: {
                    warehouseId: warehouse.id,
                    createdAt: { gte: aug1 }
                }
            },
            include: {
                product: true,
                gr: true
            }
        });

        console.log(`GR lines since 2026-08-01: ${grLinesSinceAug1.length}`);

        // Build comparison table
        const allSkus = Array.from(new Set([...Array.from(excelBySku.keys()), ...Array.from(dbBySku.keys())])).sort();

        interface CompRow {
            sku: string;
            name: string;
            excelCount: number;
            dbAvailable: number;
            dbReceived: number;
            diff: number; // excelCount - dbAvailable
            status: 'KHỚP' | 'THỪA_THỰC_TẾ' | 'THIẾU_THỰC_TẾ' | 'CHỈ_CÓ_TRÊN_EXCEL' | 'CHỈ_CÓ_TRÊN_HỆ_THỐNG';
        }

        const compRows: CompRow[] = [];

        let totalExcelBottles = 0;
        let totalDbAvailableBottles = 0;
        let totalDbReceivedBottles = 0;

        for (const sku of allSkus) {
            const ex = excelBySku.get(sku);
            const db = dbBySku.get(sku);

            const excelCount = ex ? ex.totalCount : 0;
            const dbAvailable = db ? db.qtyAvailable : 0;
            const dbReceived = db ? db.qtyReceived : 0;
            const name = ex?.name || db?.name || '';

            totalExcelBottles += excelCount;
            totalDbAvailableBottles += dbAvailable;
            totalDbReceivedBottles += dbReceived;

            const diff = excelCount - dbAvailable;
            let status: CompRow['status'] = 'KHỚP';

            if (!db && ex) {
                status = 'CHỈ_CÓ_TRÊN_EXCEL';
            } else if (db && !ex) {
                status = 'CHỈ_CÓ_TRÊN_HỆ_THỐNG';
            } else if (diff > 0) {
                status = 'THỪA_THỰC_TẾ';
            } else if (diff < 0) {
                status = 'THIẾU_THỰC_TẾ';
            }

            compRows.push({
                sku,
                name,
                excelCount,
                dbAvailable,
                dbReceived,
                diff,
                status
            });
        }

        const matched = compRows.filter(r => r.diff === 0 && r.excelCount > 0);
        const zeroStockBoth = compRows.filter(r => r.excelCount === 0 && r.dbAvailable === 0);
        const overActual = compRows.filter(r => r.diff > 0 && r.dbAvailable > 0);
        const underActual = compRows.filter(r => r.diff < 0 && r.excelCount > 0);
        const onlyInExcel = compRows.filter(r => r.status === 'CHỈ_CÓ_TRÊN_EXCEL');
        const onlyInDb = compRows.filter(r => r.status === 'CHỈ_CÓ_TRÊN_HỆ_THỐNG');
        const countZeroInExcelHasDb = compRows.filter(r => r.excelCount === 0 && r.dbAvailable > 0);

        console.log('\n======================================================');
        console.log('           BÁO CÁO ĐỐI SOÁT TỒN KHO THƯỜNG TÍN        ');
        console.log('======================================================');
        console.log(`Tổng số mã SKU trong file kiểm kê Excel : ${excelBySku.size}`);
        console.log(`Tổng số lượng chai kiểm kê (File 1.8)   : ${totalExcelBottles.toLocaleString('vi-VN')} chai`);
        console.log(`Tổng số mã SKU có tồn trên hệ thống     : ${dbBySku.size}`);
        console.log(`Tổng số lượng chai tồn hệ thống (Khả dụng): ${totalDbAvailableBottles.toLocaleString('vi-VN')} chai`);
        console.log(`Chênh lệch tổng số lượng (Thực tế - HT) : ${(totalExcelBottles - totalDbAvailableBottles).toLocaleString('vi-VN')} chai`);
        console.log('------------------------------------------------------');
        console.log(`- Khớp 100% (Số lượng > 0)               : ${matched.length} mã`);
        console.log(`- Cả hai bên đều = 0 tồn                : ${zeroStockBoth.length} mã`);
        console.log(`- Thực tế nhiều hơn hệ thống (Dư)        : ${overActual.length} mã`);
        console.log(`- Thực tế ít hơn hệ thống (Hụt)          : ${underActual.length} mã`);
        console.log(`- File Excel kiểm = 0 nhưng Hệ thống còn: ${countZeroInExcelHasDb.length} mã`);
        console.log(`- Mã chỉ có trong File Excel            : ${onlyInExcel.length} mã`);
        console.log(`- Mã chỉ có trên Hệ thống               : ${onlyInDb.length} mã`);

        console.log('\n--- CÁC MÃ CÓ CHÊNH LỆCH (DƯ / HỤT THỰC TẾ) ---');
        const diffList = compRows.filter(r => r.diff !== 0 && (r.excelCount > 0 || r.dbAvailable > 0));
        console.log(JSON.stringify(diffList, null, 2));

        console.log('\n--- DANH SÁCH KHỚP 100% ---');
        console.log(JSON.stringify(matched, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
