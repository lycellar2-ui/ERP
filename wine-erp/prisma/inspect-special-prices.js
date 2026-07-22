const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = 'D:\\Lyscellar\\Price\\Customer Special Price - need to confirm.xlsx';

console.log('Reading file:', filePath);
const wb = xlsx.readFile(filePath);

wb.SheetNames.forEach(sheetName => {
    console.log(`\n========================================`);
    console.log(`SHEET: ${sheetName}`);
    console.log(`========================================`);
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    rows.slice(0, 35).forEach((r, idx) => {
        if (r && r.some(c => c !== null && c !== '')) {
            console.log(`Row ${idx + 1}:`, r);
        }
    });
});
