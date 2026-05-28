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

// Official website mappings searched for each supplier
const supplierWebsites: Record<string, string> = {
    'Berton Vineyards': 'https://www.bertonvineyards.com.au',
    'Vina San Esteban/In Situ': 'https://www.insitu.cl',
    'Maison Bouey': 'https://www.maisonbouey.fr',
    'Domaine de la Tour Blanche': 'https://famille-klack.fr',
    'Domaine de la Solitude': 'https://www.domaine-solitude.com',
    'Pardon & Fils': 'https://www.pardonetfils.com',
    'Domaine du Meteore': 'https://www.domainedumeteore.com',
    'Lorgeril': 'https://www.lorgeril.wine',
    'DVP': 'https://www.delaunay.vin',
    'La Perriere': 'https://www.sagetlaperriere.com',
    'Collis Heritage': 'https://www.collisheritage.com',
    'Collavini': 'https://www.collavini.it',
    'Ethica Wines': 'https://www.ethicawines.com',
    'La Jara': 'https://www.lajara.it',
    'Allan Scott': 'https://www.allanscott.com',
    'Cavas': 'https://www.cavas.es',
    'Bodegas': 'https://www.docava.es',
    'Società Agricola Semplice Buccia Nera': 'https://www.buccianera.it',
    'Plaimont': 'https://www.plaimont.com',
    'Calabria': 'https://www.calabriafamilywines.com.au'
};

// SupplierType mapping based on domain context
const supplierTypes: Record<string, string> = {
    'Maison Bouey': 'NEGOCIANT',
    'DVP': 'NEGOCIANT',
    'Collis Heritage': 'WINERY',
    'Berton Vineyards': 'WINERY',
    'Vina San Esteban/In Situ': 'WINERY',
    'Domaine de la Tour Blanche': 'WINERY',
    'Domaine de la Solitude': 'WINERY',
    'Pardon & Fils': 'WINERY',
    'Domaine du Meteore': 'WINERY',
    'Lorgeril': 'WINERY',
    'La Perriere': 'WINERY',
    'Collavini': 'WINERY',
    'Ethica Wines': 'WINERY',
    'La Jara': 'WINERY',
    'Allan Scott': 'WINERY',
    'Cavas': 'WINERY',
    'Bodegas': 'WINERY',
    'Società Agricola Semplice Buccia Nera': 'WINERY',
    'Plaimont': 'WINERY',
    'Calabria': 'WINERY'
};

// Currencies mapping based on country
const countryCurrencies: Record<string, string> = {
    'Australia': 'AUD',
    'Chile': 'USD',
    'France': 'EUR',
    'Italy': 'EUR',
    'Tây Ban Nha': 'EUR',
    'Spain': 'EUR',
    'New Zealand': 'NZD'
};

// Country code mapping (ISO 2-letter codes)
const countryCodes: Record<string, string> = {
    'Australia': 'AU',
    'Chile': 'CL',
    'France': 'FR',
    'Italy': 'IT',
    'Tây Ban Nha': 'ES',
    'Spain': 'ES',
    'New Zealand': 'NZ'
};

interface SupplierRawData {
    country: string;
    region: string;
    name: string;
    contractNo: string;
    contractForm: string;
    expirationDate: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    picName: string;
    picPhone: string;
    picEmail: string;
    priceTerm: string;
    pickupPic: string;
    pickupAddress: string;
    discount: string;
    marketingBudget: string;
    payment: string;
}

async function main() {
    console.log('🍷 Starting automatic import of Suppliers from Excel...');
    
    const excelPath = "D:\\Lyscellar\\Hợp đồng NCC\\Theo dõi HỢP ĐỒNG NƯỚC NGOÀI - 2026.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets['TỔNG HỢP THÔNG TIN'];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    // We will collect and group suppliers from rows 2 onwards
    const rawSuppliers: SupplierRawData[] = [];
    
    for (let r = 2; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || row.length === 0) continue;
        
        const supplierName = String(row[3] || '').trim();
        if (!supplierName) continue;
        
        rawSuppliers.push({
            country: String(row[1] || '').trim(),
            region: String(row[2] || '').trim(),
            name: supplierName,
            contractNo: String(row[4] || '').trim(),
            contractForm: String(row[5] || '').trim(),
            expirationDate: String(row[6] || '').trim(),
            companyName: String(row[7] || '').trim(),
            companyAddress: String(row[8] || '').trim(),
            companyPhone: String(row[9] || '').trim(),
            picName: String(row[10] || '').trim(),
            picPhone: String(row[11] || '').trim(),
            picEmail: String(row[12] || '').trim(),
            priceTerm: String(row[13] || '').trim(),
            pickupPic: String(row[14] || '').trim(),
            pickupAddress: String(row[15] || '').trim(),
            discount: String(row[16] || '').trim(),
            marketingBudget: String(row[17] || '').trim(),
            payment: String(row[18] || '').trim(),
        });
    }
    
    console.log(`Parsed ${rawSuppliers.length} supplier entries from sheet.`);

    // Group by supplier name to merge rows (e.g. Maison Bouey)
    const groupedSuppliers: Record<string, SupplierRawData[]> = {};
    for (const entry of rawSuppliers) {
        if (!groupedSuppliers[entry.name]) {
            groupedSuppliers[entry.name] = [];
        }
        groupedSuppliers[entry.name].push(entry);
    }
    
    const uniqueSupplierNames = Object.keys(groupedSuppliers);
    console.log(`Found ${uniqueSupplierNames.length} unique suppliers to sync.`);

    // Query existing suppliers in DB to preserve codes
    const existingSuppliers = await prisma.supplier.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true }
    });
    
    const existingCodeMap = new Map<string, string>(); // normalized_name -> code
    const existingIdMap = new Map<string, string>(); // normalized_name -> id
    
    const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exact or loose match to resolve existing suppliers
    for (const s of existingSuppliers) {
        const dbNorm = normalize(s.name);
        existingCodeMap.set(dbNorm, s.code);
        existingIdMap.set(dbNorm, s.id);
        console.log(`Existing in DB: Code=${s.code} | Name="${s.name}"`);
    }

    let codeSeq = 3; // start generating from NCC003 onwards
    
    for (const name of uniqueSupplierNames) {
        console.log(`\nProcessing: "${name}"`);
        const entries = groupedSuppliers[name];
        const primary = entries[0];
        
        const normalizedName = normalize(name);
        let code: string | undefined;
        let id: string | undefined;
        
        // Smarter loose match by checking if normalized name is a substring or vice versa
        for (const [dbNorm, dbCode] of existingCodeMap.entries()) {
            if (dbNorm.includes(normalizedName) || normalizedName.includes(dbNorm)) {
                code = dbCode;
                id = existingIdMap.get(dbNorm);
                break;
            }
        }
        
        if (!code) {
            // Generate sequential code NCC003, NCC004, etc.
            code = `NCC${String(codeSeq).padStart(3, '0')}`;
            codeSeq++;
            console.log(`-> Generating NEW code: ${code}`);
        } else {
            console.log(`-> Matches EXISTING code in DB: ${code}`);
        }
        
        const country = primary.country || 'France';
        const countryCode = countryCodes[country] || 'FR';
        const currency = countryCurrencies[country] || 'EUR';
        const type = supplierTypes[name] || 'WINERY';
        const website = supplierWebsites[name] || null;
        
        // Consolidate payment terms and incoterms across entries
        const paymentTerm = entries.map(e => e.payment).filter(p => p && p !== '—' && p !== 'NA').join(' / ') || primary.payment || null;
        const incoterms = entries.map(e => e.priceTerm).filter(i => i && i !== '—').join(', ') || primary.priceTerm || null;
        
        // Pickup Info & Port of Loading
        const portOfLoading = primary.pickupAddress && primary.pickupAddress.toLowerCase().includes('port') 
            ? primary.pickupAddress 
            : (primary.pickupPic && primary.pickupPic.toLowerCase().includes('port') ? primary.pickupPic : null);
            
        const pickupInfo = entries.map(e => {
            const parts = [];
            if (e.pickupPic) parts.push(`PIC: ${e.pickupPic}`);
            if (e.pickupAddress) parts.push(`Address: ${e.pickupAddress}`);
            return parts.join(' | ');
        }).filter(x => x).join('\n---\n') || null;

        // Notes
        const notes = `Region: ${primary.region} | Trade Agreement: ${primary.contractNo || 'None'}`;

        // Prepare Contacts
        const contactsToCreate: any[] = [];
        const seenContacts = new Set<string>();
        
        for (const entry of entries) {
            // Main contact
            if (entry.picName && entry.picName !== '-' && !seenContacts.has(entry.picName.toLowerCase())) {
                // Ignore Spain garbage copy-paste PIC "Stace Scollard"
                if ((country === 'Tây Ban Nha' || country === 'Spain') && entry.picName.includes('Stace Scollard')) {
                    continue; // Skip trash data
                }
                contactsToCreate.push({
                    name: entry.picName,
                    title: 'Export Manager',
                    phone: entry.picPhone || null,
                    email: entry.picEmail || null,
                    isPrimary: contactsToCreate.length === 0, // first is primary
                });
                seenContacts.add(entry.picName.toLowerCase());
            }
            
            // Pickup contact
            if (entry.pickupPic && entry.pickupPic !== '-' && !entry.pickupPic.toLowerCase().includes('port') && !seenContacts.has(entry.pickupPic.toLowerCase())) {
                // Parse contact from pickupPic e.g. "Mr. Yafei \r\n +33(0)5 56..."
                const lines = entry.pickupPic.split('\n').map(l => l.trim()).filter(l => l);
                const picName = lines[0];
                const picContactInfo = lines.slice(1).join(' ');
                
                if (picName && !seenContacts.has(picName.toLowerCase())) {
                    contactsToCreate.push({
                        name: picName,
                        title: 'Logistics / Pickup Contact',
                        phone: picContactInfo || null,
                        email: entry.picEmail && entry.picEmail.includes('advexport') ? entry.picEmail : null,
                        isPrimary: false,
                    });
                    seenContacts.add(picName.toLowerCase());
                }
            }
        }

        // Prepare Addresses
        const addressesToCreate: any[] = [];
        const seenAddresses = new Set<string>();
        
        for (const entry of entries) {
            if (entry.companyAddress && entry.companyAddress !== ' ' && !seenAddresses.has(entry.companyAddress.toLowerCase())) {
                addressesToCreate.push({
                    label: addressesToCreate.length === 0 ? 'Headquarter' : 'Office',
                    address: entry.companyAddress,
                    city: primary.region || null,
                    country: country,
                    isDefault: addressesToCreate.length === 0,
                });
                seenAddresses.add(entry.companyAddress.toLowerCase());
            }
            
            if (entry.pickupAddress && entry.pickupAddress !== ' ' && !seenAddresses.has(entry.pickupAddress.toLowerCase())) {
                addressesToCreate.push({
                    label: 'Warehouse',
                    address: entry.pickupAddress,
                    city: primary.region || null,
                    country: country,
                    isDefault: false,
                });
                seenAddresses.add(entry.pickupAddress.toLowerCase());
            }
        }

        // Upsert Supplier in Database
        const supplierData = {
            code,
            name,
            type: type as any,
            country: countryCode,
            paymentTerm,
            defaultCurrency: currency,
            incoterms,
            website,
            pickupInfo,
            portOfLoading,
            notes,
        };

        let supplierId = id;
        
        if (id) {
            // Update existing
            await prisma.supplier.update({
                where: { id },
                data: supplierData
            });
            console.log(`✓ Updated Supplier: ${name}`);
        } else {
            // Create new
            const newSupplier = await prisma.supplier.create({
                data: supplierData
            });
            supplierId = newSupplier.id;
            console.log(`✓ Created Supplier: ${name} (${code})`);
        }

        // Synchronize Contacts
        await prisma.supplierContact.deleteMany({
            where: { supplierId: supplierId! }
        });
        
        if (contactsToCreate.length > 0) {
            await prisma.supplierContact.createMany({
                data: contactsToCreate.map(c => ({ ...c, supplierId: supplierId! }))
            });
            console.log(`  ✓ Synced ${contactsToCreate.length} Contacts`);
        }

        // Synchronize Addresses
        await prisma.supplierAddress.deleteMany({
            where: { supplierId: supplierId! }
        });
        
        if (addressesToCreate.length > 0) {
            await prisma.supplierAddress.createMany({
                data: addressesToCreate.map(a => ({ ...a, supplierId: supplierId! }))
            });
            console.log(`  ✓ Synced ${addressesToCreate.length} Addresses`);
        }
    }
    
    console.log('\n🎉 Supplier Import Completed Successfully!');
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
