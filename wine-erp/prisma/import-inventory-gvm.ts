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
    console.log('🚀 Importing Inventory Data into Kho Giang Văn Minh Tầng 2 (WH-TA-GVM)...')

    // 1. Get Warehouse & Legal Entity
    const wh = await prisma.warehouse.findUnique({ where: { code: 'WH-TA-GVM' } })
    if (!wh) throw new Error('Warehouse WH-TA-GVM not found!')

    const legalEntity = await prisma.legalEntity.findFirst({ where: { code: 'TA' } })
    if (!legalEntity) throw new Error('Legal Entity TA not found!')

    // 2. Create Default & Area Locations for WH-TA-GVM
    const areaNames = [
        'Kệ hàng lẻ', 'Kệ cạnh hàng lẻ', 'Khu vực cạnh bồn rửa', 
        'Khu vực sát cửa phụ', 'Khu vực cửa chính', 'Khu vực sát tường', 
        'Kệ hàng mẫu', 'Khu vực cửa sổ'
    ]

    const locationMap = new Map<string, string>() // Name -> Location ID

    // Create Main Location
    const mainLoc = await prisma.location.upsert({
        where: { warehouseId_locationCode: { warehouseId: wh.id, locationCode: 'LOC-GVM-MAIN' } },
        update: { zone: 'Khu vực chung - Tầng 2' },
        create: {
            warehouseId: wh.id,
            locationCode: 'LOC-GVM-MAIN',
            zone: 'Khu vực chung - Tầng 2'
        }
    })
    locationMap.set('MAIN', mainLoc.id)

    for (let i = 0; i < areaNames.length; i++) {
        const aName = areaNames[i]
        const code = `LOC-GVM-A${i + 1}`
        const loc = await prisma.location.upsert({
            where: { warehouseId_locationCode: { warehouseId: wh.id, locationCode: code } },
            update: { zone: aName },
            create: {
                warehouseId: wh.id,
                locationCode: code,
                zone: aName
            }
        })
        locationMap.set(aName, loc.id)
    }

    console.log(`✓ Configured ${locationMap.size} locations for warehouse ${wh.name}`)

    // 3. Load Excel Json data
    const rawPath = path.join(__dirname, 'inventory_raw.json')
    const rawData: string[][] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'))
    const dataRows = rawData.slice(3) // skip headers

    // Fetch Products
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    })

    const dbSkuMap = new Map<string, typeof dbProducts[0]>()
    const dbNameMap = new Map<string, typeof dbProducts[0]>()
    dbProducts.forEach(p => {
        if (p.skuCode) dbSkuMap.set(p.skuCode.trim().toUpperCase(), p)
        if (p.productName) dbNameMap.set(p.productName.trim().toLowerCase(), p)
    })

    // Clear old stock lots in WH-TA-GVM before importing fresh
    await prisma.stockLot.deleteMany({
        where: { location: { warehouseId: wh.id } }
    })
    console.log('✓ Cleaned previous stock lots in WH-TA-GVM')

    let importedCount = 0
    let totalImportedQty = 0

    const now = new Date()

    for (let idx = 0; idx < dataRows.length; idx++) {
        const r = dataRows[idx]
        const sku = (r[0] || '').trim()
        const name = (r[1] || '').trim()
        const vintageRaw = (r[2] || '').trim()
        const totalQty = parseFloat((r[4] || '0').trim()) || 0

        if (!sku && !name) continue
        if (totalQty <= 0) continue // Only import active stock

        let product = dbSkuMap.get(sku.toUpperCase()) || dbNameMap.get(name.toLowerCase())
        if (!product) {
            console.log(`⚠️ Skipped unmapped product: SKU "${sku}" Name "${name}"`)
            continue
        }

        const vintageInt = parseInt(vintageRaw, 10)
        const vintage = isNaN(vintageInt) || vintageInt <= 0 ? null : vintageInt

        let importedForProduct = false

        for (let aIdx = 0; aIdx < areaNames.length; aIdx++) {
            const aName = areaNames[aIdx]
            const areaQty = parseFloat((r[5 + aIdx] || '0').trim()) || 0
            if (areaQty > 0) {
                const locId = locationMap.get(aName) || mainLoc.id
                const lotNo = `LOT-GVM-${sku || product.id.slice(-4)}-R${idx + 4}-A${aIdx + 1}`

                await prisma.stockLot.create({
                    data: {
                        lotNo,
                        ownerEntityId: legalEntity.id,
                        productId: product.id,
                        locationId: locId,
                        qtyReceived: areaQty,
                        qtyAvailable: areaQty,
                        unitLandedCost: 0,
                        vintage: vintage,
                        status: 'AVAILABLE',
                        receivedDate: now
                    }
                })

                totalImportedQty += areaQty
                importedForProduct = true
            }
        }

        // If no specific area qty matched but totalQty > 0, assign to MAIN location
        if (!importedForProduct && totalQty > 0) {
            const lotNo = `LOT-GVM-${sku || product.id.slice(-4)}-R${idx + 4}-MAIN`
            await prisma.stockLot.create({
                data: {
                    lotNo,
                    ownerEntityId: legalEntity.id,
                    productId: product.id,
                    locationId: mainLoc.id,
                    qtyReceived: totalQty,
                    qtyAvailable: totalQty,
                    unitLandedCost: 0,
                    vintage: vintage,
                    status: 'AVAILABLE',
                    receivedDate: now
                }
            })
            totalImportedQty += totalQty
        }

        importedCount++
    }

    console.log(`\n🎉 IMPORT COMPLETED SUCCESSFULLY!`)
    console.log(`- Imported Products count: ${importedCount}`)

    // 4. Verify Stock Lots in DB
    const stockSummary = await prisma.stockLot.aggregate({
        where: { location: { warehouseId: wh.id } },
        _sum: { qtyAvailable: true },
        _count: { id: true }
    })

    console.log('\n--- 📊 DB VERIFICATION SUMMARY ---')
    console.log(`Warehouse: ${wh.name} (${wh.code})`)
    console.log(`Total Stock Lot Records created: ${stockSummary._count.id}`)
    console.log(`Total Available Inventory Qty: ${stockSummary._sum.qtyAvailable || 0} chai/hộp`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
