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
    console.log("🧪 Checking thukho@lyscellars.com permissions & sales orders...");

    // Check user & roles & permissions
    const user = await prisma.user.findUnique({
        where: { email: 'thukho@lyscellars.com' },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            }
        }
    });

    const userPermissions = user?.roles.flatMap(r => r.role.permissions.map(p => p.permission.code)) || [];
    console.log("User Email:", user?.email);
    console.log("User Roles:", user?.roles.map(r => r.role.name));
    console.log("User Permissions:", userPermissions);
    console.log("Has SLS:READ permission?", userPermissions.includes('SLS:READ'));

    // Check count of Sales Orders in DB
    const totalOrders = await prisma.salesOrder.count();
    console.log(`Total Sales Orders in system: ${totalOrders}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
