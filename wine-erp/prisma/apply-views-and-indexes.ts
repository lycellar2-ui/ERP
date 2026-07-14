import { Client } from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

const sql = `
-- 1. Create View for Product Rows (List) — includes price + profile for instant detail drawer
DROP VIEW IF EXISTS v_product_rows;
CREATE OR REPLACE VIEW v_product_rows AS
SELECT 
    p.id,
    p."skuCode" AS "skuCode",
    p."productName" AS "productName",
    p."wineType" AS "wineType",
    p.format,
    p."packagingType" AS "packagingType",
    p."unitsPerCase" AS "unitsPerCase",
    p."abvPercent"::float AS "abvPercent",
    p.country,
    p."barcodeEan" AS "barcodeEan",
    p.classification,
    p.status,
    p."createdAt" AS "createdAt",
    p."deletedAt" AS "deletedAt",
    p."producerId" AS "producerId",
    pr.name AS "producerName",
    pr.country AS "producerCountry",
    p."appellationId" AS "appellationId",
    ap.name AS "appellationName",
    -- Technical fields for instant detail drawer
    p."volumeMl" AS "volumeMl",
    p."hsCode" AS "hsCode",
    p."isAllocationEligible" AS "isAllocationEligible",
    -- Pricing (1-to-1 join, negligible cost)
    mp."retailPrice"::float AS "retailPrice",
    mp."wholesalePrice"::float AS "wholesalePrice",
    -- Wine profile (1-to-1 join, negligible cost)
    prof."originDetail" AS "originDetail",
    prof.certification AS certification,
    prof.color AS color,
    prof.aromas AS aromas,
    prof.palate AS palate,
    prof.style AS style,
    prof."servingTemp" AS "servingTemp",
    prof."foodPairings" AS "foodPairings",
    prof."bestSuitedFor" AS "bestSuitedFor",
    prof.grapes AS grapes,
    (
        SELECT COALESCE(SUM(sl."qtyAvailable"), 0)::int
        FROM stock_lots sl
        WHERE sl."productId" = p.id AND sl.status = 'AVAILABLE'
    ) AS "totalStock",
    (
        SELECT COUNT(*)::int
        FROM product_media pm
        WHERE pm."productId" = p.id
    ) AS "mediaCount",
    (
        SELECT pm.url
        FROM product_media pm
        WHERE pm."productId" = p.id AND pm."isPrimary" = true
        LIMIT 1
    ) AS "primaryImageUrl"
FROM products p
JOIN producers pr ON p."producerId" = pr.id
LEFT JOIN appellations ap ON p."appellationId" = ap.id
LEFT JOIN product_margin_prices mp ON p.id = mp."productId"
LEFT JOIN product_profiles prof ON p.id = prof."productId";

-- 2. Create View for Product Details (Drawer)
DROP VIEW IF EXISTS v_product_details;
CREATE OR REPLACE VIEW v_product_details AS
SELECT 
    p.id, p."skuCode", p."productName", p.country,
    p."abvPercent"::float AS "abvPercent", p."volumeMl", p.format, p."packagingType" AS "packagingType",
    p."unitsPerCase" AS "unitsPerCase", p."hsCode", p."barcodeEan" AS "barcodeEan", p."wineType" AS "wineType",
    p.classification, p.status, p."isAllocationEligible", p."deletedAt",
    pr.name AS "producerName",
    ap.name AS "appellationName",
    mp."retailPrice"::float AS "retailPrice",
    mp."wholesalePrice"::float AS "wholesalePrice",
    prof."originDetail", prof.certification, prof.color,
    prof.aromas, prof.palate, prof.style, prof."servingTemp",
    prof."foodPairings", prof."bestSuitedFor", prof.grapes
FROM products p
JOIN producers pr ON p."producerId" = pr.id
LEFT JOIN appellations ap ON p."appellationId" = ap.id
LEFT JOIN product_margin_prices mp ON p.id = mp."productId"
LEFT JOIN product_profiles prof ON p.id = prof."productId";

-- 3. Add Composite Indexes for speed
CREATE INDEX IF NOT EXISTS idx_stock_lots_product_status_qty ON stock_lots ("productId", status, "qtyAvailable");
CREATE INDEX IF NOT EXISTS idx_product_media_product_primary ON product_media ("productId", "isPrimary");
`

async function main() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined in environment')
    }

    console.log('Connecting to database...')
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    })
    
    await client.connect()
    console.log('Connected. Running SQL commands...')
    
    await client.query(sql)
    console.log('Views and indexes created/updated successfully.')
    
    await client.end()
}

main().catch(err => {
    console.error('Error applying database changes:', err)
    process.exit(1)
})
