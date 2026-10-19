import XLSX from 'xlsx';
import fs from 'fs';
import { prisma } from '../src/lib/db';

async function generateReport() {
    try {
        const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
        const wb = XLSX.readFile(filePath);
        const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const excelBySku = new Map<string, { sku: string; name: string; totalCount: number; vintages: { vintage: any; count: number }[] }>();
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[0]) continue;
            const sku = String(row[0]).trim();
            if (!sku || sku.toLowerCase().includes('mã') || sku.toLowerCase().includes('tổng')) continue;
            const name = row[1] ? String(row[1]).trim() : '';
            const count = row[4] !== undefined && row[4] !== null ? Number(row[4]) : 0;
            const vintage = row[2] || null;

            const existing = excelBySku.get(sku) || { sku, name, totalCount: 0, vintages: [] };
            existing.totalCount += count;
            existing.vintages.push({ vintage, count });
            excelBySku.set(sku, existing);
        }

        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        const stockLots = await prisma.stockLot.findMany({
            where: { location: { warehouseId: warehouse!.id } },
            include: { product: true, location: true }
        });

        const dbBySku = new Map<string, { sku: string; name: string; qtyAvailable: number; qtyReceived: number; lots: any[] }>();
        for (const lot of stockLots) {
            const sku = lot.product.skuCode;
            const existing = dbBySku.get(sku) || { sku, name: lot.product.productName, qtyAvailable: 0, qtyReceived: 0, lots: [] };
            const avail = Number(lot.qtyAvailable);
            const recv = Number(lot.qtyReceived);
            existing.qtyAvailable += avail;
            existing.qtyReceived += recv;
            existing.lots.push({ lotNo: lot.lotNo, location: lot.location.locationCode, vintage: lot.vintage, qtyAvailable: avail });
            dbBySku.set(sku, existing);
        }

        const allSkus = Array.from(new Set([...excelBySku.keys(), ...dbBySku.keys()])).sort();
        
        const report = {
            warehouse: {
                code: warehouse!.code,
                name: warehouse!.name
            },
            summary: {
                totalSkusInExcel: excelBySku.size,
                totalSkusInDb: dbBySku.size,
                totalBottlesExcel: 0,
                totalBottlesDbAvailable: 0,
                totalBottlesDbReceived: 0,
                totalVarianceBottles: 0,
                countMatched: 0,
                countDifferences: 0,
                countOnlyInExcel: 0,
                countOnlyInDb: 0,
            },
            differences: [] as any[],
            onlyInExcel: [] as any[],
            onlyInDb: [] as any[],
            matched: [] as any[],
        };

        for (const sku of allSkus) {
            const ex = excelBySku.get(sku);
            const db = dbBySku.get(sku);
            const exQty = ex ? ex.totalCount : 0;
            const dbQty = db ? db.qtyAvailable : 0;
            const name = ex?.name || db?.name || '';
            const diff = exQty - dbQty;

            report.summary.totalBottlesExcel += exQty;
            report.summary.totalBottlesDbAvailable += dbQty;
            report.summary.totalBottlesDbReceived += db ? db.qtyReceived : 0;

            if (ex && !db && exQty > 0) {
                report.summary.countOnlyInExcel++;
                report.onlyInExcel.push({ sku, name, excelQty: exQty, dbQty: 0, diff });
            } else if (!ex && db && dbQty > 0) {
                report.summary.countOnlyInDb++;
                report.onlyInDb.push({ sku, name, excelQty: 0, dbQty, diff });
            } else if (diff !== 0) {
                report.summary.countDifferences++;
                report.differences.push({
                    sku,
                    name,
                    excelQty: exQty,
                    dbQty,
                    diff,
                    type: diff > 0 ? 'DƯ_THỰC_TẾ' : 'HỤT_THỰC_TẾ',
                    excelVintages: ex?.vintages,
                    dbLots: db?.lots
                });
            } else if (exQty > 0) {
                report.summary.countMatched++;
                report.matched.push({ sku, name, qty: exQty });
            }
        }

        report.summary.totalVarianceBottles = report.summary.totalBottlesExcel - report.summary.totalBottlesDbAvailable;

        fs.writeFileSync('D:/Lyruou/inventory_comparison_tt_0108.json', JSON.stringify(report, null, 2), 'utf-8');
        console.log('Successfully wrote D:/Lyruou/inventory_comparison_tt_0108.json');
        console.log(JSON.stringify(report.summary, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

generateReport();
