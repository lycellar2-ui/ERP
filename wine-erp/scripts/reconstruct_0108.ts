import XLSX from 'xlsx';
import { prisma } from '../src/lib/db';

async function main() {
    try {
        const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
        const wb = XLSX.readFile(filePath);
        const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Excel counts
        const excelBySku = new Map<string, { sku: string; name: string; totalCount: number; vintage: any }>();
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;
            const sku = String(row[0]).trim();
            if (!sku || sku.toLowerCase().includes('mã') || sku.toLowerCase().includes('tổng')) continue;
            const name = row[1] ? String(row[1]).trim() : '';
            const count = row[4] !== undefined && row[4] !== null ? Number(row[4]) : 0;
            const vintage = row[2];

            const existing = excelBySku.get(sku) || { sku, name, totalCount: 0, vintage };
            existing.totalCount += count;
            excelBySku.set(sku, existing);
        }

        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });

        // Current StockLots in Kho TT
        const stockLots = await prisma.stockLot.findMany({
            where: { location: { warehouseId: warehouse!.id } },
            include: { product: true }
        });

        const currentDbStock = new Map<string, { sku: string; name: string; qtyAvailable: number; qtyReceived: number }>();
        for (const lot of stockLots) {
            const sku = lot.product.skuCode;
            const existing = currentDbStock.get(sku) || { sku, name: lot.product.productName, qtyAvailable: 0, qtyReceived: 0 };
            existing.qtyAvailable += Number(lot.qtyAvailable);
            existing.qtyReceived += Number(lot.qtyReceived);
            currentDbStock.set(sku, existing);
        }

        // Transfers on 13.08
        const transfers = await prisma.transferOrder.findMany({
            where: {
                fromWarehouseId: warehouse!.id,
                status: 'RECEIVED'
            },
            include: {
                lines: {
                    include: { product: true }
                }
            }
        });

        const transferQtyMap = new Map<string, number>();
        for (const t of transfers) {
            for (const l of t.lines) {
                const sku = l.product.skuCode;
                transferQtyMap.set(sku, (transferQtyMap.get(sku) || 0) + Number(l.qtyTransferred));
            }
        }

        // Reconstruct Stock as of 01/08
        // Stock_01_08 = Current_Stock + Outbound_Transfers
        const allSkus = Array.from(new Set([...excelBySku.keys(), ...currentDbStock.keys()])).sort();

        const comparison: any[] = [];
        let totalExcel = 0;
        let totalCurrentDb = 0;
        let totalReconstructed0108 = 0;

        for (const sku of allSkus) {
            const ex = excelBySku.get(sku);
            const db = currentDbStock.get(sku);
            const transferredOut = transferQtyMap.get(sku) || 0;

            const excelQty = ex ? ex.totalCount : 0;
            const currentAvail = db ? db.qtyAvailable : 0;
            const dbAt0108 = currentAvail + transferredOut;

            totalExcel += excelQty;
            totalCurrentDb += currentAvail;
            totalReconstructed0108 += dbAt0108;

            const name = ex?.name || db?.name || '';
            const diff0108 = excelQty - dbAt0108;

            comparison.push({
                sku,
                name,
                excelQty,
                currentDb: currentAvail,
                transferredOut1308: transferredOut,
                reconstructed0108: dbAt0108,
                diff: diff0108,
                status: diff0108 === 0 ? (excelQty > 0 ? 'KHỚP_100%' : 'TỒN_0') : (diff0108 > 0 ? 'DƯ_THỰC_TẾ' : 'HỤT_THỰC_TẾ')
            });
        }

        const exactMatch = comparison.filter(c => c.diff === 0 && c.excelQty > 0);
        const zeroStock = comparison.filter(c => c.diff === 0 && c.excelQty === 0);
        const diffList = comparison.filter(c => c.diff !== 0);

        console.log('\n=============================================================');
        console.log('  BÁO CÁO TỒN KHO THƯỜNG TÍN NGÀY 01.08 (ĐÃ TÍNH CHUYỂN KHO 13.08)');
        console.log('=============================================================');
        console.log(`Tổng số chai theo File Kiểm kê 01.08        : ${totalExcel.toLocaleString('vi-VN')} chai`);
        console.log(`Tổng số chai Tồn hệ thống ngày 01.08 (Quy đổi): ${totalReconstructed0108.toLocaleString('vi-VN')} chai`);
        console.log(`  (Trong đó: Tồn hiện tại = ${totalCurrentDb.toLocaleString('vi-VN')} chai + Đã chuyển đi ngày 13.08 = ${Array.from(transferQtyMap.values()).reduce((a,b)=>a+b, 0)} chai)`);
        console.log(`Chênh lệch thực tế ngày 01.08 (Thực tế - HT) : ${(totalExcel - totalReconstructed0108).toLocaleString('vi-VN')} chai`);
        console.log('-------------------------------------------------------------');
        console.log(`- Số mã KHỚP 100% ngày 01.08                 : ${exactMatch.length} mã`);
        console.log(`- Số mã Tồn = 0 cả 2 bên                      : ${zeroStock.length} mã`);
        console.log(`- Số mã còn chênh lệch                       : ${diffList.length} mã`);

        console.log('\n--- CÁC MÃ ĐƯỢC CHUYỂN KHO NGÀY 13.08 (TO-2608-0001) ---');
        console.table(comparison.filter(c => c.transferredOut1308 > 0));

        console.log('\n--- CÁC MÃ CÒN CHÊNH LỆCH NGÀY 01.08 ---');
        console.table(diffList);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
