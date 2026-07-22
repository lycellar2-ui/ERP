const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = 'I:\\My Drive\\Kế toán 2026\\1. Dữ liệu kế toán\\1. Master data\\Master Data  - Khách hàng.xlsx';
const wb = xlsx.readFile(filePath);

console.log('=== INSPECTING MASTER DATA KHÁCH HÀNG ===');

wb.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Total rows: ${data.length}`);
    
    data.forEach((r, idx) => {
        if (r && r.some(c => String(c).toLowerCase().includes('pincho') || String(c).toLowerCase().includes('tinh hoa'))) {
            console.log(`Row ${idx + 1}:`, r.filter(c => c !== null && c !== ''));
        }
    });
});
