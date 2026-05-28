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
    console.log("🔍 Checking Chateau Petrus product in DB...");
    const p = await prisma.product.findFirst({
        where: {
            OR: [
                { skuCode: { contains: 'PETRUS', mode: 'insensitive' } },
                { productName: { contains: 'Petrus', mode: 'insensitive' } }
            ]
        },
        include: {
            producer: true,
            appellation: true
        }
    });

    if (!p) {
        console.log("❌ No product found matching 'PETRUS'!");
    } else {
        console.log("✅ Product Found:");
        console.log(JSON.stringify(p, null, 2));
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
        await prisma.$disconnect();
    });
