import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const isDryRun = process.argv.includes('--dry-run')

async function run() {
    console.log(`[Sync] Starting showroom count synchronization to ERP... (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'})`)

    // 1. Fetch Warehouses
    const whShowroom = await prisma.warehouse.findUnique({ where: { code: 'WH-LYS-SR' } })
    const whGvm = await prisma.warehouse.findUnique({ where: { code: 'WH-TA-GVM' } })

    if (!whShowroom || !whGvm) {
        throw new Error('Could not find WH-LYS-SR or WH-TA-GVM warehouses')
    }

    // 2. Fetch all locations for both warehouses
    const locations = await prisma.location.findMany({
        where: { warehouseId: { in: [whShowroom.id, whGvm.id] } }
    })

    const locMap = new Map<string, string>() // code -> id
    for (const l of locations) {
        locMap.set(l.locationCode, l.id)
    }

    // Helper to find locationId by spot
    function resolveLocationId(groupName: string, spotName: string): { warehouseId: string; locationId: string; locationCode: string } {
        if (groupName.includes('Tầng 1') || groupName.includes('Showroom')) {
            const whId = whShowroom!.id
            if (spotName.includes('Tủ lạnh')) return { warehouseId: whId, locationId: locMap.get('LOC-LYS-SR-TU-LANH') || locations[0].id, locationCode: 'LOC-LYS-SR-TU-LANH' }
            if (spotName.includes('ngang')) return { warehouseId: whId, locationId: locMap.get('LOC-LYS-SR-KE-NGANG') || locations[0].id, locationCode: 'LOC-LYS-SR-KE-NGANG' }
            if (spotName.includes('trong')) return { warehouseId: whId, locationId: locMap.get('LOC-LYS-SR-KE-TRONG-T1') || locations[0].id, locationCode: 'LOC-LYS-SR-KE-TRONG-T1' }
            return { warehouseId: whId, locationId: locMap.get('LOC-LYS-SR-KE-NGOAI-T1') || locations[0].id, locationCode: 'LOC-LYS-SR-KE-NGOAI-T1' }
        }

        // Tầng 2 -> GVM
        const whId = whGvm!.id
        if (spotName.includes('Kệ hàng lẻ')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A1') || locMap.get('LOC-GVM-KE-HANG-LE') || locations[0].id, locationCode: 'LOC-GVM-A1' }
        if (spotName.includes('cạnh hàng lẻ')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A2') || locMap.get('LOC-GVM-KE-CANH-LE') || locations[0].id, locationCode: 'LOC-GVM-A2' }
        if (spotName.includes('bồn rửa')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A3') || locMap.get('LOC-GVM-BON-RUA') || locations[0].id, locationCode: 'LOC-GVM-A3' }
        if (spotName.includes('cửa phụ')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A4') || locMap.get('LOC-GVM-CUA-PHU') || locations[0].id, locationCode: 'LOC-GVM-A4' }
        if (spotName.includes('cửa chính') || spotName.includes('cầu thang')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A5') || locMap.get('LOC-GVM-CUA-CHINH') || locations[0].id, locationCode: 'LOC-GVM-A5' }
        if (spotName.includes('sát tường')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A6') || locMap.get('LOC-GVM-SAT-TUONG') || locations[0].id, locationCode: 'LOC-GVM-A6' }
        if (spotName.includes('hàng mẫu')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A7') || locMap.get('LOC-GVM-KE-MAU') || locations[0].id, locationCode: 'LOC-GVM-A7' }
        if (spotName.includes('cửa sổ')) return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A8') || locMap.get('LOC-GVM-CUA-SO') || locations[0].id, locationCode: 'LOC-GVM-A8' }

        return { warehouseId: whId, locationId: locMap.get('LOC-GVM-A6') || locations[0].id, locationCode: 'LOC-GVM-A6' }
    }

    // 3. Fetch count entries
    const entries = await prisma.showroomCountEntry.findMany({
        include: {
            item: true,
            spot: true
        }
    })

    console.log(`[Sync] Found ${entries.length} showroom count entries.`)

    // 4. Fetch Products to map codes
    const products = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    })
    const productMap = new Map<string, { id: string; name: string }>()
    for (const p of products) {
        productMap.set(p.skuCode.toUpperCase().trim(), { id: p.id, name: p.productName })
    }

    // 5. Aggregate entries by warehouse + location + product + vintage
    type AggregatedKey = {
        warehouseId: string
        locationId: string
        locationCode: string
        productId: string
        skuCode: string
        vintage: number | null
        qtyActual: number
    }

    const aggregated = new Map<string, AggregatedKey>()
    let unmappedCount = 0

    for (const entry of entries) {
        const cleanSku = (entry.item.code || '').toUpperCase().trim()
        const prod = productMap.get(cleanSku)
        if (!prod) {
            unmappedCount++
            continue
        }

        const vintage = entry.item.vintage && /^\d{4}$/.test(entry.item.vintage.trim())
            ? parseInt(entry.item.vintage.trim(), 10)
            : null

        const { warehouseId, locationId, locationCode } = resolveLocationId(entry.spot.groupName, entry.spot.name)
        const key = `${warehouseId}_${locationId}_${prod.id}_${vintage || 'NV'}`

        const existing = aggregated.get(key)
        if (existing) {
            existing.qtyActual += entry.qty
        } else {
            aggregated.set(key, {
                warehouseId,
                locationId,
                locationCode,
                productId: prod.id,
                skuCode: cleanSku,
                vintage,
                qtyActual: entry.qty
            })
        }
    }

    console.log(`[Sync] Aggregated into ${aggregated.size} unique lot/location lines. (Unmapped SKUs: ${unmappedCount})`)

    const srLines = Array.from(aggregated.values()).filter(a => a.warehouseId === whShowroom.id)
    const gvmLines = Array.from(aggregated.values()).filter(a => a.warehouseId === whGvm.id)

    console.log(`[Sync] Showroom T1 lines: ${srLines.length} | Total bottles: ${srLines.reduce((s, l) => s + l.qtyActual, 0)}`)
    console.log(`[Sync] GVM T2 lines: ${gvmLines.length} | Total bottles: ${gvmLines.reduce((s, l) => s + l.qtyActual, 0)}`)

    if (isDryRun) {
        console.log('[Sync] Dry run complete! Run without --dry-run to commit changes.')
        await pool.end()
        return
    }

    // Function to create and approve session for a warehouse
    async function createAndApproveSession(whId: string, whCode: string, whName: string, lines: AggregatedKey[]) {
        if (lines.length === 0) return
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const sessionNo = `KK-${whCode}-${dateStr}-CHOT`
        const title = `Kiểm kê chốt tồn đầu kỳ - ${whName}`

        console.log(`[Sync] Creating StockCountSession ${sessionNo}...`)
        const session = await prisma.stockCountSession.create({
            data: {
                sessionNo,
                title,
                warehouseId: whId,
                type: 'FULL_PHYSICAL',
                scopeType: 'FULL_WAREHOUSE',
                status: 'APPROVED',
                completedAt: new Date(),
                lines: {
                    create: lines.map(l => ({
                        productId: l.productId,
                        locationId: l.locationId,
                        locationCode: l.locationCode,
                        vintage: l.vintage,
                        qtySystem: 0,
                        qtyActual: l.qtyActual,
                        variance: l.qtyActual,
                        countedAt: new Date()
                    }))
                }
            }
        })

        console.log(`[Sync] Created session ${session.id}. Updating StockLots...`)

        // Update StockLots directly in transaction
        await prisma.$transaction(async (tx) => {
            for (const line of lines) {
                const vintageFilter = line.vintage !== null
                    ? { vintage: line.vintage }
                    : { OR: [{ vintage: null }, { vintage: 0 }] }

                let lot = await tx.stockLot.findFirst({
                    where: {
                        productId: line.productId,
                        locationId: line.locationId,
                        ...vintageFilter,
                        status: 'AVAILABLE'
                    }
                })

                if (lot) {
                    await tx.stockLot.update({
                        where: { id: lot.id },
                        data: {
                            qtyOnHand: line.qtyActual,
                            qtyAvailable: line.qtyActual
                        }
                    })
                } else {
                    // Create new lot
                    const lotNo = `LOT-${whCode}-${line.skuCode}-${line.vintage || 'NV'}-${dateStr}`
                    const ownerEntity = await tx.legalEntity.findFirst()
                    if (ownerEntity) {
                        await tx.stockLot.create({
                            data: {
                                lotNo,
                                ownerEntityId: ownerEntity.id,
                                productId: line.productId,
                                locationId: line.locationId,
                                vintage: line.vintage,
                                qtyReceived: line.qtyActual,
                                qtyOnHand: line.qtyActual,
                                qtyAvailable: line.qtyActual,
                                unitLandedCost: 0,
                                receivedDate: new Date(),
                                status: 'AVAILABLE'
                            }
                        })
                    }
                }
            }
        })

        console.log(`[Sync] Completed sync for ${whName}!`)
    }

    await createAndApproveSession(whShowroom.id, whShowroom.code, whShowroom.name, srLines)
    await createAndApproveSession(whGvm.id, whGvm.code, whGvm.name, gvmLines)

    console.log('[Sync] All done!')
    await pool.end()
}

run().catch(err => {
    console.error('[Sync] Fatal error:', err)
    process.exit(1)
})
