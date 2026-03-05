export default function SubPageLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            {/* Title skeleton */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="h-7 w-56 rounded" style={{ background: '#1B2E3D' }} />
                    <div className="h-4 w-80 rounded mt-2" style={{ background: '#142433' }} />
                </div>
                <div className="h-10 w-32 rounded" style={{ background: '#1B2E3D' }} />
            </div>

            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="p-4 rounded-md flex items-center gap-4"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-md" style={{ background: '#142433' }} />
                        <div>
                            <div className="h-3 w-20 rounded mb-2" style={{ background: '#142433' }} />
                            <div className="h-6 w-16 rounded" style={{ background: '#142433' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter bar skeleton */}
            <div className="flex gap-3">
                <div className="flex-1 h-10 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }} />
                <div className="h-10 w-40 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }} />
            </div>

            {/* Table skeleton */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex gap-4 px-4 py-3" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                    {[80, 120, 60, 80, 100, 60, 80, 60].map((w, i) => (
                        <div key={i} className="h-3 rounded" style={{ width: w, background: '#1B2E3D' }} />
                    ))}
                </div>
                {/* Rows */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex gap-4 px-4 py-4 items-center"
                        style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                        {[80, 120, 60, 80, 100, 60, 80, 60].map((w, j) => (
                            <div key={j} className="h-3 rounded" style={{ width: w, background: '#1B2E3D' }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
