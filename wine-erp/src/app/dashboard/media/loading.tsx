export default function Loading() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#2A4355', borderTopColor: '#87CBB9' }} />
                <p className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải thư viện ảnh...</p>
            </div>
        </div>
    )
}
