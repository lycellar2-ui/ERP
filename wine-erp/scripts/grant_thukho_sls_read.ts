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
    console.log("🔍 Checking permissions for role-thủ-kho...");

    const role = await prisma.role.findUnique({
        where: { id: 'role-thủ-kho' },
        include: {
            permissions: {
                include: { permission: true }
            }
        }
    });

    console.log("Role:", role?.name);
    console.log("Current Permissions:", role?.permissions.map(p => p.permission.code));

    // Ensure SLS:READ permission exists in DB
    let slsRead = await prisma.permission.findUnique({
        where: { code: 'SLS:READ' }
    });

    if (!slsRead) {
        slsRead = await prisma.permission.create({
            data: { code: 'SLS:READ', module: 'SLS', action: 'READ' }
        });
    }

    // Add SLS:READ to role-thủ-kho
    await prisma.rolePermission.upsert({
        where: {
            roleId_permissionId: {
                roleId: 'role-thủ-kho',
                permissionId: slsRead.id
            }
        },
        update: {},
        create: {
            roleId: 'role-thủ-kho',
            permissionId: slsRead.id
        }
    });

    console.log("✅ Granted SLS:READ permission to role-thủ-kho!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
