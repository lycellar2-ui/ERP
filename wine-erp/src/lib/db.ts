import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Supabase pooler uses self-signed certificates in its chain.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set')
    }

    // Transaction Pooler (port 6543 + pgBouncer)
    // Serverless: max 2 — each Vercel function gets its own pool,
    //   so with 10+ concurrent invocations, 2 × 10 = 20 is already near the limit.
    // Dev/long-lived: max 5 — single process reuses connections.
    const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: IS_SERVERLESS ? 2 : 5,
        idleTimeoutMillis: IS_SERVERLESS ? 5000 : 10000,
        connectionTimeoutMillis: 15000,
        allowExitOnIdle: true,
        statement_timeout: 30000,      // 30s query timeout to prevent hung queries
    })

    pool.on('error', (err) => {
        console.error('[DB Pool] Unexpected error on idle client:', err.message)
    })

    // Graceful shutdown — release connections back to pgBouncer on process exit
    const cleanup = () => {
        pool.end().catch(() => { })
    }
    process.once('SIGTERM', cleanup)
    process.once('SIGINT', cleanup)
    // Vercel serverless functions receive beforeExit when the function is about to freeze
    process.once('beforeExit', cleanup)

    const adapter = new PrismaPg(pool)
    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
    __dbPool?: pg.Pool
}

// Singleton — reuse across hot reloads (dev) and serverless invocations (prod)
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
// In production/serverless, still cache on globalThis to survive warm starts
if (IS_SERVERLESS) {
    globalForPrisma.prisma = prisma
}

/**
 * Retry wrapper for transient "Max client connections reached" errors.
 * Use for critical operations: await withRetry(() => prisma.user.findMany())
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 500
): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            const isConnectionError =
                message.includes('Max client connections reached') ||
                message.includes('connection timeout') ||
                message.includes('ECONNREFUSED') ||
                message.includes('too many connections')

            if (isConnectionError && attempt < retries) {
                console.warn(
                    `[DB Retry] Attempt ${attempt}/${retries} failed: ${message}. Retrying in ${delayMs * attempt}ms...`
                )
                await new Promise(r => setTimeout(r, delayMs * attempt))
                continue
            }
            throw err
        }
    }
    throw new Error('[DB Retry] Exhausted all retries')
}
