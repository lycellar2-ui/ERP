import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { revalidateCache } from '../src/lib/cache'

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

function normalizeLocationCode(locName: string, index: number): string {
    const slug = locName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return `LOC-TT-${slug.toUpperCase() || index}`
}

async function main() {
    console.log('🚀 Starting Opening Inventory Import for Kho Thường Tín (WH-TA-TT)...')

    // 1. Get Warehouse & Legal Entity
    const wh = await prisma.warehouse.findUnique({ where: { code: 'WH-TA-TT' } })
    if (!wh) throw new Error('Warehouse WH-TA-TT not found!')

    const legalEntity = (await prisma.legalEntity.findFirst({ where: { code: 'TA' } })) || 
                        (await prisma.legalEntity.findFirst({ where: { id: 'le-thang-an' } }))
    if (!legalEntity) throw new Error('Legal Entity TA (Thắng Ân) not found!')

    console.log(`✓ Target Warehouse: ${wh.name} (${wh.id})`)
    console.log(`✓ Legal Entity: ${legalEntity.name} (${legalEntity.id})`)

    // 2. Read input file
    const csvPath = 'D:\\Lyscellar\\Kế toán\\Kiểm kê\\File upload he thong\\File_upload_kiem_ke_thuong_tin.csv'
    if (!fs.existsSync(csvPath)) {
        throw new Error(`Input file not found at path: ${csvPath}`)
    }

    const content = fs.readFileSync(csvPath, 'utf-utf8' in fs ? 'utf-8' : 'utf8')
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
    console.log(`✓ Read CSV file: ${lines.length - 1} data rows`)

    // 3. Parse CSV rows
    type ImportedRecord = {
        sku: string
        name: string
        vintage: number | null
        qty: number
        locationStr: string
    }

    const records: ImportedRecord[] = []
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const parts = line.split(',')
        const sku = parts[0].trim()
        const locationStr = parts[parts.length - 1].trim()
        const qtyStr = parts[parts.length - 2].trim()
        const vintageStr = parts[parts.length - 3].trim()
        
        // Extract product name (handling possible middle commas)
        const nameParts = parts.slice(1, parts.length - 3)
        const name = nameParts.join(',').trim().replace(/^"|"$/g, '')

        const qty = parseFloat(qtyStr) || 0
        const vintageInt = parseInt(vintageStr, 10)
        const vintage = isNaN(vintageInt) || vintageInt <= 0 ? null : vintageInt

        if (sku && qty > 0) {
            records.push({ sku, name, vintage, qty, locationStr })
        }
    }

    console.log(`✓ Parsed ${records.length} active inventory items`)
    const totalQtyToImport = records.reduce((sum, r) => sum + r.qty, 0)
    console.log(`✓ Total quantity to import: ${totalQtyToImport} bottles`)

    // 4. Fetch Products for SKU mapping
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    })
    const dbSkuMap = new Map(dbProducts.map(p => [p.skuCode.trim().toUpperCase(), p]))

    // Verify all SKUs exist
    const unmapped = records.filter(r => !dbSkuMap.has(r.sku.toUpperCase()))
    if (unmapped.length > 0) {
        console.error('❌ Unmapped SKUs found:', unmapped)
        throw new Error(`Found ${unmapped.length} unmapped SKUs in import file. Cannot proceed.`)
    }

    // 5. Upsert Locations for WH-TA-TT
    const uniqueLocations = Array.from(new Set(records.map(r => r.locationStr)))
    console.log(`✓ Creating/upserting ${uniqueLocations.length} locations for Kho Thường Tín...`)

    const locationMap = new Map<string, string>() // locationStr -> Location ID
    for (let idx = 0; idx < uniqueLocations.length; idx++) {
        const locName = uniqueLocations[idx]
        const code = normalizeLocationCode(locName, idx + 1)

        const loc = await prisma.location.upsert({
            where: { warehouseId_locationCode: { warehouseId: wh.id, locationCode: code } },
            update: { zone: locName },
            create: {
                warehouseId: wh.id,
                locationCode: code,
                zone: locName,
                type: 'STORAGE'
            }
        })
        locationMap.set(locName, loc.id)
    }

    // 6. Delete old stock lots in Kho Thường Tín
    console.log('🧹 Deleting existing stock lots in Kho Thường Tín...')
    const deleteResult = await prisma.stockLot.deleteMany({
        where: { location: { warehouseId: wh.id } }
    })
    console.log(`✓ Deleted ${deleteResult.count} old stock lots from Kho Thường Tín`)

    // 7. Import Opening Inventory Stock Lots as of 22/07/2026
    const receivedDate = new Date('2026-07-22T00:00:00.000Z')
    console.log(`📥 Creating ${records.length} new stock lots with receivedDate = 2026-07-22...`)

    let importedCount = 0
    let importedQtyTotal = 0

    for (let idx = 0; idx < records.length; idx++) {
        const r = records[idx]
        const product = dbSkuMap.get(r.sku.toUpperCase())!
        const locationId = locationMap.get(r.locationStr)!
        const lotNo = `LOT-TT-20260722-${r.sku}-${String(idx + 1).padStart(3, '0')}`

        await prisma.stockLot.create({
            data: {
                lotNo,
                ownerEntityId: legalEntity.id,
                productId: product.id,
                locationId: locationId,
                qtyReceived: r.qty,
                qtyAvailable: r.qty,
                unitLandedCost: 0,
                vintage: r.vintage,
                status: 'AVAILABLE',
                receivedDate: receivedDate
            }
        })

        importedCount++
        importedQtyTotal += r.qty
    }

    console.log('\n=================== IMPORT SUMMARY ===================')
    console.log(`Warehouse:          ${wh.name} (${wh.code})`)
    console.log(`Import Date:        22/07/2026`)
    console.log(`Deleted Old Lots:   ${deleteResult.count}`)
    console.log(`Created Locations:  ${locationMap.size}`)
    console.log(`Created Stock Lots: ${importedCount}`)
    console.log(`Total Quantity:     ${importedQtyTotal} bottles`)
    console.log('======================================================\n')

    // 8. Invalidate WMS cache
    try {
        await revalidateCache('wms')
        console.log('✓ Invalidated WMS cache')
    } catch (e) {
        console.log('Cache invalidation note:', e)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
