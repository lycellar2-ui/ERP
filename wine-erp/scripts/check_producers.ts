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
    console.log("=== LISTING ALL PRODUCERS IN DATABASE ===");
    const producers = await prisma.producer.findMany();
    console.log(`Total producers: ${producers.length}`);
    producers.forEach((p, idx) => {
        console.log(`[${idx+1}] ID: ${p.id} | Name: "${p.name}" | Country: "${p.country}"`);
    });
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    });
