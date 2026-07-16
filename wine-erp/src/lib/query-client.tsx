'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is "fresh" for 30s — no refetch within this window
                staleTime: 30_000,
                // Cache kept in memory for 24h to support persister
                gcTime: 24 * 60 * 60 * 1000,
                // Don't refetch everything when user alt-tabs back
                refetchOnWindowFocus: false,
                // Only 1 retry on failure
                retry: 1,
                // Keep showing old data while fetching new data (no loading flash)
                placeholderData: (prev: unknown) => prev,
            },
        },
    })
}

// Singleton for browser — survives across navigations
let browserQueryClient: QueryClient | undefined

function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always create a new client (no shared state)
        return makeQueryClient()
    }
    // Browser: reuse the same client across navigations
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient()
        try {
            const persister = createSyncStoragePersister({
                storage: window.localStorage,
                key: 'WINE_ERP_QUERY_CACHE',
            })
            persistQueryClient({
                queryClient: browserQueryClient,
                persister,
                maxAge: 24 * 60 * 60 * 1000, // Keep cache for 24 hours
                buster: 'v2', // Increment to invalidate previous cache versions
            })
        } catch (err) {
            console.error('[Query Persistence] Failed to initialize:', err)
        }
    }
    return browserQueryClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(getQueryClient)
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

// Export for use in prefetch/invalidation
export { getQueryClient }
