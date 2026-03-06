/**
 * Server-side in-memory cache with SWR (Stale-While-Revalidate).
 *
 * WHY: Each page navigation triggers server-side DB queries to Supabase Singapore (~63ms/query).
 * With 5-7 queries per page, that's 300-500ms PER NAVIGATION even with no data.
 * This cache stores results in server memory so subsequent requests = ~0ms.
 *
 * HOW: Map<key, {data, expiry, staleDeadline}> with TTL + SWR.
 * - Fresh (< expiry): Return cached data immediately
 * - Stale (expiry < now < staleDeadline): Return cached data immediately + refresh in background
 * - Dead (> staleDeadline): Fetch fresh data synchronously
 * Cache invalidates on mutations via revalidateCache().
 */

type CacheEntry<T> = {
    data: T
    expiry: number
    staleDeadline: number // 2x TTL — after this, truly expired
}

const cache = new Map<string, CacheEntry<unknown>>()

const DEFAULT_TTL_MS = 30_000 // 30 seconds
const STALE_MULTIPLIER = 3    // stale data lives 3x TTL before eviction

/**
 * Cache a server-side function result with SWR pattern.
 *
 * - FRESH hit: returns ~0ms
 * - STALE hit: returns ~0ms + background revalidation
 * - MISS: fetches from DB (blocks)
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
    const now = Date.now()
    const existing = cache.get(key) as CacheEntry<T> | undefined

    // FRESH — return immediately
    if (existing && now < existing.expiry) {
        return existing.data
    }

    // STALE — return immediately + background refresh (SWR)
    if (existing && now < existing.staleDeadline) {
        // Fire-and-forget background refresh
        fn().then(freshData => {
            cache.set(key, {
                data: freshData,
                expiry: Date.now() + ttlMs,
                staleDeadline: Date.now() + ttlMs * STALE_MULTIPLIER,
            })
        }).catch(() => {
            // On error, keep stale data — better than nothing
        })
        return existing.data
    }

    // MISS or DEAD — fetch synchronously
    const data = await fn()
    cache.set(key, {
        data,
        expiry: now + ttlMs,
        staleDeadline: now + ttlMs * STALE_MULTIPLIER,
    })
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
    let fresh = 0
    let stale = 0
    let dead = 0
    const now = Date.now()
    for (const entry of cache.values()) {
        const e = entry as CacheEntry<unknown>
        if (now < e.expiry) fresh++
        else if (now < e.staleDeadline) stale++
        else dead++
    }
    return { total: cache.size, fresh, stale, dead }
}
