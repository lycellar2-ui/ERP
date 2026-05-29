import * as fs from 'fs'
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
    console.log("🍷 Restoring Product Images from Shopify Crawled JSON...");

    // 1. Load Crawled Shopify Products
    const shopifyProducts: any[] = [];
    for (const page of [1, 2, 3]) {
        const file = `d:\\Lyruou\\lyscellars_products_p${page}.json`;
        const path = page === 1 ? `d:\\Lyruou\\lyscellars_products.json` : file;
        
        if (fs.existsSync(path)) {
            const raw = fs.readFileSync(path, 'utf8');
            const json = JSON.parse(raw.trim().replace(/^\uFEFF/, ''));
            if (json.products) {
                shopifyProducts.push(...json.products);
            }
        }
    }
    console.log(`Loaded ${shopifyProducts.length} crawled products from JSON files.`);

    // 2. Fetch all products from DB
    const dbProducts = await prisma.product.findMany({
        select: { id: true, skuCode: true, productName: true }
    });
    console.log(`Loaded ${dbProducts.length} products from Database.`);

    // Map skuCode (lowercase) to DB product
    const productMap = new Map<string, any>();
    dbProducts.forEach(p => productMap.set(p.skuCode.toLowerCase().trim(), p));

    let restoredCount = 0;

    for (const sp of shopifyProducts) {
        const rawSku = sp.variants?.[0]?.sku;
        if (!rawSku) continue;
        
        const sku = rawSku.trim().toLowerCase();
        
        // Find by SKU code
        let dbProd = productMap.get(sku);
        
        // If not found, check if it matches a vintage suffix (e.g. L20019 matches L20019-21)
        if (!dbProd) {
            for (const [dbSku, prod] of productMap.entries()) {
                if (dbSku.startsWith(sku + '-')) {
                    dbProd = prod;
                    break;
                }
            }
        }

        if (!dbProd) continue;

        // Get image URL
        const imageUrl = sp.image?.src || sp.images?.[0]?.src;
        if (!imageUrl) continue;

        // Check if product already has media
        const existingMedia = await prisma.productMedia.findFirst({
            where: { productId: dbProd.id }
        });

        if (!existingMedia) {
            await prisma.productMedia.create({
                data: {
                    productId: dbProd.id,
                    url: imageUrl,
                    mediaType: 'PRODUCT_MAIN',
                    isPrimary: true
                }
            });
            console.log(`   ✓ Restored image for [${dbProd.skuCode}] -> ${imageUrl}`);
            restoredCount++;
        }
    }

    console.log(`\n🎉 Image restoration completed! Restored ${restoredCount} product images successfully.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
