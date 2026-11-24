'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[DashboardError]', error)
    }, [error])

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div className="w-full max-w-lg text-center p-8 sm:p-10 bg-lys-surface border border-lys-border rounded-lg shadow-sm">
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center bg-tone-danger-bg border border-tone-danger-border text-tone-danger-fg">
                    <AlertTriangle size={24} aria-hidden />
                </div>
                <h1 className="text-xl font-semibold text-lys-primary mb-2">
                    Không thể tải Dashboard
                </h1>
                <p className="text-sm text-lys-muted mb-3 leading-relaxed">
                    Có thể do mất kết nối database hoặc lỗi server. Vui lòng thử lại.
                </p>
                {error.message && (
                    <p className="font-mono text-xs text-tone-danger-fg bg-tone-danger-bg border border-tone-danger-border px-3 py-2 rounded-md mb-4 text-left break-all">
                        {error.message.slice(0, 300)}
                    </p>
                )}
                {error.digest && (
                    <p className="font-mono text-[11px] text-lys-muted mb-4">
                        Digest: {error.digest}
                    </p>
                )}
                <div className="flex flex-wrap gap-3 justify-center mt-5">
                    <Button variant="primary" onClick={reset}>
                        <RefreshCw size={14} aria-hidden />
                        Thử lại
                    </Button>
                    <Button variant="secondary" onClick={() => { window.location.href = '/login' }}>
                        Về trang đăng nhập
                    </Button>
                </div>
            </div>
        </div>
    )
}
