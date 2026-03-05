/**
 * Server-side in-memory cache for database query results.
 *
 * WHY: Each page navigation triggers server-side DB queries to Supabase Singapore (~63ms/query).
 * With 5-7 queries per page, that's 300-500ms PER NAVIGATION even with no data.
 * This cache stores results in server memory so subsequent requests = ~0ms.
 *
 * HOW: Simple Map<key, {data, expiry}> with TTL. No external dependencies.
 * Cache invalidates on mutations via revalidateCache().
 */

type CacheEntry<T> = {
    data: T
    expiry: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 30_000 // 30 seconds

/**
 * Cache a server-side function result. If cached value exists and hasn't expired,
 * returns it immediately (~0ms) instead of hitting the database.
 *
 * @param key - Unique cache key (e.g., 'dashboard:stats:month')
 * @param fn - Async function that fetches data
 * @param ttlMs - Time-to-live in milliseconds (default: 30s)
 */
export async function cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
    const existing = cache.get(key) as CacheEntry<T> | undefined

    if (existing && Date.now() < existing.expiry) {
        return existing.data
    }

    const data = await fn()
    cache.set(key, { data, expiry: Date.now() + ttlMs })
    return data
}

/**
 * Invalidate all cache entries matching a prefix.
 * Call this after mutations (create/update/delete).
 *
 * @param prefix - Key prefix to invalidate (e.g., 'sales' invalidates 'sales:orders', 'sales:stats')
 */
export function revalidateCache(prefix?: string) {
    if (!prefix) {
        cache.clear()
        return
    }
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key)
        }
    }
}

/**
 * Get current cache stats (for debugging)
 */
export function getCacheStats() {
    let active = 0
    let expired = 0
    const now = Date.now()
    for (const entry of cache.values()) {
        if (now < (entry as CacheEntry<unknown>).expiry) active++
        else expired++
    }
    return { total: cache.size, active, expired }
}
