import Link from 'next/link'
import { Wine } from 'lucide-react'

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
        }}>
            <div style={{
                maxWidth: '480px',
                textAlign: 'center',
                padding: '48px 32px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(8, 145, 178, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                        <Wine size={32} />
                    </div>
                </div>
                <h1 className="font-mono" style={{ color: '#0E7490', fontSize: '72px', fontWeight: 700, margin: '0 0 8px' }}>
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
                            color: '#0E7490',
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
