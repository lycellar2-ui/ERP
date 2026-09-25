import Link from 'next/link'

export default function NotFound() {
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
                <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>🍷</div>
                <h1 className="font-mono" style={{ color: '#0891B2', fontSize: '72px', fontWeight: 700, margin: '0 0 8px' }}>
                    404
                </h1>
                <h2 style={{ color: '#0F172A', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                    Trang không tồn tại
                </h2>
                <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                    Trang bạn tìm kiếm không có trong hệ thống LY&apos;s Cellars.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <Link
                        href="/dashboard"
                        style={{
                            padding: '10px 24px',
                            background: 'rgba(8, 145, 178, 0.08)',
                            color: '#0891B2',
                            border: '1px solid rgba(8, 145, 178, 0.25)',
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
