'use client'

import { useState } from 'react'
import { 
    CheckCircle2, XCircle, Clock, Wine, MapPin, Award, Star, 
    AlertTriangle, Quote, ShieldCheck, Mail, Calendar, 
    CreditCard, Printer, Copy, Check, Sparkles, Building2, User,
    Phone, MessageSquare, ChevronRight, Compass,
    Thermometer, UtensilsCrossed, Package, Search, Truck
} from 'lucide-react'
import { acceptQuotationPublic, rejectQuotationPublic } from './actions'

type WineProfileData = {
    grapes: string | null
    color: string | null
    aromas: string | null
    palate: string | null
    style: string | null
    foodPairings: string | null
    servingTemp: string | null
    bestSuitedFor: string | null
}

type LineData = {
    index: number; productName: string; skuCode: string; wineType: string
    volumeMl: number; vintage?: number | null; country: string; abvPercent: number
    tastingNotes: string | null; classification: string | null; producerName?: string | null
    appellationName?: string | null; regionName?: string | null
    format?: string | null; packagingType?: string | null
    profile?: WineProfileData | null
    imageUrl: string | null; awards: { source: string; score: number | null; medal: string | null; vintage?: number | null }[]
    qty: number; unitPrice: number; discountPct: number; vatRate: number; lineTotal: number
}

type QuotationData = {
    id: string; quotationNo: string; status: string; channel: string; paymentTerm: string
    totalAmount: number; orderDiscount: number; validUntil: string; notes: string | null
    terms: string | null; deliveryTerms: string | null; vatIncluded: boolean
    companyName: string | null; contactPerson: string | null; createdAt: string
    customerName: string; customerCode: string; salesRepName: string; salesRepEmail: string
    customerPhone?: string | null; customerEmail?: string | null
    isExpired: boolean; isActionable: boolean; showQuantity?: boolean; lines: LineData[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    DRAFT: { label: 'Bản Nháp (Draft)', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1', icon: Clock },
    SENT: { label: 'Đang Hiệu Lực (Active)', color: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', icon: Clock },
    ACCEPTED: { label: 'Đã Duyệt (Approved)', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
    CONVERTED: { label: 'Đã Lên Đơn Hàng (Ordered)', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', icon: CheckCircle2 },
    EXPIRED: { label: 'Hết Hiệu Lực (Expired)', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', icon: AlertTriangle },
    CANCELLED: { label: 'Đã Hủy / Từ Chối', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', icon: XCircle },
}

const WINE_TYPE_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
    RED: { label: 'Vang Đỏ (Red Wine)', bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    WHITE: { label: 'Vang Trắng (White Wine)', bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A' },
    SPARKLING: { label: 'Vang Sủi / Champagne', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    CHAMPAGNE: { label: 'Champagne Grand Cru', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    ROSE: { label: 'Vang Hồng (Rosé)', bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
    DESSERT: { label: 'Vang Tráng Miệng / Ngọt', bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
    FORTIFIED: { label: 'Vang Cường Hóa (Port)', bg: '#FFFBEB', text: '#78350F', border: '#FDE68A' },
}

// Sub-component for individual product cards with rich information architecture
function ProductLineCard({ 
    line, 
    i, 
    totalCount, 
    showQuantity, 
    onOpenModal 
}: { 
    line: LineData; 
    i: number; 
    totalCount: number; 
    showQuantity?: boolean; 
    onOpenModal: (line: LineData) => void 
}) {
    const [hovered, setHovered] = useState(false)

    // Formulate a premium classification subtitle (e.g. "Pauillac AOC • Bordeaux, France")
    const originParts = []
    if (line.appellationName) originParts.push(line.appellationName)
    if (line.regionName && line.regionName !== line.appellationName) originParts.push(line.regionName)
    originParts.push(line.country)

    const wineTypeInfo = WINE_TYPE_BADGES[line.wineType] || { label: line.wineType, bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' }
    const p = line.profile

    return (
        <div 
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="qtn-product-card"
            style={{ 
                padding: '28px', 
                borderBottom: i < totalCount - 1 ? '1px solid #EAE7E0' : 'none', 
                display: 'flex', 
                gap: 28, 
                alignItems: 'flex-start',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                background: hovered ? '#FAFAF7' : '#FFFFFF',
                boxShadow: hovered ? 'inset 4px 0 0 #C5A059, 0 8px 24px rgba(15,23,42,0.05)' : 'none',
            }}
        >
            {/* Bottle pedestal container */}
            <div 
                className="qtn-img-wrap cursor-pointer" 
                onClick={() => onOpenModal(line)}
                style={{ 
                    width: 110, 
                    height: 140, 
                    borderRadius: 3, 
                    flexShrink: 0, 
                    background: '#F9F8F5', 
                    border: hovered ? '1.5px solid #C5A059' : '1px solid #E2E8F0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '8px',
                    boxShadow: '0 2px 10px rgba(15,23,42,0.05)',
                    transition: 'all 0.3s ease',
                    transform: hovered ? 'scale(1.02)' : 'scale(1)',
                    cursor: 'pointer',
                    position: 'relative',
                }}
                title="Bấm để xem hồ sơ thử nếm chi tiết & thông số điền trang"
            >
                {line.imageUrl ? (
                    <img 
                        src={line.imageUrl} 
                        alt={line.productName} 
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.14))',
                        }} 
                    />
                ) : (
                    <Wine size={36} style={{ color: '#C5A059', opacity: 0.6 }} />
                )}
                <div style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    background: 'rgba(255,255,255,0.92)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 2,
                    padding: '2px 4px',
                    fontSize: 9,
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}>
                    <Search size={9} style={{ color: '#0E7490' }} />
                    <span>Chi tiết</span>
                </div>
            </div>

            {/* Product core body */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Producer and Type Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    {line.producerName && (
                        <span style={{ 
                            fontSize: 10.5, 
                            fontWeight: 700, 
                            letterSpacing: '0.12em', 
                            color: '#C5A059', 
                            textTransform: 'uppercase' 
                        }}>
                            MAISON &bull; {line.producerName}
                        </span>
                    )}
                    <span style={{ 
                        fontSize: 10, 
                        fontWeight: 600, 
                        background: wineTypeInfo.bg, 
                        color: wineTypeInfo.text, 
                        border: `1px solid ${wineTypeInfo.border}`,
                        padding: '1px 6px',
                        borderRadius: 2
                    }}>
                        {wineTypeInfo.label}
                    </span>
                    {line.classification && (
                        <span style={{ 
                            color: '#92400E', 
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            fontSize: 10, 
                            fontWeight: 700, 
                            letterSpacing: '0.04em', 
                            textTransform: 'uppercase',
                            padding: '1px 6px',
                            borderRadius: 2
                        }}>
                            {line.classification}
                        </span>
                    )}
                </div>

                {/* Wine Title & Price Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 280 }}>
                        <h4 
                            onClick={() => onOpenModal(line)}
                            className="font-brand cursor-pointer" 
                            style={{ 
                                color: hovered ? '#0E7490' : '#0F172A', 
                                fontWeight: 700, 
                                fontSize: 20, 
                                margin: 0, 
                                lineHeight: 1.25, 
                                transition: 'color 0.2s ease',
                                cursor: 'pointer',
                            }}
                        >
                            {line.productName}
                        </h4>
                        
                        {/* Terroir & Origin Line */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <MapPin size={12} style={{ color: '#C5A059' }} />
                            <span style={{ color: '#475569', fontSize: 13, fontWeight: 500 }}>
                                {originParts.join(' · ')}
                            </span>
                            <span style={{ color: '#CBD5E1', fontSize: 11 }}>•</span>
                            <span style={{ color: '#64748B', fontSize: 12 }}>
                                SKU: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{line.skuCode}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Financial Figures */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>
                            {showQuantity ? fmt(line.lineTotal) : fmt(line.unitPrice * (1 - line.discountPct / 100))} <span style={{ fontSize: 12, fontWeight: 600, color: '#C5A059' }}>₫</span>
                        </div>
                        <div style={{ color: '#64748B', fontSize: 12, margin: '2px 0 0' }}>
                            {showQuantity ? (
                                <>
                                    {line.qty} chai &times; {fmt(line.unitPrice)} ₫
                                    {line.discountPct > 0 && (
                                        <span style={{ color: '#B91C1C', fontWeight: 700, marginLeft: 5 }}>
                                            (−{line.discountPct}%)
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    Giá niêm yết: {fmt(line.unitPrice)} ₫
                                    {line.discountPct > 0 && (
                                        <span style={{ color: '#B91C1C', fontWeight: 700, marginLeft: 5 }}>
                                            (−{line.discountPct}%)
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4-Quadrant Rich Technical Specs Grid */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '8px 16px', 
                    marginTop: 12,
                    padding: '10px 14px',
                    background: '#F9F8F5',
                    border: '1px solid #EAE7E0',
                    borderRadius: 3
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#334155' }}>
                        <Wine size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
                        <span><strong>Giống nho:</strong> {p?.grapes || 'Blend điền trang tuyển chọn'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#334155' }}>
                        <Package size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
                        <span><strong>Quy cách:</strong> {line.volumeMl}ml &bull; {line.abvPercent}% ABV</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#334155' }}>
                        <Thermometer size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
                        <span><strong>Nhiệt độ phục vụ:</strong> {p?.servingTemp || '16-18°C'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#334155' }}>
                        <UtensilsCrossed size={13} style={{ color: '#C5A059', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>Ẩm thực:</strong> {p?.foodPairings || 'Bò Wagyu, sườn cừu, phô mai'}
                        </span>
                    </div>
                </div>

                {/* Sommelier Tasting Note Callout */}
                <div style={{ 
                    marginTop: 10, 
                    padding: '8px 12px', 
                    background: '#FFFFFF', 
                    borderLeft: '2.5px solid #C5A059', 
                    borderTop: '1px solid #F1F5F9',
                    borderRight: '1px solid #F1F5F9',
                    borderBottom: '1px solid #F1F5F9',
                    borderRadius: '0 3px 3px 0',
                    fontSize: 12, 
                    color: '#475569', 
                    lineHeight: 1.5,
                    fontStyle: 'italic'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <Quote size={11} style={{ color: '#C5A059', transform: 'rotate(180deg)' }} />
                        <span style={{ fontStyle: 'normal', fontWeight: 700, fontSize: 10.5, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Ghi Chú Cảm Quan Sommelier
                        </span>
                    </div>
                    <span>
                        {line.tastingNotes || (p?.palate ? `Hương vị: ${p.palate}. ${p.aromas ? `Hương thơm: ${p.aromas}.` : ''}` : 'Dòng vang cao cấp sở hữu cấu trúc đậm đà, tannin mượt mà như lụa và hậu vị sâu lắng đặc trưng của điền trang.')}
                    </span>
                </div>

                {/* Awards & Action button row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                    {/* Critic Medals */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {line.awards.length > 0 ? line.awards.map((a, j) => (
                            <span key={j} style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                background: '#FFFBEB', 
                                color: '#92400E', 
                                border: '1px solid #FDE68A',
                                padding: '2px 8px', 
                                borderRadius: 2, 
                                fontSize: 10.5, 
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em'
                            }}>
                                {a.medal ? <Award size={11} style={{ color: '#C5A059' }} /> : <Star size={11} style={{ color: '#C5A059' }} />}
                                {a.source} {a.score ? `${a.score} pts` : a.medal?.replace('_', ' ')}
                            </span>
                        )) : (
                            <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                background: '#F8FAFC', 
                                color: '#64748B', 
                                border: '1px solid #E2E8F0',
                                padding: '2px 8px', 
                                borderRadius: 2, 
                                fontSize: 10.5, 
                                fontWeight: 600,
                            }}>
                                <Sparkles size={11} style={{ color: '#C5A059' }} /> Tuyển Chọn Độc Quyền LY&apos;s Cellars
                            </span>
                        )}
                    </div>

                    {/* View Dossier button */}
                    <button
                        onClick={() => onOpenModal(line)}
                        style={{
                            background: 'transparent',
                            border: '1px solid #CBD5E1',
                            padding: '4px 12px',
                            borderRadius: 3,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#0E7490',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#0E7490'
                            e.currentTarget.style.background = '#ECFEFF'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1'
                            e.currentTarget.style.background = 'transparent'
                        }}
                    >
                        <span>Hồ Sơ Nếm Thử Chi Tiết</span>
                        <ChevronRight size={13} />
                    </button>
                </div>
            </div>
        </div>
    )
}

export function QuotationPublicView({ data, token }: { data: QuotationData; token: string }) {
    const [accepting, setAccepting] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [activeModalLine, setActiveModalLine] = useState<LineData | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [done, setDone] = useState<'accepted' | 'rejected' | null>(null)
    const [copiedAccount, setCopiedAccount] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)

    const subtotal = data.lines.reduce((s, l) => s + l.lineTotal, 0)
    const discountAmount = subtotal * (data.orderDiscount / 100)
    const afterDiscount = subtotal - discountAmount
    const vatAmount = data.vatIncluded
        ? 0
        : data.lines.reduce((sum, l) => {
            const lineAmountAfterOrderDiscount = l.lineTotal * (1 - data.orderDiscount / 100)
            return sum + (lineAmountAfterOrderDiscount * ((l.vatRate ?? 10) / 100))
          }, 0)
    const grandTotal = afterDiscount + vatAmount
    const statusInfo = STATUS_MAP[data.status] || STATUS_MAP.DRAFT

    // Group lines by supplierName and country
    const groups: Record<string, { supplierName: string; country: string; lines: LineData[] }> = {}
    for (const line of data.lines) {
        const supplierName = (line as any).supplierName || "Ly's Cellars"
        const country = line.country || "Other"
        const key = `${supplierName} - ${country}`
        if (!groups[key]) {
            groups[key] = { supplierName, country, lines: [] }
        }
        groups[key].lines.push(line)
    }

    async function handleAccept() {
        setAccepting(true)
        const res = await acceptQuotationPublic(token)
        setAccepting(false)
        if (res.success) setDone('accepted')
        else alert(res.error || 'Có lỗi xảy ra trong quá trình xác nhận')
    }

    async function handleReject() {
        if (!rejectReason.trim()) return
        setRejecting(true)
        const res = await rejectQuotationPublic(token, rejectReason)
        setRejecting(false)
        if (res.success) {
            setDone('rejected')
        } else {
            alert(res.error || 'Có lỗi xảy ra khi gửi phản hồi')
        }
    }

    function handleCopyAccount() {
        navigator.clipboard.writeText('1023456789')
        setCopiedAccount(true)
        setTimeout(() => setCopiedAccount(false), 2000)
    }

    function handleCopyShareLink() {
        navigator.clipboard.writeText(window.location.href)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
    }

    if (done) {
        return (
            <div style={{ minHeight: '100vh', background: '#FDFCF9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ 
                    maxWidth: 560, 
                    textAlign: 'center', 
                    color: '#0F172A', 
                    padding: '56px 40px', 
                    background: '#FFFFFF', 
                    border: '1px solid #E2E8F0', 
                    borderTop: done === 'accepted' ? '4px solid #15803D' : '4px solid #B91C1C',
                    boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
                    borderRadius: 4
                }}>
                    {done === 'accepted' ? (
                        <>
                            <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1.5px solid #BBF7D0' }}>
                                <CheckCircle2 size={44} style={{ color: '#15803D' }} />
                            </div>
                            <h2 className="font-brand" style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, letterSpacing: '0.02em', color: '#15803D' }}>Cảm Ơn Quý Khách!</h2>
                            <p style={{ color: '#334155', fontSize: 15, lineHeight: 1.7, margin: '0 0 16px' }}>
                                Báo giá đặc quyền <strong style={{ color: '#0E7490' }}>{data.quotationNo}</strong> đã được Quý khách xác nhận phê duyệt thành công.
                                Chuyên viên Sommelier <strong style={{ color: '#0F172A' }}>{data.salesRepName}</strong> sẽ liên hệ ngay để hỗ trợ chuẩn bị đơn hàng, kiểm tra tem niêm phong và điều phối lịch giao xe chuyên dụng.
                            </p>
                            <p style={{ color: '#64748B', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
                                The proposal {data.quotationNo} has been successfully approved. Our concierge team will contact you shortly.
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '1.5px solid #FECACA' }}>
                                <XCircle size={44} style={{ color: '#B91C1C' }} />
                            </div>
                            <h2 className="font-brand" style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, color: '#B91C1C' }}>Đã Ghi Nhận Phản Hồi</h2>
                            <p style={{ color: '#334155', fontSize: 15, lineHeight: 1.7, margin: '0 0 16px' }}>
                                Phản hồi của Quý khách đã được lưu chuyển tới Ban Giám Đốc &amp; chuyên viên phụ trách tài khoản. Chúng tôi sẽ điều chỉnh các điều khoản thương mại và liên hệ gửi lại phương án hoàn thiện nhất.
                            </p>
                            <p style={{ color: '#64748B', fontSize: 13, margin: 0, fontStyle: 'italic' }}>
                                Your feedback has been recorded. Our team will contact you with a revised proposal as soon as possible.
                            </p>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#FDFCF9', color: '#0F172A', fontFamily: 'var(--font-sans)', position: 'relative', overflowX: 'hidden' }}>
            <style>{`
                .qtn-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(11, 25, 36, 0.78);
                    backdrop-filter: blur(8px);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .qtn-modal-container {
                    width: 100%;
                    max-width: 820px;
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-top: 3.5px solid #C5A059;
                    box-shadow: 0 32px 80px rgba(15, 23, 42, 0.28);
                    border-radius: 4px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: row;
                    gap: 32px;
                    padding: 36px;
                    position: relative;
                    animation: qtnModalFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .qtn-modal-img-col {
                    width: 42%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 28px;
                    border-radius: 3px;
                    background: #F9F8F5;
                    border: 1px solid #E2E8F0;
                    min-height: 400px;
                    flex-shrink: 0;
                }
                .qtn-modal-info-col {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-width: 0;
                }
                @keyframes qtnModalFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.96) translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @media (max-width: 768px) {
                    .qtn-product-card {
                        flex-direction: column !important;
                        gap: 16px !important;
                        padding: 20px 16px !important;
                    }
                    .qtn-img-wrap {
                        width: 100% !important;
                        height: 160px !important;
                    }
                    .qtn-modal-overlay {
                        padding: 12px !important;
                    }
                    .qtn-modal-container {
                        flex-direction: column !important;
                        gap: 20px !important;
                        padding: 20px !important;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    .qtn-modal-img-col {
                        width: 100% !important;
                        min-height: 220px !important;
                        padding: 16px !important;
                    }
                }
            `}</style>

            {/* TOP LUXURY GOLD ACCENT STRIPE */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #C5A059 0%, #F5E6AB 50%, #C5A059 100%)', width: '100%' }} />

            {/* HEADER: Prestigious Fine Wine Salon Presentation */}
            <header style={{ 
                background: '#0B1924', 
                color: '#FFFFFF',
                borderBottom: '1px solid rgba(197, 160, 89, 0.4)', 
                padding: '26px 0',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                            width: 48, 
                            height: 48, 
                            border: '1.5px solid #C5A059', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'rgba(197, 160, 89, 0.1)',
                            borderRadius: '50%'
                        }}>
                            <svg width="24" height="28" viewBox="0 0 40 48" fill="none">
                                <path d="M8 4 Q8 20 20 26 Q32 20 32 4 Z" stroke="#C5A059" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="20" y1="26" x2="20" y2="40" stroke="#C5A059" strokeWidth="2.2" strokeLinecap="round" />
                                <line x1="13" y1="40" x2="27" y2="40" stroke="#C5A059" strokeWidth="2.2" strokeLinecap="round" />
                                <path d="M20 22 Q16 16 18 10 Q20 6 22 10" stroke="#C5A059" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-brand" style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '0.04em' }}>
                                LY&apos;s Cellars
                            </h1>
                            <p style={{ color: '#C5A059', fontSize: 9.5, letterSpacing: '0.22em', margin: 0, textTransform: 'uppercase', fontWeight: 600 }}>
                                FINE WINE SPECIALIST &bull; PRIVATE CLIENT SERVICE
                            </p>
                        </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', display: 'flex', gap: 24, alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#94A3B8', fontSize: 9.5, letterSpacing: '0.08em', margin: '0 0 2px', textTransform: 'uppercase' }}>Hỗ Trợ Khách Hàng VIP</p>
                            <p style={{ color: '#C5A059', fontWeight: 600, fontSize: 13, margin: 0 }}>concierge@lyscellars.com</p>
                        </div>
                        <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.15)', alignSelf: 'center' }} />
                        <div>
                            <p style={{ color: '#94A3B8', fontSize: 9.5, letterSpacing: '0.08em', margin: '0 0 2px', textTransform: 'uppercase' }}>Hotline Rượu Vang</p>
                            <p style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 13, margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Phone size={12} style={{ color: '#C5A059' }} /> 090 9999 999
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT CANVAS */}
            <main style={{ maxWidth: 1060, margin: '0 auto', padding: '36px 24px 60px', position: 'relative', zIndex: 10 }}>
                
                {/* Proposal Title and Action Buttons */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: 16, 
                    marginBottom: 28,
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '20px'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <ShieldCheck size={16} style={{ color: '#C5A059' }} />
                            <span style={{ color: '#C5A059', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                {data.showQuantity ? 'BẢN CHÀO GIÁ CHÍNH THỨC &bull; EXCLUSIVE COMMERCIAL PROPOSAL' : 'BẢNG GIÁ KHUNG &bull; EXCLUSIVE PRICE LIST'}
                            </span>
                        </div>
                        <h2 className="font-brand" style={{ color: '#0F172A', fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
                            {data.showQuantity ? 'BÁO GIÁ ĐẶC QUYỀN' : 'BẢNG GIÁ ĐẶC QUYỀN'}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ 
                            color: '#92400E', 
                            background: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            fontSize: 14, 
                            fontWeight: 700, 
                            letterSpacing: '0.04em',
                            padding: '4px 14px',
                            borderRadius: 2
                        }}>
                            {data.quotationNo}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                onClick={handleCopyShareLink}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '6px 12px',
                                    borderRadius: 3,
                                    background: '#FFFFFF',
                                    color: '#475569',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid #CBD5E1',
                                    transition: 'all 0.2s',
                                }}
                                title="Sao chép đường dẫn trực tiếp gửi đối tác"
                            >
                                {copiedLink ? <Check size={13} style={{ color: '#15803D' }} /> : <Copy size={13} />}
                                <span>{copiedLink ? 'Đã Sao Chép Link' : 'Chia Sẻ'}</span>
                            </button>

                            <button
                                onClick={() => window.open(`/api/export/quotation-pdf?token=${token}&style=professional`, '_blank')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 14px',
                                    borderRadius: 3,
                                    background: '#0B1924',
                                    color: '#FFFFFF',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid rgba(197, 160, 89, 0.5)',
                                    boxShadow: '0 2px 8px rgba(11,25,36,0.15)',
                                    transition: 'all 0.2s',
                                }}
                                title="Mở bản in hoặc tải file PDF khổ A4 chính thức"
                            >
                                <Printer size={13} style={{ color: '#C5A059' }} />
                                <span>In / Tải PDF A4</span>
                            </button>

                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                padding: '5px 12px', 
                                borderRadius: 3, 
                                background: statusInfo.bg, 
                                border: `1.5px solid ${statusInfo.border}` 
                            }}>
                                <statusInfo.icon size={13} style={{ color: statusInfo.color }} />
                                <span style={{ color: statusInfo.color, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    {statusInfo.label}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4-STAGE VIP TRANSACTION PROGRESSION STEPPER */}
                <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0', 
                    padding: '18px 24px', 
                    marginBottom: 32,
                    boxShadow: '0 2px 8px rgba(15,23,42,0.03)'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0FDF4', color: '#15803D', border: '1.5px solid #15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                                ✓
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A' }}>1. Khởi Tạo Báo Giá</span>
                            <span style={{ fontSize: 10, color: '#64748B' }}>Đã hoàn tất</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ECFEFF', color: '#0E7490', border: '1.5px solid #0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                                2
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0E7490' }}>2. Khách Duyệt &amp; Ký Tên</span>
                            <span style={{ fontSize: 10, color: '#0E7490', fontWeight: 600 }}>Đang thực hiện</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                3
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>3. Niêm Phong Hầm Vang</span>
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>Kiểm tra tem bảo hiểm</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                4
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>4. Giao Nhận Chuyên Dụng</span>
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>Xe lạnh 14-16°C</span>
                        </div>
                    </div>
                </div>

                {/* THREE ARCHITECTURAL DOSSIER CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, marginBottom: 36 }}>
                    
                    {/* Guest card */}
                    <div style={{ 
                        background: '#FFFFFF', 
                        padding: '24px', 
                        borderRadius: 3, 
                        border: '1px solid #E2E8F0',
                        borderTop: '2px solid #C5A059',
                        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <User size={13} style={{ color: '#C5A059' }} />
                            <h4 style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 700 }}>
                                KÍNH GỬI / PREPARED FOR
                            </h4>
                        </div>
                        <p className="font-brand" style={{ color: '#0F172A', fontWeight: 700, fontSize: 21, margin: 0 }}>
                            {data.contactPerson || data.customerName}
                        </p>
                        {data.companyName && (
                            <p style={{ color: '#334155', fontSize: 14, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Building2 size={13} style={{ color: '#64748B' }} /> {data.companyName}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, background: '#F8FAFC', color: '#475569', padding: '2px 8px', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                                Mã KH: <strong>{data.customerCode}</strong>
                            </span>
                            <span style={{ fontSize: 11, background: '#F8FAFC', color: '#475569', padding: '2px 8px', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                                Kênh: <strong>{data.channel}</strong>
                            </span>
                        </div>
                    </div>

                    {/* Timeline card */}
                    <div style={{ 
                        background: '#FFFFFF', 
                        padding: '24px', 
                        borderRadius: 3, 
                        border: '1px solid #E2E8F0',
                        borderTop: '2px solid #C5A059',
                        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Calendar size={13} style={{ color: '#C5A059' }} />
                            <h4 style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 700 }}>
                                THỜI HẠN &amp; THANH TOÁN / TERMS
                            </h4>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                                <span style={{ color: '#64748B', fontSize: 13 }}>Ngày lập báo giá</span>
                                <strong style={{ color: '#0F172A', fontSize: 13 }}>{fmtDate(data.createdAt)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                                <span style={{ color: '#64748B', fontSize: 13 }}>Hiệu lực báo giá đến</span>
                                <strong style={{ color: data.isExpired ? '#B91C1C' : '#92400E', fontSize: 13 }}>{fmtDate(data.validUntil)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748B', fontSize: 13 }}>Điều kiện thanh toán</span>
                                <strong style={{ color: '#0F172A', fontSize: 13 }}>{data.paymentTerm}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Sales advisor card */}
                    <div style={{ 
                        background: '#FFFFFF', 
                        padding: '24px', 
                        borderRadius: 3, 
                        border: '1px solid #E2E8F0',
                        borderTop: '2px solid #C5A059',
                        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <Mail size={13} style={{ color: '#C5A059' }} />
                            <h4 style={{ color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 700 }}>
                                CHUYÊN VIÊN TƯ VẤN / SOMMELIER
                            </h4>
                        </div>
                        <p className="font-brand" style={{ color: '#0F172A', fontWeight: 700, fontSize: 19, margin: '0 0 6px' }}>{data.salesRepName}</p>
                        
                        <p style={{ color: '#475569', fontSize: 13, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail size={13} style={{ color: '#0E7490' }} /> {data.salesRepEmail || 'concierge@lyscellars.com'}
                        </p>
                        
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <a
                                href={`tel:0909999999`}
                                style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    padding: '5px 8px',
                                    background: '#F8FAFC',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: 3,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#0F172A',
                                    textDecoration: 'none'
                                }}
                            >
                                <Phone size={11} style={{ color: '#0E7490' }} /> Gọi Tư Vấn
                            </a>
                            <a
                                href={`https://zalo.me/0909999999`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    padding: '5px 8px',
                                    background: '#ECFEFF',
                                    border: '1px solid #A5F3FC',
                                    borderRadius: 3,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#0E7490',
                                    textDecoration: 'none'
                                }}
                            >
                                <MessageSquare size={11} /> Nhắn Zalo
                            </a>
                        </div>
                    </div>
                </div>

                {/* PRODUCT PORTFOLIO SECTION */}
                <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0', 
                    overflow: 'hidden', 
                    marginBottom: 32,
                    boxShadow: '0 8px 30px rgba(15,23,42,0.04)'
                }}>
                    <div style={{ 
                        padding: '20px 28px', 
                        borderBottom: '1px solid #E2E8F0', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: '#FAFAF7'
                    }}>
                        <div>
                            <h3 className="font-brand" style={{ color: '#0F172A', fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Wine size={20} style={{ color: '#C5A059' }} /> DANH MỤC VANG TUYỂN CHỌN &bull; SELECTED PORTFOLIO
                            </h3>
                            <p style={{ color: '#64748B', fontSize: 12, margin: '3px 0 0' }}>
                                Toàn bộ các dòng vang đều được kiểm định chất lượng và đóng gói nguyên thùng chính ngạch
                            </p>
                        </div>
                        <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 2 }}>
                            {data.lines.length} sản phẩm
                        </span>
                    </div>

                    {data.lines.length === 0 ? (
                        <div style={{ padding: '56px 24px', textAlign: 'center', background: '#FFFFFF' }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Wine size={30} style={{ color: '#C5A059' }} />
                            </div>
                            <h4 className="font-brand" style={{ fontSize: 20, color: '#0F172A', fontWeight: 700, margin: '0 0 8px' }}>
                                Báo Giá Chưa Có Dòng Sản Phẩm
                            </h4>
                            <p style={{ color: '#64748B', fontSize: 13.5, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
                                Danh mục sản phẩm đang được chuẩn bị bởi chuyên viên Sommelier. Quý khách vui lòng liên hệ trực tiếp để nhận danh sách đề xuất cập nhật.
                            </p>
                        </div>
                    ) : (
                        Object.entries(groups).map(([groupKey, group], gIdx) => (
                            <div key={groupKey} style={{ borderBottom: gIdx < Object.keys(groups).length - 1 ? '1.5px solid #E2E8F0' : 'none' }}>
                                {/* Group Header Row */}
                                <div style={{ 
                                    padding: '12px 28px', 
                                    background: '#F4F3EE', 
                                    borderBottom: '1px solid #EAE7DF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', background: '#C5A059', color: '#FFFFFF', padding: '2px 7px', borderRadius: 1 }}>
                                        MAISON
                                    </span>
                                    <span style={{ color: '#0F172A', fontWeight: 700, fontSize: 13.5 }}>
                                        {group.supplierName}
                                    </span>
                                    <span style={{ color: '#C5A059', fontSize: 10 }}>✦</span>
                                    <span style={{ color: '#64748B', fontSize: 11.5, letterSpacing: '0.04em' }}>
                                        TERROIR: {group.country.toUpperCase()}
                                    </span>
                                </div>
                                
                                {group.lines.map((line, i) => (
                                    <ProductLineCard 
                                        key={i} 
                                        line={line} 
                                        i={i} 
                                        totalCount={group.lines.length} 
                                        showQuantity={data.showQuantity} 
                                        onOpenModal={setActiveModalLine} 
                                    />
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* PRICING TOTALS & FINANCIAL SUMMARY MATRIX */}
                {data.showQuantity && (
                    <div style={{ 
                        background: '#FFFFFF', 
                        borderRadius: 3, 
                        border: '1px solid #E2E8F0', 
                        borderTop: '2px solid #C5A059',
                        padding: '30px 36px', 
                        marginBottom: 32,
                        boxShadow: '0 8px 30px rgba(15,23,42,0.04)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: 40
                    }}>
                        {/* Left: Sommelier Cellar Master Assurance */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <ShieldCheck size={20} style={{ color: '#C5A059' }} />
                                <span className="font-brand" style={{ color: '#0F172A', fontSize: 18, fontWeight: 700 }}>
                                    Bảo Chứng Chất Lượng Hầm Rượu Vang LY&apos;s Cellars
                                </span>
                            </div>
                            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                                100% các dòng rượu vang đều được nhập khẩu chính ngạch nguyên chai từ các điền trang danh tiếng. Toàn bộ quy trình vận chuyển đường biển và lưu kho đều áp dụng công nghệ kiểm soát nhiệt độ nghiêm ngặt 14-16°C để giữ trọn vẹn chất lượng đỉnh cao của từng niên vụ.
                            </p>
                        </div>

                        {/* Right: Detailed financial matrix */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#64748B', fontSize: 14 }}>Tổng giá trị danh mục ({data.lines.length} sản phẩm):</span>
                                <span style={{ color: '#0F172A', fontWeight: 600, fontSize: 14 }}>{fmt(subtotal)} ₫</span>
                            </div>
                            
                            {data.orderDiscount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#B91C1C', fontSize: 14 }}>Chiết khấu đặc quyền dành riêng ({data.orderDiscount}%):</span>
                                    <span style={{ color: '#B91C1C', fontWeight: 700, fontSize: 14 }}>−{fmt(discountAmount)} ₫</span>
                                </div>
                            )}

                            {!data.vatIncluded && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#64748B', fontSize: 14 }}>Thuế Giá Trị Gia Tăng (VAT 10%):</span>
                                    <span style={{ color: '#0F172A', fontWeight: 600, fontSize: 14 }}>{fmt(vatAmount)} ₫</span>
                                </div>
                            )}

                            <div style={{ 
                                borderTop: '2px solid #C5A059', 
                                paddingTop: 16, 
                                marginTop: 6, 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <div>
                                    <span className="font-brand" style={{ color: '#0F172A', fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>
                                        TỔNG CỘNG THANH TOÁN
                                    </span>
                                    <p style={{ color: '#64748B', fontSize: 11, margin: '2px 0 0' }}>
                                        {data.vatIncluded ? 'Đã bao gồm thuế GTGT (VAT Included)' : 'Chưa bao gồm thuế GTGT (VAT Excluded)'}
                                    </p>
                                </div>
                                <span style={{ color: '#0F172A', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                    {fmt(grandTotal)} <span style={{ fontSize: 15, fontWeight: 600, color: '#C5A059' }}>₫</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* CELLAR MASTER 4 PILLARS OF EXCELLENCE */}
                <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0', 
                    padding: '24px 32px', 
                    marginBottom: 32,
                    boxShadow: '0 4px 16px rgba(15,23,42,0.03)'
                }}>
                    <h4 style={{ 
                        color: '#92400E', 
                        fontSize: 11, 
                        fontWeight: 700, 
                        letterSpacing: '0.12em', 
                        textTransform: 'uppercase', 
                        margin: '0 0 16px',
                        borderBottom: '1px solid #F1F5F9',
                        paddingBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <Sparkles size={14} style={{ color: '#C5A059' }} /> TIÊU CHUẨN DỊCH VỤ HẦM VANG LY&apos;S CELLARS (CELLAR MASTER ASSURANCE)
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ShieldCheck size={15} style={{ color: '#0E7490' }} /> 100% Chính Ngạch &bull; CO/CQ
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                                Nhập khẩu nguyên chai trực tiếp, đầy đủ tem hải quan và chứng nhận nguồn gốc xuất xứ.
                            </p>
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Thermometer size={15} style={{ color: '#0E7490' }} /> Kho Lạnh 14-16°C &bull; 70% Ẩm
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                                Bảo quản hầm rượu chuyên dụng 24/7 ngăn ngừa thoái hóa hương vị do nhiệt độ và ánh sáng.
                            </p>
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Truck size={15} style={{ color: '#0E7490' }} /> Giao Hàng Xe Chuyên Dụng
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                                Giao nhận xe thùng lạnh kiểm soát nhiệt độ tận nơi, miễn phí giao nội thành TP.HCM.
                            </p>
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0F172A', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Wine size={15} style={{ color: '#0E7490' }} /> Bảo Hiểm Nút Bần &bull; Đổi Trả
                            </div>
                            <p style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                                Cam kết đổi mới tức thì nếu chai vang có hiện tượng lỗi nút bần (corked) hoặc oxy hóa.
                            </p>
                        </div>
                    </div>
                </div>

                {/* BANK TRANSFER & LOGISTICS BLOCK */}
                <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0', 
                    padding: '24px 32px', 
                    marginBottom: 32,
                    boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 28
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <CreditCard size={15} style={{ color: '#C5A059' }} />
                            <h4 style={{ color: '#92400E', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                THÔNG TIN CHUYỂN KHOẢN (BANKING PROTOCOL)
                            </h4>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
                            Chủ tài khoản: <strong style={{ color: '#0F172A' }}>CÔNG TY TNHH LY&apos;S CELLARS</strong><br/>
                            Số tài khoản: <strong style={{ color: '#0E7490', fontSize: 14 }}>1023456789</strong> &nbsp;
                            <button 
                                onClick={handleCopyAccount}
                                style={{
                                    border: 'none',
                                    background: '#F1F5F9',
                                    padding: '2px 8px',
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    color: '#475569',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                }}
                            >
                                {copiedAccount ? <Check size={11} style={{ color: '#15803D' }} /> : <Copy size={11} />}
                                {copiedAccount ? 'Đã sao chép' : 'Sao chép STK'}
                            </button><br/>
                            Ngân hàng: <strong>Vietcombank (VCB)</strong> — Chi nhánh TP. Hồ Chí Minh<br/>
                            Nội dung chuyển khoản: <strong style={{ color: '#B45309' }}>Thanh toán {data.quotationNo}</strong>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <Compass size={15} style={{ color: '#C5A059' }} />
                            <h4 style={{ color: '#92400E', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                ĐIỀU KHOẢN VẬN CHUYỂN &amp; LƯU KHO
                            </h4>
                        </div>
                        <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                            {data.deliveryTerms || 'Giao hàng tận nơi bằng phương tiện chuyên dụng kiểm soát nhiệt độ 16-18°C. Miễn phí vận chuyển nội thành TP.HCM cho các đơn hàng rượu vang Grand Cru.'}
                        </p>
                    </div>
                </div>

                {/* ADDITIONAL COMMERCIAL TERMS */}
                {(data.terms || data.notes) && (
                    <div style={{ 
                        background: '#FFFFFF', 
                        borderRadius: 3, 
                        border: '1px solid #E2E8F0', 
                        padding: '24px 32px', 
                        marginBottom: 32 
                    }}>
                        <h4 style={{ 
                            color: '#92400E', 
                            fontSize: 11, 
                            fontWeight: 700, 
                            letterSpacing: '0.1em', 
                            textTransform: 'uppercase',
                            margin: '0 0 12px',
                            borderBottom: '1px solid #F1F5F9',
                            paddingBottom: 8
                        }}>
                            ĐIỀU KHOẢN KINH DOANH &amp; BẢO MẬT (COMMERCIAL TERMS)
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                            {data.terms && (
                                <div>
                                    <h5 style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Điều Khoản Hợp Đồng &amp; Thanh Toán</h5>
                                    <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{data.terms}</p>
                                </div>
                            )}
                            {data.notes && (
                                <div>
                                    <h5 style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>Ghi Chú Bổ Sung</h5>
                                    <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{data.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* FORMAL SIGNATURE & SEAL BLOCK */}
                <div style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 3, 
                    border: '1px solid #E2E8F0', 
                    padding: '28px 32px 36px', 
                    marginBottom: 36,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 36,
                    textAlign: 'center'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="font-brand" style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.06em' }}>
                            ĐẠI DIỆN KHÁCH HÀNG
                        </span>
                        <span style={{ fontSize: 10, color: '#64748B', margin: '2px 0 28px' }}>
                            Client Representative (Ký, ghi rõ họ tên)
                        </span>
                        <strong className="font-brand" style={{ fontSize: 15, color: '#0F172A', borderTop: '1px dotted #CBD5E1', paddingTop: 6, minWidth: 180 }}>
                            {data.contactPerson || data.customerName}
                        </strong>
                        <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{data.companyName || 'Đối Tác Thân Thiết'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="font-brand" style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.06em' }}>
                            CÔNG TY TNHH LY&apos;S CELLARS
                        </span>
                        <span style={{ fontSize: 10, color: '#64748B', margin: '2px 0 10px' }}>
                            Authorized Executive Signatory
                        </span>
                        <div style={{ 
                            width: 62, 
                            height: 62, 
                            borderRadius: '50%', 
                            border: '1.5px dashed #B91C1C', 
                            color: '#B91C1C', 
                            fontSize: 8, 
                            fontWeight: 700, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            textAlign: 'center', 
                            lineHeight: 1.2,
                            transform: 'rotate(-8deg)',
                            marginBottom: 8
                        }}>
                            LY&apos;S CELLARS<br/>★ DẤU PHÁP NHÂN ★<br/>APPROVED
                        </div>
                        <strong className="font-brand" style={{ fontSize: 15, color: '#0F172A', borderTop: '1px dotted #CBD5E1', paddingTop: 6, minWidth: 180 }}>
                            BAN GIÁM ĐỐC &amp; DUYỆT BÁO GIÁ
                        </strong>
                        <span style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Private Client Division &bull; Sommelier Service</span>
                    </div>
                </div>

                {/* CLIENT DECISION INTERACTION (ACCEPT / REJECT) */}
                {data.isActionable && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
                        <button
                            onClick={handleAccept}
                            disabled={accepting}
                            style={{ 
                                flex: 2, 
                                minWidth: 260, 
                                padding: '18px 36px', 
                                borderRadius: 3, 
                                background: 'linear-gradient(135deg, #15803D 0%, #166534 100%)', 
                                color: 'white', 
                                border: '1px solid #14532D', 
                                fontSize: 15, 
                                fontWeight: 700, 
                                cursor: 'pointer', 
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                boxShadow: '0 6px 20px rgba(21,128,61,0.25)',
                                opacity: accepting ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.boxShadow = '0 8px 28px rgba(21,128,61,0.35)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(21,128,61,0.25)'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }}
                        >
                            <CheckCircle2 size={18} />
                            {accepting ? 'Đang Xác Nhận...' : 'Xác Nhận & Ký Duyệt Báo Giá'}
                        </button>
                        
                        {!showRejectForm ? (
                            <button
                                onClick={() => setShowRejectForm(true)}
                                style={{ 
                                    flex: 1,
                                    padding: '18px 28px', 
                                    borderRadius: 3, 
                                    background: '#FFFFFF', 
                                    color: '#B91C1C', 
                                    border: '1px solid #FECACA', 
                                    fontSize: 14, 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = '#FEF2F2'
                                    e.currentTarget.style.borderColor = '#B91C1C'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = '#FFFFFF'
                                    e.currentTarget.style.borderColor = '#FECACA'
                                }}
                            >
                                Góp Ý / Từ Chối Báo Giá
                            </button>
                        ) : (
                            <div style={{ flex: 2, minWidth: 280, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    placeholder="Nêu mong muốn điều chỉnh (giá, số lượng, điều khoản)..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    style={{ 
                                        flex: 1, 
                                        padding: '14px 18px', 
                                        borderRadius: 3, 
                                        background: '#FFFFFF', 
                                        border: '1px solid #B91C1C', 
                                        color: '#0F172A', 
                                        fontSize: 14, 
                                        outline: 'none',
                                    }}
                                />
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting || !rejectReason.trim()}
                                    style={{ 
                                        padding: '14px 24px', 
                                        borderRadius: 3, 
                                        background: '#B91C1C', 
                                        color: 'white', 
                                        border: 'none', 
                                        fontWeight: 700, 
                                        fontSize: 13,
                                        cursor: 'pointer', 
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                        opacity: (rejecting || !rejectReason.trim()) ? 0.5 : 1,
                                    }}
                                >
                                    Gửi Phản Hồi
                                </button>
                                <button
                                    onClick={() => setShowRejectForm(false)}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: 3,
                                        background: '#F1F5F9',
                                        color: '#475569',
                                        border: '1px solid #E2E8F0',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Hủy
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {data.isExpired && (
                    <div style={{ 
                        background: '#FEF2F2', 
                        border: '1.5px solid #FECACA', 
                        borderRadius: 3, 
                        padding: '24px 32px', 
                        textAlign: 'center', 
                        marginBottom: 40,
                        boxShadow: '0 4px 16px rgba(185,28,28,0.06)'
                    }}>
                        <AlertTriangle size={28} style={{ color: '#B91C1C', margin: '0 auto 10px' }} />
                        <h4 style={{ color: '#B91C1C', fontSize: 16, fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Báo Giá Này Đã Hết Hiệu Lực</h4>
                        <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                            Thời hạn hiệu lực của bảng giá đặc quyền này đã kết thúc. Quý khách vui lòng liên hệ chuyên viên tư vấn <strong style={{ color: '#0F172A' }}>{data.salesRepName}</strong> hoặc hòm thư concierge@lyscellars.com để nhận bản báo giá cập nhật mới nhất.
                        </p>
                    </div>
                )}
            </main>

            {/* FOOTER */}
            <footer style={{ 
                borderTop: '1px solid #E2E8F0', 
                padding: '36px 24px', 
                textAlign: 'center',
                background: '#FAFAF7',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                    <p style={{ color: '#475569', fontSize: 13, margin: 0, fontWeight: 500 }}>
                        © {new Date().getFullYear()} LY&apos;s Cellars — Fine Wine Specialist &bull; Private Client Division
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: 11, maxWidth: 680, margin: 0, lineHeight: 1.5 }}>
                        Tài liệu này chứa thông tin kinh doanh và chính sách giá đặc quyền dành riêng cho Quý khách. Mọi hành vi sao chép, công bố hoặc chia sẻ thông tin báo giá khi chưa có văn bản chấp thuận từ LY&apos;s Cellars đều bị nghiêm cấm.
                    </p>
                </div>
            </footer>

            {/* GRAND CRU DOSSIER MODAL */}
            {activeModalLine && (
                <div 
                    className="qtn-modal-overlay"
                    onClick={() => setActiveModalLine(null)}
                >
                    <div 
                        className="qtn-modal-container"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setActiveModalLine(null)} 
                            style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94A3B8',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s ease',
                                zIndex: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#B91C1C'}
                            onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                        >
                            <XCircle size={26} />
                        </button>

                        {/* Left Column: Big bottle visual */}
                        <div className="qtn-modal-img-col">
                            {activeModalLine.imageUrl ? (
                                <img 
                                    src={activeModalLine.imageUrl} 
                                    alt={activeModalLine.productName} 
                                    style={{ 
                                        maxWidth: '100%', 
                                        maxHeight: '360px', 
                                        objectFit: 'contain',
                                        filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.18))'
                                    }} 
                                />
                            ) : (
                                <Wine size={80} style={{ color: '#C5A059', opacity: 0.5 }} />
                            )}
                        </div>

                        {/* Right Column: Wine profile specs */}
                        <div className="qtn-modal-info-col">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                    {activeModalLine.producerName && (
                                        <span style={{ color: '#C5A059', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                            {activeModalLine.producerName} &bull;
                                        </span>
                                    )}
                                    <span style={{ color: '#92400E', fontSize: 12.5, fontWeight: 600 }}>
                                        {[activeModalLine.appellationName, activeModalLine.regionName !== activeModalLine.appellationName ? activeModalLine.regionName : null, activeModalLine.country].filter(Boolean).join(' · ')}
                                    </span>
                                </div>

                                <h3 className="font-brand" style={{ color: '#0F172A', fontSize: 24, fontWeight: 700, margin: '0 0 12px 0', lineHeight: 1.25, borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                                    {activeModalLine.productName}
                                </h3>

                                {/* Technical Specs Block */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(2, 1fr)', 
                                    gap: '8px 16px',
                                    marginBottom: 16,
                                    background: '#F9F8F5',
                                    padding: '12px 16px',
                                    border: '1px solid #EAE7E0',
                                    borderRadius: '3px'
                                }}>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Mã SKU: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{activeModalLine.skuCode}</strong>
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Dòng Vang: <strong style={{ color: '#0F172A' }}>{activeModalLine.wineType}</strong>
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Giống Nho: <strong style={{ color: '#0F172A' }}>{activeModalLine.profile?.grapes || 'Blend điền trang tuyển chọn'}</strong>
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Nhiệt Độ: <strong style={{ color: '#0F172A' }}>{activeModalLine.profile?.servingTemp || '16-18°C'}</strong>
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Dung Tích: <strong style={{ color: '#0F172A' }}>{activeModalLine.volumeMl}ml {activeModalLine.packagingType ? `• ${String(activeModalLine.packagingType).replace('_', ' ')}` : ''}</strong>
                                    </span>
                                    <span style={{ color: '#64748B', fontSize: 12 }}>
                                        Nồng Độ Cồn: <strong style={{ color: '#0F172A' }}>{activeModalLine.abvPercent}% ABV</strong>
                                    </span>
                                    {activeModalLine.profile?.foodPairings && (
                                        <div style={{ gridColumn: 'span 2', color: '#64748B', fontSize: 12, borderTop: '1px solid #EAE7E0', paddingTop: 6, marginTop: 2 }}>
                                            Ẩm Thực Đề Xuất: <strong style={{ color: '#0F172A' }}>{activeModalLine.profile.foodPairings}</strong>
                                        </div>
                                    )}
                                </div>

                                {/* Tasting Notes Details */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Quote size={13} style={{ color: '#C5A059', transform: 'rotate(180deg)' }} />
                                        <span style={{ 
                                            color: '#C5A059', 
                                            fontSize: 11, 
                                            fontWeight: 700, 
                                            letterSpacing: '0.1em', 
                                            textTransform: 'uppercase' 
                                        }}>
                                            Hồ Sơ Thử Nếm Từ Sommelier
                                        </span>
                                    </div>
                                    <div style={{ background: '#FFFBEB', padding: '12px 16px', borderLeft: '2.5px solid #C5A059', borderRadius: '2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {activeModalLine.profile?.aromas && (
                                            <p style={{ color: '#334155', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                                                <strong>Tầng Hương (Aromas):</strong> {activeModalLine.profile.aromas}
                                            </p>
                                        )}
                                        {activeModalLine.profile?.palate && (
                                            <p style={{ color: '#334155', fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
                                                <strong>Cấu Trúc Vị Giác (Palate):</strong> {activeModalLine.profile.palate}
                                            </p>
                                        )}
                                        {activeModalLine.tastingNotes && !activeModalLine.profile?.aromas && !activeModalLine.profile?.palate && (
                                            <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                                                {activeModalLine.tastingNotes}
                                            </p>
                                        )}
                                        {!activeModalLine.tastingNotes && !activeModalLine.profile?.aromas && !activeModalLine.profile?.palate && (
                                            <p style={{ color: '#64748B', fontSize: 12.5, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                                                Chưa có bản ghi chú nếm chi tiết cho niên vụ này. Quý khách vui lòng liên hệ chuyên viên tư vấn để nhận khuyến nghị chi tiết.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Wine Awards */}
                                {activeModalLine.awards.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                        {activeModalLine.awards.map((a, j) => (
                                            <span key={j} style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: 4, 
                                                background: '#FFFBEB', 
                                                color: '#92400E', 
                                                border: '1px solid #FDE68A',
                                                padding: '2px 8px', 
                                                borderRadius: 2, 
                                                fontSize: 11, 
                                                fontWeight: 600,
                                                textTransform: 'uppercase'
                                            }}>
                                                {a.medal ? <Award size={12} style={{ color: '#C5A059' }} /> : <Star size={12} style={{ color: '#C5A059' }} />}
                                                {a.source} {a.score ? `${a.score} pts` : a.medal?.replace('_', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pricing matrix block */}
                            <div style={{ 
                                marginTop: 20, 
                                paddingTop: 16, 
                                borderTop: '1px solid #E2E8F0', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <div>
                                    <span style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Đơn Giá Đề Xuất Đặc Quyền
                                    </span>
                                    {activeModalLine.discountPct > 0 && (
                                        <span style={{ color: '#B91C1C', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
                                            (−{activeModalLine.discountPct}% ưu đãi)
                                        </span>
                                    )}
                                </div>
                                <strong style={{ color: '#0F172A', fontSize: 22, fontWeight: 700 }}>
                                    {fmt(activeModalLine.unitPrice * (1 - activeModalLine.discountPct / 100))} <span style={{ fontSize: 13, fontWeight: 500, color: '#C5A059' }}>₫</span>
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
