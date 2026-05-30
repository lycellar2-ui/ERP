'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, Wine, MapPin, Award, Star, AlertTriangle, Quote, ShieldCheck, Mail, Phone, Calendar, CreditCard, ChevronRight } from 'lucide-react'
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
    isExpired: boolean; isActionable: boolean; showQuantity?: boolean; lines: LineData[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    DRAFT: { label: 'Bản Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.1)', border: 'rgba(138,174,187,0.3)', icon: Clock },
    SENT: { label: 'Đang Hiệu Lực', color: '#87CBB9', bg: 'rgba(135,203,185,0.1)', border: 'rgba(135,203,185,0.3)', icon: Clock },
    ACCEPTED: { label: 'Đã Chấp Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.1)', border: 'rgba(91,168,138,0.3)', icon: CheckCircle2 },
    CONVERTED: { label: 'Đã Lên Đơn Hàng', color: '#4A8FAB', bg: 'rgba(74,143,171,0.1)', border: 'rgba(74,143,171,0.3)', icon: CheckCircle2 },
    EXPIRED: { label: 'Hết Hiệu Lực', color: '#8B1A2E', bg: 'rgba(139,26,46,0.1)', border: 'rgba(139,26,46,0.3)', icon: AlertTriangle },
    CANCELLED: { label: 'Đã Từ Chối', color: '#8B1A2E', bg: 'rgba(139,26,46,0.1)', border: 'rgba(139,26,46,0.3)', icon: XCircle },
}

// Sub-component for individual product cards with rich hover styling and spring transitions
function ProductLineCard({ line, i, totalCount, showQuantity, onImageClick }: { line: LineData; i: number; totalCount: number; showQuantity?: boolean; onImageClick: (line: LineData) => void }) {
    const [hovered, setHovered] = useState(false)

    // Formulate a premium classification subtitle (e.g. "Grand Cru Classé • Bordeaux, France")
    const originParts = []
    if (line.appellationName) originParts.push(line.appellationName)
    if (line.regionName && line.regionName !== line.appellationName) originParts.push(line.regionName)
    originParts.push(line.country)

    return (
        <div 
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="qtn-product-card"
            style={{ 
                padding: '28px 24px', 
                borderBottom: i < totalCount - 1 ? '1px solid #1B2E3D' : 'none', 
                display: 'flex', 
                gap: 24, 
                alignItems: 'flex-start',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                background: hovered ? 'linear-gradient(90deg, rgba(20,36,51,0.45) 0%, rgba(27,46,61,0.15) 100%)' : 'transparent',
                transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: hovered ? 'inset 0 0 24px rgba(135,203,185,0.03), 0 12px 30px rgba(0,0,0,0.25)' : 'none',
            }}
        >
            {/* Product image with sleek premium dark background and shadow */}
            <div 
                className="qtn-img-wrap cursor-pointer" 
                onClick={() => onImageClick(line)}
                style={{ 
                    width: 140, 
                    height: 90, 
                    borderRadius: 4, 
                    flexShrink: 0, 
                    background: 'linear-gradient(135deg, #091520 0%, #112130 100%)', 
                    border: hovered ? '1px solid rgba(135,203,185,0.35)' : '1px solid #2A4355', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transition: 'all 0.4s ease',
                    transform: hovered ? 'scale(1.03)' : 'scale(1)',
                    cursor: 'pointer',
                }}
                title="Click to view large image & tasting profile"
            >
                {line.imageUrl ? (
                    <img 
                        src={line.imageUrl} 
                        alt={line.productName} 
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
                        }} 
                    />
                ) : (
                    <Wine size={32} style={{ color: '#4A6A7A' }} />
                )}
            </div>

            {/* Product details */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h4 style={{ 
                            color: hovered ? '#87CBB9' : '#E8F1F2', 
                            fontWeight: 600, 
                            fontSize: 18, 
                            margin: 0, 
                            fontFamily: '"Cormorant Garamond", Georgia, serif',
                            lineHeight: 1.25,
                            transition: 'color 0.3s ease'
                        }}>
                            {line.productName}
                        </h4>
                        
                        {/* Subtitles & Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                            {line.vintage ? (
                                <span style={{ color: '#D4A853', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>{line.vintage}</span>
                            ) : (
                                <span style={{ color: '#4A6A7A', fontSize: 12, fontWeight: 500 }}>N/V</span>
                            )}
                            <span style={{ color: '#4A6A7A', fontSize: 12 }}>•</span>
                            <span style={{ color: '#8AAEBB', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={11} style={{ color: '#87CBB9' }} /> {originParts.join(', ')}
                            </span>
                            {line.classification && (
                                <>
                                    <span style={{ color: '#4A6A7A', fontSize: 12 }}>•</span>
                                    <span style={{ color: '#D4A853', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                                        {line.classification}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Technical Metadata */}
                        <p style={{ color: '#4A6A7A', fontSize: 12, margin: '6px 0 0', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                            SKU: <span style={{ color: '#8AAEBB' }}>{line.skuCode}</span> • Type: <span style={{ color: '#8AAEBB' }}>{line.wineType}</span> • Vol: <span style={{ color: '#8AAEBB' }}>{line.volumeMl}ml</span> • ABV: <span style={{ color: '#8AAEBB' }}>{line.abvPercent}%</span>
                        </p>
                    </div>

                    {/* Pricing column */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ color: '#87CBB9', fontWeight: 700, fontSize: 18, margin: 0, fontFamily: 'var(--font-sans)' }}>
                            {showQuantity ? fmt(line.lineTotal) : fmt(line.unitPrice * (1 - line.discountPct / 100))} <span style={{ fontSize: 12, fontWeight: 400 }}>₫</span>
                        </p>
                        <p style={{ color: '#4A6A7A', fontSize: 12, margin: '2px 0 0', fontFamily: 'var(--font-sans)' }}>
                            {showQuantity ? (
                                <>
                                    {line.qty} × {fmt(line.unitPrice)} ₫
                                    {line.discountPct > 0 && (
                                        <span style={{ color: '#EF4444', fontWeight: 600, marginLeft: 4 }}>
                                            (−{line.discountPct}%)
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    Đơn giá: {fmt(line.unitPrice)} ₫
                                    {line.discountPct > 0 && (
                                        <span style={{ color: '#EF4444', fontWeight: 600, marginLeft: 4 }}>
                                            (−{line.discountPct}%)
                                        </span>
                                    )}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Wine awards with modern styling */}
                {line.awards.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {line.awards.map((a, j) => (
                            <span key={j} style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                background: 'rgba(212,168,83,0.08)', 
                                color: '#D4A853', 
                                border: '1px solid rgba(212,168,83,0.2)',
                                padding: '3px 10px', 
                                borderRadius: 2, 
                                fontSize: 11, 
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                            }}>
                                {a.medal ? <Award size={11} /> : <Star size={11} />}
                                {a.source} {a.score ? `${a.score} pts` : a.medal?.replace('_', ' ')}
                            </span>
                        ))}
                    </div>
                )}

                {/* Sommelier Tasting Profile Card */}
                {line.tastingNotes && (
                    <div style={{ 
                        marginTop: 14, 
                        padding: '14px 18px', 
                        borderRadius: 2, 
                        background: 'linear-gradient(135deg, rgba(212,168,83,0.02) 0%, rgba(135,203,185,0.01) 100%)', 
                        borderLeft: '3px solid #D4A853', 
                        borderTop: '1px solid rgba(212,168,83,0.05)',
                        borderRight: '1px solid rgba(212,168,83,0.05)',
                        borderBottom: '1px solid rgba(212,168,83,0.05)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Quote size={12} style={{ color: '#D4A853', transform: 'rotate(180deg)' }} />
                            <span style={{ 
                                color: '#D4A853', 
                                fontSize: 10, 
                                fontWeight: 700, 
                                letterSpacing: '0.12em', 
                                textTransform: 'uppercase' 
                            }}>
                                Sommelier&apos;s Tasting Profile
                            </span>
                        </div>
                        <p style={{ 
                            color: '#8AAEBB', 
                            fontSize: 13, 
                            lineHeight: 1.6,
                            margin: 0,
                            fontStyle: 'italic',
                            fontFamily: '"Cormorant Garamond", Georgia, serif',
                        }}>
                            {line.tastingNotes}
                        </p>
                    </div>
                )}
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

    const subtotal = data.lines.reduce((s, l) => s + l.lineTotal, 0)
    const discountAmount = subtotal * (data.orderDiscount / 100)
    const afterDiscount = subtotal - discountAmount
    const vatAmount = data.vatIncluded ? 0 : afterDiscount * 0.1
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
        else alert(res.error || 'An error occurred')
    }

    async function handleReject() {
        if (!rejectReason.trim()) return
        setRejecting(true)
        const res = await rejectQuotationPublic(token, rejectReason)
        setRejecting(false)
        if (res.success) {
            setDone('rejected')
        } else {
            alert(res.error || 'An error occurred')
        }
    }

    if (done) {
        return (
            <div style={{ minHeight: '100vh', background: '#0A1926', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ 
                    maxWidth: 500, 
                    textAlign: 'center', 
                    color: '#E8F1F2', 
                    padding: '48px 32px', 
                    background: '#142433', 
                    border: '1px solid #2A4355', 
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)' 
                }}>
                    {done === 'accepted' ? (
                        <>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(91,168,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <CheckCircle2 size={48} style={{ color: '#5BA88A' }} />
                            </div>
                            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, fontFamily: '"Cormorant Garamond", Georgia, serif', letterSpacing: '0.02em' }}>Thank You!</h1>
                            <p style={{ color: '#8AAEBB', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                                The proposal <strong style={{ color: '#87CBB9' }}>{data.quotationNo}</strong> has been successfully approved.
                                Our LY's Cellars team will contact you shortly to coordinate logistics and delivery.
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,26,46,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                                <XCircle size={48} style={{ color: '#8B1A2E' }} />
                            </div>
                            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>Feedback Recorded</h1>
                            <p style={{ color: '#8AAEBB', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                                Your request to decline this proposal has been successfully recorded. We will quickly adjust the commercial terms and send a revised offer as soon as possible.
                            </p>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0A1926', color: '#E8F1F2', fontFamily: 'var(--font-sans)', position: 'relative', overflowX: 'hidden' }}>
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
                    background: rgba(8, 16, 24, 0.88);
                    backdrop-filter: blur(12px);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .qtn-modal-container {
                    width: 100%;
                    max-width: 760px;
                    background: linear-gradient(135deg, #0D1E2B 0%, #0A1621 100%);
                    border: 1px solid #2A4355;
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
                    border-radius: 2px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: row;
                    gap: 28px;
                    padding: 28px;
                    position: relative;
                    animation: qtnModalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .qtn-modal-img-col {
                    width: 45%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    border-radius: 2px;
                    background: linear-gradient(135deg, #081119 0%, #112130 100%);
                    border: 1px solid rgba(42, 67, 85, 0.5);
                    min-height: 380px;
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
                        transform: scale(0.96) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @media (max-width: 640px) {
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
                        min-height: 200px !important;
                        padding: 16px !important;
                    }
                }
            `}</style>
            
            {/* Ambient luxury radial glow */}
            <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: '50%', 
                transform: 'translateX(-50%)', 
                width: '100vw', 
                height: '700px', 
                background: 'radial-gradient(circle, rgba(135,203,185,0.03) 0%, rgba(10,25,38,0) 70%)', 
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Header section with high-end asymmetrical lines */}
            <header style={{ 
                background: 'linear-gradient(180deg, #09141F 0%, #0A1926 100%)', 
                borderBottom: '1px solid #2A4355', 
                padding: '36px 0',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                            width: 48, 
                            height: 48, 
                            border: '1.5px solid #87CBB9', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            background: 'rgba(135,203,185,0.03)',
                            borderRadius: '50%'
                        }}>
                            <svg width="22" height="26" viewBox="0 0 40 48" fill="none">
                                <path d="M8 4 Q8 20 20 26 Q32 20 32 4 Z" stroke="#87CBB9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="20" y1="26" x2="20" y2="40" stroke="#87CBB9" strokeWidth="2" strokeLinecap="round" />
                                <line x1="13" y1="40" x2="27" y2="40" stroke="#87CBB9" strokeWidth="2" strokeLinecap="round" />
                                <path d="M20 22 Q16 16 18 10 Q20 6 22 10" stroke="#D4A853" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <h1 style={{ color: '#E8F1F2', fontSize: 24, fontWeight: 700, fontFamily: '"Cormorant Garamond", Georgia, serif', margin: 0, letterSpacing: '0.04em' }}>
                                LY&apos;s Cellars
                            </h1>
                            <p style={{ color: '#4A6A7A', fontSize: 10, letterSpacing: '0.22em', margin: 0 }}>FINE WINE SPECIALIST</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: 24 }}>
                        <div>
                            <p style={{ color: '#4A6A7A', fontSize: 10, letterSpacing: '0.08em', margin: '0 0 2px', textTransform: 'uppercase' }}>Online Support</p>
                            <p style={{ color: '#87CBB9', fontWeight: 600, fontSize: 14, margin: 0 }}>📧 info@lyscellars.com</p>
                        </div>
                        <div style={{ height: '32px', width: '1px', background: '#2A4355', alignSelf: 'center' }} />
                        <div>
                            <p style={{ color: '#4A6A7A', fontSize: 10, letterSpacing: '0.08em', margin: '0 0 2px', textTransform: 'uppercase' }}>Hotline</p>
                            <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 14, margin: 0 }}>📞 028 1234 5678</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content grid */}
            <main style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 10 }}>
                
                {/* Title selection bar */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: 16, 
                    marginBottom: 36,
                    borderBottom: '1px solid #2A4355',
                    paddingBottom: '20px'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <ShieldCheck size={16} style={{ color: '#87CBB9' }} />
                            <span style={{ color: '#87CBB9', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                {data.showQuantity ? 'Exclusive Proposal' : 'Frame Pricing Agreement'}
                            </span>
                        </div>
                        <h2 style={{ color: '#E8F1F2', fontSize: 32, fontWeight: 700, margin: 0, fontFamily: '"Cormorant Garamond", Georgia, serif', letterSpacing: '0.01em' }}>
                            {data.showQuantity ? 'EXCLUSIVE QUOTATION' : 'EXCLUSIVE PRICE LIST'}
                        </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ color: '#D4A853', fontSize: 16, fontWeight: 700, fontFamily: '"DM Mono", monospace', letterSpacing: '0.05em' }}>
                            {data.quotationNo}
                        </span>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 6, 
                            padding: '4px 12px', 
                            borderRadius: 2, 
                            background: statusInfo.bg, 
                            border: `1.5px solid ${statusInfo.border}` 
                        }}>
                            <statusInfo.icon size={13} style={{ color: statusInfo.color }} />
                            <span style={{ color: statusInfo.color, fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {statusInfo.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Info metadata section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 36 }}>
                    
                    {/* Guest card */}
                    <div style={{ 
                        background: 'linear-gradient(180deg, #142433 0%, #0E1D2A 100%)', 
                        padding: '24px', 
                        borderRadius: 2, 
                        border: '1px solid #2A4355',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'absolute', top: 18, right: 18, width: 8, height: 8, borderRadius: '50%', background: '#87CBB9' }} />
                        <h4 style={{ color: '#4A6A7A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px' }}>PREPARED FOR</h4>
                        <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 18, margin: 0, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                            {data.contactPerson || data.customerName}
                        </p>
                        {data.companyName && <p style={{ color: '#8AAEBB', fontSize: 14, margin: '6px 0 0' }}>{data.companyName}</p>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, background: 'rgba(135,203,185,0.05)', color: '#87CBB9', padding: '2px 8px', border: '1px solid rgba(135,203,185,0.1)' }}>
                                Client Code: {data.customerCode}
                            </span>
                            <span style={{ fontSize: 11, background: 'rgba(74,143,171,0.05)', color: '#8AAEBB', padding: '2px 8px', border: '1px solid rgba(74,143,171,0.1)' }}>
                                Channel: {data.channel}
                            </span>
                        </div>
                    </div>

                    {/* Timeline card */}
                    <div style={{ 
                        background: 'linear-gradient(180deg, #142433 0%, #0E1D2A 100%)', 
                        padding: '24px', 
                        borderRadius: 2, 
                        border: '1px solid #2A4355' 
                    }}>
                        <h4 style={{ color: '#4A6A7A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px' }}>TIMELINE & TERMS</h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(42,67,85,0.5)', paddingBottom: 6 }}>
                                <span style={{ color: '#8AAEBB', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Calendar size={13} style={{ color: '#4A6A7A' }} /> Date Issued
                                </span>
                                <strong style={{ color: '#E8F1F2', fontSize: 13, fontFamily: '"DM Mono", monospace' }}>{fmtDate(data.createdAt)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(42,67,85,0.5)', paddingBottom: 6 }}>
                                <span style={{ color: '#8AAEBB', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={13} style={{ color: '#4A6A7A' }} /> Valid Until
                                </span>
                                <strong style={{ color: data.isExpired ? '#8B1A2E' : '#D4A853', fontSize: 13, fontFamily: '"DM Mono", monospace' }}>{fmtDate(data.validUntil)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#8AAEBB', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CreditCard size={13} style={{ color: '#4A6A7A' }} /> Payment Term
                                </span>
                                <strong style={{ color: '#E8F1F2', fontSize: 13 }}>{data.paymentTerm}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Sales advisor card */}
                    <div style={{ 
                        background: 'linear-gradient(180deg, #142433 0%, #0E1D2A 100%)', 
                        padding: '24px', 
                        borderRadius: 2, 
                        border: '1px solid #2A4355' 
                    }}>
                        <h4 style={{ color: '#4A6A7A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px' }}>WINE ADVISOR</h4>
                        <p style={{ color: '#E8F1F2', fontWeight: 600, fontSize: 16, margin: '0 0 6px' }}>{data.salesRepName}</p>
                        
                        <p style={{ color: '#8AAEBB', fontSize: 13, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Mail size={13} style={{ color: '#87CBB9' }} /> {data.salesRepEmail}
                        </p>
                        <p style={{ color: '#4A6A7A', fontSize: 11, margin: '8px 0 0', fontStyle: 'italic' }}>
                            Professional Wine Consultant from LY&apos;s Cellars
                        </p>
                    </div>
                </div>

                {/* Product catalog lines wrapper */}
                <div style={{ 
                    background: '#142433', 
                    borderRadius: 2, 
                    border: '1px solid #2A4355', 
                    overflow: 'hidden', 
                    marginBottom: 32,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ 
                        padding: '20px 24px', 
                        borderBottom: '1px solid #2A4355', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: 'linear-gradient(180deg, #182B3C 0%, #142433 100%)'
                    }}>
                        <h3 style={{ color: '#E8F1F2', fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Wine size={16} style={{ color: '#87CBB9' }} /> SELECTED WINE PORTFOLIO / BOTTLE DETAILS
                        </h3>
                        <span style={{ color: '#8AAEBB', fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                            {data.lines.length} items
                        </span>
                    </div>

                    {Object.entries(groups).map(([groupKey, group], gIdx) => (
                        <div key={groupKey} style={{ borderBottom: gIdx < Object.keys(groups).length - 1 ? '1.5px solid #2A4355' : 'none' }}>
                            {/* Group Header Row */}
                            <div style={{ 
                                padding: '12px 24px', 
                                background: 'rgba(135,203,185,0.06)', 
                                borderBottom: '1px solid #2A4355',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                <span style={{ color: '#87CBB9', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    📦 {group.supplierName} — 🌍 {group.country}
                                </span>
                            </div>
                            
                            {group.lines.map((line, i) => (
                                <ProductLineCard key={i} line={line} i={i} totalCount={group.lines.length} showQuantity={data.showQuantity} onImageClick={setActiveModalLine} />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Pricing totals summary block */}
                {data.showQuantity && (
                    <div style={{ 
                        background: 'linear-gradient(180deg, #142433 0%, #0C1A27 100%)', 
                        borderRadius: 2, 
                        border: '1px solid #2A4355', 
                        padding: '28px 32px', 
                        marginBottom: 32,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 32
                    }}>
                        {/* Left: Quick checklist validation details */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <ShieldCheck size={16} style={{ color: '#87CBB9' }} />
                                <span style={{ color: '#E8F1F2', fontSize: 14, fontWeight: 600 }}>Cellar Quality Commitment</span>
                            </div>
                            <p style={{ color: '#8AAEBB', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                                All fine wines distributed by LY&apos;s Cellars are imported directly from world-class estates, strictly transported and stored under standard cellar conditions of 14-16°C.
                            </p>
                        </div>

                        {/* Right: Detailed financial matrix */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#8AAEBB', fontSize: 14 }}>Subtotal (Before Discount)</span>
                                <span style={{ color: '#E8F1F2', fontWeight: 500, fontSize: 14, fontFamily: '"DM Mono", monospace' }}>{fmt(subtotal)} ₫</span>
                            </div>
                            
                            {data.orderDiscount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#EF4444', fontSize: 14 }}>Order Discount ({data.orderDiscount}%)</span>
                                    <span style={{ color: '#EF4444', fontWeight: 600, fontSize: 14, fontFamily: '"DM Mono", monospace' }}>−{fmt(discountAmount)} ₫</span>
                                </div>
                            )}

                            {!data.vatIncluded && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#8AAEBB', fontSize: 14 }}>Value Added Tax (VAT 10%)</span>
                                    <span style={{ color: '#E8F1F2', fontWeight: 500, fontSize: 14, fontFamily: '"DM Mono", monospace' }}>{fmt(vatAmount)} ₫</span>
                                </div>
                            )}

                            <div style={{ 
                                borderTop: '1px solid #2A4355', 
                                paddingTop: 16, 
                                marginTop: 10, 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <div>
                                    <span style={{ color: '#E8F1F2', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>GRAND TOTAL</span>
                                    <p style={{ color: '#4A6A7A', fontSize: 11, margin: '2px 0 0' }}>
                                        {data.vatIncluded ? 'VAT Included' : 'VAT Excluded'}
                                    </p>
                                </div>
                                <span style={{ 
                                    color: '#87CBB9', 
                                    fontSize: 28, 
                                    fontWeight: 700, 
                                    fontFamily: '"DM Mono", monospace',
                                    letterSpacing: '0.02em'
                                }}>
                                    {fmt(grandTotal)} <span style={{ fontSize: 14, fontWeight: 400, fontFamily: '"DM Mono", monospace' }}>₫</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Additional Commercial Terms & Notes */}
                {(data.terms || data.notes || data.deliveryTerms) && (
                    <div style={{ 
                        background: 'linear-gradient(180deg, #142433 0%, #0E1D2A 100%)', 
                        borderRadius: 2, 
                        border: '1px solid #2A4355', 
                        padding: '28px 32px', 
                        marginBottom: 32 
                    }}>
                        <h3 style={{ 
                            color: '#D4A853', 
                            fontSize: 14, 
                            fontWeight: 700, 
                            letterSpacing: '0.12em', 
                            textTransform: 'uppercase',
                            margin: '0 0 20px',
                            borderBottom: '1px solid rgba(42,67,85,0.5)',
                            paddingBottom: 10
                        }}>
                            COMMERCIAL TERMS & CONFIDENTIALITY
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                            {data.terms && (
                                <div>
                                    <h4 style={{ color: '#8AAEBB', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Contract & Payment Terms</h4>
                                    <p style={{ color: '#E8F1F2', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{data.terms}</p>
                                </div>
                            )}
                            {data.deliveryTerms && (
                                <div>
                                    <h4 style={{ color: '#8AAEBB', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Delivery & Warehousing</h4>
                                    <p style={{ color: '#E8F1F2', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{data.deliveryTerms}</p>
                                </div>
                            )}
                            {data.notes && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <h4 style={{ color: '#8AAEBB', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Special Notes</h4>
                                    <p style={{ color: '#E8F1F2', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{data.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Client interactivity control area */}
                {data.isActionable && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
                        <button
                            onClick={handleAccept}
                            disabled={accepting}
                            style={{ 
                                flex: 2, 
                                minWidth: 260, 
                                padding: '18px 36px', 
                                borderRadius: 2, 
                                background: 'linear-gradient(135deg, #5BA88A 0%, #3D7E65 100%)', 
                                color: 'white', 
                                border: '1px solid rgba(135,203,185,0.4)', 
                                fontSize: 16, 
                                fontWeight: 700, 
                                cursor: 'pointer', 
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                boxShadow: '0 8px 32px rgba(91,168,138,0.2)',
                                opacity: accepting ? 0.6 : 1,
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.boxShadow = '0 12px 40px rgba(91,168,138,0.35)'
                                e.currentTarget.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = '0 8px 32px rgba(91,168,138,0.2)'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }}
                        >
                            {accepting ? '⏳ Verifying...' : '✓ Approve & Sign Proposal'}
                        </button>
                        
                        {!showRejectForm ? (
                            <button
                                onClick={() => setShowRejectForm(true)}
                                style={{ 
                                    flex: 1,
                                    padding: '18px 36px', 
                                    borderRadius: 2, 
                                    background: 'transparent', 
                                    color: '#8B1A2E', 
                                    border: '1px solid #8B1A2E', 
                                    fontSize: 14, 
                                    fontWeight: 700, 
                                    cursor: 'pointer',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(139,26,46,0.05)'
                                    e.currentTarget.style.color = '#EF4444'
                                    e.currentTarget.style.borderColor = '#EF4444'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent'
                                    e.currentTarget.style.color = '#8B1A2E'
                                    e.currentTarget.style.borderColor = '#8B1A2E'
                                }}
                            >
                                Decline Proposal
                            </button>
                        ) : (
                            <div style={{ flex: 2, minWidth: 260, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    placeholder="Please state your reason for declining to help us improve..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    style={{ 
                                        flex: 1, 
                                        padding: '16px 20px', 
                                        borderRadius: 2, 
                                        background: '#1B2E3D', 
                                        border: '1px solid #8B1A2E', 
                                        color: '#E8F1F2', 
                                        fontSize: 14, 
                                        outline: 'none',
                                        transition: 'border-color 0.3s ease'
                                    }}
                                />
                                <button
                                    onClick={handleReject}
                                    disabled={rejecting || !rejectReason.trim()}
                                    style={{ 
                                        padding: '16px 28px', 
                                        borderRadius: 2, 
                                        background: '#8B1A2E', 
                                        color: 'white', 
                                        border: 'none', 
                                        fontWeight: 700, 
                                        fontSize: 14,
                                        cursor: 'pointer', 
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        opacity: (rejecting || !rejectReason.trim()) ? 0.5 : 1,
                                        transition: 'background-color 0.3s ease'
                                    }}
                                >
                                    Confirm Decline
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {data.isExpired && (
                    <div style={{ 
                        background: 'rgba(139,26,46,0.08)', 
                        border: '1.5px solid rgba(139,26,46,0.3)', 
                        borderRadius: 2, 
                        padding: '24px 32px', 
                        textAlign: 'center', 
                        marginBottom: 40,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                    }}>
                        <AlertTriangle size={28} style={{ color: '#EF4444', margin: '0 auto 12px' }} />
                        <h4 style={{ color: '#EF4444', fontSize: 16, fontWeight: 700, margin: '0 0 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>This Proposal has Expired</h4>
                        <p style={{ color: '#8AAEBB', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                            The validity period for this exclusive pricing has ended. Please contact your Wine Advisor <strong style={{ color: '#E8F1F2' }}>{data.salesRepName}</strong> or email our support desk to receive an updated proposal.
                        </p>
                    </div>
                )}
            </main>

            {/* Footer with legal disclosures */}
            <footer style={{ 
                borderTop: '1px solid #2A4355', 
                padding: '40px 24px', 
                textAlign: 'center',
                background: '#09141F',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                    <p style={{ color: '#8AAEBB', fontSize: 13, margin: 0, fontWeight: 500 }}>
                        © {new Date().getFullYear()} LY&apos;s Cellars — Fine Wine Specialist | Private Client Service
                    </p>
                    <p style={{ color: '#4A6A7A', fontSize: 11, maxWidth: 600, margin: 0, lineHeight: 1.5 }}>
                        This document contains confidential commercial information intended solely for the recipient. Any unauthorized copying, distribution, or pricing disclosure without prior written consent from LY&apos;s Cellars is strictly prohibited.
                    </p>
                </div>
            </footer>

            {/* Render the details modal if active */}
            {activeModalLine && (
                <div 
                    className="qtn-modal-overlay"
                    onClick={() => setActiveModalLine(null)}
                >
                    <div 
                        className="qtn-modal-container"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button at top right */}
                        <button 
                            onClick={() => setActiveModalLine(null)} 
                            style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#8AAEBB',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s ease',
                                zIndex: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8AAEBB'}
                        >
                            <XCircle size={24} />
                        </button>

                        {/* Left/Top Column: Big bottle visual with luxury gradients */}
                        <div className="qtn-modal-img-col">
                            {activeModalLine.imageUrl ? (
                                <img 
                                    src={activeModalLine.imageUrl} 
                                    alt={activeModalLine.productName} 
                                    style={{ 
                                        maxWidth: '100%', 
                                        maxHeight: '340px', 
                                        objectFit: 'contain',
                                        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.65))'
                                    }} 
                                />
                            ) : (
                                <Wine size={80} style={{ color: '#4A6A7A' }} />
                            )}
                        </div>

                        {/* Right/Bottom Column: Content portfolio & specs */}
                        <div className="qtn-modal-info-col">
                            <div>
                                {/* Appellation & Classification */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                    {activeModalLine.vintage ? (
                                        <span style={{ color: '#D4A853', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em' }}>
                                            {activeModalLine.vintage}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#4A6A7A', fontSize: 13, fontWeight: 500 }}>N/V</span>
                                    )}
                                    <span style={{ color: '#4A6A7A', fontSize: 11 }}>•</span>
                                    <span style={{ color: '#8AAEBB', fontSize: 13, fontWeight: 500 }}>
                                        {[activeModalLine.appellationName, activeModalLine.regionName !== activeModalLine.appellationName ? activeModalLine.regionName : null, activeModalLine.country].filter(Boolean).join(', ')}
                                    </span>
                                </div>

                                {/* Wine Title */}
                                <h3 style={{ 
                                    color: '#E8F1F2', 
                                    fontSize: 24, 
                                    fontWeight: 700, 
                                    fontFamily: '"Cormorant Garamond", Georgia, serif', 
                                    margin: '0 0 12px 0', 
                                    lineHeight: 1.2,
                                    borderBottom: '1px solid rgba(42, 67, 85, 0.4)',
                                    paddingBottom: '12px'
                                }}>
                                    {activeModalLine.productName}
                                </h3>

                                {/* Technical Specs Block */}
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(2, 1fr)', 
                                    gap: '8px 16px',
                                    marginBottom: 16,
                                    background: 'rgba(27, 46, 61, 0.3)',
                                    padding: '10px 14px',
                                    border: '1px solid rgba(42, 67, 85, 0.3)',
                                    borderRadius: '2px'
                                }}>
                                    <span style={{ color: '#4A6A7A', fontSize: 12 }}>
                                        SKU: <span style={{ color: '#8AAEBB', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{activeModalLine.skuCode}</span>
                                    </span>
                                    <span style={{ color: '#4A6A7A', fontSize: 12 }}>
                                        Type: <span style={{ color: '#8AAEBB' }}>{activeModalLine.wineType}</span>
                                    </span>
                                    <span style={{ color: '#4A6A7A', fontSize: 12 }}>
                                        Vol: <span style={{ color: '#8AAEBB' }}>{activeModalLine.volumeMl}ml</span>
                                    </span>
                                    <span style={{ color: '#4A6A7A', fontSize: 12 }}>
                                        ABV: <span style={{ color: '#8AAEBB' }}>{activeModalLine.abvPercent}%</span>
                                    </span>
                                </div>

                                {/* Tasting Notes Details */}
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <Quote size={12} style={{ color: '#D4A853', transform: 'rotate(180deg)' }} />
                                        <span style={{ 
                                            color: '#D4A853', 
                                            fontSize: 11, 
                                            fontWeight: 700, 
                                            letterSpacing: '0.1em', 
                                            textTransform: 'uppercase' 
                                        }}>
                                            Sommelier&apos;s Tasting Notes
                                        </span>
                                    </div>
                                    <p style={{ 
                                        color: '#E8F1F2', 
                                        fontSize: 14, 
                                        lineHeight: 1.6,
                                        margin: 0,
                                        fontStyle: 'italic',
                                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.02) 0%, rgba(135,203,185,0.01) 100%)',
                                        padding: '12px 16px',
                                        borderLeft: '2px solid #D4A853',
                                        borderRadius: '2px'
                                    }}>
                                        {activeModalLine.tastingNotes || "No tasting notes available for this specific vintage yet. Please ask our Wine Advisor for professional recommendation."}
                                    </p>
                                </div>

                                {/* Wine Awards */}
                                {activeModalLine.awards.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                                        {activeModalLine.awards.map((a, j) => (
                                            <span key={j} style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: 4, 
                                                background: 'rgba(212,168,83,0.08)', 
                                                color: '#D4A853', 
                                                border: '1px solid rgba(212,168,83,0.2)',
                                                padding: '3px 8px', 
                                                borderRadius: 2, 
                                                fontSize: 10, 
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.02em'
                                            }}>
                                                {a.medal ? <Award size={11} /> : <Star size={11} />}
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
                                borderTop: '1px solid rgba(42, 67, 85, 0.4)', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <div>
                                    <span style={{ color: '#4A6A7A', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Exclusive Proposal Price
                                    </span>
                                    {activeModalLine.discountPct > 0 && (
                                        <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
                                            ({activeModalLine.discountPct}% saving)
                                        </span>
                                    )}
                                </div>
                                <strong style={{ color: '#87CBB9', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                                    {fmt(activeModalLine.unitPrice * (1 - activeModalLine.discountPct / 100))} <span style={{ fontSize: 13, fontWeight: 400 }}>₫</span>
                                </strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
