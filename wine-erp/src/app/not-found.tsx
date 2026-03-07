import Link from 'next/link'

export default function NotFound() {
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
                <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>🍷</div>
                <h1 style={{
                    color: '#87CBB9',
                    fontSize: '72px',
                    fontWeight: 700,
                    fontFamily: '"DM Mono", monospace',
                    margin: '0 0 8px',
                }}>
                    404
                </h1>
                <h2 style={{ color: '#E8F1F2', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                    Trang không tồn tại
                </h2>
                <p style={{ color: '#4A6A7A', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                    Trang bạn tìm kiếm không có trong hệ thống LY&apos;s Cellars.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <Link
                        href="/dashboard"
                        style={{
                            padding: '10px 24px',
                            background: 'rgba(135,203,185,0.15)',
                            color: '#87CBB9',
                            border: '1px solid rgba(135,203,185,0.3)',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        ← Về Dashboard
                    </Link>
                </div>
            </div>
        </div>
    )
}
