import { Client } from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()
    console.log('Connected to DB successfully.\n')

    // 1. Find all parent customers (customers with children or entityType = COMPANY)
    const parentCustomersRes = await client.query(`
        SELECT 
            c.id,
            c.code,
            c.name,
            c."entityType",
            c."allowDirectSO",
            c.status,
            c."creditLimit",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM customers c
        WHERE 
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
            OR c."entityType" = 'COMPANY'
            OR c."allowDirectSO" = false
        ORDER BY child_count DESC, c.code ASC
    `)

    console.log(`=== TỔNG SỐ KHÁCH HÀNG LÀ MÃ CHA HOẶC CÔNG TY (entityType = COMPANY / có con / allowDirectSO = false): ${parentCustomersRes.rows.length} ===`)
    for (const p of parentCustomersRes.rows) {
        console.log(`- Mã: [${p.code}] - Tên: ${p.name} | Loại: ${p.entityType} | DirectSO: ${p.allowDirectSO} | Status: ${p.status} | Số mã con: ${p.child_count}`)
    }

    // 2. Check Sales Orders (SO) created on customers that have child accounts (actual parent customers)
    console.log('\n========================================================================')
    console.log('=== 1. ĐƠN HÀNG (SALES ORDERS) TẠO TRÊN KHÁCH HÀNG CÓ MÃ CON (MÃ CHA) ===')
    console.log('========================================================================')
    const soOnParentsRes = await client.query(`
        SELECT 
            so.id as so_id,
            so."orderNo",
            so.status as so_status,
            so."totalAmount",
            so."createdAt",
            c.id as customer_id,
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count,
            (
                SELECT string_agg(child.code || ' - ' || child.name, '; ')
                FROM customers child 
                WHERE child."parentId" = c.id
            ) as child_list
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY so."createdAt" DESC
    `)

    console.log(`Tìm thấy ${soOnParentsRes.rows.length} đơn hàng (SO) tạo trên mã khách hàng có mã con:\n`)
    for (const r of soOnParentsRes.rows) {
        console.log(`👉 SO: ${r.orderNo} | Ngày: ${r.createdAt?.toISOString()?.slice(0, 10)} | Trạng thái: ${r.so_status} | Tổng tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ`)
        console.log(`   Khách hàng (Mã cha): [${r.customer_code}] ${r.customer_name}`)
        console.log(`   EntityType: ${r.entityType} | allowDirectSO: ${r.allowDirectSO} | Số mã con: ${r.child_count}`)
        console.log(`   Danh sách mã con: ${r.child_list}`)
        console.log('   ---')
    }

    // 3. Check Sales Orders created on COMPANY entityType where allowDirectSO is false or null
    console.log('\n========================================================================')
    console.log('=== 2. ĐƠN HÀNG (SO) TẠO TRÊN CÔNG TY (entityType = COMPANY & allowDirectSO = false) ===')
    console.log('========================================================================')
    const soOnCompanyNoDirectRes = await client.query(`
        SELECT 
            so.id as so_id,
            so."orderNo",
            so.status as so_status,
            so."totalAmount",
            so."createdAt",
            c.id as customer_id,
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        WHERE c."entityType" = 'COMPANY' AND c."allowDirectSO" = false
        ORDER BY so."createdAt" DESC
    `)

    console.log(`Tìm thấy ${soOnCompanyNoDirectRes.rows.length} đơn hàng (SO) tạo trên công ty bị cấm tạo SO trực tiếp (allowDirectSO = false):\n`)
    for (const r of soOnCompanyNoDirectRes.rows) {
        console.log(`👉 SO: ${r.orderNo} | Ngày: ${r.createdAt?.toISOString()?.slice(0, 10)} | Trạng thái: ${r.so_status} | Tổng tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ`)
        console.log(`   Khách hàng: [${r.customer_code}] ${r.customer_name} (Số con: ${r.child_count})`)
        console.log('   ---')
    }

    // 4. Check Sales Quotations (Báo giá) on parent customers
    console.log('\n========================================================================')
    console.log('=== 3. BÁO GIÁ (SALES QUOTATIONS) TẠO TRÊN MÃ CHA (Có mã con) ===')
    console.log('========================================================================')
    const sqOnParentsRes = await client.query(`
        SELECT 
            sq.id as sq_id,
            sq."quotationNo",
            sq.status as sq_status,
            sq."totalAmount",
            sq."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM sales_quotations sq
        JOIN customers c ON sq."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY sq."createdAt" DESC
    `)
    console.log(`Tìm thấy ${sqOnParentsRes.rows.length} báo giá tạo trên mã cha:\n`)
    for (const r of sqOnParentsRes.rows) {
        console.log(`👉 Quotation: ${r.quotationNo} | Ngày: ${r.createdAt?.toISOString()?.slice(0, 10)} | Trạng thái: ${r.sq_status} | Tổng tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ | KH: [${r.customer_code}] ${r.customer_name}`)
    }

    // 5. Check AR Invoices (Hóa đơn công nợ) on parent customers vs child customers
    console.log('\n========================================================================')
    console.log('=== 4. HÓA ĐƠN CÔNG NỢ (AR INVOICES) TẠO TRÊN MÃ CHA (Có mã con) ===')
    console.log('========================================================================')
    const invOnParentsRes = await client.query(`
        SELECT 
            inv.id as inv_id,
            inv."invoiceNo",
            inv.status as inv_status,
            inv."totalAmount",
            inv."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM ar_invoices inv
        JOIN customers c ON inv."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY inv."createdAt" DESC
    `)
    console.log(`Tìm thấy ${invOnParentsRes.rows.length} hóa đơn công nợ trên mã cha:\n`)
    for (const r of invOnParentsRes.rows) {
        console.log(`👉 Invoice: ${r.invoiceNo} | Trạng thái: ${r.inv_status} | Tổng tiền: ${Number(r.totalAmount).toLocaleString('vi-VN')} đ | KH: [${r.customer_code}] ${r.customer_name}`)
    }

    // 6. Check Delivery Orders (Lệnh xuất giao hàng) on parent customers
    console.log('\n========================================================================')
    console.log('=== 5. PHIẾU XUẤT KHO / GIAO HÀNG (DELIVERY ORDERS) TẠO TRÊN MÃ CHA ===')
    console.log('========================================================================')
    const doOnParentsRes = await client.query(`
        SELECT 
            d.id as do_id,
            d."doNo",
            d.status as do_status,
            d."createdAt",
            c.code as customer_code,
            c.name as customer_name,
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) as child_count
        FROM delivery_orders d
        JOIN customers c ON d."customerId" = c.id
        WHERE (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id) > 0
        ORDER BY d."createdAt" DESC
    `)
    console.log(`Tìm thấy ${doOnParentsRes.rows.length} phiếu giao hàng trên mã cha:\n`)
    for (const r of doOnParentsRes.rows) {
        console.log(`👉 DO: ${r.doNo} | Trạng thái: ${r.do_status} | KH: [${r.customer_code}] ${r.customer_name}`)
    }

    await client.end()
}

main().catch(console.error)
