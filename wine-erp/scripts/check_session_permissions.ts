import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import { getPermissionsForRoles } from '../src/lib/session'

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
    console.log("🔍 Checking permissions fetched by session layer...");

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

    if (!user) return;

    const roleNames = user.roles.map(r => r.role.name);
    const roleIds = user.roles.map(r => r.role.id);

    console.log("User Roles:", roleNames);
    console.log("Role IDs:", roleIds);

    const permissions = await getPermissionsForRoles(roleIds);
    console.log("Permissions from getPermissionsForRoles:", permissions);
    console.log("Includes SLS:READ?", permissions.includes('SLS:READ'));
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
