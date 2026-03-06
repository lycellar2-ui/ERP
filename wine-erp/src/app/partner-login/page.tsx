'use client'

import { useState } from 'react'
import { Loader2, Shield, AlertCircle, Ship } from 'lucide-react'
import { authenticatePartner, getPartnerPortalData, type PartnerShipmentView, type AgencySubmissionRow } from '../dashboard/agency/actions'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    BOOKED: { label: 'Đã Đặt', color: '#4A8FAB' },
    ON_VESSEL: { label: 'Trên Tàu', color: '#D4A853' },
    ARRIVED_PORT: { label: 'Đến Cảng', color: '#87CBB9' },
    CUSTOMS_HOLD: { label: 'Chờ HQ', color: '#E05252' },
    CLEARED: { label: 'Thông Quan', color: '#5BA88A' },
    COMPLETED: { label: 'Hoàn Tất', color: '#4A6A7A' },
    PENDING_REVIEW: { label: 'Chờ Duyệt', color: '#D4A853' },
    APPROVED: { label: 'Đã Duyệt', color: '#5BA88A' },
    REJECTED: { label: 'Từ Chối', color: '#8B1A2E' },
}

const PARTNER_TYPE: Record<string, string> = {
    CUSTOMS_BROKER: '🏛️ Đại lý Hải Quan',
    FORWARDER: '🚢 Forwarder',
    SURVEYOR: '🔍 Giám Định',
}

export default function PartnerLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Logged in state
    const [partner, setPartner] = useState<{ id: string; name: string; type: string; code: string } | null>(null)
    const [shipments, setShipments] = useState<PartnerShipmentView[]>([])
    const [submissions, setSubmissions] = useState<AgencySubmissionRow[]>([])
    const [portalLoading, setPortalLoading] = useState(false)

    const handleLogin = async () => {
        if (!email || !password) return
        setLoading(true)
        setError('')
        const result = await authenticatePartner(email, password)
        if (result.success && result.partner) {
            setPartner(result.partner)
            setPortalLoading(true)
            const data = await getPartnerPortalData(result.partner.id)
            setShipments(data.shipments)
            setSubmissions(data.submissions)
            setPortalLoading(false)
        } else {
            setError(result.error ?? 'Đăng nhập thất bại')
        }
        setLoading(false)
    }

    const formatDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

    // ──── PORTAL VIEW ────
    if (partner) {
        return (
            <div style={{ minHeight: '100vh', background: '#0A1926' }}>
                {/* Header */}
                <div style={{ background: '#0D1E2B', borderBottom: '1px solid #2A4355' }}>
                    <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(135,203,185,0.15)' }}>
                                <Shield size={20} style={{ color: '#87CBB9' }} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                                    {partner.name}
                                </h1>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                    {PARTNER_TYPE[partner.type] ?? partner.type} • {partner.code}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => { setPartner(null); setEmail(''); setPassword('') }}
                            className="text-xs px-4 py-2 rounded-lg"
                            style={{ border: '1px solid #2A4355', color: '#8AAEBB' }}>
                            Đăng Xuất
                        </button>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
                    {portalLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 size={32} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    ) : (
                        <>
                            {/* Shipments */}
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#87CBB9' }}>
                                    <Ship size={14} className="inline mr-2" />
                                    Lô Hàng Được Phân Công ({shipments.length})
                                </h2>
                                {shipments.length === 0 ? (
                                    <div className="text-center py-12 rounded-lg" style={{ background: '#1B2E3D', border: '1px dashed #2A4355' }}>
                                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có lô hàng nào được phân công</p>
                                    </div>
                                ) : (
                                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                                    {['B/L', 'Tàu', 'ETA', 'Trạng Thái', 'Submissions'].map(h => (
                                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {shipments.map(s => {
                                                    const st = STATUS_MAP[s.status] ?? { label: s.status, color: '#4A6A7A' }
                                                    return (
                                                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                            <td className="px-4 py-3 text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                                {s.billOfLading}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm" style={{ color: '#E8F1F2' }}>{s.vesselName ?? '—'}</td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(s.eta)}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                                    style={{ color: st.color, background: `${st.color}18` }}>{st.label}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-bold" style={{ color: '#8AAEBB' }}>{s.submissionCount}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Submissions History */}
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#D4A853' }}>
                                    Lịch Sử Nộp Hồ Sơ ({submissions.length})
                                </h2>
                                {submissions.length === 0 ? (
                                    <div className="text-center py-12 rounded-lg" style={{ background: '#1B2E3D', border: '1px dashed #2A4355' }}>
                                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có hồ sơ nào</p>
                                    </div>
                                ) : (
                                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                                    {['B/L', 'Số Tờ Khai', 'Tài Liệu', 'Trạng Thái', 'Nộp Lúc', 'Duyệt Lúc'].map(h => (
                                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {submissions.map(s => {
                                                    const st = STATUS_MAP[s.status] ?? { label: s.status, color: '#4A6A7A' }
                                                    return (
                                                        <tr key={s.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                                            <td className="px-4 py-3 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                                {s.shipmentBol ?? '—'}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm" style={{ color: '#E8F1F2' }}>{s.declarationNo ?? '—'}</td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB' }}>{s.documentCount} file</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                                    style={{ color: st.color, background: `${st.color}18` }}>{st.label}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(s.submittedAt)}</td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(s.reviewedAt)}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ──── LOGIN VIEW ────
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1926' }}>
            <div className="w-full max-w-sm space-y-6">
                {/* Logo */}
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(135,203,185,0.12)', border: '1px solid #2A4355' }}>
                        <Shield size={28} style={{ color: '#87CBB9' }} />
                    </div>
                    <h1 className="text-2xl font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                        Partner Portal
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#4A6A7A' }}>
                        Đăng nhập dành cho Đại lý / Forwarder / Giám định
                    </p>
                </div>

                {/* Login form */}
                <div className="p-6 rounded-xl space-y-4" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
                            style={{ background: 'rgba(139,26,46,0.1)', border: '1px solid rgba(139,26,46,0.3)', color: '#E05252' }}>
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="partner@agency.com"
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Mật Khẩu</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading || !email || !password}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => !loading && (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                        {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                    </button>
                </div>

                <p className="text-center text-xs" style={{ color: '#2A4355' }}>
                    Wine ERP — Agency Partner Portal v1.0
                </p>
            </div>
        </div>
    )
}
