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

interface ExcelSupplier {
    code: string
    name: string
    address: string
    country: string
}

async function main() {
    console.log("=== COMPARING SYSTEM SUPPLIERS VS EXCEL ===");
    
    // 1. Read Excel
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - NCC.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const excelSuppliers: ExcelSupplier[] = [];
    // Start from row 1 (row 0 is header)
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 2) continue;
        excelSuppliers.push({
            code: String(row[0] || '').trim(),
            name: String(row[1] || '').trim(),
            address: String(row[2] || '').trim(),
            country: String(row[3] || '').trim()
        });
    }
    console.log(`Loaded ${excelSuppliers.length} suppliers from Excel.\n`);

    // 2. Read DB
    const dbSuppliers = await prisma.supplier.findMany({
        include: {
            addresses: {
                where: { isDefault: true }
            }
        }
    });
    console.log(`Loaded ${dbSuppliers.length} suppliers from database (including soft-deleted).\n`);

    const dbMap = new Map<string, typeof dbSuppliers[0]>();
    dbSuppliers.forEach(s => dbMap.set(s.code, s));

    const report: any[] = [];
    const missingInDB: ExcelSupplier[] = [];

    for (const ex of excelSuppliers) {
        const db = dbMap.get(ex.code);
        if (!db) {
            missingInDB.push(ex);
            report.push({
                code: ex.code,
                nameInExcel: ex.name,
                status: "MISSING IN SYSTEM",
                nameMatches: false,
                addressMatches: false,
                countryMatches: false,
                excelName: ex.name,
                dbName: "N/A",
                excelAddress: ex.address,
                dbAddress: "N/A",
                excelCountry: ex.country,
                dbCountry: "N/A"
            });
            continue;
        }

        const dbAddr = db.addresses[0]?.address || "";
        const dbCountry = db.country; // This is a 2-letter ISO code in DB

        // Resolve 2-letter code or country name
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
        const expectedCountryCode = countryCodes[ex.country.toUpperCase()] || ex.country;

        const nameMatches = db.name.trim() === ex.name.trim();
        const addressMatches = dbAddr.trim() === ex.address.trim();
        const countryMatches = dbCountry === expectedCountryCode;

        report.push({
            code: ex.code,
            nameInExcel: ex.name,
            status: db.deletedAt ? "SOFT-DELETED" : "ACTIVE",
            nameMatches,
            addressMatches,
            countryMatches,
            excelName: ex.name,
            dbName: db.name,
            excelAddress: ex.address,
            dbAddress: dbAddr,
            excelCountry: ex.country,
            dbCountry: dbCountry
        });
    }

    // 3. Print Report
    console.log("=== COMPARISON DETAILS ===");
    let nameMismatches = 0;
    let addressMismatches = 0;
    let countryMismatches = 0;

    report.forEach(r => {
        console.log(`[${r.code}] ${r.nameInExcel}`);
        console.log(`  - Status: ${r.status}`);
        
        if (r.status === "MISSING IN SYSTEM") {
            console.log(`  - CRITICAL: Missing in system!`);
            return;
        }

        if (r.nameMatches) {
            console.log(`  - Name: OK`);
        } else {
            console.log(`  - Name: MISMATCH!`);
            console.log(`    Excel: "${r.excelName}"`);
            console.log(`    System: "${r.dbName}"`);
            nameMismatches++;
        }

        if (r.addressMatches) {
            console.log(`  - Address: OK`);
        } else {
            console.log(`  - Address: MISMATCH!`);
            console.log(`    Excel: "${r.excelAddress}"`);
            console.log(`    System: "${r.dbAddress}"`);
            addressMismatches++;
        }

        if (r.countryMatches) {
            console.log(`  - Country: OK`);
        } else {
            console.log(`  - Country: MISMATCH!`);
            console.log(`    Excel: "${r.excelCountry}" (Expected DB Code: ${r.dbCountry})`);
            countryMismatches++;
        }
        console.log("");
    });

    console.log("=== SUMMARY ===");
    console.log(`Total checked: ${excelSuppliers.length}`);
    console.log(`Missing in System: ${missingInDB.length}`);
    console.log(`Name mismatches: ${nameMismatches}`);
    console.log(`Address mismatches: ${addressMismatches}`);
    console.log(`Country mismatches: ${countryMismatches}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
