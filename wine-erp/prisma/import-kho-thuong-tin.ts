import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🏭 Importing Australian Wine Inventory into Kho Thường Tín...')

    // 1. Find or create Kho Thường Tín warehouse
    let warehouse = await prisma.warehouse.findFirst({
        where: {
            OR: [
                { name: { contains: 'Thường Tín', mode: 'insensitive' } },
                { code: 'KHO-HNI-01' }
            ]
        }
    })

    if (!warehouse) {
        warehouse = await prisma.warehouse.create({
            data: {
                code: 'KHO-HNI-01',
                name: 'Kho Thường Tín',
                address: 'KCN Thường Tín, Hà Nội'
            }
        })
        console.log(`  ✓ Created Warehouse: ${warehouse.name}`)
    } else {
        console.log(`  ✓ Found Warehouse: ${warehouse.name} [Code: ${warehouse.code}]`)
    }

    // 2. Find or create a storage location in Kho Thường Tín
    let location = await prisma.location.findFirst({
        where: { warehouseId: warehouse.id }
    })

    if (!location) {
        location = await prisma.location.create({
            data: {
                warehouseId: warehouse.id,
                zone: 'A',
                rack: '01',
                bin: '01',
                locationCode: 'A-01-01',
                type: 'STORAGE',
                capacityCases: 500,
                tempControlled: true,
            }
        })
        console.log(`  ✓ Created Location: ${location.locationCode} in ${warehouse.name}`)
    }

    // 3. Find active legal entity
    const legalEntity = await prisma.legalEntity.findFirst({ where: { code: 'TA' } }) ||
        await prisma.legalEntity.findFirst()

    if (!legalEntity) {
        throw new Error('No legal entity found!')
    }

    // 4. Quantities to import for each Australian wine
    const itemsToImport = [
        { skuCode: 'L40010', name: 'Calabria The Wall Shiraz', qty: 600 },
        { skuCode: 'L40011', name: 'Calabria The Wall Chardonnay', qty: 600 },
        { skuCode: 'L40012', name: 'Calabria Guiding Star Shiraz', qty: 300 },
        { skuCode: 'L40013', name: 'Calabria Guiding Star Chardonnay', qty: 300 },
        { skuCode: 'L40014', name: 'Calabria Guiding Star Moscato', qty: 300 },
    ]

    console.log('\n  📦 Processing Stock Lots for Kho Thường Tín:')

    for (const item of itemsToImport) {
        const product = await prisma.product.findUnique({
            where: { skuCode: item.skuCode }
        })

        if (!product) {
            console.error(`  ❌ Product not found for SKU ${item.skuCode}`)
            continue
        }

        const lotNo = `LOT-THUONGTIN-${item.skuCode}-202607`

        const stockLot = await prisma.stockLot.upsert({
            where: { lotNo },
            update: {
                locationId: location.id,
                ownerEntityId: legalEntity.id,
                qtyReceived: item.qty,
                qtyAvailable: item.qty,
                status: 'AVAILABLE',
            },
            create: {
                lotNo,
                productId: product.id,
                locationId: location.id,
                ownerEntityId: legalEntity.id,
                vintage: 2024,
                receivedDate: new Date(),
                unitLandedCost: 150000,
                qtyReceived: item.qty,
                qtyAvailable: item.qty,
                status: 'AVAILABLE',
            }
        })

        console.log(`    ✅ ${item.name} (${item.skuCode}): SL Nhập ${item.qty} chai [Lô: ${stockLot.lotNo}]`)
    }

    console.log('\n🎉 Đã nhập kho thành công vào Kho Thường Tín!')
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi nhập kho Thường Tín:', e)
        process.exit(1)
    })
    .finally(() => pool.end())
