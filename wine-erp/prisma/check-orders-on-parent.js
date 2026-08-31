const { Client } = require('pg');
const dotenv = require('dotenv');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('=== KẾT NỐI DB THÀNH CÔNG ===\n');

    // 1. Sales Orders on customers that have children
    console.log('========================================================================');
    console.log('=== 1. ĐƠN BÁN HÀNG (SALES ORDERS) ĐANG TẠO TRÊN KHÁCH CÓ MÃ CON (MÃ CHA) ===');
    console.log('========================================================================');
    const soOnParentsRes = await client.query(`
        SELECT 
            so.id as so_id,
            so."soNo",
            so.status as so_status,
            so."totalAmount",
            so."notes",
            so."createdAt",
            c.id as customer_id,
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count,
            (
                SELECT string_agg(child.code || ' (' || child.name || ')', '; ')
                FROM customers child 
                WHERE child."parentId" = c.id
            ) as child_list
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY so."createdAt" DESC
    `);

    console.log(`👉 TỔNG SỐ ĐƠN SO TRÊN MÃ CHA (CÓ MÃ CON): ${soOnParentsRes.rows.length}`);
    for (const r of soOnParentsRes.rows) {
        console.log(`\n📦 Mã SO: ${r.soNo}`);
        console.log(`   - Ngày tạo: ${r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : 'N/A'}`);
        console.log(`   - Trạng thái SO: ${r.so_status}`);
        console.log(`   - Tổng tiền: ${Number(r.totalAmount || 0).toLocaleString('vi-VN')} đ`);
        console.log(`   - Ghi chú: ${r.notes || 'Trống'}`);
        console.log(`   - Khách hàng trên đơn (Mã Cha): [${r.customer_code}] ${r.customer_name}`);
        console.log(`   - Phân loại KH: entityType=${r.entityType}, allowDirectSO=${r.allowDirectSO}`);
        console.log(`   - Số mã con thuộc về mã cha này: ${r.child_count}`);
        console.log(`   - Danh sách mã con: ${r.child_list}`);
    }

    // 2. Sales Orders on entityType = COMPANY & allowDirectSO = false
    console.log('\n========================================================================');
    console.log('=== 2. ĐƠN SO TẠO TRÊN CÔNG TY BỊ CHẶN BÁN TRỰC TIẾP (allowDirectSO = false) ===');
    console.log('========================================================================');
    const soNoDirectRes = await client.query(`
        SELECT 
            so."soNo",
            so.status as so_status,
            so."totalAmount",
            so."notes",
            so."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        WHERE c."entityType" = 'COMPANY' AND c."allowDirectSO" = false
        ORDER BY so."createdAt" DESC
    `);
    console.log(`👉 TỔNG SỐ ĐƠN: ${soNoDirectRes.rows.length}`);
    for (const r of soNoDirectRes.rows) {
        console.log(`- SO: ${r.soNo} | Ngày: ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : 'N/A'} | Status: ${r.so_status} | Tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ | KH: [${r.customer_code}] ${r.customer_name} (Số con: ${r.child_count}) | Notes: ${r.notes || ''}`);
    }

    // 3. Sales Quotations (Báo giá)
    console.log('\n========================================================================');
    console.log('=== 3. BÁO GIÁ (SALES QUOTATIONS) TRÊN MÃ CHA CÓ MÃ CON HOẶC COMPANY ===');
    console.log('========================================================================');
    const sqRes = await client.query(`
        SELECT 
            sq."quotationNo",
            sq.status,
            sq."totalAmount",
            sq."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM sales_quotations sq
        JOIN customers c ON sq."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0 OR (c."entityType" = 'COMPANY' AND c."allowDirectSO" = false)
        ORDER BY sq."createdAt" DESC
    `);
    console.log(`👉 TỔNG SỐ BÁO GIÁ: ${sqRes.rows.length}`);
    for (const r of sqRes.rows) {
        console.log(`- Quotation: ${r.quotationNo} | Status: ${r.status} | Tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ | KH: [${r.customer_code}] ${r.customer_name} (Số con: ${r.child_count})`);
    }

    // 4. Invoices & Delivery Orders
    console.log('\n========================================================================');
    console.log('=== 4. HÓA ĐƠN CÔNG NỢ (AR INVOICES) & LỆNH GIAO HÀNG (DO) TRÊN MÃ CHA ===');
    console.log('========================================================================');
    const invRes = await client.query(`
        SELECT 
            inv."invoiceNo",
            inv.status,
            inv."totalAmount",
            inv."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM ar_invoices inv
        JOIN customers c ON inv."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY inv."createdAt" DESC
    `);
    console.log(`👉 TỔNG SỐ HÓA ĐƠN: ${invRes.rows.length}`);
    for (const r of invRes.rows) {
        console.log(`- Invoice: ${r.invoiceNo} | Status: ${r.status} | Tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ | KH: [${r.customer_code}] ${r.customer_name}`);
    }

    const doRes = await client.query(`
        SELECT 
            d."doNo",
            d.status,
            d."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM delivery_orders d
        JOIN customers c ON d."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY d."createdAt" DESC
    `);
    console.log(`👉 TỔNG SỐ LỆNH GIAO HÀNG (DO): ${doRes.rows.length}`);
    for (const r of doRes.rows) {
        console.log(`- DO: ${r.doNo} | Status: ${r.status} | KH: [${r.customer_code}] ${r.customer_name}`);
    }

    // 5. Check detailed items of the Sales Orders found on parent codes
    console.log('\n========================================================================');
    console.log('=== 5. CHI TIẾT SẢN PHẨM & DÒNG ĐƠN HÀNG CỦA CÁC ĐƠN TRÊN MÃ CHA ===');
    console.log('========================================================================');
    for (const so of soOnParentsRes.rows) {
        const lines = await client.query(`
            SELECT 
                sol."qtyOrdered",
                sol."unitPrice",
                (sol."qtyOrdered" * sol."unitPrice") as line_total,
                p."skuCode",
                p."productName"
            FROM sales_order_lines sol
            JOIN products p ON sol."productId" = p.id
            WHERE sol."soId" = $1
        `, [so.so_id]);

        console.log(`\n🔍 SO: ${so.soNo} | Status: ${so.so_status} | KH: [${so.customer_code}] ${so.customer_name}`);
        for (const l of lines.rows) {
            console.log(`   + [${l.skuCode}] ${l.productName} | SL: ${l.qtyOrdered} | Đơn giá: ${Number(l.unitPrice).toLocaleString('vi-VN')} | Thành tiền: ${Number(l.line_total).toLocaleString('vi-VN')} đ`);
        }
    }

    // 6. Check proposals (đề xuất) on parent codes
    console.log('\n========================================================================');
    console.log('=== 6. ĐỀ XUẤT (PROPOSALS) TRÊN MÃ CHA ===');
    console.log('========================================================================');
    const propRes = await client.query(`
        SELECT 
            p."proposalNo",
            p.title,
            p.status,
            p."totalAmount",
            c.code as customer_code,
            c.name as customer_name
        FROM proposals p
        JOIN customers c ON p."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
    `);
    console.log(`👉 TỔNG SỐ PROPOSALS TRÊN MÃ CHA: ${propRes.rows.length}`);
    for (const r of propRes.rows) {
        console.log(`- Proposal: ${r.proposalNo} | Title: ${r.title} | Status: ${r.status} | Tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} | KH: [${r.customer_code}] ${r.customer_name}`);
    }

    await client.end();
}

main().catch(console.error);
