export default function ReconciliationLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="h-14 rounded-lg bg-white border border-lys-border" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-white border border-lys-border p-4 space-y-2">
                        <div className="h-3 w-16 rounded bg-slate-200/70" />
                        <div className="h-6 w-20 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="h-16 rounded-lg bg-white border border-lys-border" />
            <div className="h-96 rounded-lg bg-white border border-lys-border" />
        </div>
    )
}
