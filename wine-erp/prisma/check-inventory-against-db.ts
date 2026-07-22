import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🔍 Checking Inventory File against Master Data (Products)...')

    const rawPath = path.join(__dirname, 'inventory_raw.json')
    const rawData: string[][] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'))

    // Fetch all products from DB
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true, status: true }
    })

    const dbSkuMap = new Map<string, typeof dbProducts[0]>()
    const dbNameMap = new Map<string, typeof dbProducts[0]>()

    dbProducts.forEach(p => {
        if (p.skuCode) dbSkuMap.set(p.skuCode.trim().toUpperCase(), p)
        if (p.productName) dbNameMap.set(p.productName.trim().toLowerCase(), p)
    })

    console.log(`DB Master Products count: ${dbProducts.length}`)

    // Header is row 2 (index 2)
    // Data rows start from index 3
    const dataRows = rawData.slice(3)

    interface InventoryItem {
        rowIndex: number
        sku: string
        name: string
        vintage: string
        totalQty: number
        areas: Record<string, number>
        matchedProduct: { id: string; skuCode: string; productName: string } | null
        matchMethod: 'SKU' | 'NAME' | 'NONE'
    }

    const matchedItems: InventoryItem[] = []
    const missingItems: InventoryItem[] = []

    let totalQtyInFile = 0
    let nonZeroQtyCount = 0

    const areaHeaders = [
        'Kệ hàng lẻ', 'Kệ cạnh hàng lẻ', 'Khu vực cạnh bồn rửa', 
        'Khu vực sát cửa phụ', 'Khu vực cửa chính', 'Khu vực sát tường', 
        'Kệ hàng mẫu', 'Khu vực cửa sổ'
    ]

    dataRows.forEach((r, idx) => {
        const sku = (r[0] || '').trim()
        const name = (r[1] || '').trim()
        const vintage = (r[2] || '').trim()
        const totalStr = (r[4] || '0').trim()
        const totalQty = parseFloat(totalStr) || 0

        if (!sku && !name) return // empty row

        const areas: Record<string, number> = {}
        areaHeaders.forEach((h, hIdx) => {
            const val = parseFloat((r[5 + hIdx] || '0').trim()) || 0
            if (val > 0) areas[h] = val
        })

        let matched = dbSkuMap.get(sku.toUpperCase())
        let method: 'SKU' | 'NAME' | 'NONE' = 'NONE'

        if (matched) {
            method = 'SKU'
        } else {
            matched = dbNameMap.get(name.toLowerCase())
            if (matched) method = 'NAME'
        }

        const item: InventoryItem = {
            rowIndex: idx + 4,
            sku,
            name,
            vintage,
            totalQty,
            areas,
            matchedProduct: matched ? { id: matched.id, skuCode: matched.skuCode, productName: matched.productName } : null,
            matchMethod: method
        }

        if (matched) {
            matchedItems.push(item)
        } else {
            missingItems.push(item)
        }

        totalQtyInFile += totalQty
        if (totalQty > 0) nonZeroQtyCount++
    })

    console.log('\n--- 📊 AUDIT RESULT SUMMARY ---')
    console.log(`Total rows in Excel file: ${dataRows.length}`)
    console.log(`- Matched in Master Data: ${matchedItems.length}`)
    console.log(`- MISSING from Master Data: ${missingItems.length}`)
    console.log(`- Total inventory quantity (Tổng tồn): ${totalQtyInFile} chai/hộp`)
    console.log(`- Products with quantity > 0: ${nonZeroQtyCount}`)

    if (missingItems.length > 0) {
        console.log('\n--- ❌ MISSING PRODUCTS (Chưa có trong Master Data) ---')
        missingItems.forEach(m => {
            console.log(`Row ${m.rowIndex} | SKU: "${m.sku}" | Name: "${m.name}" | Vintage: ${m.vintage} | Total Qty: ${m.totalQty}`)
        })
    } else {
        console.log('\n✅ Tất cả mã hàng trong file kiểm kê ĐỀU ĐÃ CÓ trong Master Data!')
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
