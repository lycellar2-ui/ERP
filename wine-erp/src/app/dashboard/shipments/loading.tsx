export default function ShipmentsLoading() {
    return (
        <div className="space-y-6 max-w-screen-2xl animate-pulse">
            <div className="h-8 w-48 rounded" style={{ background: '#1B2E3D' }} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl" style={{ background: '#1B2E3D' }} />
                ))}
            </div>
            <div className="h-[400px] rounded-2xl" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }} />
        </div>
    )
}
