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
    console.log("Fetching all active suppliers from DB...");
    const suppliers = await prisma.supplier.findMany({
        where: { deletedAt: null },
        select: {
            id: true,
            code: true,
            name: true,
            country: true,
            defaultCurrency: true,
            type: true,
        }
    });
    console.log(`Found ${suppliers.length} active suppliers:`);
    suppliers.forEach((s, idx) => {
        console.log(`[${idx+1}] ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Country: ${s.country} | Currency: ${s.defaultCurrency} | Type: ${s.type}`);
    });
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
