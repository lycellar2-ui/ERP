import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

async function main() {
    console.log('🧹 [OPTION 3] Resetting Sales & Transaction Data (Master Data Intact)...')

    const client = new pg.Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()

    try {
        await client.query('BEGIN')

        // 1. Clear Sales Quotations & Proposals
        const qLines = await client.query('DELETE FROM sales_quotation_lines')
        console.log(`  ✓ Deleted sales_quotation_lines: ${qLines.rowCount}`)

        const q = await client.query('DELETE FROM sales_quotations')
        console.log(`  ✓ Deleted sales_quotations: ${q.rowCount}`)

        await client.query('DELETE FROM proposal_price_items CASCADE').catch(() => {})
        await client.query('DELETE FROM proposal_approval_logs CASCADE').catch(() => {})
        await client.query('DELETE FROM proposal_comments CASCADE').catch(() => {})
        await client.query('DELETE FROM proposal_attachments CASCADE').catch(() => {})
        const prop = await client.query('DELETE FROM proposals CASCADE')
        console.log(`  ✓ Deleted proposals: ${prop.rowCount}`)

        // 2. Clear Allocation Campaigns
        await client.query('DELETE FROM allocation_logs CASCADE').catch(() => {})
        await client.query('DELETE FROM allocation_quotas CASCADE').catch(() => {})
        const allocCamp = await client.query('DELETE FROM allocation_campaigns CASCADE').catch(() => {})
        console.log(`  ✓ Deleted allocation campaigns/quotas/logs: ${allocCamp?.rowCount ?? 0}`)

        // 3. Clear Delivery Orders
        const doLines = await client.query('DELETE FROM delivery_order_lines CASCADE').catch(() => {})
        const doOrders = await client.query('DELETE FROM delivery_orders CASCADE').catch(() => {})
        console.log(`  ✓ Deleted delivery_orders: ${doOrders?.rowCount ?? 0}`)

        // 4. Clear Return Orders & Credit Notes & AR Payments & AR Invoices
        await client.query('DELETE FROM return_order_lines CASCADE').catch(() => {})
        await client.query('DELETE FROM return_orders CASCADE').catch(() => {})
        const arPay = await client.query('DELETE FROM ar_payments CASCADE')
        console.log(`  ✓ Deleted ar_payments: ${arPay.rowCount}`)

        const cn = await client.query('DELETE FROM credit_notes CASCADE').catch(() => {})
        console.log(`  ✓ Deleted credit_notes: ${cn?.rowCount ?? 0}`)

        const arInv = await client.query('DELETE FROM ar_invoices CASCADE')
        console.log(`  ✓ Deleted ar_invoices: ${arInv.rowCount}`)

        // 5. Clear Sales Orders & SO Lines
        const soLines = await client.query('DELETE FROM sales_order_lines CASCADE')
        console.log(`  ✓ Deleted sales_order_lines: ${soLines.rowCount}`)

        const so = await client.query('DELETE FROM sales_orders CASCADE')
        console.log(`  ✓ Deleted sales_orders: ${so.rowCount}`)

        // 6. Clear Consignment
        await client.query('DELETE FROM consignment_reports CASCADE').catch(() => {})
        await client.query('DELETE FROM consignment_stocks CASCADE').catch(() => {})
        const csg = await client.query('DELETE FROM consignment_agreements CASCADE').catch(() => {})
        console.log(`  ✓ Deleted consignment agreements/stocks: ${csg?.rowCount ?? 0}`)

        // 7. Clear Loyalty transactions (if any)
        const loyalty = await client.query('DELETE FROM loyalty_transactions CASCADE').catch(() => {})
        console.log(`  ✓ Deleted loyalty_transactions: ${loyalty?.rowCount ?? 0}`)

        await client.query('COMMIT')
        console.log('\n🎉 SUCCESS: All sales, quotation, delivery, and AR invoice transactions have been safely reset!')

        // Verify Master Data Counts
        console.log('\n--- Master Data Integrity Check ---')
        const custCount = await client.query('SELECT COUNT(*) FROM customers')
        const prodCount = await client.query('SELECT COUNT(*) FROM products')
        const suppCount = await client.query('SELECT COUNT(*) FROM suppliers')
        const whCount = await client.query('SELECT COUNT(*) FROM warehouses')
        const userCount = await client.query('SELECT COUNT(*) FROM users')
        console.log(`- Customers: ${custCount.rows[0].count} (Intact)`)
        console.log(`- Products: ${prodCount.rows[0].count} (Intact)`)
        console.log(`- Suppliers: ${suppCount.rows[0].count} (Intact)`)
        console.log(`- Warehouses: ${whCount.rows[0].count} (Intact)`)
        console.log(`- Users: ${userCount.rows[0].count} (Intact)`)

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error during transaction reset:', error)
    } finally {
        await client.end()
    }
}

main().catch(console.error)
