import * as fs from 'fs'
import * as XLSX from 'xlsx'

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
    console.log("=== GENERATING PRECISE PRODUCT PRODUCER MAPPINGS ===");
    
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
    console.log(`Loaded ${shopifySkuMap.size} unique Shopify SKU-to-Vendor mappings.\n`);

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

    console.log(`Auditing ${rows.length} wines...\n`);

    const result: any[] = [];
    
    // We will resolve each wine's producer using Shopify vendor first, then fallback to smart lookup
    for (const r of rows) {
        let producer = shopifySkuMap.get(r.code);
        let source = 'Shopify Crawl';

        if (!producer) {
            source = 'Smart Parsing / Web Search Match';
            const nameLower = r.wineName.toLowerCase();
            
            // Apply targeted web-searched brand patterns
            if (nameLower.includes('i saltari')) {
                producer = 'I Saltari';
            } else if (nameLower.includes('arco dei giovi')) {
                producer = 'Arco dei Giovi';
            } else if (nameLower.includes('sartori')) {
                producer = 'Sartori di Verona';
            } else if (nameLower.includes('pardon')) {
                producer = 'Pardon & Fils';
            } else if (nameLower.includes('la perriere') || nameLower.includes('perriere')) {
                producer = 'Domaine de la Perrière';
            } else if (nameLower.includes('saget')) {
                producer = 'Maison Saget';
            } else if (nameLower.includes('baudouin millet') || nameLower.includes('millet')) {
                producer = 'Domaine Baudouin Millet';
            } else if (nameLower.includes('rochebin')) {
                producer = 'Domaine de Rochebin';
            } else if (nameLower.includes('chateau de pennautier') || nameLower.includes('pennautier')) {
                producer = 'Château de Pennautier';
            } else if (nameLower.includes('chateau de l\'angle') || nameLower.includes('l\'angle')) {
                producer = 'Château de l\'Angle';
            } else if (nameLower.includes('chateau de ciffre') || nameLower.includes('ciffre')) {
                producer = 'Château de Ciffre';
            } else if (nameLower.includes('chateau la jara') || nameLower.includes('la jara')) {
                producer = 'Azienda Agricola La Jara';
            } else if (nameLower.includes('paniza')) {
                producer = 'Bodegas Paniza';
            } else if (nameLower.includes('marevia')) {
                producer = 'Cavas Marevia';
            } else if (nameLower.includes('allan scott')) {
                producer = 'Allan Scott Family Winemakers';
            } else if (nameLower.includes('scott base')) {
                producer = 'Scott Base';
            } else if (nameLower.includes('buccia nera')) {
                producer = 'Buccia Nera';
            } else if (nameLower.includes('plaimont')) {
                producer = 'Plaimont';
            } else if (nameLower.includes('calabria')) {
                producer = 'Calabria Family Wines';
            } else if (nameLower.includes('in situ') || nameLower.includes('san esteban')) {
                producer = 'Viña San Esteban (In Situ)';
            } else if (nameLower.includes('tour blanche')) {
                producer = 'Domaine de la Tour Blanche';
            } else if (nameLower.includes('solitude')) {
                producer = 'Domaine de la Solitude';
            } else if (nameLower.includes('bourceau')) {
                producer = 'Vignobles Bourceau';
            } else if (nameLower.includes('linshank')) {
                producer = 'Linshank Vintners';
            } else {
                // If it's a Chateau wine under Maison Bouey
                if (r.supplierCode === 'NCC002') {
                    const match = r.wineName.match(/château\s+[a-zA-Z\s]+/i) || r.wineName.match(/chateau\s+[a-zA-Z\s]+/i);
                    producer = match ? match[0].trim() : 'Maison Bouey';
                } else if (r.supplierCode === 'NCC013') {
                    // If it's under DVP
                    const match = r.wineName.match(/domaine\s+[a-zA-Z\s]+/i) || r.wineName.match(/château\s+[a-zA-Z\s]+/i);
                    producer = match ? match[0].trim() : 'DVP';
                } else {
                    producer = r.excelSupplierName; // Fallback
                }
            }
        }

        // Clean up names (e.g. spelling errors like "Badouin Millet" -> "Domaine Baudouin Millet")
        if (producer === 'Badouin Millet') {
            producer = 'Domaine Baudouin Millet';
        }

        result.push({
            code: r.code,
            ncc: r.supplierCode,
            vendorExcel: r.excelSupplierName,
            wineName: r.wineName,
            resolvedProducer: producer,
            source
        });
    }

    // Group by NCC for clear reporting
    const nccGroups = new Map<string, typeof result>();
    for (const item of result) {
        if (!nccGroups.has(item.ncc)) {
            nccGroups.set(item.ncc, []);
        }
        nccGroups.get(item.ncc)!.push(item);
    }

    console.log("=== FINAL RESOLVED PRODUCERS REPORT BY NCC ===");
    for (const [nccCode, items] of Array.from(nccGroups.entries()).sort()) {
        const vendorName = items[0].vendorExcel;
        console.log(`\n📦 NCC: ${nccCode} | Excel Vendor Name: "${vendorName}"`);
        
        // Find unique resolved producers under this supplier
        const uniqueProducers = Array.from(new Set(items.map(i => i.resolvedProducer)));
        console.log(`   - Resolved actual Producers: ${uniqueProducers.join(', ')}`);
        
        console.log(`   - Sample Wines mappings:`);
        items.slice(0, 4).forEach(item => {
            console.log(`     * SKU: ${item.code} | Name: "${item.wineName}"`);
            console.log(`       -> Resolved Producer: "${item.resolvedProducer}" (via ${item.source})`);
        });
        if (items.length > 4) {
            console.log(`     * ... and ${items.length - 4} more wines under this supplier.`);
        }
    }
}

main().catch(console.error);
