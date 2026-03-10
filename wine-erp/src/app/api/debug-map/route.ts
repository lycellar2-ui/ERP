import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const url = new URL(req.url)
    const whId = url.searchParams.get('id')

    try {
        // Test 1: Get all warehouses IDs
        const warehouses = await prisma.warehouse.findMany({
            select: { id: true, code: true, name: true },
        })

        if (!whId) {
            return NextResponse.json({
                msg: 'Add ?id=<warehouseId> to test',
                warehouses,
            })
        }

        // Test 2: Simple location query (no stockLots)
        const locations = await prisma.location.findMany({
            where: { warehouseId: whId },
            select: {
                id: true, locationCode: true, zone: true, rack: true, bin: true,
                type: true, capacityCases: true, tempControlled: true,
                posX: true, posY: true, width: true, height: true,
            },
            take: 5,
        })

        // Test 3: StockLot query separately
        let stockLotsError: string | null = null
        let stockLotsCount = 0
        try {
            const locIds = locations.map(l => l.id)
            const lots = await prisma.stockLot.findMany({
                where: {
                    locationId: { in: locIds },
                    status: { in: ['AVAILABLE', 'RESERVED'] },
                },
                select: {
                    id: true, locationId: true, qtyAvailable: true, status: true,
                    product: { select: { skuCode: true, productName: true } },
                },
                take: 10,
            })
            stockLotsCount = lots.length
        } catch (err: any) {
            stockLotsError = err.message
        }

        return NextResponse.json({
            whId,
            locationCount: locations.length,
            locations: locations.slice(0, 3),
            stockLotsCount,
            stockLotsError,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) }, { status: 500 })
    }
}
