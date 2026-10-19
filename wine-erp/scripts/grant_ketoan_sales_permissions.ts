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
    console.log("🚀 Granting SLS:READ, SLS:APPROVE, WMS:READ permissions to role-kế-toán...");

    const roleId = 'role-kế-toán'
    const permCodes = ['SLS:READ', 'SLS:APPROVE', 'SLS:UPDATE', 'WMS:READ', 'CRM:READ']

    const perms = await prisma.permission.findMany({
        where: { code: { in: permCodes } }
    })

    for (const p of perms) {
        const exists = await prisma.rolePermission.findFirst({
            where: { roleId, permissionId: p.id }
        })
        if (!exists) {
            await prisma.rolePermission.create({
                data: { roleId, permissionId: p.id }
            })
            console.log(`✅ Granted ${p.code} to role-kế-toán`);
        } else {
            console.log(`ℹ️ ${p.code} already granted.`);
        }
    }

    console.log("🎉 SUCCESS! Role Kế Toán can now view and approve Sales Orders!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
