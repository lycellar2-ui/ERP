const { Client } = require('pg');
const dotenv = require('dotenv');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const MAPPINGS = [
    { soNo: 'SO-2608-0105', targetChildCode: 'HR10059-04', targetName: 'RICO Steak House (Cơ sở Nguyễn Gia Thiều)' },
    { soNo: 'SO-2608-0104', targetChildCode: 'HR10017-01', targetName: 'La Badiane' },
    { soNo: 'SO-2608-0103', targetChildCode: 'HR10038-01', targetName: 'Dragon Cello Restaurant' },
    { soNo: 'SO-2608-0102', targetChildCode: 'HR10071-01', targetName: 'Fabrik / Fabrik Restaurant' },
    { soNo: 'SO-2608-0101', targetChildCode: 'HR10022-01', targetName: 'Pincho - Tapas Kitchen and Drinks' },
    { soNo: 'SO-2608-0097', targetChildCode: 'HR10040-01', targetName: 'La Fiorentina Restaurant' },
    { soNo: 'SO-2608-0096', targetChildCode: 'HR10023-01', targetName: 'Bánh tráng Phú Cường - 275 Nguyễn Trãi' },
    { soNo: 'SO-2608-0095', targetChildCode: 'HR10064-01', targetName: 'Ambrys' },
    { soNo: 'SO-2608-0094', targetChildCode: 'HR10015-01', targetName: 'Grand Plaza Hotel Ha Noi' },
    { soNo: 'SO-2608-0093', targetChildCode: 'HR10017-01', targetName: 'La Badiane' },
    { soNo: 'SO-2608-0092', targetChildCode: 'HR10046-01', targetName: 'LABRI - Oriental Neo Bistro' },
    { soNo: 'SO-2608-0091', targetChildCode: 'HR10087-01', targetName: 'Villa Des Fleurs' },
    { soNo: 'SO-2608-0049', targetChildCode: 'HR10054-01', targetName: 'Jumarc - Korean Modern Bar Kitchen' },
    { soNo: 'SO-2608-0008', targetChildCode: 'HR10079-01', targetName: 'Same Bistrot & Wine / Samé Bistro' },
    { soNo: 'SO-2608-0006', targetChildCode: 'HR10022-01', targetName: 'Pincho - Tapas Kitchen and Drinks' },
    { soNo: 'SO-2608-0005', targetChildCode: 'HR10064-01', targetName: 'Ambrys' },
    { soNo: 'SO-2608-0004', targetChildCode: 'HR10054-01', targetName: 'Jumarc - Korean Modern Bar Kitchen' },
    { soNo: 'SO-2608-0003', targetChildCode: 'HR10072-02', targetName: 'Cousins Restaurant (Tây Hồ)' },
    { soNo: 'SO-2608-0001', targetChildCode: 'HR10064-01', targetName: 'Ambrys' }
];

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    console.log('=== BẮT ĐẦU CHUYỂN 19 ĐƠN HÀNG VỀ CHI NHÁNH CON ===\n');

    await client.query('BEGIN');

    try {
        // 1. Fix self-referencing customers where parentId = id
        const selfRefFixRes = await client.query(`
            UPDATE customers 
            SET "parentId" = NULL 
            WHERE "parentId" = id
        `);
        console.log(`✅ Đã chuẩn hóa ${selfRefFixRes.rowCount} khách hàng bị lỗi tự trỏ cha (parentId = id) về NULL.\n`);

        // 2. Update each SO & ARInvoice to child customer
        for (const item of MAPPINGS) {
            const childRes = await client.query(`SELECT id, code, name FROM customers WHERE code = $1`, [item.targetChildCode]);
            if (childRes.rows.length === 0) {
                throw new Error(`Không tìm thấy mã con ${item.targetChildCode}`);
            }
            const child = childRes.rows[0];

            // Get SO ID
            const soRes = await client.query(`SELECT id, "soNo", "customerId" FROM sales_orders WHERE "soNo" = $1`, [item.soNo]);
            if (soRes.rows.length === 0) {
                throw new Error(`Không tìm thấy SO ${item.soNo}`);
            }
            const soId = soRes.rows[0].id;

            // Update Sales Order
            await client.query(`
                UPDATE sales_orders 
                SET "customerId" = $1, "updatedAt" = NOW() 
                WHERE id = $2
            `, [child.id, soId]);

            // Update AR Invoice
            const invUpdateRes = await client.query(`
                UPDATE ar_invoices 
                SET "customerId" = $1 
                WHERE "soId" = $2
            `, [child.id, soId]);

            console.log(`✔ [${item.soNo}] -> Đã chuyển sang: [${child.code}] ${child.name} (Hóa đơn AR cập nhật: ${invUpdateRes.rowCount})`);
        }

        await client.query('COMMIT');
        console.log('\n🎉 TRANSACTION THÀNH CÔNG: ĐÃ CẬP NHẬT TOÀN BỘ 19 ĐƠN HÀNG VÀ HÓA ĐƠN!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ LỖI - ĐÃ ROLLBACK:', err);
    }

    // 3. Verification check
    console.log('\n=== KIỂM TRA LẠI SAU KHI CHUYỂN ===');
    const verifyRes = await client.query(`
        SELECT 
            so."soNo",
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id AND child.id != c.id) as child_count
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        WHERE 
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id AND child.id != c.id) > 0
            OR (c."entityType" = 'COMPANY' AND c."allowDirectSO" = false)
    `);

    console.log(`👉 Số đơn hàng còn tồn tại trên Mã Cha / Công ty bị chặn bán: ${verifyRes.rows.length}`);
    if (verifyRes.rows.length === 0) {
        console.log('✨ HOÀN HẢO! Không còn bất kỳ đơn hàng nào bị gán sai vào Mã Cha.');
    } else {
        console.table(verifyRes.rows);
    }

    await client.end();
}

main().catch(console.error);
