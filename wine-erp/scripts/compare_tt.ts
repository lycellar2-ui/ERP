import XLSX from 'xlsx';
import { prisma } from '../src/lib/db';

async function run() {
    try {
        const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
        const wb = XLSX.readFile(filePath);
        console.log('Sheet names:', wb.SheetNames);

        // Sheet 1: TH tồn kho thực tế
        const sheet1 = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const data1: any[][] = XLSX.utils.sheet_to_json(sheet1, { header: 1 });
        
        console.log('Total rows in sheet 1:', data1.length);
        
        // Find header row
        // Usually Row index 1 has: Mã hàng, Tên hàng, Niên vụ, Quy cách, Tổng kiểm
        const excelItems: { sku: string; name: string; vintage: number | null; count: number }[] = [];
        
        for (let i = 2; i < data1.length; i++) {
            const row = data1[i];
            if (!row || !row[0]) continue;
            const sku = String(row[0]).trim();
            if (!sku || sku.toLowerCase().includes('mã') || sku.toLowerCase().includes('tổng')) continue;
            
            const name = row[1] ? String(row[1]).trim() : '';
            const vintage = row[2] ? Number(row[2]) : null;
            const count = row[4] !== undefined && row[4] !== null ? Number(row[4]) : 0;
            
            excelItems.push({ sku, name, vintage, count });
        }

        console.log(`Parsed ${excelItems.length} items from Excel file.`);

        // Find Kho Thường Tín
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

        console.log(`Found warehouse: ${warehouse.name} (${warehouse.code}, ID: ${warehouse.id})`);

        // Fetch stock lots for this warehouse
        // We can query all StockLot in locations belonging to this warehouse
        const stockLots = await prisma.stockLot.findMany({
            where: {
                location: {
                    warehouseId: warehouse.id
                }
            },
            include: {
                product: {
                    select: {
                        skuCode: true,
                        productName: true
                    }
                },
                location: {
                    select: {
                        locationCode: true
                    }
                }
            }
        });

        console.log(`Total stock lot records in DB for Kho TT: ${stockLots.length}`);

        // Aggregate by SKU and Vintage
        const dbStockMap = new Map<string, { sku: string; name: string; vintage: number | null; qtyOnHand: number; qtyAvailable: number; qtyReserved: number }>();

        for (const lot of stockLots) {
            const key = `${lot.product.skuCode}_${lot.vintage || 'NO_VINTAGE'}`;
            const existing = dbStockMap.get(key) || {
                sku: lot.product.skuCode,
                name: lot.product.productName,
                vintage: lot.vintage,
                qtyOnHand: 0,
                qtyAvailable: 0,
                qtyReserved: 0
            };

            existing.qtyOnHand += Number(lot.qtyOnHand);
            existing.qtyAvailable += Number(lot.qtyAvailable);
            existing.qtyReserved += Number(lot.qtyReserved);
            dbStockMap.set(key, existing);
        }

        // Also aggregate by SKU only (in case vintage is aggregated in Excel or DB)
        const dbSkuMap = new Map<string, { sku: string; name: string; qtyOnHand: number; qtyAvailable: number; qtyReserved: number }>();
        for (const lot of stockLots) {
            const sku = lot.product.skuCode;
            const existing = dbSkuMap.get(sku) || {
                sku,
                name: lot.product.productName,
                qtyOnHand: 0,
                qtyAvailable: 0,
                qtyReserved: 0
            };
            existing.qtyOnHand += Number(lot.qtyOnHand);
            existing.qtyAvailable += Number(lot.qtyAvailable);
            existing.qtyReserved += Number(lot.qtyReserved);
            dbSkuMap.set(sku, existing);
        }

        const excelSkuMap = new Map<string, { sku: string; name: string; count: number }>();
        for (const item of excelItems) {
            const existing = excelSkuMap.get(item.sku) || {
                sku: item.sku,
                name: item.name,
                count: 0
            };
            existing.count += item.count;
            excelSkuMap.set(item.sku, existing);
        }

        // Compare by SKU
        const allSkus = Array.from(new Set([...Array.from(excelSkuMap.keys()), ...Array.from(dbSkuMap.keys())])).sort();

        const matched: any[] = [];
        const diffs: any[] = [];
        const onlyInExcel: any[] = [];
        const onlyInDb: any[] = [];

        let totalExcelQty = 0;
        let totalDbQty = 0;

        for (const sku of allSkus) {
            const ex = excelSkuMap.get(sku);
            const db = dbSkuMap.get(sku);

            const exQty = ex ? ex.count : 0;
            const dbQty = db ? db.qtyOnHand : 0;

            totalExcelQty += exQty;
            totalDbQty += dbQty;

            const name = ex?.name || db?.name || '';
            const diff = exQty - dbQty;

            if (ex && !db) {
                onlyInExcel.push({ sku, name, excelQty: exQty, dbQty: 0, diff });
            } else if (!ex && db) {
                onlyInDb.push({ sku, name, excelQty: 0, dbQty, diff });
            } else if (diff !== 0) {
                diffs.push({ sku, name, excelQty: exQty, dbQty, diff });
            } else {
                matched.push({ sku, name, excelQty: exQty, dbQty, diff: 0 });
            }
        }

        console.log('=== COMPARISON SUMMARY ===');
        console.log(`Total SKUs in Excel: ${excelSkuMap.size} (Total Bottles: ${totalExcelQty})`);
        console.log(`Total SKUs in DB: ${dbSkuMap.size} (Total Bottles: ${totalDbQty})`);
        console.log(`Total Matched perfectly (diff = 0): ${matched.length}`);
        console.log(`Total Variances (diff != 0): ${diffs.length}`);
        console.log(`Only in Excel: ${onlyInExcel.length}`);
        console.log(`Only in DB: ${onlyInDb.length}`);

        console.log('\n--- DIFFERENCES (Excel vs DB) ---');
        console.table(diffs);

        if (onlyInExcel.length > 0) {
            console.log('\n--- ONLY IN EXCEL ---');
            console.table(onlyInExcel);
        }

        if (onlyInDb.length > 0) {
            console.log('\n--- ONLY IN DB ---');
            console.table(onlyInDb);
        }

    } catch (e) {
        console.error('Error running comparison:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
