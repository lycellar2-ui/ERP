export default function DashboardLoading() {
    const barHeights = [45, 75, 55, 90, 65, 80]
    return (
        <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
            {/* Header skeleton */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="h-7 w-48 sm:w-64 rounded bg-slate-200/80" />
                    <div className="h-4 w-36 sm:w-48 rounded mt-2 bg-slate-200/60" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-9 w-20 sm:w-24 rounded-md bg-slate-200/70" />
                    ))}
                </div>
            </div>

            {/* KPI Cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-lg p-6 bg-white border border-lys-border border-l-3 border-l-slate-300">
                        <div className="h-3 w-28 rounded mb-4 bg-slate-200/70" />
                        <div className="h-8 w-24 rounded mb-2 bg-slate-200" />
                        <div className="h-3 w-36 rounded bg-slate-100" />
                    </div>
                ))}
            </div>

            {/* Chart + Widget skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg p-6 bg-white border border-lys-border">
                    <div className="h-5 w-48 rounded mb-6 bg-slate-200" />
                    <div className="flex items-end gap-3 h-40">
                        {barHeights.map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="h-3 w-10 rounded bg-slate-100" />
                                <div className="w-full rounded-t bg-slate-200/80" style={{ height: `${h}px` }} />
                                <div className="h-3 w-8 rounded bg-slate-100" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-lg p-6 bg-white border border-lys-border">
                    <div className="h-5 w-36 rounded mb-4 bg-slate-200" />
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                <div className="h-3 w-32 rounded mb-2 bg-slate-200" />
                                <div className="h-3 w-20 rounded bg-slate-200/70" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom row skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-lg p-6 bg-white border border-lys-border">
                        <div className="h-5 w-32 rounded mb-5 bg-slate-200" />
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(j => (
                                <div key={j} className="flex justify-between">
                                    <div className="h-3 w-28 rounded bg-slate-100" />
                                    <div className="h-3 w-20 rounded bg-slate-200/80" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
