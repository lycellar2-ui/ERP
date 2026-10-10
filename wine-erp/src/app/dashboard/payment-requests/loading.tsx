import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="flex h-96 w-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#B91C1C]" />
                <p className="text-sm font-medium text-slate-500">Đang tải phân hệ Đề nghị thanh toán...</p>
            </div>
        </div>
    )
}
