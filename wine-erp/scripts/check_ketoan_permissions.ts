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
    console.log("🔍 Looking for SLS permissions in DB...");

    const slsPerms = await prisma.permission.findMany({
        where: { code: { startsWith: 'SLS' } }
    });

    console.log("SLS permissions:", slsPerms);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
