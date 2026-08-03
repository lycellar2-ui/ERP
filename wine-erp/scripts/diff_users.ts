import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log("🔍 Full diff between accounting and thukho...");

    const users: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM auth.users WHERE email IN ('accounting@lyscellars.com', 'thukho@lyscellars.com')
    `);

    const acc = users.find(u => u.email === 'accounting@lyscellars.com')
    const thu = users.find(u => u.email === 'thukho@lyscellars.com')

    for (const key of Object.keys(acc)) {
        const valAcc = JSON.stringify(acc[key])
        const valThu = JSON.stringify(thu[key])
        if (valAcc !== valThu) {
            console.log(`DIFF [${key}]:`);
            console.log(`  accounting: ${valAcc}`);
            console.log(`  thukho:     ${valThu}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
