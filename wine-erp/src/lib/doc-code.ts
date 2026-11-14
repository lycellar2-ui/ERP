function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Collision-safe sequential document code generator.
 * Scans existing codes matching `^<prefix><digits>$` (preferring `findMany`
 * so non-numeric or differently suffixed entries like `JE-COGS-20266-69rdla`
 * do not shadow sequential entries), with graceful fallbacks to `findFirst`
 * and `count()` for partial unit-test Prisma mocks.
 */
export async function generateNextDocCode(
    model: {
        findMany?: (args: any) => Promise<Record<string, any>[]>
        findFirst?: (args: any) => Promise<Record<string, any> | null>
        count?: (args?: any) => Promise<number>
    },
    field: string,
    prefix: string,
    padLength = 6
): Promise<string> {
    const exactPattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`)
    let maxNum = 0

    if (typeof model?.findMany === 'function') {
        const rows = await model.findMany({
            where: { [field]: { startsWith: prefix } },
            select: { [field]: true },
        })
        if (Array.isArray(rows)) {
            for (const row of rows) {
                const rawCode = row?.[field]
                if (typeof rawCode !== 'string') continue
                const match = rawCode.match(exactPattern)
                if (!match) continue
                const parsed = parseInt(match[1], 10)
                if (!Number.isNaN(parsed) && parsed > maxNum) {
                    maxNum = parsed
                }
            }
        }
        return `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`
    }

    let nextNum = 1
    if (typeof model?.findFirst === 'function') {
        const latest = await model.findFirst({
            where: { [field]: { startsWith: prefix } },
            orderBy: { [field]: 'desc' },
            select: { [field]: true },
        })
        const rawCode = latest?.[field]
        if (typeof rawCode === 'string') {
            const match = rawCode.match(exactPattern) ?? rawCode.match(/(\d+)$/)
            if (match) {
                const parsed = parseInt(match[1], 10)
                if (!Number.isNaN(parsed)) nextNum = parsed + 1
            }
        } else if (typeof model?.count === 'function') {
            const cnt = await model.count()
            nextNum = (Number.isFinite(cnt) ? cnt : 0) + 1
        }
    } else if (typeof model?.count === 'function') {
        const cnt = await model.count()
        nextNum = (Number.isFinite(cnt) ? cnt : 0) + 1
    }
    return `${prefix}${String(nextNum).padStart(padLength, '0')}`
}
