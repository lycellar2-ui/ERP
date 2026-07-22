const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const files = [
    'D:\\Lyscellar\\Price\\Customer Special Price - need to confirm.xlsx',
    'D:\\Lyscellar\\Price\\Cơ chế và giá đặc biệt khách hàng 30.03.2026.xlsx',
    'D:\\Lyscellar\\Price\\HRC- Margin Checking- Manager 08.07.xlsx',
    'D:\\Lyscellar\\Price\\HRC- Margin Checking- Sales 08.07.xlsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    console.log('\n=======================================');
    console.log('SEARCHING FILE:', path.basename(file));
    console.log('=======================================');
    try {
        const workbook = xlsx.readFile(file);
        workbook.SheetNames.forEach(sheetName => {
            const ws = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
            data.forEach((row, rowIndex) => {
                if (row && row.some(cell => String(cell).toLowerCase().includes('pincho') || String(cell).toLowerCase().includes('tinh hoa'))) {
                    console.log(`[Sheet: ${sheetName} | Row ${rowIndex + 1}]`, row.filter(c => c !== null && c !== ''));
                }
            });
        });
    } catch (err) {
        console.error('Error reading file:', err.message);
    }
});
