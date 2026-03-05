/**
 * Seed warehouse, locations
 * Run: node --env-file=.env.local -e "require('./prisma/seed-wms.ts')"
 * Or: npx tsx prisma/seed-wms.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🏭 Seeding WMS data...')

    // ─── Warehouses ───────────────────────────────
    console.log('  → Creating warehouses...')
    const khoHCM = await prisma.warehouse.upsert({
        where: { code: 'KHO-HCM-01' },
        update: {},
        create: {
            code: 'KHO-HCM-01',
            name: 'Kho Lạnh HCM (Bình Dương)',
            address: '15 Đường Xuyên Á, An Phú, Thuận An, Bình Dương',
        },
    })

    const khoHNI = await prisma.warehouse.upsert({
        where: { code: 'KHO-HNI-01' },
        update: {},
        create: {
            code: 'KHO-HNI-01',
            name: 'Kho Hà Nội (Gia Lâm)',
            address: 'KCN Phú Thị, Gia Lâm, Hà Nội',
        },
    })

    const showroom = await prisma.warehouse.upsert({
        where: { code: 'SHOWROOM-HCM' },
        update: {},
        create: {
            code: 'SHOWROOM-HCM',
            name: 'Showroom Quận 1',
            address: '12 Ngô Đức Kế, Bến Nghé, Quận 1, TP.HCM',
        },
    })

    console.log('  ✓ 3 warehouses')

    // ─── Locations ────────────────────────────────
    console.log('  → Creating locations...')
    const locationData = [
        // HCM warehouse — zones A, B, C
        ...[
            { zone: 'A', racks: ['01', '02', '03'], tempControlled: true },
            { zone: 'B', racks: ['01', '02'], tempControlled: false },
            { zone: 'C', racks: ['01'], tempControlled: false },
        ].flatMap(z =>
            z.racks.flatMap(rack =>
                ['01', '02', '03'].map(bin => ({
                    warehouseId: khoHCM.id,
                    zone: z.zone,
                    rack,
                    bin,
                    locationCode: `${z.zone}-${rack}-${bin}`,
                    type: 'STORAGE' as const,
                    capacityCases: 20,
                    tempControlled: z.tempControlled,
                }))
            )
        ),
        // HNI warehouse
        ...[
            { zone: 'A', racks: ['01', '02'], tempControlled: false },
            { zone: 'B', racks: ['01'], tempControlled: false },
        ].flatMap(z =>
            z.racks.flatMap(rack =>
                ['01', '02'].map(bin => ({
                    warehouseId: khoHNI.id,
                    zone: z.zone,
                    rack,
                    bin,
                    locationCode: `${z.zone}-${rack}-${bin}`,
                    type: 'STORAGE' as const,
                    capacityCases: 15,
                    tempControlled: z.tempControlled,
                }))
            )
        ),
        // Showroom
        { warehouseId: showroom.id, zone: 'SR', rack: '01', bin: '01', locationCode: 'SR-01-01', type: 'SHIPPING' as const, capacityCases: 10, tempControlled: true },
        { warehouseId: showroom.id, zone: 'SR', rack: '01', bin: '02', locationCode: 'SR-01-02', type: 'STORAGE' as const, capacityCases: 5, tempControlled: false },
    ]

    // Upsert locations
    for (const loc of locationData) {
        await prisma.location.upsert({
            where: { warehouseId_locationCode: { warehouseId: loc.warehouseId, locationCode: loc.locationCode } },
            update: {},
            create: loc,
        })
    }
    console.log(`  ✓ ${locationData.length} locations`)

    // ─── Stock Lots (demo data without GR) ────────
    console.log('  → Creating sample stock lots...')
    // Need product IDs and location IDs
    const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, skuCode: true },
        take: 8,
    })

    const hcmLoc_A01_01 = await prisma.location.findFirst({
        where: { warehouseId: khoHCM.id, locationCode: 'A-01-01' },
        select: { id: true },
    })
    const hcmLoc_A01_02 = await prisma.location.findFirst({
        where: { warehouseId: khoHCM.id, locationCode: 'A-01-02' },
        select: { id: true },
    })
    const hcmLoc_A02_01 = await prisma.location.findFirst({
        where: { warehouseId: khoHCM.id, locationCode: 'A-02-01' },
        select: { id: true },
    })
    const hcmLoc_B01_01 = await prisma.location.findFirst({
        where: { warehouseId: khoHCM.id, locationCode: 'B-01-01' },
        select: { id: true },
    })
    const hniLoc_A01_01 = await prisma.location.findFirst({
        where: { warehouseId: khoHNI.id, locationCode: 'A-01-01' },
        select: { id: true },
    })
    const showroomLoc = await prisma.location.findFirst({
        where: { warehouseId: showroom.id, locationCode: 'SR-01-01' },
        select: { id: true },
    })

    if (products.length < 4 || !hcmLoc_A01_01 || !hcmLoc_A01_02 || !hcmLoc_A02_01 || !hcmLoc_B01_01 || !hniLoc_A01_01 || !showroomLoc) {
        console.log('  ⚠ Skipping stock lots — missing products or locations')
        return
    }

    const stockLots: any[] = [
        { lotNo: `LOT-2503-0001`, productId: products[0].id, locationId: hcmLoc_A01_01.id, qtyReceived: 120, qtyAvailable: 96, unitLandedCost: 4_500_000, receivedDate: new Date('2025-03-10'), status: 'AVAILABLE' },
        { lotNo: `LOT-2503-0002`, productId: products[1].id, locationId: hcmLoc_A01_01.id, qtyReceived: 72, qtyAvailable: 72, unitLandedCost: 18_000_000, receivedDate: new Date('2025-03-10'), status: 'AVAILABLE' },
        { lotNo: `LOT-2503-0003`, productId: products[2].id, locationId: hcmLoc_A01_02.id, qtyReceived: 60, qtyAvailable: 48, unitLandedCost: 9_200_000, receivedDate: new Date('2025-03-12'), status: 'AVAILABLE' },
        { lotNo: `LOT-2503-0004`, productId: products[3].id, locationId: hcmLoc_A02_01.id, qtyReceived: 48, qtyAvailable: 12, unitLandedCost: 32_000_000, receivedDate: new Date('2025-02-20'), status: 'AVAILABLE' },
        { lotNo: `LOT-2503-0005`, productId: products[0].id, locationId: hcmLoc_B01_01.id, qtyReceived: 36, qtyAvailable: 36, unitLandedCost: 4_800_000, receivedDate: new Date('2025-03-01'), status: 'RESERVED' as const },
        { lotNo: `LOT-2502-0006`, productId: products[4 % products.length].id, locationId: hniLoc_A01_01.id, qtyReceived: 60, qtyAvailable: 55, unitLandedCost: 3_800_000, receivedDate: new Date('2025-02-15'), status: 'AVAILABLE' },
        { lotNo: `LOT-2502-0007`, productId: products[5 % products.length].id, locationId: hniLoc_A01_01.id, qtyReceived: 24, qtyAvailable: 24, unitLandedCost: 6_200_000, receivedDate: new Date('2025-02-20'), status: 'AVAILABLE' },
        { lotNo: `LOT-2503-0008`, productId: products[6 % products.length].id, locationId: showroomLoc.id, qtyReceived: 12, qtyAvailable: 9, unitLandedCost: 14_000_000, receivedDate: new Date('2025-03-05'), status: 'AVAILABLE' },
    ]

    for (const lot of stockLots) {
        await prisma.stockLot.upsert({
            where: { lotNo: lot.lotNo },
            update: {},
            create: lot,
        })
    }
    console.log(`  ✓ ${stockLots.length} stock lots`)

    console.log('\n✅ WMS seed complete!')
    console.log(`   Warehouses: 3 | Locations: ${locationData.length} | Stock lots: ${stockLots.length}`)
}

main()
    .catch(e => { console.error('❌ WMS seed failed:', e); process.exit(1) })
    .finally(async () => { await pool.end(); await prisma.$disconnect() })
