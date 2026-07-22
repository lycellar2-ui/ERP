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
    console.log('🏷️ Updating Prices for 5 Australian Wines (Wholesale from TA, Retail from Ly)...')

    const user = await prisma.user.findFirst()
    if (!user) {
        throw new Error('No user found in database!')
    }

    const priceConfig = [
        {
            skuCode: 'L40010',
            name: 'Calabria The Wall Shiraz',
            wholesaleExclVat: 229000,
            wholesaleInclVat: 251900,
            retailExclVat: 385000,
            retailInclVat: 423500,
            costPrice: 150000,
        },
        {
            skuCode: 'L40011',
            name: 'Calabria The Wall Chardonnay',
            wholesaleExclVat: 229000,
            wholesaleInclVat: 251900,
            retailExclVat: 385000,
            retailInclVat: 423500,
            costPrice: 150000,
        },
        {
            skuCode: 'L40012',
            name: 'Calabria Guiding Star Shiraz',
            wholesaleExclVat: 269000,
            wholesaleInclVat: 295900,
            retailExclVat: 440000,
            retailInclVat: 484000,
            costPrice: 180000,
        },
        {
            skuCode: 'L40013',
            name: 'Calabria Guiding Star Chardonnay',
            wholesaleExclVat: 269000,
            wholesaleInclVat: 295900,
            retailExclVat: 440000,
            retailInclVat: 484000,
            costPrice: 180000,
        },
        {
            skuCode: 'L40014',
            name: 'Calabria Guiding Star Moscato',
            wholesaleExclVat: 269000,
            wholesaleInclVat: 295900,
            retailExclVat: 440000,
            retailInclVat: 484000,
            costPrice: 180000,
        },
    ]

    for (const p of priceConfig) {
        const product = await prisma.product.findUnique({
            where: { skuCode: p.skuCode }
        })

        if (!product) {
            console.error(`  ❌ Product ${p.skuCode} not found!`)
            continue
        }

        // 1. Upsert ProductMarginPrice (Stores wholesale, retail, cost for margin calculator)
        await prisma.productMarginPrice.upsert({
            where: { skuCode: p.skuCode },
            update: {
                wholesalePrice: p.wholesaleExclVat,
                retailPrice: p.retailExclVat,
                costPrice: p.costPrice,
            },
            create: {
                productId: product.id,
                skuCode: p.skuCode,
                wholesalePrice: p.wholesaleExclVat,
                retailPrice: p.retailExclVat,
                costPrice: p.costPrice,
            }
        })

        // 2. Clear old market prices for this product to avoid duplicates
        await prisma.marketPrice.deleteMany({
            where: { productId: product.id }
        })

        // 3. Insert Wholesale Price (File TA)
        await prisma.marketPrice.create({
            data: {
                product: { connect: { id: product.id } },
                enteredByUser: { connect: { id: user.id } },
                price: p.wholesaleExclVat,
                source: 'TA_WHOLESALE',
                priceDate: new Date(),
            }
        })

        // 4. Insert Retail Price (File Ly)
        await prisma.marketPrice.create({
            data: {
                product: { connect: { id: product.id } },
                enteredByUser: { connect: { id: user.id } },
                price: p.retailExclVat,
                source: 'LY_RETAIL',
                priceDate: new Date(),
            }
        })

        console.log(`  ✅ Cập nhật giá thành công [${p.skuCode}] ${p.name}:\n     • Giá Wholesale (File TA): ${p.wholesaleExclVat.toLocaleString()}đ (Chưa VAT) -> ${p.wholesaleInclVat.toLocaleString()}đ (Đã VAT)\n     • Giá Bán Lẻ (File Ly): ${p.retailExclVat.toLocaleString()}đ (Chưa VAT) -> ${p.retailInclVat.toLocaleString()}đ (Đã VAT)`)
    }

    console.log('\n🎉 Hoàn tất cập nhật cơ chế giá cho 5 sản phẩm rượu Úc!')
}

main()
    .catch((e) => {
        console.error('❌ Lỗi cập nhật giá:', e)
        process.exit(1)
    })
    .finally(() => pool.end())
