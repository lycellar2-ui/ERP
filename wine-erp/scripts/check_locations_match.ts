import { prisma } from '../src/lib/db';
import XLSX from 'xlsx';

async function checkLocationsAndLots() {
    try {
        const warehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-TA-TT' } });
        const locations = await prisma.location.findMany({
            where: { warehouseId: warehouse!.id },
            orderBy: { locationCode: 'asc' }
        });

        console.log(`Warehouse: ${warehouse!.name} has ${locations.length} locations:`);
        console.log(locations.map(l => l.locationCode));

        const wb = XLSX.readFile('D:/Lyscellar/Kế toán/Kiểm kê/Tồn kho TT 1.8.xlsx');
        const sheet = wb.Sheets['TH tồn kho thực tế'] || wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const palletHeaders = rows[0].filter(Boolean);
        console.log('\nPallet headers in Excel:', palletHeaders);

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkLocationsAndLots();
