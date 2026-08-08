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
    console.log('🚀 Starting GVM Inventory Overwrite (01/08/2026)...')

    // 1. Get Target Warehouse & Legal Entity
    const wh = await prisma.warehouse.findUnique({ where: { code: 'WH-TA-GVM' } })
    if (!wh) throw new Error('Warehouse WH-TA-GVM not found!')

    const legalEntity = (await prisma.legalEntity.findFirst({ where: { code: 'TA' } })) ||
                        (await prisma.legalEntity.findFirst({ where: { id: 'le-thang-an' } }))
    if (!legalEntity) throw new Error('Legal Entity TA (Thắng Ân) not found!')

    console.log(`✓ Target Warehouse: ${wh.name} (${wh.id})`)
    console.log(`✓ Legal Entity: ${legalEntity.name} (${legalEntity.id})`)

    // 2. Setup 9 GVM Locations (excluding "Hàng lẻ trong thùng")
    const locationsConfig = [
        { code: 'LOC-GVM-KE-HANG-LE', name: 'Kệ hàng lẻ', colIdx: 6, suffix: 'L1' },
        { code: 'LOC-GVM-KE-CANH-LE', name: 'Kệ cạnh hàng lẻ', colIdx: 7, suffix: 'L2' },
        { code: 'LOC-GVM-BON-RUA', name: 'Khu vực cạnh bồn rửa', colIdx: 8, suffix: 'L3' },
        { code: 'LOC-GVM-CUA-PHU', name: 'Khu vực sát cửa phụ', colIdx: 9, suffix: 'L4' },
        { code: 'LOC-GVM-CUA-CHINH', name: 'Khu vực cửa chính', colIdx: 10, suffix: 'L5' },
        { code: 'LOC-GVM-SAT-TUONG', name: 'Khu vực sát tường', colIdx: 11, suffix: 'L6' },
        { code: 'LOC-GVM-KE-MAU', name: 'Kệ hàng mẫu', colIdx: 13, suffix: 'L8' },
        { code: 'LOC-GVM-CUA-SO', name: 'Khu vực cửa sổ', colIdx: 14, suffix: 'L9' },
        { code: 'LOC-GVM-KHO-TANG-1', name: 'Khu vực kho tầng 1', colIdx: 15, suffix: 'L10' },
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
    console.log(`✓ Configured 9 physical locations for Kho GVM`)

    // 3. Load Excel Data from Sheet "Kiểm hàng t2"
    const filePath = 'D:\\Lyscellar\\Kế toán\\Kiểm kê\\Kiểm kê TA 01.08.26.xlsx'
    const workbook = xlsx.readFile(filePath)
    const sheet = workbook.Sheets['Kiểm hàng t2']
    if (!sheet) throw new Error('Sheet "Kiểm hàng t2" not found in Excel file!')

    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 })
    console.log(`✓ Read sheet "Kiểm hàng t2": ${data.length} rows`)

    // 4. Fetch Products for SKU Mapping
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    })
    const dbSkuMap = new Map(dbProducts.map(p => [p.skuCode.trim().toUpperCase(), p]))

    // 5. Clean / Zero out existing stock lots in WH-TA-GVM safely preserving FK integrity
    const existingLots = await prisma.stockLot.findMany({
        where: { location: { warehouseId: wh.id } },
        include: { doLines: true, grLines: true }
    })

    const lotsToDelete = existingLots.filter(l => l.doLines.length === 0 && l.grLines.length === 0)
    const lotsToZero = existingLots.filter(l => l.doLines.length > 0 || l.grLines.length > 0)

    if (lotsToDelete.length > 0) {
        const deleted = await prisma.stockLot.deleteMany({
            where: { id: { in: lotsToDelete.map(l => l.id) } }
        })
        console.log(`✓ Deleted ${deleted.count} unreferenced old stock lots from GVM`)
    }

    if (lotsToZero.length > 0) {
        await prisma.stockLot.updateMany({
            where: { id: { in: lotsToZero.map(l => l.id) } },
            data: { qtyAvailable: 0, status: 'CONSUMED' }
        })
        console.log(`✓ Zeroed out ${lotsToZero.length} historical DO-referenced stock lots in GVM (status: CONSUMED)`)
    }

    // 6. Import Stock Lots as of 01/08/2026
    const receivedDate = new Date('2026-08-01T00:00:00.000Z')
    let totalLotsCreated = 0
    let totalQtyImported = 0

    const locSummary: Record<string, number> = {}
    for (const locCfg of locationsConfig) {
        locSummary[locCfg.name] = 0
    }

    // Rows 6 onwards are product data
    for (let i = 6; i < data.length; i++) {
        const r = data[i] || []
        const sku = String(r[0] || '').trim()
        const vintageStr = String(r[2] || '').trim()

        if (!sku || sku.toLowerCase().includes('mã') || sku.toLowerCase().includes('tổng')) continue

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
                const lotNo = `LOT-GVM-20260801-${sku}-${locCfg.suffix}-R${i + 1}`

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

    console.log('\n=================== GVM IMPORT SUMMARY ===================')
    console.log(`Warehouse:          ${wh.name} (${wh.code})`)
    console.log(`Import Date:        01/08/2026`)
    console.log(`Deleted Old Lots:   ${lotsToDelete.length}`)
    console.log(`Zeroed DO Lots:     ${lotsToZero.length}`)
    console.log(`Created Stock Lots: ${totalLotsCreated}`)
    console.log(`Total Quantity:     ${totalQtyImported} bottles`)
    console.log('Location Breakdown (9 locations):')
    for (const [locName, qty] of Object.entries(locSummary)) {
        console.log(`  - ${locName}: ${qty} bottles`)
    }
    console.log('===========================================================\n')

    // 7. Invalidate WMS Cache
    try {
        await revalidateCache('wms')
        console.log('✓ Invalidated WMS cache')
    } catch (e) {
        console.log('Cache invalidation note:', e)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
