import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { notifySOConfirmed } from '../src/lib/notifications'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

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
    console.log("🧪 Testing notifySOConfirmed for thukho & accounting...");

    await notifySOConfirmed({
        soNo: 'SO-TEST-2026',
        customerName: 'Khách hàng Thử Nghiệm',
        totalAmount: 15000000,
        salesRepName: 'Huy (Sales)',
        recipientEmails: ['thukho@lyscellars.com', 'accounting@lyscellars.com']
    });

    console.log("Checking DB notifications table...");
    const notis = await prisma.notification.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } }
    });

    console.log("Created notifications:", JSON.stringify(notis, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
