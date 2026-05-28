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
    console.log("=== SCANNING WINES FOR ACTUAL PRODUCERS & VINTAGE RECOMMENDATIONS ===");
    
    // 1. Read Excel
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

    console.log(`Analyzing ${rows.length} product entries...\n`);

    const suggestions: any[] = [];
    const skuGroup = new Map<string, ExcelRow[]>();

    for (const r of rows) {
        // Group by code to detect vintage issues
        const baseCode = r.code;
        if (!skuGroup.has(baseCode)) skuGroup.set(baseCode, []);
        skuGroup.get(baseCode)!.push(r);

        // 1. Extract Vintage (4 digit number e.g. 2019, 2021)
        const vintageMatch = r.wineName.match(/\b(19\d{2}|20\d{2})\b/);
        const vintage = vintageMatch ? vintageMatch[1] : null;

        // 2. Intelligent Producer / Chateau Extraction
        let suggestedProducer = r.excelSupplierName; // Default to Excel supplier name
        const nameLower = r.wineName.toLowerCase();

        // Rules based on brand indicators in the wine name
        if (nameLower.includes('i saltari')) {
            suggestedProducer = 'I Saltari';
        } else if (nameLower.includes('arco dei giovi')) {
            suggestedProducer = 'Arco dei Giovi';
        } else if (nameLower.includes('sartori')) {
            suggestedProducer = 'Sartori di Verona';
        } else if (nameLower.includes('pardon')) {
            suggestedProducer = 'Pardon & Fils';
        } else if (nameLower.includes('la perriere') || nameLower.includes('perriere')) {
            suggestedProducer = 'Domaine de la Perrière';
        } else if (nameLower.includes('saget')) {
            suggestedProducer = 'Maison Saget';
        } else if (nameLower.includes('chateau de pennautier') || nameLower.includes('pennautier')) {
            suggestedProducer = 'Château de Pennautier';
        } else if (nameLower.includes('chateau de l\'angle') || nameLower.includes('l\'angle')) {
            suggestedProducer = 'Château de l\'Angle';
        } else if (nameLower.includes('chateau de ciffre') || nameLower.includes('ciffre')) {
            suggestedProducer = 'Château de Ciffre';
        } else if (nameLower.includes('chateau la jara') || nameLower.includes('la jara')) {
            suggestedProducer = 'Azienda Agricola La Jara';
        } else if (nameLower.includes('paniza')) {
            suggestedProducer = 'Bodegas Paniza';
        } else if (nameLower.includes('marevia')) {
            suggestedProducer = 'Cavas Marevia';
        } else if (nameLower.includes('allan scott')) {
            suggestedProducer = 'Allan Scott Family Winemakers';
        } else if (nameLower.includes('scott base')) {
            suggestedProducer = 'Scott Base';
        } else if (nameLower.includes('buccia nera')) {
            suggestedProducer = 'Buccia Nera';
        } else if (nameLower.includes('plaimont')) {
            suggestedProducer = 'Plaimont';
        } else if (nameLower.includes('calabria')) {
            suggestedProducer = 'Calabria Family Wines';
        } else if (nameLower.includes('in situ') || nameLower.includes('san esteban')) {
            suggestedProducer = 'Viña San Esteban (In Situ)';
        } else if (nameLower.includes('tour blanche')) {
            suggestedProducer = 'Domaine de la Tour Blanche';
        } else if (nameLower.includes('solitude')) {
            suggestedProducer = 'Domaine de la Solitude';
        } else if (nameLower.includes('bourceau')) {
            suggestedProducer = 'Vignobles Bourceau';
        } else if (nameLower.includes('linshank')) {
            suggestedProducer = 'Linshank Vintners';
        }

        // Special Chateau extraction for Maison Bouey (NCC002)
        if (r.supplierCode === 'NCC002') {
            const chateauMatch = r.wineName.match(/château\s+[a-zA-Z\s]+/i) || r.wineName.match(/chateau\s+[a-zA-Z\s]+/i);
            if (chateauMatch) {
                suggestedProducer = chateauMatch[0].trim();
            }
        }
        // Special Chateau extraction for DVP (NCC013)
        if (r.supplierCode === 'NCC013') {
            const domainMatch = r.wineName.match(/domaine\s+[a-zA-Z\s]+/i) || r.wineName.match(/château\s+[a-zA-Z\s]+/i);
            if (domainMatch) {
                suggestedProducer = domainMatch[0].trim();
            }
        }

        suggestions.push({
            code: r.code,
            wineName: r.wineName,
            excelSupplier: r.excelSupplierName,
            suggestedProducer,
            vintage: vintage || 'N/A'
        });
    }

    // Print summary of duplicate code issues
    console.log("=== VINTAGE DUPLICATE DETECTIONS ===");
    for (const [code, items] of skuGroup.entries()) {
        if (items.length > 1) {
            console.log(`⚠️ Code: ${code} is used ${items.length} times in Excel:`);
            items.forEach(item => {
                console.log(`   - "${item.wineName}"`);
            });
        }
    }
    console.log("");

    // Print Sample Suggestions (Top 25 rows)
    console.log("=== SUGGESTED PRODUCERS & VINTAGE ANALYSIS (SAMPLE OF TOP 25 ROWS) ===");
    for (let i = 0; i < Math.min(25, suggestions.length); i++) {
        const s = suggestions[i];
        console.log(`[${i+1}] SKU in Accounting: ${s.code}`);
        console.log(`    Wine Name: "${s.wineName}"`);
        console.log(`    NCC (Excel Vendor): "${s.excelSupplier}"`);
        console.log(`    Suggested Producer (Hãng sản xuất thực tế): "${s.suggestedProducer}"`);
        console.log(`    Vintage Extracted: ${s.vintage}`);
        
        // Show recommended child SKU
        const childSkuSuffix = s.vintage !== 'N/A' ? `-${s.vintage.slice(-2)}` : '';
        console.log(`    👉 Recommended ERP Child SKU: "${s.code}${childSkuSuffix}"`);
        console.log("");
    }

    console.log("\n... Total suggestions available for all 138 rows.");
}

main().catch(console.error);
