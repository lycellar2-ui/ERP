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

    // 1. Total products
    const totalRes = await client.query(`SELECT COUNT(*) FROM products WHERE "deletedAt" IS NULL`)
    console.log(`\n=== TOTAL PRODUCTS: ${totalRes.rows[0].count} ===\n`)

    // 2. With/without vintage
    const vintageRes = await client.query(`
        SELECT 
            COUNT(*) FILTER (WHERE vintage IS NOT NULL) as with_vintage,
            COUNT(*) FILTER (WHERE vintage IS NULL) as without_vintage
        FROM products WHERE "deletedAt" IS NULL
    `)
    console.log(`With vintage: ${vintageRes.rows[0].with_vintage}`)
    console.log(`Without vintage (NV): ${vintageRes.rows[0].without_vintage}`)

    // 3. Find duplicate groups: same base name (removing trailing year), same producer
    const dupsRes = await client.query(`
        WITH base_products AS (
            SELECT 
                id, "skuCode", "productName", vintage, "producerId",
                TRIM(REGEXP_REPLACE("productName", '\\s+\\d{4}\\s*$', '')) as base_name
            FROM products 
            WHERE "deletedAt" IS NULL
        ),
        grouped AS (
            SELECT base_name, "producerId", COUNT(*) as cnt
            FROM base_products
            GROUP BY base_name, "producerId"
            HAVING COUNT(*) > 1
        )
        SELECT bp.base_name, bp."skuCode", bp."productName", bp.vintage, bp.id,
            (SELECT COUNT(*) FROM stock_lots sl WHERE sl."productId" = bp.id) as lot_count,
            (SELECT COUNT(*) FROM stock_lots sl WHERE sl."productId" = bp.id AND sl."qtyAvailable" > 0) as active_lots,
            (SELECT COALESCE(SUM(sl."qtyAvailable"), 0) FROM stock_lots sl WHERE sl."productId" = bp.id) as total_stock,
            (SELECT COUNT(*) FROM product_media pm WHERE pm."productId" = bp.id) as media_count,
            (SELECT COUNT(*) FROM product_awards pa WHERE pa."productId" = bp.id) as award_count
        FROM base_products bp
        JOIN grouped g ON bp.base_name = g.base_name AND bp."producerId" = g."producerId"
        ORDER BY bp.base_name, bp.vintage NULLS LAST
    `)

    console.log(`\n=== DUPLICATE GROUPS ===\n`)
    let currentGroup = ''
    let groupCount = 0
    for (const r of dupsRes.rows) {
        if (r.base_name !== currentGroup) {
            if (currentGroup) console.log()
            currentGroup = r.base_name
            groupCount++
            console.log(`📦 "${r.base_name}":`)
        }
        console.log(`   ${r.skuCode} | V: ${r.vintage ?? 'NV'} | Lots: ${r.lot_count} (active: ${r.active_lots}) | Stock: ${r.total_stock} | Media: ${r.media_count} | Awards: ${r.award_count}`)
    }
    console.log(`\nTotal duplicate groups: ${groupCount}`)

    // 4. Vintage distribution
    const distRes = await client.query(`
        SELECT vintage, COUNT(*) as cnt 
        FROM products WHERE "deletedAt" IS NULL 
        GROUP BY vintage ORDER BY vintage DESC NULLS LAST
    `)
    console.log(`\n=== VINTAGE DISTRIBUTION ===`)
    for (const r of distRes.rows) {
        console.log(`  ${r.vintage ?? 'NV'}: ${r.cnt} products`)
    }

    // 5. Stock lots summary
    const lotsRes = await client.query(`
        SELECT COUNT(*) as total, 
               COUNT(*) FILTER (WHERE "qtyAvailable" > 0) as with_stock
        FROM stock_lots
    `)
    console.log(`\n=== STOCK LOTS: ${lotsRes.rows[0].total} total, ${lotsRes.rows[0].with_stock} with stock ===`)

    await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
