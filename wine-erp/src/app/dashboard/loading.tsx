export default function DashboardLoading() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="h-7 w-64 rounded" style={{ background: '#1B2E3D' }} />
                    <div className="h-4 w-48 rounded mt-2" style={{ background: '#142433' }} />
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-9 w-24 rounded" style={{ background: '#1B2E3D' }} />
                    ))}
                </div>
            </div>

            {/* KPI Cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-md p-6"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: '3px solid #2A4355' }}>
                        <div className="h-3 w-28 rounded mb-4" style={{ background: '#142433' }} />
                        <div className="h-8 w-24 rounded mb-2" style={{ background: '#142433' }} />
                        <div className="h-3 w-36 rounded" style={{ background: '#142433' }} />
                    </div>
                ))}
            </div>

            {/* Chart + Widget skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-md p-6"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="h-5 w-48 rounded mb-6" style={{ background: '#142433' }} />
                    <div className="flex items-end gap-3 h-40">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="h-3 w-10 rounded" style={{ background: '#142433' }} />
                                <div className="w-full rounded-t"
                                    style={{ height: `${20 + Math.random() * 80}px`, background: '#142433' }} />
                                <div className="h-3 w-8 rounded" style={{ background: '#142433' }} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-md p-6"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="h-5 w-36 rounded mb-4" style={{ background: '#142433' }} />
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-3 rounded"
                                style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="h-3 w-32 rounded mb-2" style={{ background: '#0A1926' }} />
                                <div className="h-3 w-20 rounded" style={{ background: '#0A1926' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom row skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-md p-6"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="h-5 w-32 rounded mb-5" style={{ background: '#142433' }} />
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(j => (
                                <div key={j} className="flex justify-between">
                                    <div className="h-3 w-28 rounded" style={{ background: '#142433' }} />
                                    <div className="h-3 w-20 rounded" style={{ background: '#142433' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
