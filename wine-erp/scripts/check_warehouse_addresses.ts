import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as XLSX from 'xlsx'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface ExcelContractRow {
    country: string
    region: string
    supplierName: string
    pickupAddress: string
}

async function main() {
    console.log("=== CHECKING WAREHOUSE ADDRESSES FROM CONTRACT EXCEL ===");
    
    // 1. Fetch DB suppliers
    const dbSuppliers = await prisma.supplier.findMany({
        select: { id: true, code: true, name: true, country: true }
    });
    console.log(`Loaded ${dbSuppliers.length} active suppliers from DB.`);

    const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dbMap = new Map<string, typeof dbSuppliers[0]>();
    dbSuppliers.forEach(s => dbMap.set(normalize(s.name), s));

    // 2. Read Contract Excel
    const excelPath = "D:\\Lyscellar\\Hợp đồng NCC\\Theo dõi HỢP ĐỒNG NƯỚC NGOÀI - 2026.xlsx";
    console.log(`Reading Contract Excel: ${excelPath}`);
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets['TỔNG HỢP THÔNG TIN'];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const excelRows: ExcelContractRow[] = [];
    for (let r = 2; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || row.length === 0) continue;
        
        const supplierName = String(row[3] || '').trim();
        const pickupAddress = String(row[15] || '').trim();
        
        if (!supplierName) continue;
        
        excelRows.push({
            country: String(row[1] || '').trim(),
            region: String(row[2] || '').trim(),
            supplierName,
            pickupAddress
        });
    }
    console.log(`Found ${excelRows.length} entries in sheet.\n`);

    // 3. Match and display what addresses we find
    const foundAddresses: { supplierCode: string; dbName: string; excelName: string; pickupAddress: string; countryCode: string }[] = [];
    const unmatched: string[] = [];

    for (const row of excelRows) {
        const normName = normalize(row.supplierName);
        let matchedSupplier = dbMap.get(normName);

        // Substring / fuzzy match
        if (!matchedSupplier) {
            for (const [dbNorm, dbSup] of dbMap.entries()) {
                if (dbNorm.includes(normName) || normName.includes(dbNorm)) {
                    matchedSupplier = dbSup;
                    break;
                }
            }
        }

        if (matchedSupplier) {
            const addr = row.pickupAddress;
            // Clean up placeholders
            if (addr && addr !== '—' && addr !== '-' && addr !== 'NA' && addr !== ' ' && addr !== 'undefined') {
                foundAddresses.push({
                    supplierCode: matchedSupplier.code,
                    dbName: matchedSupplier.name,
                    excelName: row.supplierName,
                    pickupAddress: addr,
                    countryCode: matchedSupplier.country
                });
            }
        } else {
            unmatched.push(row.supplierName);
        }
    }

    console.log(`=== MATCHED WAREHOUSE ADDRESSES FOUND: ${foundAddresses.length} ===`);
    foundAddresses.forEach((item, idx) => {
        console.log(`[${idx+1}] Code: ${item.supplierCode} | Name: ${item.dbName}`);
        console.log(`    Excel Supplier Name: "${item.excelName}"`);
        console.log(`    Warehouse Address: "${item.pickupAddress}"`);
    });

    if (unmatched.length > 0) {
        console.log(`\nUnmatched excel suppliers: ${Array.from(new Set(unmatched)).join(', ')}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
