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

// ISO Country codes mapping
const countryCodes: Record<string, string> = {
    'AUSTRALIA': 'AU',
    'CHILE': 'CL',
    'FRANCE': 'FR',
    'ITALY': 'IT',
    'SPAIN': 'ES',
    'NEW ZEALAND': 'NZ',
    'Ý': 'IT',
    'PHÁP': 'FR',
    'TÂY BAN NHA': 'ES',
    'ÚC': 'AU'
};

async function main() {
    console.log("=== AUDITING PRODUCT MASTER DATA EXCEL ===");
    
    // 1. Fetch current database suppliers and products
    const dbSuppliers = await prisma.supplier.findMany({ select: { id: true, code: true, name: true } });
    const dbProducts = await prisma.product.findMany({ select: { id: true, skuCode: true, productName: true } });
    
    const dbSupplierCodes = new Set(dbSuppliers.map(s => s.code));
    const dbSkus = new Set(dbProducts.map(p => p.skuCode));
    
    // 2. Read Excel
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - Hàng hóa.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log(`Total rows in Excel sheet: ${jsonData.length}`);
    
    const excelSkus = new Set<string>();
    const excelSkuDuplicates: string[] = [];
    const invalidSuppliers: { row: number; code: string; supplierCode: string; name: string }[] = [];
    const invalidCountries: { row: number; code: string; country: string; name: string }[] = [];
    const uniqueProducers = new Set<string>();
    const uniqueCountries = new Set<string>();
    const validRows: any[] = [];
    
    // Start from row 1
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 5) continue;
        
        const code = String(row[0] || '').trim();
        const classification = String(row[1] || '').trim();
        const nccCode = String(row[2] || '').trim();
        const producerName = String(row[3] || '').trim();
        const nameOfWine = String(row[4] || '').trim();
        const country = String(row[5] || '').trim();
        const currency = String(row[6] || '').trim();
        
        if (!code) continue; // Skip empty rows
        
        // 1. Check duplicate SKU in Excel
        if (excelSkus.has(code)) {
            excelSkuDuplicates.push(code);
        } else {
            excelSkus.add(code);
        }
        
        // 2. Check Supplier Code
        if (!dbSupplierCodes.has(nccCode)) {
            invalidSuppliers.push({ row: i + 1, code, supplierCode: nccCode, name: nameOfWine });
        }
        
        // 3. Check Country
        const countryUpper = country.toUpperCase();
        if (!countryCodes[countryUpper]) {
            invalidCountries.push({ row: i + 1, code, country, name: nameOfWine });
        }
        
        if (producerName) uniqueProducers.add(producerName);
        if (country) uniqueCountries.add(country);
        
        validRows.push({
            rowNum: i + 1,
            code,
            classification,
            nccCode,
            producerName,
            nameOfWine,
            country,
            currency
        });
    }

    console.log("\n=== AUDIT RESULTS ===");
    console.log(`Total parsed products: ${validRows.length}`);
    console.log(`Unique SKU codes in Excel: ${excelSkus.size}`);
    
    // 1. Duplicates in Excel
    if (excelSkuDuplicates.length > 0) {
        console.log(`❌ ERROR: Found ${excelSkuDuplicates.length} duplicate SKU codes inside Excel file:`);
        console.log(`   ${Array.from(new Set(excelSkuDuplicates)).join(', ')}`);
    } else {
        console.log("✅ No duplicate SKU codes inside Excel.");
    }
    
    // 2. Duplicates in DB
    const dbSkuCollisions: string[] = [];
    excelSkus.forEach(sku => {
        if (dbSkus.has(sku)) {
            dbSkuCollisions.push(sku);
        }
    });
    if (dbSkuCollisions.length > 0) {
        console.log(`❌ WARNING: ${dbSkuCollisions.length} SKU codes already exist in the database:`);
        console.log(`   ${dbSkuCollisions.join(', ')}`);
    } else {
        console.log("✅ No SKU code collisions with existing database records (0 collisions).");
    }

    // 3. Invalid Suppliers
    if (invalidSuppliers.length > 0) {
        console.log(`❌ ERROR: Found ${invalidSuppliers.length} rows referencing invalid/missing Supplier codes (Mã NCC):`);
        invalidSuppliers.forEach(item => {
            console.log(`   - Row ${item.row}: SKU ${item.code} | Invalid Supplier Code: "${item.supplierCode}" | Wine: "${item.name}"`);
        });
    } else {
        console.log("✅ All supplier codes (Mã NCC) refer to valid active suppliers synced from Excel.");
    }

    // 4. Invalid Countries
    if (invalidCountries.length > 0) {
        console.log(`❌ WARNING: Found ${invalidCountries.length} rows with unmapped country names:`);
        invalidCountries.forEach(item => {
            console.log(`   - Row ${item.row}: SKU ${item.code} | Unmapped Country: "${item.country}" | Wine: "${item.name}"`);
        });
    } else {
        console.log("✅ All country names map cleanly to standard ISO codes.");
    }

    console.log("\n=== MASTER DATA STATS ===");
    console.log(`Total unique Producers (Wine houses): ${uniqueProducers.size}`);
    console.log("Producers found:");
    Array.from(uniqueProducers).sort().forEach(p => console.log(` - ${p}`));
    
    console.log(`\nTotal unique Countries: ${uniqueCountries.size}`);
    console.log("Countries found:", Array.from(uniqueCountries).join(', '));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
