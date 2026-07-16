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
    const process = (val: any): any => {
        if (val === null || val === undefined) return val
        if (typeof val === 'object') {
            if (val.constructor && (val.constructor.name === 'Decimal' || val.constructor.name === 'd' || typeof val.toNumber === 'function')) {
                return Number(val.toString())
            }
            if (val instanceof Date) {
                return val.toISOString()
            }
            if (Array.isArray(val)) {
                return val.map(process)
            }
            const res: any = {}
            for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                    res[key] = process(val[key])
                }
            }
            return res
        }
        if (typeof val === 'bigint') {
            return Number(val)
        }
        return val
    }
    return process(data)
}
