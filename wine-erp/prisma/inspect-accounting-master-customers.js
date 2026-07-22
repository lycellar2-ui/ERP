const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = 'I:\\My Drive\\Kế toán 2026\\1. Dữ liệu kế toán\\1. Master data\\Master Data  - Khách hàng.xlsx';

console.log('Reading file:', filePath);
const wb = xlsx.readFile(filePath);

wb.SheetNames.forEach(sheetName => {
    console.log(`\n========================================`);
    console.log(`SHEET: ${sheetName}`);
    console.log(`========================================`);
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Total Rows: ${rows.length}`);
    rows.slice(0, 30).forEach((r, idx) => {
        if (r && r.some(c => c !== null && c !== '')) {
            console.log(`Row ${idx + 1}:`, r.filter(c => c !== null && c !== ''));
        }
    });
});
