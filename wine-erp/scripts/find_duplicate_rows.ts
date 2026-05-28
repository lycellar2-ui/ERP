import * as XLSX from 'xlsx'

async function main() {
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - Hàng hóa.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log("=== SCANNING FOR L20019 ===");
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && String(row[0]).trim() === 'L20019') {
            console.log(`Row ${i + 1}:`, JSON.stringify(row));
        }
    }
}

main().catch(console.error);
