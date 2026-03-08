/**
 * Strips Prisma Decimal, BigInt, and Date types for safe JSON serialization to Next.js client.
 *
 * WHY: Prisma returns `Decimal` objects that can't be serialized across the
 * Server→Client boundary. Next.js will throw:
 *   "Only plain objects can be passed to Client Components from Server Components"
 *
 * USAGE: Wrap any `return` value in server actions/pages that may contain Prisma models.
 *   return serialize(prismaResult)
 */
export function serialize<T>(data: T): T {
    return JSON.parse(JSON.stringify(data, (_key, value) => {
        // Convert BigInt to number (safe for our use case — no values > Number.MAX_SAFE_INTEGER)
        if (typeof value === 'bigint') return Number(value)
        return value
    }))
}
