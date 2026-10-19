import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function inspectUpdatedFile() {
    const dir = 'D:/Lyscellar/Kế toán/Kiểm kê';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    
    console.log('=== FILES IN DIRECTORY WITH STATS ===');
    for (const f of files) {
        const fp = path.join(dir, f);
        const stats = fs.statSync(fp);
        console.log(`- ${f}: Modified at ${stats.mtime.toLocaleString('vi-VN')} (${stats.size} bytes)`);
    }

    // Inspect Tồn kho TT 1.8.xlsx
    const targetFile = 'D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx';
    if (fs.existsSync(targetFile)) {
        const wb = XLSX.readFile(targetFile);
        console.log(`\n=== INSPECTING: Tồn kho TT 1.8.xlsx (Sheets: ${wb.SheetNames.join(', ')}) ===`);
        
        for (const sname of wb.SheetNames) {
            const sheet = wb.Sheets[sname];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            console.log(`\n--- Sheet "${sname}" (Total rows: ${rows.length}, Total cols in header: ${rows[0] ? rows[0].length : 0}) ---`);
            
            // Print row 0 (Location headers) and row 1 (Sub headers)
            if (rows.length > 0) {
                console.log('Row 0 (Locations/Pallets):', rows[0].filter(Boolean));
                console.log('Row 1 (Sub-headers):', rows[1].slice(0, 10));
            }

            // Print all rows with L400
            const l400Rows = rows.filter(r => r && r[0] && String(r[0]).trim().toUpperCase().startsWith('L400'));
            console.log(`Found ${l400Rows.length} L400 rows in "${sname}":`);
            for (const r of l400Rows) {
                console.log(`  SKU: ${r[0]} | Name: ${r[1]} | Vintage: ${r[2]} | Quy cách: ${r[3]} | Tổng kiểm: ${r[4]}`);
                // find non-empty location cells
                const locCols: string[] = [];
                for (let c = 5; c < r.length; c++) {
                    if (r[c] !== undefined && r[c] !== null && r[c] !== '') {
                        const locName = rows[0] && rows[0][c] ? rows[0][c] : (rows[0] && rows[0][c - 1] ? `${rows[0][c-1]} (${rows[1][c]})` : `Col ${c}`);
                        locCols.push(`${locName}: ${r[c]}`);
                    }
                }
                if (locCols.length > 0) {
                    console.log(`    -> Vị trí: ${locCols.join(' | ')}`);
                }
            }
        }
    }
}

inspectUpdatedFile();
