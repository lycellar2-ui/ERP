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
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - Hàng hóa.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const groups = new Map<string, ExcelRow[]>();
    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 5) continue;
        const r: ExcelRow = {
            code: String(row[0] || '').trim(),
            classification: String(row[1] || '').trim(),
            supplierCode: String(row[2] || '').trim(),
            excelSupplierName: String(row[3] || '').trim(),
            wineName: String(row[4] || '').trim(),
            country: String(row[5] || '').trim(),
            currency: String(row[6] || '').trim()
        };
        if (!groups.has(r.excelSupplierName)) {
            groups.set(r.excelSupplierName, []);
        }
        groups.get(r.excelSupplierName)!.push(r);
    }

    console.log(`=== WINES GROUPED BY EXCEL VENDOR (WINE HOUSE) ===`);
    for (const [vendor, items] of groups.entries()) {
        console.log(`\n📦 Vendor/Wine house: "${vendor}" (${items.length} wines)`);
        items.forEach((item, idx) => {
            console.log(`   [${idx+1}] Code: ${item.code} | Name: "${item.wineName}"`);
        });
    }
}

main().catch(console.error);
