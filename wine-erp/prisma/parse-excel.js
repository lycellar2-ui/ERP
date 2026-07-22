const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dir = 'D:\\Lyscellar\\Quyết định giá';
const files = fs.readdirSync(dir);

console.log('Files in Quyết định giá:', files);

files.filter(f => f.endsWith('.xlsx')).forEach(file => {
    console.log('\n=======================================');
    console.log('READING FILE:', file);
    console.log('=======================================');
    const workbook = xlsx.readFile(path.join(dir, file));
    workbook.SheetNames.forEach(sheetName => {
        console.log(`--- Sheet: ${sheetName} ---`);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        data.forEach(row => {
            if (row && row.some(cell => cell !== null && cell !== '')) {
                console.log(row.filter(c => c !== null && c !== ''));
            }
        });
    });
});
