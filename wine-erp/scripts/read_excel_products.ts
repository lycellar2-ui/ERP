import * as XLSX from 'xlsx'

async function main() {
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - Hàng hóa.xlsx";
    console.log(`Loading Excel file from ${excelPath}...`);
    const workbook = XLSX.readFile(excelPath);
    console.log("Sheet names in workbook:", workbook.SheetNames);
    
    // Read the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log(`Total rows parsed: ${jsonData.length}`);
    console.log("First 15 rows:");
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
        console.log(`Row ${i}:`, JSON.stringify(jsonData[i]));
    }
}

main().catch(console.error);
