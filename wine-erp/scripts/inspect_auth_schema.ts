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
    console.log("🔍 Checking triggers on auth.users...");

    const triggers: any[] = await prisma.$queryRawUnsafe(`
        SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing
        FROM information_schema.triggers
        WHERE event_object_schema = 'auth'
    `);

    console.log("Triggers in auth schema:", JSON.stringify(triggers, null, 2));

    console.log("\n🔍 Checking functions in auth schema...");
    const funcs: any[] = await prisma.$queryRawUnsafe(`
        SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'auth'
    `);
    console.log("Functions in auth schema:", funcs.map(f => f.routine_name));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
