'use client'

import { useEffect } from 'react'

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
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{
                maxWidth: '480px',
                textAlign: 'center',
                padding: '48px 32px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Đã xảy ra lỗi
                </h2>
                <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                    Hệ thống gặp sự cố khi tải trang. Vui lòng thử lại hoặc liên hệ quản trị viên.
                </p>
                {error.digest && (
                    <p className="font-mono" style={{ color: '#64748B', fontSize: '11px', marginBottom: '16px' }}>
                        Mã lỗi: {error.digest}
                    </p>
                )}
                <button
                    onClick={reset}
                    style={{
                        padding: '10px 24px',
                        background: 'rgba(8, 145, 178, 0.08)',
                        color: '#0891B2',
                        border: '1px solid rgba(8, 145, 178, 0.25)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                    }}
                >
                    Thử lại
                </button>
            </div>
        </div>
    )
}
