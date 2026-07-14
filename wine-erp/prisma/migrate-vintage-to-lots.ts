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
    console.log('Connected. Starting vintage migration...\n')

    // Step 1: Add vintage column to stock_lots if not exists
    await client.query(`
        ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS vintage INT
    `)
    console.log('✅ Added vintage column to stock_lots')

    // Step 2: For any stock lots linked to products with vintage, copy vintage over
    const updateRes = await client.query(`
        UPDATE stock_lots sl
        SET vintage = p.vintage
        FROM products p
        WHERE sl."productId" = p.id AND p.vintage IS NOT NULL AND sl.vintage IS NULL
    `)
    console.log(`✅ Migrated vintage to ${updateRes.rowCount} stock lots`)

    // Step 3: Merge duplicate products (Château Pétrus 2018 + 2020 → keep one)
    // Find duplicates: same base name (without year), same producer
    const dupsRes = await client.query(`
        WITH base_products AS (
            SELECT id, "productName", vintage, "producerId",
                TRIM(REGEXP_REPLACE("productName", '\\s+\\d{4}\\s*$', '')) as base_name
            FROM products WHERE "deletedAt" IS NULL
        ),
        grouped AS (
            SELECT base_name, "producerId", COUNT(*) as cnt,
                   MIN(id) as keep_id
            FROM base_products
            GROUP BY base_name, "producerId"
            HAVING COUNT(*) > 1
        )
        SELECT g.base_name, g.keep_id, bp.id as dup_id, bp."productName", bp.vintage
        FROM grouped g
        JOIN base_products bp ON bp.base_name = g.base_name AND bp."producerId" = g."producerId"
        WHERE bp.id != g.keep_id
        ORDER BY g.base_name
    `)

    for (const dup of dupsRes.rows) {
        console.log(`\n🔀 Merging "${dup.productName}" (${dup.dup_id}) → keep_id: ${dup.keep_id}`)

        // Move stock lots
        const movedLots = await client.query(`UPDATE stock_lots SET "productId" = $1 WHERE "productId" = $2`, [dup.keep_id, dup.dup_id])
        console.log(`   Moved ${movedLots.rowCount} stock lots`)

        // Move media
        const movedMedia = await client.query(`UPDATE product_media SET "productId" = $1 WHERE "productId" = $2`, [dup.keep_id, dup.dup_id])
        console.log(`   Moved ${movedMedia.rowCount} media`)

        // Move awards
        const movedAwards = await client.query(`UPDATE product_awards SET "productId" = $1 WHERE "productId" = $2`, [dup.keep_id, dup.dup_id])
        console.log(`   Moved ${movedAwards.rowCount} awards`)

        // Soft delete the duplicate
        await client.query(`UPDATE products SET "deletedAt" = NOW() WHERE id = $1`, [dup.dup_id])
        console.log(`   Soft-deleted duplicate`)
    }

    if (dupsRes.rows.length === 0) {
        console.log('\n✅ No duplicates to merge')
    }

    // Step 4: Remove vintage from the kept product name (e.g., "Pétrus 2018" → "Pétrus")
    const renamedRes = await client.query(`
        UPDATE products
        SET "productName" = TRIM(REGEXP_REPLACE("productName", '\\s+\\d{4}\\s*$', '')),
            "skuCode" = REGEXP_REPLACE("skuCode", '-\\d{4}-', '-NV-')
        WHERE vintage IS NOT NULL AND "deletedAt" IS NULL
            AND "productName" ~ '\\d{4}\\s*$'
    `)
    console.log(`\n✅ Cleaned vintage from ${renamedRes.rowCount} product names`)

    // Step 5: Null out the vintage column on products (no longer used)
    const nulledRes = await client.query(`UPDATE products SET vintage = NULL WHERE vintage IS NOT NULL`)
    console.log(`✅ Nulled vintage on ${nulledRes.rowCount} products`)

    // Step 6: Drop the vintage column from products
    // (Commented out — let Prisma migration handle this)
    // await client.query(`ALTER TABLE products DROP COLUMN IF EXISTS vintage`)
    // console.log('✅ Dropped vintage column from products')

    console.log('\n🎉 Migration complete!')
    await client.end()
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1) })
