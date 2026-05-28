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
    console.log("🍷 Starting synchronization of Warehouse Addresses from Contract Tracking Excel...");
    
    // 1. Fetch DB suppliers
    const dbSuppliers = await prisma.supplier.findMany({
        select: { id: true, code: true, name: true, country: true }
    });
    console.log(`Loaded ${dbSuppliers.length} active suppliers from DB.`);

    const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dbMap = new Map<string, typeof dbSuppliers[0]>();
    dbSuppliers.forEach(s => dbMap.set(normalize(s.name), s));

    // Special manual mappings for domain mismatches between brand names and legal entity names
    // Keys must be fully normalized (alphanumeric only, lowercase)
    const manualMappings: Record<string, string> = {
        'vinasanestebaninsitu': 'vinasanestebansa',
        'domainedelasolitude': 'sasfamillelancon',
        'pardonfils': 'pardonetfils',
        'allanscott': 'provincialvineyardslimited'
    };

    // 2. Read Contract Excel
    const excelPath = "D:\\Lyscellar\\Hợp đồng NCC\\Theo dõi HỢP ĐỒNG NƯỚC NGOÀI - 2026.xlsx";
    console.log(`Reading Excel file from: ${excelPath}`);
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
    console.log(`Parsed ${excelRows.length} contract entries from sheet.\n`);

    // 3. Delete existing non-default warehouse addresses to prevent duplicates
    console.log("Cleaning up existing non-default Warehouse addresses...");
    const deletedAddresses = await prisma.supplierAddress.deleteMany({
        where: {
            label: 'Warehouse',
            isDefault: false
        }
    });
    console.log(`- Deleted ${deletedAddresses.count} existing Warehouse addresses.\n`);

    // 4. Sync Warehouse addresses
    console.log("Importing warehouse addresses...");
    let addedCount = 0;

    for (const row of excelRows) {
        const rawName = row.supplierName;
        const normName = normalize(rawName);
        
        let matchedSupplier = dbMap.get(normName);

        // Try manual mapping
        if (!matchedSupplier && manualMappings[normName]) {
            matchedSupplier = dbMap.get(manualMappings[normName]);
        }

        // Substring matching as secondary fallback
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
            // Validate address is real
            if (addr && addr !== '—' && addr !== '-' && addr !== 'NA' && addr !== ' ' && addr !== 'undefined') {
                // Check if this address already exists for this supplier
                const existing = await prisma.supplierAddress.findFirst({
                    where: {
                        supplierId: matchedSupplier.id,
                        address: addr
                    }
                });

                if (!existing) {
                    await prisma.supplierAddress.create({
                        data: {
                            supplierId: matchedSupplier.id,
                            label: 'Warehouse',
                            address: addr,
                            city: row.region || null,
                            country: matchedSupplier.country,
                            isDefault: false,
                        }
                    });
                    console.log(`✓ Added Warehouse for [${matchedSupplier.code}] ${matchedSupplier.name}: "${addr}"`);
                    addedCount++;
                }
            }
        } else {
            console.log(`⚠️ Unmatched supplier from Excel: "${rawName}"`);
        }
    }

    console.log(`\n🎉 Warehouse Address Sync Completed Successfully! Added ${addedCount} warehouse addresses.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
