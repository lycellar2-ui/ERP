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
    console.log("🔍 Querying auth.identities...");

    const identities: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM auth.identities LIMIT 10
    `);

    console.log("Identities sample:", JSON.stringify(identities, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
