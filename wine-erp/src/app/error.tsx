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
            background: '#0A1926',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{
                maxWidth: '480px',
                textAlign: 'center',
                padding: '48px 32px',
                background: '#1B2E3D',
                border: '1px solid #2A4355',
                borderRadius: '12px',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ color: '#E8F1F2', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Đã xảy ra lỗi
                </h2>
                <p style={{ color: '#4A6A7A', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                    Hệ thống gặp sự cố khi tải trang. Vui lòng thử lại hoặc liên hệ quản trị viên.
                </p>
                {error.digest && (
                    <p style={{
                        color: '#4A6A7A',
                        fontSize: '11px',
                        marginBottom: '16px',
                        fontFamily: 'monospace',
                    }}>
                        Mã lỗi: {error.digest}
                    </p>
                )}
                <button
                    onClick={reset}
                    style={{
                        padding: '10px 24px',
                        background: 'rgba(135,203,185,0.15)',
                        color: '#87CBB9',
                        border: '1px solid rgba(135,203,185,0.3)',
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
