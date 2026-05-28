import * as XLSX from 'xlsx'

async function main() {
    const excelPath = "D:\\Lyscellar\\Kế toán\\Master data\\Master Data  - NCC.xlsx";
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log(`Total rows parsed: ${jsonData.length}`);
    jsonData.forEach((row, index) => {
        console.log(`Row ${index}:`, JSON.stringify(row));
    });
}

main().catch(console.error);
