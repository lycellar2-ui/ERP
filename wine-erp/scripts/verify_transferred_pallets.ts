import XLSX from 'xlsx';

function verifyRows() {
    const filePath = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const header = rows[0];
    const subheader = rows[1];

    const targetSkus = ['L10007', 'L20017', 'L20019', 'L20063', 'L40006', 'L40010', 'L40011', 'L40012', 'L40013', 'L40014'];

    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;
        const sku = String(row[0]).trim();
        if (targetSkus.includes(sku)) {
            console.log(`\n=== SKU: ${sku} | ${row[1]} | Vintage: ${row[2]} | Tổng kiểm: ${row[4]} ===`);
            for (let c = 5; c < row.length; c++) {
                if (row[c] !== undefined && row[c] !== null && row[c] !== '' && Number(row[c]) > 0) {
                    const loc = header[c] || (header[c-1] ? `${header[c-1]} (${subheader[c]})` : `Col ${c}`);
                    console.log(`  Col ${c} [${loc}]: ${row[c]}`);
                }
            }
        }
    }
}

verifyRows();
