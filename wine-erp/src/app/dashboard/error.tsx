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
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔌</div>
                <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
                    Không thể tải Dashboard
                </h2>
                <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '8px', lineHeight: 1.6 }}>
                    Có thể do mất kết nối database hoặc lỗi server. Vui lòng thử lại.
                </p>
                {error.message && (
                    <p className="font-mono" style={{ color: '#8B1A2E', fontSize: '12px', marginBottom: '16px', background: 'rgba(139,26,46,0.08)', padding: '8px 12px', borderRadius: '6px', textAlign: 'left', wordBreak: 'break-all' }}>
                        {error.message.slice(0, 300)}
                    </p>
                )}
                {error.digest && (
                    <p className="font-mono" style={{ color: '#64748B', fontSize: '11px', marginBottom: '16px' }}>
                        Digest: {error.digest}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
                        🔄 Thử lại
                    </button>
                    <button
                        onClick={() => window.location.href = '/login'}
                        style={{
                            padding: '10px 24px',
                            background: '#FFFFFF',
                            color: '#475569',
                            border: '1px solid #E2E8F0',
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
