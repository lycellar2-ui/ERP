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

// Country code mapping (ISO 2-letter codes)
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

// Currencies mapping based on country ISO code
const countryCurrencies: Record<string, string> = {
    'AU': 'AUD',
    'CL': 'USD',
    'FR': 'EUR',
    'IT': 'EUR',
    'ES': 'EUR',
    'NZ': 'NZD'
};

// Official website mappings
const supplierWebsites: Record<string, string> = {
    'berton': 'https://www.bertonvineyards.com.au',
    'san esteban': 'https://www.insitu.cl',
    'in situ': 'https://www.insitu.cl',
    'maison bouey': 'https://www.maisonbouey.fr',
    'tour blanche': 'https://famille-klack.fr',
    'solitude': 'https://www.domaine-solitude.com',
    'lancon': 'https://www.domaine-solitude.com',
    'pardon': 'https://www.pardonetfils.com',
    'meteore': 'https://www.domainedumeteore.com',
    'lorgeril': 'https://www.lorgeril.wine',
    'dvp': 'https://www.delaunay.vin',
    'perriere': 'https://www.sagetlaperriere.com',
    'saget': 'https://www.sagetlaperriere.com',
    'collis': 'https://www.collisheritage.com',
    'collavini': 'https://www.collavini.it',
    'ethica': 'https://www.ethicawines.com',
    'la jara': 'https://www.lajara.it',
    'allan scott': 'https://www.allanscott.com',
    'provincial': 'https://www.allanscott.com',
    'cavas': 'https://www.cavas.es',
    'paniza': 'https://www.docava.es',
    'bodegas': 'https://www.docava.es',
    'buccia nera': 'https://www.buccianera.it',
    'plaimont': 'https://www.plaimont.com',
    'calabria': 'https://www.calabriafamilywines.com.au',
    'bourceau': 'https://www.vignobles-bourceau.com',
    'linshank': 'https://www.linshank.com'
};

interface ExcelSupplier {
    code: string
    name: string
    address: string
    country: string
}

async function main() {
    console.log("🍷 Starting synchronization of Supplier master data with Excel...");
    
    // 1. Read Excel
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - NCC.xlsx";
    console.log(`Reading Excel file from: ${excelPath}`);
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
    console.log(`Successfully parsed ${excelSuppliers.length} suppliers from Excel.\n`);

    // 2. Clear Existing Tables Safely
    console.log("Clearing existing database tables...");
    
    const countContactsDeleted = await prisma.supplierContact.deleteMany({});
    console.log(`- Deleted ${countContactsDeleted.count} old supplier contacts.`);
    
    const countAddressesDeleted = await prisma.supplierAddress.deleteMany({});
    console.log(`- Deleted ${countAddressesDeleted.count} old supplier addresses.`);
    
    const countActivitiesDeleted = await prisma.supplierActivity.deleteMany({});
    console.log(`- Deleted ${countActivitiesDeleted.count} old supplier activities.`);
    
    const countSuppliersDeleted = await prisma.supplier.deleteMany({});
    console.log(`- Deleted ${countSuppliersDeleted.count} old suppliers.\n`);

    // 3. Import new master data
    console.log("Importing new suppliers and primary addresses...");
    let successCount = 0;

    for (const ex of excelSuppliers) {
        // Resolve country code
        const rawCountryUpper = ex.country.toUpperCase();
        const countryCode = countryCodes[rawCountryUpper] || 'FR'; // Fallback to FR
        const currency = countryCurrencies[countryCode] || 'EUR';

        // Resolve supplier type (default to WINERY, except Maison Bouey & DVP which are NEGOCIANT)
        const nameLower = ex.name.toLowerCase();
        let type = 'WINERY';
        if (nameLower.includes('maison bouey') || nameLower.includes('dvp') || nameLower.includes('domaines et vins de propriete')) {
            type = 'NEGOCIANT';
        }

        // Resolve website
        let website: string | null = null;
        for (const [key, webUrl] of Object.entries(supplierWebsites)) {
            if (nameLower.includes(key)) {
                website = webUrl;
                break;
            }
        }

        // Create Supplier
        const supplier = await prisma.supplier.create({
            data: {
                code: ex.code,
                name: ex.name,
                type: type as any,
                country: countryCode,
                defaultCurrency: currency,
                website: website,
                status: 'ACTIVE',
            }
        });

        // Create Address
        await prisma.supplierAddress.create({
            data: {
                supplierId: supplier.id,
                label: 'Trụ sở chính',
                address: ex.address,
                country: countryCode,
                isDefault: true,
            }
        });

        console.log(`✓ Synchronized: ${ex.code} - ${ex.name} | Country: ${countryCode} | Currency: ${currency} | Type: ${type}`);
        successCount++;
    }

    console.log(`\n🎉 Synchronization Completed Successfully! ${successCount} suppliers imported.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
