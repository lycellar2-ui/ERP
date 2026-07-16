'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is "fresh" for 30s — no refetch within this window
                staleTime: 30_000,
                // Cache kept for 10 minutes after last subscriber unmounts
                gcTime: 10 * 60_000,
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
