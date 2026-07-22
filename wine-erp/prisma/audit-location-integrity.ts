import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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
    console.log('🔍 Auditing Location Integrity & Constraints in Database...')

    // 1. Audit Locations per Warehouse
    const warehouses = await prisma.warehouse.findMany({
        include: {
            locations: {
                include: {
                    _count: { select: { stockLots: true } }
                }
            }
        }
    })

    console.log(`\n--- 1. Warehouse & Location Hierarchy (${warehouses.length} warehouses) ---`)
    for (const wh of warehouses) {
        console.log(`\n🏢 Warehouse [${wh.code}] ${wh.name} (ID: ${wh.id})`)
        console.log(`   Locations count: ${wh.locations.length}`)
        
        // Check for duplicate locationCodes within warehouse
        const codeSet = new Set<string>()
        let hasDupCode = false
        wh.locations.forEach(loc => {
            if (codeSet.has(loc.locationCode)) {
                console.error(`   ❌ CRITICAL: Duplicate locationCode "${loc.locationCode}" in warehouse ${wh.code}!`)
                hasDupCode = true
            }
            codeSet.add(loc.locationCode)
            console.log(`   📍 Location [${loc.locationCode}] | Zone: "${loc.zone}" | StockLots: ${loc._count.stockLots}`)
        })
        if (!hasDupCode) {
            console.log(`   ✅ Unique constraint ([warehouseId, locationCode]) is 100% VALID and clean!`)
        }
    }

    // 2. Audit Orphan Locations (locations pointing to invalid warehouses)
    const allLocations = await prisma.location.findMany({
        select: { id: true, warehouseId: true, locationCode: true }
    })
    const validWhIds = new Set(warehouses.map(w => w.id))
    const orphanLocations = allLocations.filter(l => !validWhIds.has(l.warehouseId))
    console.log(`\n--- 2. Orphan Location Check ---`)
    if (orphanLocations.length > 0) {
        console.error(`❌ Found ${orphanLocations.length} orphan locations!`)
    } else {
        console.log(`✅ Zero orphan locations found. All locations link cleanly to existing warehouses.`)
    }

    // 3. Audit StockLot Location Links
    const stockLots = await prisma.stockLot.findMany({
        select: { id: true, lotNo: true, locationId: true, qtyAvailable: true }
    })
    const validLocIds = new Set(allLocations.map(l => l.id))
    const orphanLots = stockLots.filter(l => !validLocIds.has(l.locationId))
    console.log(`\n--- 3. StockLot Location FK Check ---`)
    if (orphanLots.length > 0) {
        console.error(`❌ Found ${orphanLots.length} stock lots with invalid locationId!`)
    } else {
        console.log(`✅ All ${stockLots.length} StockLot records link cleanly to valid Locations (${validLocIds.size} locations).`)
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
