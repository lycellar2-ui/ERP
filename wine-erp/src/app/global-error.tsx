'use client'

import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html lang="vi">
            <body style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F8FAFC',
                margin: 0,
                padding: '16px',
            }}>
                <div style={{
                    maxWidth: '480px',
                    width: '100%',
                    textAlign: 'center',
                    padding: '40px 32px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
                            <AlertTriangle size={28} aria-hidden />
                        </div>
                    </div>
                    <h1 style={{ color: '#0F172A', fontSize: '20px', fontWeight: 600, margin: '0 0 8px' }}>
                        Hệ thống gặp sự cố
                    </h1>
                    <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                        Vui lòng thử lại. Nếu lỗi tiếp tục, liên hệ quản trị viên.
                    </p>
                    {error.digest && (
                        <p className="font-mono" style={{ color: '#64748B', fontSize: '11px', marginBottom: '16px' }}>
                            Mã lỗi: {error.digest}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            padding: '10px 24px',
                            background: '#0E7490',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                        }}
                    >
                        Thử lại
                    </button>
                </div>
            </body>
        </html>
    )
}
