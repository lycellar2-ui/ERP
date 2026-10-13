export default function ShipmentsLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="h-8 w-48 rounded bg-slate-200/80" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-white border border-lys-border p-4 space-y-2">
                        <div className="h-3 w-20 rounded bg-slate-200/70" />
                        <div className="h-6 w-24 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="h-[400px] rounded-lg bg-white border border-lys-border" />
        </div>
    )
}
