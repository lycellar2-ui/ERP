export default function SubPageLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            {/* Title skeleton */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-7 w-56 rounded bg-slate-200/80" />
                    <div className="h-4 w-80 rounded mt-2 bg-slate-200/60" />
                </div>
                <div className="h-9 w-32 rounded-md bg-slate-200/80" />
            </div>

            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="p-4 rounded-lg flex items-center gap-4 bg-white border border-lys-border">
                        <div className="w-10 h-10 rounded-md bg-slate-100" />
                        <div>
                            <div className="h-3 w-20 rounded mb-2 bg-slate-200/70" />
                            <div className="h-6 w-16 rounded bg-slate-200" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar skeleton */}
            <div className="flex gap-3">
                <div className="flex-1 h-9 rounded-md bg-white border border-lys-border" />
                <div className="h-9 w-40 rounded-md bg-white border border-lys-border" />
            </div>

            {/* Table skeleton */}
            <div className="rounded-lg overflow-hidden bg-white border border-lys-border">
                {/* Header */}
                <div className="flex gap-4 px-4 py-3 bg-lys-subtle border-b border-lys-border">
                    {[80, 120, 60, 80, 100, 60, 80, 60].map((w, i) => (
                        <div key={i} className="h-3 rounded bg-slate-200" style={{ width: w }} />
                    ))}
                </div>
                {/* Rows */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex gap-4 px-4 py-3.5 items-center border-b border-lys-border last:border-b-0">
                        {[80, 120, 60, 80, 100, 60, 80, 60].map((w, j) => (
                            <div key={j} className="h-3 rounded bg-slate-100" style={{ width: w }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
