'use client'

import { useEffect } from 'react'

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
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
        }}>
            <div style={{
                maxWidth: '520px',
                textAlign: 'center',
                padding: '48px 32px',
                background: '#1B2E3D',
                border: '1px solid #2A4355',
                borderRadius: '12px',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔌</div>
                <h2 style={{ color: '#E8F1F2', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Không thể tải Dashboard
                </h2>
                <p style={{ color: '#4A6A7A', fontSize: '14px', marginBottom: '8px', lineHeight: 1.6 }}>
                    Có thể do mất kết nối database hoặc lỗi server. Vui lòng thử lại.
                </p>
                {error.message && (
                    <p style={{
                        color: '#8B1A2E',
                        fontSize: '12px',
                        marginBottom: '16px',
                        fontFamily: 'monospace',
                        background: 'rgba(139,26,46,0.08)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        textAlign: 'left',
                        wordBreak: 'break-all',
                    }}>
                        {error.message.slice(0, 300)}
                    </p>
                )}
                {error.digest && (
                    <p style={{
                        color: '#4A6A7A',
                        fontSize: '11px',
                        marginBottom: '16px',
                        fontFamily: 'monospace',
                    }}>
                        Digest: {error.digest}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
                        🔄 Thử lại
                    </button>
                    <button
                        onClick={() => window.location.href = '/login'}
                        style={{
                            padding: '10px 24px',
                            background: '#142433',
                            color: '#8AAEBB',
                            border: '1px solid #2A4355',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                        }}
                    >
                        Về trang đăng nhập
                    </button>
                </div>
            </div>
        </div>
    )
}
