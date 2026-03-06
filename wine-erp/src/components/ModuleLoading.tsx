/**
 * Reusable loading skeleton for dashboard module pages.
 * Used as Next.js loading.tsx for instant Suspense fallback.
 */

const S = {
    bg: '#1B2E3D',
    dim: '#142433',
    border: '#2A4355',
    dark: '#0A1926',
}

function SkeletonBar({ w, h = 'h-3' }: { w: string; h?: string }) {
    return <div className={`${h} ${w} rounded`} style={{ background: S.dim }} />
}

function SkeletonCard() {
    return (
        <div className="rounded-md p-5" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
            <SkeletonBar w="w-28" h="h-3" />
            <SkeletonBar w="w-20" h="h-7" />
            <SkeletonBar w="w-36" h="h-3" />
        </div>
    )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <SkeletonBar w="w-56" h="h-7" />
                    <SkeletonBar w="w-40" h="h-4" />
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-28 rounded" style={{ background: S.bg }} />
                    <div className="h-9 w-9 rounded" style={{ background: S.bg }} />
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </div>

            {/* Filter bar */}
            <div className="flex gap-3">
                <div className="h-9 flex-1 max-w-sm rounded" style={{ background: S.bg, border: `1px solid ${S.border}` }} />
                <div className="h-9 w-32 rounded" style={{ background: S.bg, border: `1px solid ${S.border}` }} />
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ background: S.bg, border: `1px solid ${S.border}` }}>
                {/* Header row */}
                <div className="flex gap-4 p-3" style={{ borderBottom: `1px solid ${S.border}` }}>
                    {Array.from({ length: cols }).map((_, i) => (
                        <SkeletonBar key={i} w={i === 0 ? 'w-32' : 'w-24'} />
                    ))}
                </div>
                {/* Body rows */}
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex gap-4 p-3" style={{ borderBottom: `1px solid ${S.border}` }}>
                        {Array.from({ length: cols }).map((_, c) => (
                            <SkeletonBar key={c} w={c === 0 ? 'w-32' : 'w-20'} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function ModuleLoading() {
    return <TableSkeleton />
}
