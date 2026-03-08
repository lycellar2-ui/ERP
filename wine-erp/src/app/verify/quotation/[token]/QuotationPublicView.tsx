'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, Wine, MapPin, Award, Star, AlertTriangle } from 'lucide-react'
import { acceptQuotationPublic, rejectQuotationPublic } from './actions'

type LineData = {
    index: number; productName: string; skuCode: string; wineType: string
    volumeMl: number; vintage: number | null; country: string; abvPercent: number
    tastingNotes: string | null; classification: string | null; producerName: string | undefined
    appellationName: string | undefined; regionName: string | undefined
    imageUrl: string | null; awards: { source: string; score: number | null; medal: string | null }[]
    qty: number; unitPrice: number; discountPct: number; lineTotal: number
}

type QuotationData = {
    id: string; quotationNo: string; status: string; channel: string; paymentTerm: string
    totalAmount: number; orderDiscount: number; validUntil: string; notes: string | null
    terms: string | null; deliveryTerms: string | null; vatIncluded: boolean
    companyName: string | null; contactPerson: string | null; createdAt: string
    customerName: string; customerCode: string; salesRepName: string; salesRepEmail: string
    isExpired: boolean; isActionable: boolean; lines: LineData[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    DRAFT: { label: 'Nháp', color: '#4A6A7A', icon: Clock },
    SENT: { label: 'Đã Gửi', color: '#87CBB9', icon: Clock },
    ACCEPTED: { label: 'Đã Chấp Nhận', color: '#22C55E', icon: CheckCircle2 },
    CONVERTED: { label: 'Đã Chuyển Đơn', color: '#3B82F6', icon: CheckCircle2 },
    EXPIRED: { label: 'Hết Hạn', color: '#EF4444', icon: AlertTriangle },
    CANCELLED: { label: 'Từ Chối', color: '#EF4444', icon: XCircle },
}

export function QuotationPublicView({ data, token }: { data: QuotationData; token: string }) {
    const [accepting, setAccepting] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [done, setDone] = useState<'accepted' | 'rejected' | null>(null)

    const subtotal = data.lines.reduce((s, l) => s + l.lineTotal, 0)
    const discountAmount = subtotal * (data.orderDiscount / 100)
    const afterDiscount = subtotal - discountAmount
    const vatAmount = data.vatIncluded ? 0 : afterDiscount * 0.1
    const grandTotal = afterDiscount + vatAmount
    const statusInfo = STATUS_MAP[data.status] || STATUS_MAP.DRAFT

    async function handleAccept() {
        setAccepting(true)
        const res = await acceptQuotationPublic(token)
        setAccepting(false)
        if (res.success) setDone('accepted')
        else alert(res.error || 'Có lỗi xảy ra')
    }

    async function handleReject() {
        if (!rejectReason.trim()) return
        setRejecting(true)
        const res = await rejectQuotationPublic(token, rejectReason)
        setRejecting(false)
        if (res.success) setDone('rejected')
        else alert(res.error || 'Có lỗi xảy ra')
    }

    if (done) {
        return (
            <div style={{ minHeight: '100vh', background: '#0A1926', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ maxWidth: 450, textAlign: 'center', color: '#E8F1F2' }}>
                    {done === 'accepted' ? (
                        <>
                            <CheckCircle2 size={64} style={{ color: '#22C55E', margin: '0 auto 20px' }} />
                            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>Cảm ơn quý khách!</h1>
                            <p style={{ color: '#8AAEBB', fontSize: 16, lineHeight: 1.6 }}>
                                Báo giá <strong style={{ color: '#87CBB9' }}>{data.quotationNo}</strong> đã được chấp nhận.
                                Nhân viên bán hàng sẽ liên hệ để xác nhận đơn hàng.
                            </p>
                        </>
                    ) : (
                        <>
                            <XCircle size={64} style={{ color: '#EF4444', margin: '0 auto 20px' }} />
                            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>Đã ghi nhận</h1>
                            <p style={{ color: '#8AAEBB', fontSize: 16 }}>Cảm ơn quý khách đã phản hồi. Chúng tôi sẽ liên hệ lại.</p>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0A1926' }}>
            {/* Header */}
            <header style={{ background: 'linear-gradient(135deg, #142433 0%, #1B2E3D 100%)', borderBottom: '1px solid #2A4355', padding: '28px 0' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <svg width="40" height="40" viewBox="0 0 40 48" fill="none">
                            <path d="M8 4 Q8 20 20 26 Q32 20 32 4 Z" stroke="#87CBB9" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="20" y1="26" x2="20" y2="40" stroke="#87CBB9" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="13" y1="40" x2="27" y2="40" stroke="#87CBB9" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M20 22 Q16 16 18 10 Q20 6 22 10" stroke="#A5DED0" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                        </svg>
                        <div>
                            <h1 style={{ color: '#E8F1F2', fontSize: 22, fontWeight: 700, fontFamily: '"Cormorant Garamond", Georgia, serif', margin: 0 }}>LY&apos;s Cellars</h1>
                            <p style={{ color: '#4A6A7A', fontSize: 11, letterSpacing: '0.12em', margin: 0 }}>FINE WINE SPECIALIST</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#87CBB9', fontWeight: 600, fontSize: 14, margin: 0 }}>📧 info@lyscellars.com</p>
                        <p style={{ color: '#4A6A7A', fontSize: 12, margin: 0 }}>📞 028 1234 5678</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
                {/* Title bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
                    <div>
                        <h2 style={{ color: '#E8F1F2', fontSize: 26, fontWeight: 700, margin: 0, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                            BÁO GIÁ / QUOTATION
                        </h2>
                        <p style={{ color: '#87CBB9', fontSize: 16, fontWeight: 600, margin: '4px 0 0' }}>{data.quotationNo}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: `${statusInfo.color}18`, border: `1px solid ${statusInfo.color}40` }}>
                        <statusInfo.icon size={16} style={{ color: statusInfo.color }} />
                        <span style={{ color: statusInfo.color, fontWeight: 600, fontSize: 13 }}>{statusInfo.label}</span>
                    </div>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <div style={{ background: '#142433', padding: 20, borderRadius: 10, border: '1px solid #2A4355' }}>
                        <p style={{ color: '#4A6A7A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Kính gửi</p>
                        <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 16, margin: 0 }}>{data.contactPerson || data.customerName}</p>
                        {data.companyName && <p style={{ color: '#8AAEBB', fontSize: 13, margin: '4px 0 0' }}>{data.companyName}</p>}
                        <p style={{ color: '#4A6A7A', fontSize: 12, margin: '4px 0 0' }}>Kênh: {data.channel}</p>
                    </div>
                    <div style={{ background: '#142433', padding: 20, borderRadius: 10, border: '1px solid #2A4355' }}>
                        <p style={{ color: '#4A6A7A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Thông tin</p>
                        <p style={{ color: '#8AAEBB', fontSize: 13, margin: '2px 0' }}>📅 Ngày: <strong style={{ color: '#E8F1F2' }}>{fmtDate(data.createdAt)}</strong></p>
                        <p style={{ color: '#8AAEBB', fontSize: 13, margin: '2px 0' }}>⏰ Hiệu lực đến: <strong style={{ color: data.isExpired ? '#EF4444' : '#87CBB9' }}>{fmtDate(data.validUntil)}</strong></p>
                        <p style={{ color: '#8AAEBB', fontSize: 13, margin: '2px 0' }}>💳 Thanh toán: <strong style={{ color: '#E8F1F2' }}>{data.paymentTerm}</strong></p>
                    </div>
                    <div style={{ background: '#142433', padding: 20, borderRadius: 10, border: '1px solid #2A4355' }}>
                        <p style={{ color: '#4A6A7A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Nhân viên phụ trách</p>
                        <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 14, margin: 0 }}>{data.salesRepName}</p>
                        <p style={{ color: '#87CBB9', fontSize: 12, margin: '4px 0 0' }}>{data.salesRepEmail}</p>
                    </div>
                </div>

                {/* Product lines */}
                <div style={{ background: '#142433', borderRadius: 12, border: '1px solid #2A4355', overflow: 'hidden', marginBottom: 24 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #2A4355' }}>
                        <h3 style={{ color: '#E8F1F2', fontSize: 15, fontWeight: 600, margin: 0 }}>Chi Tiết Sản Phẩm</h3>
                    </div>

                    {data.lines.map((line, i) => (
                        <div key={i} style={{ padding: '20px', borderBottom: i < data.lines.length - 1 ? '1px solid #1B2E3D' : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                            {/* Product image */}
                            <div style={{ width: 80, height: 110, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1B2E3D', border: '1px solid #2A4355', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {line.imageUrl ? (
                                    <img src={line.imageUrl} alt={line.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Wine size={28} style={{ color: '#4A6A7A' }} />
                                )}
                            </div>

                            {/* Product info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                    <div>
                                        <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 15, margin: 0, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                                            {line.productName}
                                        </p>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                            {line.vintage && <span style={{ color: '#87CBB9', fontSize: 12, fontWeight: 600 }}>{line.vintage}</span>}
                                            {line.appellationName && (
                                                <span style={{ color: '#8AAEBB', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <MapPin size={10} /> {line.appellationName}
                                                </span>
                                            )}
                                            {line.regionName && <span style={{ color: '#4A6A7A', fontSize: 12 }}>• {line.regionName}</span>}
                                            <span style={{ color: '#4A6A7A', fontSize: 12 }}>• {line.country}</span>
                                        </div>
                                        <p style={{ color: '#4A6A7A', fontSize: 11, margin: '3px 0 0' }}>
                                            {line.skuCode} • {line.wineType} • {line.volumeMl}ml • ABV {line.abvPercent}%
                                            {line.classification ? ` • ${line.classification}` : ''}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ color: '#87CBB9', fontWeight: 700, fontSize: 16, margin: 0 }}>{fmt(line.lineTotal)} ₫</p>
                                        <p style={{ color: '#4A6A7A', fontSize: 11, margin: '2px 0 0' }}>
                                            {line.qty} × {fmt(line.unitPrice)} ₫
                                            {line.discountPct > 0 ? ` (−${line.discountPct}%)` : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Awards */}
                                {line.awards.length > 0 && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                        {line.awards.map((a, j) => (
                                            <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(234,179,8,0.12)', color: '#EAB308', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                                                {a.medal ? <Award size={10} /> : <Star size={10} />}
                                                {a.source} {a.score ? `${a.score}` : a.medal?.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Tasting notes */}
                                {line.tastingNotes && (
                                    <p style={{ color: '#4A6A7A', fontSize: 11, margin: '6px 0 0', fontStyle: 'italic', lineHeight: 1.4 }}>
                                        🍷 {line.tastingNotes.length > 120 ? line.tastingNotes.slice(0, 120) + '…' : line.tastingNotes}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div style={{ background: '#142433', borderRadius: 12, border: '1px solid #2A4355', padding: 24, marginBottom: 24 }}>
                    <div style={{ maxWidth: 350, marginLeft: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ color: '#8AAEBB', fontSize: 14 }}>Tạm tính ({data.lines.length} sản phẩm)</span>
                            <span style={{ color: '#E8F1F2', fontWeight: 500 }}>{fmt(subtotal)} ₫</span>
                        </div>
                        {data.orderDiscount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ color: '#87CBB9', fontSize: 14 }}>Chiết khấu tổng ({data.orderDiscount}%)</span>
                                <span style={{ color: '#87CBB9', fontWeight: 500 }}>−{fmt(discountAmount)} ₫</span>
                            </div>
                        )}
                        {!data.vatIncluded && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ color: '#8AAEBB', fontSize: 14 }}>VAT (10%)</span>
                                <span style={{ color: '#E8F1F2', fontWeight: 500 }}>{fmt(vatAmount)} ₫</span>
                            </div>
                        )}
                        <div style={{ borderTop: '2px solid #87CBB9', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#E8F1F2', fontSize: 16, fontWeight: 600 }}>TỔNG CỘNG</span>
                            <span style={{ color: '#87CBB9', fontSize: 24, fontWeight: 700, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>{fmt(grandTotal)} ₫</span>
                        </div>
                        {data.vatIncluded && <p style={{ color: '#4A6A7A', fontSize: 11, textAlign: 'right', margin: '4px 0 0' }}>Giá đã bao gồm VAT</p>}
                    </div>
                </div>

                {/* Terms & Notes */}
                {(data.terms || data.notes || data.deliveryTerms) && (
                    <div style={{ background: '#142433', borderRadius: 12, border: '1px solid #2A4355', padding: 24, marginBottom: 24 }}>
                        {data.terms && (
                            <div style={{ marginBottom: 16 }}>
                                <h4 style={{ color: '#8AAEBB', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Điều khoản & Điều kiện</h4>
                                <p style={{ color: '#E8F1F2', fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{data.terms}</p>
                            </div>
                        )}
                        {data.deliveryTerms && (
                            <div style={{ marginBottom: 16 }}>
                                <h4 style={{ color: '#8AAEBB', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Giao hàng</h4>
                                <p style={{ color: '#E8F1F2', fontSize: 14, margin: 0 }}>{data.deliveryTerms}</p>
                            </div>
                        )}
                        {data.notes && (
                            <div>
                                <h4 style={{ color: '#8AAEBB', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Ghi chú</h4>
                                <p style={{ color: '#E8F1F2', fontSize: 14, margin: 0, whiteSpace: 'pre-line' }}>{data.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                {data.isActionable && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                        <button
                            onClick={handleAccept}
                            disabled={accepting}
                            style={{ flex: 1, minWidth: 200, padding: '16px 32px', borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: accepting ? 0.6 : 1 }}
                        >
                            {accepting ? '⏳ Đang xử lý...' : '✅ Chấp Nhận Báo Giá'}
                        </button>
                        {!showRejectForm ? (
                            <button
                                onClick={() => setShowRejectForm(true)}
                                style={{ padding: '16px 32px', borderRadius: 10, background: 'transparent', color: '#EF4444', border: '1px solid #EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                            >
                                Từ Chối
                            </button>
                        ) : (
                            <div style={{ flex: 1, minWidth: 200, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    placeholder="Lý do từ chối..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#1B2E3D', border: '1px solid #EF4444', color: '#E8F1F2', fontSize: 14, outline: 'none' }}
                                />
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting || !rejectReason.trim()}
                                    style={{ padding: '12px 24px', borderRadius: 8, background: '#EF4444', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: (rejecting || !rejectReason.trim()) ? 0.5 : 1 }}
                                >
                                    Xác nhận
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {data.isExpired && (
                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 32 }}>
                        <AlertTriangle size={24} style={{ color: '#EF4444', marginBottom: 8 }} />
                        <p style={{ color: '#EF4444', fontSize: 15, fontWeight: 600, margin: 0 }}>Báo giá này đã hết hạn</p>
                        <p style={{ color: '#8AAEBB', fontSize: 13, margin: '4px 0 0' }}>Vui lòng liên hệ nhân viên bán hàng để được cập nhật báo giá mới.</p>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid #2A4355', padding: '24px', textAlign: 'center' }}>
                <p style={{ color: '#4A6A7A', fontSize: 12, margin: 0 }}>
                    © {new Date().getFullYear()} LY&apos;s Cellars — Fine Wine Specialist | Hệ thống báo giá tự động
                </p>
            </footer>
        </div>
    )
}
