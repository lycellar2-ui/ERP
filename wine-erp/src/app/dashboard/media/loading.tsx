export default function Loading() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#E2E8F0', borderTopColor: '#0891B2' }} />
                <p className="text-sm" style={{ color: '#64748B' }}>Đang tải thư viện ảnh...</p>
            </div>
        </div>
    )
}
