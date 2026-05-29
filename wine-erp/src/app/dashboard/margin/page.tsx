import { Suspense } from 'react'
import { getMarginProducts } from './actions'
import { MarginClient } from './MarginClient'
import { getCurrentUser, hasRole } from '@/lib/session'

export const metadata = { title: 'Mô Phỏng Margin Giá Vang | Wine ERP' }

export default async function MarginPage() {
    // Fetch initial products and current user roles in parallel
    const [initialRows, user] = await Promise.all([
        getMarginProducts().catch(() => []),
        getCurrentUser().catch(() => null)
    ])

    const isAdmin = user ? hasRole(user, 'CEO', 'ADMIN') : false

    return (
        <Suspense fallback={<MarginPageSkeleton />}>
            <MarginClient initialRows={initialRows} isAdmin={isAdmin} />
        </Suspense>
    )
}

function MarginPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-16 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
                ))}
            </div>
            <div className="h-12 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="h-96 rounded-2xl animate-pulse" style={{ background: '#1B2E3D' }} />
        </div>
    )
}
