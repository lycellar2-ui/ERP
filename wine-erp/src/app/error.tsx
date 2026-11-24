'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[GlobalError]', error)
    }, [error])

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-lys-bg">
            <div className="w-full max-w-md text-center p-8 sm:p-10 bg-lys-surface border border-lys-border rounded-lg shadow-sm">
                <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-lg bg-tone-warning-bg border border-tone-warning-border flex items-center justify-center text-tone-warning-fg">
                        <AlertTriangle size={28} aria-hidden />
                    </div>
                </div>
                <h1 className="text-xl font-semibold text-lys-primary mb-2">
                    Đã xảy ra lỗi
                </h1>
                <p className="text-sm text-lys-muted mb-6 leading-relaxed">
                    Hệ thống gặp sự cố khi tải trang. Vui lòng thử lại hoặc liên hệ quản trị viên.
                </p>
                {error.digest && (
                    <p className="font-mono text-[11px] text-lys-muted mb-4">
                        Mã lỗi: {error.digest}
                    </p>
                )}
                <div className="flex justify-center">
                    <Button variant="primary" onClick={reset}>
                        <RefreshCw size={15} aria-hidden />
                        Thử lại
                    </Button>
                </div>
            </div>
        </div>
    )
}
