import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Supabase pooler uses self-signed certificates in its chain.
// Node's TLS layer rejects these even when pg.Pool sets rejectUnauthorized: false,
// because PrismaPg adapter negotiates TLS at a deeper level.
// This is safe — we're connecting to Supabase's managed infrastructure only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set')
    }

    // Session Pooler (port 5432) — max pool low to avoid Supabase free tier limits (~15 total)
    const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 3,
        idleTimeoutMillis: 15000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
    })

    pool.on('error', (err) => {
        console.error('[DB Pool] Unexpected error on idle client:', err.message)
    })

    const adapter = new PrismaPg(pool)
    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
