import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Test 1: Simple count
        const count = await prisma.warehouse.count()

        // Test 2: Simple findMany (no includes)
        const simple = await prisma.warehouse.findMany({
            select: { id: true, code: true, name: true, address: true },
            orderBy: { name: 'asc' },
        })

        // Test 3: With location count
        const withLocations = await prisma.warehouse.findMany({
            include: {
                _count: { select: { locations: true } },
            },
            orderBy: { name: 'asc' },
        })

        // Test 4: Full nested include (same as getWarehouses)
        let fullData: any = null
        let fullError: string | null = null
        try {
            fullData = await prisma.warehouse.findMany({
                include: {
                    locations: {
                        include: {
                            stockLots: {
                                where: { status: { in: ['AVAILABLE', 'RESERVED'] } },
                                select: { qtyAvailable: true, unitLandedCost: true },
                            },
                        },
                    },
                },
                orderBy: { name: 'asc' },
            })
        } catch (err: any) {
            fullError = err.message || String(err)
        }

        return NextResponse.json({
            test1_count: count,
            test2_simple: simple,
            test3_withLocations: withLocations.map(w => ({
                id: w.id, code: w.code, name: w.name, locationCount: w._count.locations
            })),
            test4_full: fullError ? { error: fullError } : {
                count: fullData?.length,
                warehouses: fullData?.map((w: any) => ({
                    id: w.id,
                    code: w.code,
                    locationCount: w.locations.length,
                    lotCount: w.locations.flatMap((l: any) => l.stockLots).length,
                }))
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
