import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'
import xlsx from 'xlsx'
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

async function main() {
    console.log('🚀 Starting Showroom Inventory Import (11/07/2026)...')

    // 1. Get Target Warehouse & Legal Entity
    const wh = await prisma.warehouse.findUnique({ where: { code: 'WH-LYS-SR' } })
    if (!wh) throw new Error('Warehouse WH-LYS-SR not found!')

    const legalEntity = (await prisma.legalEntity.findFirst({ where: { code: 'LC' } })) ||
                        (await prisma.legalEntity.findFirst({ where: { id: 'le-lys-cellar' } }))
    if (!legalEntity) throw new Error("Legal Entity LC (Ly's Cellar) not found!")

    console.log(`✓ Target Warehouse: ${wh.name} (${wh.id})`)
    console.log(`✓ Legal Entity: ${legalEntity.name} (${legalEntity.id})`)

    // 2. Setup 4 Showroom Locations
    const locationsConfig = [
        { code: 'LOC-LYS-SR-KE-TRONG-T1', name: 'Kệ trong T1', colIdx: 3, suffix: 'LOC1' },
        { code: 'LOC-LYS-SR-KE-NGOAI-T1', name: 'Kệ ngoài T1 + W.show', colIdx: 4, suffix: 'LOC2' },
        { code: 'LOC-LYS-SR-KE-NGANG', name: 'Kệ rượu ngang', colIdx: 5, suffix: 'LOC3' },
        { code: 'LOC-LYS-SR-TU-LANH', name: 'Tủ lạnh', colIdx: 6, suffix: 'LOC4' },
    ]

    const locationMap = new Map<string, string>() // Name -> Location ID
    for (const locCfg of locationsConfig) {
        const loc = await prisma.location.upsert({
            where: { warehouseId_locationCode: { warehouseId: wh.id, locationCode: locCfg.code } },
            update: { zone: locCfg.name },
            create: {
                warehouseId: wh.id,
                locationCode: locCfg.code,
                zone: locCfg.name,
                type: 'STORAGE'
            }
        })
        locationMap.set(locCfg.name, loc.id)
    }
    console.log(`✓ Configured 4 physical locations for Showroom`)

    // 3. Load Excel Data from Sheet "Phiếu kiểm hàng"
    const filePath = 'D:\\Lyscellar\\Kế toán\\Kiểm kê\\Copy of Phieu kiem hang.xlsx'
    const workbook = xlsx.readFile(filePath)
    const sheet = workbook.Sheets['Phiếu kiểm hàng']
    if (!sheet) throw new Error('Sheet "Phiếu kiểm hàng" not found in Excel file!')

    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 })
    console.log(`✓ Read sheet "Phiếu kiểm hàng": ${data.length} rows`)

    // 4. Fetch Products for SKU Mapping
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    })
    const dbSkuMap = new Map(dbProducts.map(p => [p.skuCode.trim().toUpperCase(), p]))

    // 5. Clean existing stock lots in WH-LYS-SR
    const deleteResult = await prisma.stockLot.deleteMany({
        where: { location: { warehouseId: wh.id } }
    })
    console.log(`✓ Cleaned ${deleteResult.count} previous stock lots in Showroom`)

    // 6. Import Stock Lots as of 11/07/2026
    const receivedDate = new Date('2026-07-11T00:00:00.000Z')
    let totalLotsCreated = 0
    let totalQtyImported = 0

    const locSummary: Record<string, number> = {
        'Kệ trong T1': 0,
        'Kệ ngoài T1 + W.show': 0,
        'Kệ rượu ngang': 0,
        'Tủ lạnh': 0
    }

    // Rows 5 to 162 are standard inventory products
    for (let i = 5; i < Math.min(163, data.length); i++) {
        const r = data[i] || []
        const sku = String(r[0] || '').trim()
        const vintageStr = String(r[2] || '').trim()

        if (!sku || sku.toLowerCase().includes('mã') || sku === 'undefined') continue

        const product = dbSkuMap.get(sku.toUpperCase())
        if (!product) {
            console.log(`⚠️ Skipped unmapped SKU at row ${i + 1}: ${sku}`)
            continue
        }

        const vintageInt = parseInt(vintageStr, 10)
        const vintage = isNaN(vintageInt) || vintageInt <= 0 ? null : vintageInt

        for (const locCfg of locationsConfig) {
            const qty = Number(r[locCfg.colIdx]) || 0
            if (qty > 0) {
                const locId = locationMap.get(locCfg.name)!
                const lotNo = `LOT-LYS-SR-20260711-${sku}-${locCfg.suffix}-R${i + 1}`

                await prisma.stockLot.create({
                    data: {
                        lotNo,
                        ownerEntityId: legalEntity.id,
                        productId: product.id,
                        locationId: locId,
                        qtyReceived: qty,
                        qtyAvailable: qty,
                        unitLandedCost: 0,
                        vintage: vintage,
                        status: 'AVAILABLE',
                        receivedDate: receivedDate
                    }
                })

                totalLotsCreated++
                totalQtyImported += qty
                locSummary[locCfg.name] += qty
            }
        }
    }

    console.log('\n=================== SHOWROOM IMPORT SUMMARY ===================')
    console.log(`Warehouse:          ${wh.name} (${wh.code})`)
    console.log(`Import Date:        11/07/2026`)
    console.log(`Deleted Old Lots:   ${deleteResult.count}`)
    console.log(`Created Stock Lots: ${totalLotsCreated}`)
    console.log(`Total Quantity:     ${totalQtyImported} bottles`)
    console.log('Location Breakdown:')
    for (const [locName, qty] of Object.entries(locSummary)) {
        console.log(`  - ${locName}: ${qty} bottles`)
    }
    console.log('=================================================================\n')

    // 7. Invalidate WMS Cache
    try {
        await revalidateCache('wms')
        console.log('✓ Invalidated WMS cache')
    } catch (e) {
        console.log('Cache invalidation note:', e)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
