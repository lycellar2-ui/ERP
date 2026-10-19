import { prisma } from '../src/lib/db';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function checkL400() {
    try {
        console.log('=== 1. ALL L400 PRODUCTS IN DB ===');
        const products = await prisma.product.findMany({
            where: { skuCode: { startsWith: 'L400' } },
            include: {
                stockLots: {
                    include: {
                        location: {
                            include: { warehouse: true }
                        }
                    }
                },
                grLines: {
                    include: {
                        gr: {
                            include: { warehouse: true }
                        }
                    }
                }
            },
            orderBy: { skuCode: 'asc' }
        });

        console.log(`Found ${products.length} L400 products in DB:`);
        for (const p of products) {
            const totalStock = p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0);
            const lotBreakdown = p.stockLots.map(l => `${l.location.warehouse.code}(${l.location.locationCode}): ${Number(l.qtyAvailable)}`).join(', ');
            console.log(`- ${p.skuCode} | ${p.productName} | Total Stock: ${totalStock} chai | Lots: [${lotBreakdown || 'NO_STOCK'}]`);
        }

        console.log('\n=== 2. CHECKING ALL EXCEL FILES IN D:\\Lyscellar\\Kế toán\\Kiểm kê FOR L400 ===');
        const dir = 'D:/Lyscellar/Kế toán/Kiểm kê';
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
        
        for (const f of files) {
            const fullPath = path.join(dir, f);
            try {
                const wb = XLSX.readFile(fullPath);
                console.log(`\nFile: "${f}" (Sheets: ${wb.SheetNames.join(', ')})`);
                for (const sname of wb.SheetNames) {
                    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sname], { header: 1 });
                    const l400Rows = rows.filter(r => r && r[0] && String(r[0]).trim().startsWith('L400'));
                    if (l400Rows.length > 0) {
                        console.log(`  -> Sheet "${sname}" has ${l400Rows.length} L400 rows:`);
                        for (const r of l400Rows) {
                            console.log(`     SKU: ${r[0]} | Name: ${r[1]} | Vintage: ${r[2]} | Col4: ${r[4]} | Row: ${JSON.stringify(r.slice(0, 8))}`);
                        }
                    }
                }
            } catch (e: any) {
                console.log(`  -> Error reading ${f}: ${e.message}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkL400();
