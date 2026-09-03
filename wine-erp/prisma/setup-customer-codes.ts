import pg from 'pg'
import * as dotenv from 'dotenv'
import * as XLSX from 'xlsx'

dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!
const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})

async function main() {
    const client = await pool.connect()
    try {
        console.log('1. Creating customer_product_codes table and adding columns...')
        await client.query(`
            CREATE TABLE IF NOT EXISTS customer_product_codes (
                id TEXT PRIMARY KEY,
                "customerId" TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                "productId" TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                "customerCode" TEXT NOT NULL,
                notes TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT customer_product_codes_customerId_productId_key UNIQUE ("customerId", "productId")
            );

            CREATE INDEX IF NOT EXISTS customer_product_codes_customerId_customerCode_idx 
            ON customer_product_codes ("customerId", "customerCode");

            ALTER TABLE sales_order_lines ADD COLUMN IF NOT EXISTS "customerItemCode" TEXT;
            ALTER TABLE sales_quotation_lines ADD COLUMN IF NOT EXISTS "customerItemCode" TEXT;
        `)
        console.log('✅ DDL executed successfully!')

        // 2. Find customer La Fiorentina
        const custRes = await client.query(`
            SELECT id, code, name FROM customers 
            WHERE name ILIKE '%Fiorentina%' OR code ILIKE '%Fiorentina%'
        `)
        if (custRes.rows.length === 0) {
            throw new Error('Customer La Fiorentina not found!')
        }
        const customer = custRes.rows[0]
        console.log(`\n2. Target Customer: [${customer.code}] ${customer.name} (ID: ${customer.id})`)

        // 3. Read Excel file
        const filePath = 'D:\\Lyruou\\CODE ORDER LY\'S CELLARS (1).xlsx'
        const wb = XLSX.readFile(filePath)
        const ws = wb.Sheets['Mã hàng']
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        console.log(`\n3. Reading mapping from sheet "Mã hàng"...`)
        let imported = 0
        let skipped = 0

        // Get all products to map SKU code -> productId
        const prodRes = await client.query(`SELECT id, "skuCode", "productName" FROM products`)
        const productSkuMap = new Map(prodRes.rows.map(p => [p.skuCode.trim().toUpperCase(), p]))

        for (let i = 4; i < data.length; i++) {
            const row = data[i]
            if (!row || !row[1] || !row[2]) continue
            const customerCode = String(row[1]).trim()
            let skuCode = String(row[2]).trim().toUpperCase()

            // Special handle for L4008 -> L40008 if needed
            if (skuCode === 'L4008' && !productSkuMap.has(skuCode) && productSkuMap.has('L40008')) {
                skuCode = 'L40008'
            }

            const product = productSkuMap.get(skuCode)
            if (!product) {
                console.log(`  ⚠️ SKU code ${skuCode} not found in products! (Customer code: ${customerCode})`)
                skipped++
                continue
            }

            import('crypto').then(c => {})
            const id = 'cpc_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
            await client.query(`
                INSERT INTO customer_product_codes (id, "customerId", "productId", "customerCode", notes, "updatedAt")
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT ("customerId", "productId")
                DO UPDATE SET "customerCode" = EXCLUDED."customerCode", "updatedAt" = NOW()
            `, [id, customer.id, product.id, customerCode, `Tự động import từ file CODE ORDER LY'S CELLARS (1).xlsx`])

            console.log(`  ✅ [${customerCode}] ➔ [${product.skuCode}] ${product.productName}`)
            imported++
        }

        console.log(`\n🎉 IMPORT COMPLETED: ${imported} mappings saved, ${skipped} skipped.`)
    } finally {
        client.release()
    }
}

main()
    .catch(console.error)
    .finally(() => pool.end())
