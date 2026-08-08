import { prisma } from '../src/lib/db'
import { revalidateCache } from '../src/lib/cache'

async function main() {
    console.log("🚀 Deducting today's 5 Delivery Orders (30 bottles) from 01/08/2026 GVM stock...")

    const today = new Date('2026-08-08T00:00:00.000Z')

    // Fetch today's DO lines in WH-TA-GVM
    const doLines = await prisma.deliveryOrderLine.findMany({
        where: {
            do: {
                warehouseId: 'cmrvl95ds000048lq7vg4dllm',
                createdAt: { gte: today }
            }
        },
        include: {
            product: true,
            location: true,
            lot: true
        }
    })

    console.log(`Processing ${doLines.length} DO lines...`)
    let totalDeducted = 0

    for (const line of doLines) {
        const qtyToDeduct = Number(line.qtyShipped) || Number(line.qtyPicked) || 0
        if (qtyToDeduct <= 0) continue

        // Find available 01/08/2026 lot for this product in GVM
        // Prefer matching location zone if possible, else pick first available lot
        const availableLots = await prisma.stockLot.findMany({
            where: {
                productId: line.productId,
                location: { warehouseId: 'cmrvl95ds000048lq7vg4dllm' },
                status: 'AVAILABLE',
                qtyAvailable: { gte: qtyToDeduct }
            },
            include: { location: true },
            orderBy: { qtyAvailable: 'desc' }
        })

        if (availableLots.length === 0) {
            console.error(`❌ No available lot found for SKU ${line.product.skuCode} with qty >= ${qtyToDeduct}`)
            continue
        }

        // Match location if possible
        const targetLot = availableLots.find(l => l.location.zone === line.location.zone) || availableLots[0]

        // Update DO line to point to target 01/08 lot & location
        await prisma.deliveryOrderLine.update({
            where: { id: line.id },
            data: {
                lotId: targetLot.id,
                locationId: targetLot.locationId
            }
        })

        // Deduct stock from target lot
        const newQty = Number(targetLot.qtyAvailable) - qtyToDeduct
        await prisma.stockLot.update({
            where: { id: targetLot.id },
            data: {
                qtyAvailable: newQty,
                status: newQty === 0 ? 'CONSUMED' : 'AVAILABLE'
            }
        })

        console.log(`✓ SKU ${line.product.skuCode}: Deducted ${qtyToDeduct} bottles from lot ${targetLot.lotNo} (${targetLot.location.zone}). New QtyAvail: ${newQty}`)
        totalDeducted += qtyToDeduct
    }

    // Now delete old unreferenced zeroed lots if any remain
    const unreferencedOldLots = await prisma.stockLot.findMany({
        where: {
            location: { warehouseId: 'cmrvl95ds000048lq7vg4dllm' },
            doLines: { none: {} },
            grLines: { none: {} },
            status: 'CONSUMED',
            qtyAvailable: 0
        }
    })

    if (unreferencedOldLots.length > 0) {
        const delRes = await prisma.stockLot.deleteMany({
            where: { id: { in: unreferencedOldLots.map(l => l.id) } }
        })
        console.log(`✓ Deleted ${delRes.count} old zeroed-out lots that are now completely unreferenced`)
    }

    console.log(`\n✅ SUCCESSFULLY DEDUCTED TOTAL ${totalDeducted} BOTTLES FROM TODAY'S DOs`)

    try {
        await revalidateCache('wms')
    } catch (e) {}
}

main().catch(console.error).finally(() => prisma.$disconnect())
