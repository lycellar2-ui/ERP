export default function ReconciliationLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="h-14 rounded-xl" style={{ background: '#142433' }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl" style={{ background: '#142433' }} />
                ))}
            </div>
            <div className="h-16 rounded-xl" style={{ background: '#142433' }} />
            <div className="h-96 rounded-xl" style={{ background: '#142433' }} />
        </div>
    )
}
