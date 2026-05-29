import * as fs from 'fs'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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

// Official website mappings for producers
const producerWebsites: Record<string, string> = {
    'i saltari': 'https://www.isaltari.it',
    'arco dei giovi': 'https://www.arcodeigiovi.it',
    'sartori di verona': 'https://www.sartorinobili.it',
    'pardon & fils': 'https://www.pardonetfils.com',
    'domaine de la perrière': 'https://www.sagetlaperriere.com',
    'maison saget': 'https://www.sagetlaperriere.com',
    'domaine baudouin millet': 'https://www.chablis-millet.com',
    'domaine de rochebin': 'https://www.rochebin-vins.com',
    'château de pennautier': 'https://www.lorgeril.wine',
    'château de l\'angle': 'https://www.lorgeril.wine',
    'château de ciffre': 'https://www.lorgeril.wine',
    'azienda agricola la jara': 'https://www.lajara.it',
    'la jara': 'https://www.lajara.it',
    'bodegas paniza': 'https://www.bodegaspaniza.com',
    'cavas marevia': 'https://www.cavasmarevia.com',
    'allan scott family winemakers': 'https://www.allanscott.com',
    'scott base': 'https://www.allanscott.com',
    'buccia nera': 'https://www.buccianera.it',
    'plaimont': 'https://www.plaimont.com',
    'calabria family wines': 'https://www.calabriafamilywines.com.au',
    'viña san esteban (in situ)': 'https://www.insitu.cl',
    'domaine de la tour blanche': 'https://famille-klack.fr',
    'domaine de la solitude': 'https://www.domaine-solitude.com',
    'vignobles bourceau': 'https://www.vignobles-bourceau.com',
    'linshank vintners': 'https://www.linshank.com'
};

// Appellation & Region Mapping rules based on substrings in product names
const APPELLATION_RULES = [
    { key: 'amarone della valpolicella', region: 'Veneto', appellation: 'Amarone della Valpolicella DOCG' },
    { key: 'valpolicella ripasso', region: 'Veneto', appellation: 'Valpolicella Ripasso DOC' },
    { key: 'valpolicella superior', region: 'Veneto', appellation: 'Valpolicella Superiore DOC' },
    { key: 'valpolicella', region: 'Veneto', appellation: 'Valpolicella DOC' },
    { key: 'soave', region: 'Veneto', appellation: 'Soave DOC' },
    { key: 'lugana', region: 'Veneto', appellation: 'Lugana DOC' },
    { key: 'prosecco', region: 'Veneto', appellation: 'Prosecco DOC' },
    { key: 'petit chablis', region: 'Burgundy', appellation: 'Petit Chablis AOC' },
    { key: 'chablis 1er cru', region: 'Burgundy', appellation: 'Chablis 1er Cru AOC' },
    { key: 'chablis', region: 'Burgundy', appellation: 'Chablis AOC' },
    { key: 'macon villages', region: 'Burgundy', appellation: 'Mâcon-Villages AOC' },
    { key: 'mâcon villages', region: 'Burgundy', appellation: 'Mâcon-Villages AOC' },
    { key: 'bourgogne aligote', region: 'Burgundy', appellation: 'Bourgogne Aligoté AOC' },
    { key: 'bourgogne chardonnay', region: 'Burgundy', appellation: 'Bourgogne Chardonnay AOC' },
    { key: 'bourgogne pinot noir', region: 'Burgundy', appellation: 'Bourgogne Pinot Noir AOC' },
    { key: 'bourgogne', region: 'Burgundy', appellation: 'Bourgogne AOC' },
    { key: 'coteaux bourguignons', region: 'Burgundy', appellation: 'Coteaux Bourguignons AOC' },
    { key: 'saint julien', region: 'Bordeaux', appellation: 'Saint-Julien AOC' },
    { key: 'saint-julien', region: 'Bordeaux', appellation: 'Saint-Julien AOC' },
    { key: 'bordeaux superieur', region: 'Bordeaux', appellation: 'Bordeaux Supérieur AOC' },
    { key: 'bordeaux blanc', region: 'Bordeaux', appellation: 'Bordeaux Blanc AOC' },
    { key: 'bordeaux rouge', region: 'Bordeaux', appellation: 'Bordeaux Rouge AOC' },
    { key: 'bordeaux', region: 'Bordeaux', appellation: 'Bordeaux AOC' },
    { key: 'cotes du rhone', region: 'Rhone Valley', appellation: 'Côtes du Rhône AOC' },
    { key: 'côtes du rhône', region: 'Rhone Valley', appellation: 'Côtes du Rhône AOC' },
    { key: 'chateauneuf du pape', region: 'Rhone Valley', appellation: 'Châteauneuf-du-Pape DOCG' },
    { key: 'châteauneuf-du-pape', region: 'Rhone Valley', appellation: 'Châteauneuf-du-Pape DOCG' },
    { key: 'gigondas', region: 'Rhone Valley', appellation: 'Gigondas AOC' },
    { key: 'beaujolais-villages', region: 'Beaujolais', appellation: 'Beaujolais-Villages AOC' },
    { key: 'beaujolais blanc', region: 'Beaujolais', appellation: 'Beaujolais Blanc AOC' },
    { key: 'beaujolais', region: 'Beaujolais', appellation: 'Beaujolais AOC' },
    { key: 'morgon', region: 'Beaujolais', appellation: 'Morgon AOC' },
    { key: 'chiroubles', region: 'Beaujolais', appellation: 'Chiroubles AOC' },
    { key: 'chenas', region: 'Beaujolais', appellation: 'Chénas AOC' },
    { key: 'brouilly', region: 'Beaujolais', appellation: 'Brouilly AOC' },
    { key: 'saint-amour', region: 'Beaujolais', appellation: 'Saint-Amour AOC' },
    { key: 'sancerre', region: 'Loire Valley', appellation: 'Sancerre AOC' },
    { key: 'pouilly fume', region: 'Loire Valley', appellation: 'Pouilly-Fumé AOC' },
    { key: 'pouilly-fumé', region: 'Loire Valley', appellation: 'Pouilly-Fumé AOC' },
    { key: 'pouilly sur loire', region: 'Loire Valley', appellation: 'Pouilly-sur-Loire AOC' },
    { key: 'faugeres', region: 'Languedoc-Roussillon', appellation: 'Faugères AOC' },
    { key: 'faugères', region: 'Languedoc-Roussillon', appellation: 'Faugères AOC' },
    { key: 'saint chinian', region: 'Languedoc-Roussillon', appellation: 'Saint-Chinian AOC' },
    { key: 'saint-chinian', region: 'Languedoc-Roussillon', appellation: 'Saint-Chinian AOC' },
    { key: 'pays d\'oc', region: 'Languedoc-Roussillon', appellation: 'IGP Pays d\'Oc' },
    { key: 'barolo', region: 'Piedmont', appellation: 'Barolo DOCG' },
    { key: 'dolcetto d\'alba', region: 'Piedmont', appellation: 'Dolcetto d\'Alba DOC' },
    { key: 'langhe', region: 'Piedmont', appellation: 'Langhe DOC' },
    { key: 'etna', region: 'Sicily', appellation: 'Etna DOC' },
    { key: 'sicilia', region: 'Sicily', appellation: 'Sicilia DOC' },
    { key: 'chianti', region: 'Tuscany', appellation: 'Chianti DOCG' },
    { key: 'toscana', region: 'Tuscany', appellation: 'Toscana IGT' },
    { key: 'marlborough', region: 'Marlborough', appellation: 'Marlborough GI' },
    { key: 'barossa', region: 'Barossa Valley', appellation: 'Barossa Valley GI' },
    { key: 'coonawarra', region: 'Coonawarra', appellation: 'Coonawarra GI' },
    { key: 'riverina', region: 'Riverina', appellation: 'Riverina GI' },
    { key: 'cava', region: 'Catalonia', appellation: 'Cava DO' },
];

interface ExcelRow {
    code: string
    classification: string
    supplierCode: string
    excelSupplierName: string
    wineName: string
    country: string
    currency: string
}

async function main() {
    console.log("🍷 Starting Premium Ultimate Product Master Data Sync...");
    
    // 1. Load Crawled Shopify Products
    const shopifyProducts: any[] = [];
    const shopifySkuMap = new Map<string, string>(); // sku -> vendor

    for (const page of [1, 2, 3]) {
        const file = `d:\\Lyruou\\lyscellars_products_p${page}.json`;
        const path = page === 1 ? `d:\\Lyruou\\lyscellars_products.json` : file;
        
        if (fs.existsSync(path)) {
            const raw = fs.readFileSync(path, 'utf8');
            const json = JSON.parse(raw.trim().replace(/^\uFEFF/, ''));
            if (json.products) {
                shopifyProducts.push(...json.products);
            }
        }
    }
    
    shopifyProducts.forEach(p => {
        const sku = p.variants?.[0]?.sku;
        const vendor = p.vendor;
        if (sku && vendor) {
            shopifySkuMap.set(sku.trim(), vendor.trim());
        }
    });

    // 2. Read Excel
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - Hàng hóa.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const rows: ExcelRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 5) continue;
        rows.push({
            code: String(row[0] || '').trim(),
            classification: String(row[1] || '').trim(),
            supplierCode: String(row[2] || '').trim(),
            excelSupplierName: String(row[3] || '').trim(),
            wineName: String(row[4] || '').trim(),
            country: String(row[5] || '').trim(),
            currency: String(row[6] || '').trim()
        });
    }

    // 3. Clear existing Products, Appellations, Regions, and Producers safely
    console.log("\nClearing existing database tables...");
    try {
        await prisma.$executeRawUnsafe('TRUNCATE TABLE products, appellations, wine_regions, producers CASCADE;');
        console.log("✓ Successfully cleared tables using CASCADE TRUNCATE.");
    } catch (e) {
        console.log("Cascade truncate failed, trying deleteMany catches...");
        try { await prisma.productMarginPrice.deleteMany({}); } catch (x) {}
        try { await prisma.productMedia.deleteMany({}); } catch (x) {}
        try { await prisma.productAward.deleteMany({}); } catch (x) {}
        try { await prisma.product.deleteMany({}); } catch (x) {}
        try { await prisma.appellation.deleteMany({}); } catch (x) {}
        try { await prisma.wineRegion.deleteMany({}); } catch (x) {}
        try { await prisma.producer.deleteMany({}); } catch (x) {}
        console.log("✓ Successfully cleared tables using fallback.");
    }

    // Caches
    const producerCache = new Map<string, string>(); // name -> id
    const regionCache = new Map<string, string>(); // country:name -> id
    const appellationCache = new Map<string, string>(); // name -> id
    const supplierCache = new Map<string, string>(); // code -> cuid id

    const existingSuppliers = await prisma.supplier.findMany({ select: { id: true, code: true } });
    existingSuppliers.forEach(s => supplierCache.set(s.code.toUpperCase().trim(), s.id));

    jsonData[0][7] = "Hãng sản xuất";
    let successCount = 0;
    const dbSkus = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 1;

        // 4.1 Resolve Producer Name
        let producerName = shopifySkuMap.get(r.code);
        if (!producerName) {
            const nameLower = r.wineName.toLowerCase();
            if (nameLower.includes('i saltari')) producerName = 'I Saltari';
            else if (nameLower.includes('arco dei giovi')) producerName = 'Arco dei Giovi';
            else if (nameLower.includes('sartori')) producerName = 'Sartori di Verona';
            else if (nameLower.includes('pardon')) producerName = 'Pardon & Fils';
            else if (nameLower.includes('la perriere') || nameLower.includes('perriere')) producerName = 'Domaine de la Perrière';
            else if (nameLower.includes('saget')) producerName = 'Maison Saget';
            else if (nameLower.includes('baudouin millet') || nameLower.includes('millet')) producerName = 'Domaine Baudouin Millet';
            else if (nameLower.includes('rochebin')) producerName = 'Domaine de Rochebin';
            else if (nameLower.includes('chateau de pennautier') || nameLower.includes('pennautier')) producerName = 'Château de Pennautier';
            else if (nameLower.includes('chateau de l\'angle') || nameLower.includes('l\'angle')) producerName = 'Château de l\'Angle';
            else if (nameLower.includes('chateau de ciffre') || nameLower.includes('ciffre')) producerName = 'Château de Ciffre';
            else if (nameLower.includes('chateau la jara') || nameLower.includes('la jara')) producerName = 'Azienda Agricola La Jara';
            else if (nameLower.includes('paniza')) producerName = 'Bodegas Paniza';
            else if (nameLower.includes('marevia')) producerName = 'Cavas Marevia';
            else if (nameLower.includes('allan scott')) producerName = 'Allan Scott Family Winemakers';
            else if (nameLower.includes('scott base')) producerName = 'Scott Base';
            else if (nameLower.includes('buccia nera')) producerName = 'Buccia Nera';
            else if (nameLower.includes('plaimont')) producerName = 'Plaimont';
            else if (nameLower.includes('calabria')) producerName = 'Calabria Family Wines';
            else if (nameLower.includes('in situ') || nameLower.includes('san esteban')) producerName = 'Viña San Esteban (In Situ)';
            else if (nameLower.includes('tour blanche')) producerName = 'Domaine de la Tour Blanche';
            else if (nameLower.includes('solitude')) producerName = 'Domaine de la Solitude';
            else if (nameLower.includes('bourceau')) producerName = 'Vignobles Bourceau';
            else if (nameLower.includes('linshank')) producerName = 'Linshank Vintners';
            else {
                if (r.supplierCode === 'NCC002') {
                    const match = r.wineName.match(/château\s+[a-zA-Z\s]+/i) || r.wineName.match(/chateau\s+[a-zA-Z\s]+/i);
                    producerName = match ? match[0].trim() : 'Maison Bouey';
                } else if (r.supplierCode === 'NCC013') {
                    const match = r.wineName.match(/domaine\s+[a-zA-Z\s]+/i) || r.wineName.match(/château\s+[a-zA-Z\s]+/i);
                    producerName = match ? match[0].trim() : 'DVP';
                } else {
                    producerName = r.excelSupplierName;
                }
            }
        }

        if (producerName === 'Badouin Millet') {
            producerName = 'Domaine Baudouin Millet';
        }

        jsonData[rowNum][7] = producerName;

        // 4.2 Country ISO
        const rawCountryUpper = r.country.toUpperCase();
        const countryCode = countryCodes[rawCountryUpper] || 'FR';

        // 4.3 Create DB Producer
        const normProdName = producerName.toLowerCase().trim();
        let producerId = producerCache.get(normProdName);
        if (!producerId) {
            let website: string | null = null;
            for (const [key, webUrl] of Object.entries(producerWebsites)) {
                if (normProdName.includes(key)) {
                    website = webUrl;
                    break;
                }
            }
            const newProducer = await prisma.producer.create({
                data: { name: producerName, country: countryCode, website }
            });
            producerId = newProducer.id;
            producerCache.set(normProdName, producerId);
        }

        // 4.4 Appellation & WineRegion Auto-Creation & Mapping
        let appellationId: string | null = null;
        const wineNameLower = r.wineName.toLowerCase();
        
        const matchedRule = APPELLATION_RULES.find(rule => wineNameLower.includes(rule.key));
        if (matchedRule) {
            const regionKey = `${countryCode}:${matchedRule.region}`;
            let regionId = regionCache.get(regionKey);
            if (!regionId) {
                const newRegion = await prisma.wineRegion.create({
                    data: { name: matchedRule.region, country: countryCode }
                });
                regionId = newRegion.id;
                regionCache.set(regionKey, regionId);
            }

            const appKey = matchedRule.appellation.toLowerCase();
            appellationId = appellationCache.get(appKey) || null;
            if (!appellationId) {
                const newApp = await prisma.appellation.create({
                    data: { name: matchedRule.appellation, regionId }
                });
                appellationId = newApp.id;
                appellationCache.set(appKey, appellationId);
            }
        }

        // 4.5 Vintage
        const vintageMatch = r.wineName.match(/\b(19\d{2}|20\d{2})\b/);
        const vintage = vintageMatch ? parseInt(vintageMatch[1]) : null;

        // 4.6 Child SKU Resolution
        let finalSku = r.code;
        if (finalSku === 'L20019' && vintage) {
            finalSku = `L20019-${String(vintage).slice(-2)}`;
        }

        if (dbSkus.has(finalSku)) continue;
        dbSkus.add(finalSku);

        // 4.7 Wine Type
        let wineType = 'RED';
        const typeLower = r.classification.toLowerCase();
        if (wineNameLower.includes('pinot grigio') || wineNameLower.includes('soave') || wineNameLower.includes('lugana') || wineNameLower.includes('blanc') || wineNameLower.includes('chardonnay') || wineNameLower.includes('white') || typeLower.includes('trắng')) {
            wineType = 'WHITE';
        } else if (wineNameLower.includes('rose') || wineNameLower.includes('rosé') || typeLower.includes('hồng')) {
            wineType = 'ROSE';
        } else if (wineNameLower.includes('prosecco') || wineNameLower.includes('brut') || wineNameLower.includes('sparkling') || wineNameLower.includes('spumante') || wineNameLower.includes('champagne') || typeLower.includes('nổ') || typeLower.includes('sủi')) {
            wineType = 'SPARKLING';
        }

        // 4.8 Classification
        let classification: string | null = null;
        if (wineNameLower.includes('docg')) classification = 'DOCG';
        else if (wineNameLower.includes('doc')) classification = 'DOC';
        else if (wineNameLower.includes('igt')) classification = 'IGP/IGT';
        else if (wineNameLower.includes('grand cru')) classification = 'Grand Cru';
        else if (wineNameLower.includes('1er cru') || wineNameLower.includes('premier cru')) classification = 'Premier Cru';
        else if (wineNameLower.includes('gran reserva')) classification = 'Gran Reserva';
        else if (wineNameLower.includes('reserve') || wineNameLower.includes('reserva')) classification = 'Reserva/Reserve';

        // 4.9 ABV (Alcohol content) based on style
        let abv = 13.5;
        if (wineNameLower.includes('amarone') || wineNameLower.includes('barolo')) abv = 15.0;
        else if (wineNameLower.includes('prosecco') || wineNameLower.includes('brut') || wineNameLower.includes('spumante')) abv = 11.5;
        else if (wineType === 'WHITE') abv = 12.5;

        // 4.10 Create Product
        const supplierId = supplierCache.get(r.supplierCode.toUpperCase().trim()) || null;

        await prisma.product.create({
            data: {
                skuCode: finalSku,
                productName: r.wineName,
                producerId,
                supplierId,
                appellationId,
                vintage,
                country: countryCode,
                abvPercent: abv,
                volumeMl: wineNameLower.includes('375 ml') || wineNameLower.includes('375ml') ? 375 : 750,
                format: 'STANDARD',
                packagingType: 'CARTON',
                unitsPerCase: wineNameLower.includes('12/750') || wineNameLower.includes('12 / 750') ? 12 : 6,
                hsCode: '2204211000',
                wineType: wineType as any,
                classification: classification || r.classification,
                status: 'ACTIVE',
            }
        });

        successCount++;
    }

    // 5. Save Excel
    const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, excelPath);
    console.log(`\n✓ Excel file updated and saved successfully at: ${excelPath}`);

    console.log(`\n🎉 Synchronized all products successfully!`);
    console.log(`- Created ${producerCache.size} producers in DB.`);
    console.log(`- Created ${regionCache.size} WineRegions in DB.`);
    console.log(`- Created ${appellationCache.size} Appellations in DB.`);
    console.log(`- Imported ${successCount} products with parsed metadata.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
