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
    console.log("=== VERIFYING PRODUCT & PRODUCER DATABASE COUNTS ===");
    
    const productCount = await prisma.product.count();
    const producerCount = await prisma.producer.count();
    
    console.log(`- Products in Database: ${productCount}`);
    console.log(`- Producers in Database: ${producerCount}`);
    
    // Print a sample of 10 products
    const sampleProducts = await prisma.product.findMany({
        take: 10,
        select: {
            skuCode: true,
            productName: true,
            vintage: true,
            country: true,
            wineType: true,
            classification: true,
            producer: {
                select: {
                    name: true
                }
            }
        }
    });
    
    console.log("\n=== DATABASE PRODUCTS SAMPLE ===");
    sampleProducts.forEach((p, idx) => {
        console.log(`[${idx+1}] SKU: ${p.skuCode} | Name: "${p.productName}"`);
        console.log(`    Producer: "${p.producer.name}" | Vintage: ${p.vintage} | Country: ${p.country} | Type: ${p.wineType} | Class: ${p.classification}`);
    });
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
