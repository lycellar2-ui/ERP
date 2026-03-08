'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Building2, Package, DollarSign, FileText, Ship, MessageSquare, Clock, TrendingUp, Award, Globe, Phone, Mail, MapPin, ExternalLink, Shield, AlertTriangle } from 'lucide-react'
import {
    getSupplierDetail, getSupplierPOs, getSupplierAPInvoices, getSupplierContracts,
    getSupplierShipments, getSupplierProducts, getSupplierPricingHistory,
    getSupplierActivities, createSupplierActivity, getSupplierScorecard,
    type SupplierDetail, type SupplierPO, type SupplierAPInvoice, type SupplierContract,
    type SupplierShipment, type SupplierProduct, type PricingPoint, type SupplierScorecard,
} from './actions'
import { getSupplierRegDocs } from '../contracts/reg-doc-xmodule'
import { REG_DOC_TYPE_LABELS, REG_DOC_STATUS_LABELS } from '../contracts/reg-doc-constants'
import { formatVND } from '@/lib/utils'

const PO_STATUS_COLOR: Record<string, { color: string; bg: string }> = {
    DRAFT: { color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    CONFIRMED: { color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    SHIPPED: { color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    RECEIVED: { color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    CANCELLED: { color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
    A: { color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    B: { color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    C: { color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
    F: { color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

const ACTIVITY_ICONS: Record<string, string> = {
    NOTE: '📝', CALL: '📞', EMAIL: '✉️', VISIT: '🤝', PO_CREATED: '📦', CONTRACT_SIGNED: '📜',
}

type Tab = 'overview' | 'orders' | 'finance' | 'contracts' | 'shipments' | 'docs' | 'notes'

function InfoRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
    return (
        <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{label}</span>
            <span className="text-sm font-semibold" style={{ color: accent ?? '#E8F1F2' }}>{value}</span>
        </div>
    )
}

function MiniCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
    return (
        <div className="p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>{label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: accent, fontFamily: '"DM Mono", monospace' }}>{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const cfg = PO_STATUS_COLOR[status] ?? { color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ color: cfg.color, background: cfg.bg }}>{status}</span>
}

export function SupplierDetailDrawer({ open, supplierId, onClose }: {
    open: boolean; supplierId: string | null; onClose: () => void
}) {
    const [tab, setTab] = useState<Tab>('overview')
    const [detail, setDetail] = useState<SupplierDetail | null>(null)
    const [scorecard, setScorecard] = useState<SupplierScorecard | null>(null)
    const [loading, setLoading] = useState(false)
    const [pos, setPOs] = useState<SupplierPO[] | null>(null)
    const [invoices, setInvoices] = useState<SupplierAPInvoice[] | null>(null)
    const [contracts, setContracts] = useState<SupplierContract[] | null>(null)
    const [shipments, setShipments] = useState<SupplierShipment[] | null>(null)
    const [products, setProducts] = useState<SupplierProduct[] | null>(null)
    const [pricing, setPricing] = useState<PricingPoint[] | null>(null)
    const [activities, setActivities] = useState<any[] | null>(null)
    const [newNote, setNewNote] = useState('')
    const [noteType, setNoteType] = useState('NOTE')
    const [savingNote, setSavingNote] = useState(false)
    const [regDocs, setRegDocs] = useState<any[] | null>(null)

    useEffect(() => {
        if (!open || !supplierId) { setDetail(null); setTab('overview'); return }
        setLoading(true)
        setPOs(null); setInvoices(null); setContracts(null); setShipments(null); setProducts(null); setPricing(null); setActivities(null); setRegDocs(null)
        Promise.all([
            getSupplierDetail(supplierId),
            getSupplierScorecard(supplierId),
        ]).then(([d, sc]) => { setDetail(d); setScorecard(sc) }).finally(() => setLoading(false))
    }, [open, supplierId])

    const loadTab = async (t: Tab) => {
        setTab(t)
        if (!supplierId) return
        if (t === 'orders' && !pos) { setPOs(await getSupplierPOs(supplierId)); setProducts(await getSupplierProducts(supplierId)); setPricing(await getSupplierPricingHistory(supplierId)) }
        if (t === 'finance' && !invoices) setInvoices(await getSupplierAPInvoices(supplierId))
        if (t === 'contracts' && !contracts) setContracts(await getSupplierContracts(supplierId))
        if (t === 'shipments' && !shipments) setShipments(await getSupplierShipments(supplierId))
        if (t === 'docs' && !regDocs) setRegDocs(await getSupplierRegDocs(supplierId))
        if (t === 'notes' && !activities) setActivities(await getSupplierActivities(supplierId))
    }

    const handleAddNote = async () => {
        if (!supplierId || !newNote.trim()) return
        setSavingNote(true)
        await createSupplierActivity({ supplierId, type: noteType, description: newNote.trim() })
        setActivities(await getSupplierActivities(supplierId))
        setNewNote('')
        setSavingNote(false)
    }

    const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
    const fmtCurrency = (v: number, c?: string) => c === 'VND' ? formatVND(v) : `${c ?? 'USD'} ${v.toLocaleString('en-US', { minimumFractionDigits: 0 })}`

    const TABS: { key: Tab; label: string; icon: any }[] = [
        { key: 'overview', label: 'Tổng quan', icon: Building2 },
        { key: 'orders', label: 'Đơn Hàng', icon: Package },
        { key: 'finance', label: 'Tài Chính', icon: DollarSign },
        { key: 'contracts', label: 'Hợp Đồng', icon: FileText },
        { key: 'shipments', label: 'Lô Hàng', icon: Ship },
        { key: 'docs', label: 'Giấy Tờ', icon: Shield },
        { key: 'notes', label: 'Ghi Chú', icon: MessageSquare },
    ]

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(720px, 97vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Building2 size={20} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                                {detail?.supplier.name ?? 'Đang tải...'}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>
                                {detail?.supplier.code ?? ''}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 px-4 pt-3 pb-0 flex-shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => loadTab(t.key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-all whitespace-nowrap"
                            style={{
                                background: tab === t.key ? '#1B2E3D' : 'transparent',
                                color: tab === t.key ? '#87CBB9' : '#4A6A7A',
                                borderBottom: tab === t.key ? '2px solid #87CBB9' : '2px solid transparent',
                            }}>
                            <t.icon size={12} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                    ) : !detail ? (
                        <div className="text-center py-20 text-sm" style={{ color: '#4A6A7A' }}>Không tìm thấy NCC</div>
                    ) : (
                        <>
                            {/* ── OVERVIEW ── */}
                            {tab === 'overview' && (
                                <div className="space-y-5">
                                    {/* Scorecard badge */}
                                    {scorecard && (
                                        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
                                                style={{ background: GRADE_COLOR[scorecard.grade]?.bg, color: GRADE_COLOR[scorecard.grade]?.color }}>
                                                {scorecard.grade}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Supplier Scorecard</p>
                                                <div className="flex gap-4 mt-1">
                                                    <span className="text-xs" style={{ color: '#8AAEBB' }}>Điểm: <b style={{ color: '#E8F1F2' }}>{scorecard.overallScore}/100</b></span>
                                                    <span className="text-xs" style={{ color: '#8AAEBB' }}>Đúng hạn: <b style={{ color: '#5BA88A' }}>{scorecard.onTimeRate}%</b></span>
                                                    <span className="text-xs" style={{ color: '#8AAEBB' }}>Chất lượng: <b style={{ color: '#87CBB9' }}>{scorecard.qualityScore}/100</b></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary cards */}
                                    <div className="grid grid-cols-4 gap-3">
                                        <MiniCard label="Đơn PO" value={detail.poSummary.total} accent="#87CBB9" />
                                        <MiniCard label="Tổng PO" value={fmtCurrency(detail.poSummary.totalValue)} accent="#5BA88A" />
                                        <MiniCard label="Nợ phải trả" value={fmtCurrency(detail.apSummary.unpaidAmount)} accent={detail.apSummary.unpaidAmount > 0 ? '#D4A853' : '#5BA88A'} />
                                        <MiniCard label="Sản phẩm" value={detail.productCount} accent="#4A8FAB" />
                                    </div>

                                    {/* Info */}
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-0">
                                            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#87CBB9' }}>── Thương Mại</p>
                                            <InfoRow label="Loại" value={detail.supplier.type} />
                                            <InfoRow label="Quốc gia" value={detail.supplier.country} />
                                            <InfoRow label="Hiệp định" value={detail.supplier.tradeAgreement ?? 'MFN'} accent={detail.supplier.tradeAgreement ? '#5BA88A' : '#4A6A7A'} />
                                            <InfoRow label="C/O Form" value={detail.supplier.coFormType ?? '—'} />
                                            <InfoRow label="Incoterms" value={detail.supplier.incoterms ?? '—'} />
                                            <InfoRow label="Thanh toán" value={detail.supplier.paymentTerm ?? '—'} />
                                            <InfoRow label="Tiền tệ" value={detail.supplier.defaultCurrency} />
                                            <InfoRow label="Lead Time" value={`${detail.supplier.leadTimeDays} ngày`} />
                                            <InfoRow label="Mã thuế" value={detail.supplier.taxId ?? '—'} />
                                        </div>
                                        <div className="space-y-4">
                                            {/* Contacts */}
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#87CBB9' }}>── Liên Hệ</p>
                                                {detail.contacts.length > 0 ? detail.contacts.map(c => (
                                                    <div key={c.id} className="p-3 rounded-lg mb-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{c.name}</span>
                                                            {c.isPrimary && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ color: '#5BA88A', background: 'rgba(91,168,138,0.15)' }}>Chính</span>}
                                                        </div>
                                                        {c.title && <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{c.title}</p>}
                                                        {c.phone && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#8AAEBB' }}><Phone size={10} /> {c.phone}</p>}
                                                        {c.email && <p className="text-xs flex items-center gap-1" style={{ color: '#8AAEBB' }}><Mail size={10} /> {c.email}</p>}
                                                    </div>
                                                )) : <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có liên hệ</p>}
                                            </div>
                                            {/* Addresses */}
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#87CBB9' }}>── Địa Chỉ</p>
                                                {detail.addresses.length > 0 ? detail.addresses.map(a => (
                                                    <div key={a.id} className="p-3 rounded-lg mb-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                        <p className="text-xs font-bold" style={{ color: '#8AAEBB' }}>{a.label}</p>
                                                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#E8F1F2' }}><MapPin size={10} /> {a.address}</p>
                                                        {a.city && <p className="text-xs" style={{ color: '#4A6A7A' }}>{[a.city, a.region, a.country].filter(Boolean).join(', ')}</p>}
                                                    </div>
                                                )) : <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có địa chỉ</p>}
                                            </div>
                                            {detail.supplier.website && (
                                                <a href={detail.supplier.website} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs" style={{ color: '#4A8FAB' }}>
                                                    <ExternalLink size={11} /> {detail.supplier.website}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {detail.supplier.notes && (
                                        <div className="p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#4A6A7A' }}>Ghi chú</p>
                                            <p className="text-xs whitespace-pre-wrap" style={{ color: '#8AAEBB' }}>{detail.supplier.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ORDERS ── */}
                            {tab === 'orders' && (
                                <div className="space-y-5">
                                    {/* PO list */}
                                    <div>
                                        <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#87CBB9' }}>── Lịch Sử Đơn Hàng (PO)</p>
                                        {!pos ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                            pos.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có PO</p> : (
                                                <div className="space-y-2">
                                                    {pos.map(po => (
                                                        <div key={po.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                            <div>
                                                                <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{po.poNo}</span>
                                                                <span className="text-xs ml-3" style={{ color: '#4A6A7A' }}>{fmtDate(po.createdAt)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-semibold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                                    {fmtCurrency(po.totalValue, po.currency)}
                                                                </span>
                                                                <StatusBadge status={po.status} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                    </div>

                                    {/* Products */}
                                    {products && products.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#87CBB9' }}>── Danh Mục Sản Phẩm ({products.length})</p>
                                            <div className="space-y-1.5">
                                                {products.slice(0, 15).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#142433' }}>
                                                        <div>
                                                            <span className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{p.productName}</span>
                                                            <span className="text-[10px] ml-2" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{p.skuCode}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px]">
                                                            <span style={{ color: '#8AAEBB' }}>{p.totalQty.toLocaleString()} chai</span>
                                                            <span style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>~${p.avgUnitPrice}</span>
                                                            <span style={{ color: '#4A6A7A' }}>{p.orderCount} PO</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pricing trend */}
                                    {pricing && pricing.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#87CBB9' }}>
                                                <TrendingUp size={11} className="inline mr-1" /> Lịch Sử Giá
                                            </p>
                                            <div className="space-y-1">
                                                {pricing.slice(0, 20).map((p, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 rounded" style={{ background: i % 2 === 0 ? '#142433' : 'transparent' }}>
                                                        <span style={{ color: '#4A6A7A' }}>{fmtDate(p.date)}</span>
                                                        <span style={{ color: '#8AAEBB' }}>{p.productName.slice(0, 30)}</span>
                                                        <span style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{p.currency} {p.unitPrice}</span>
                                                        <span style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>×{p.qty}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── FINANCE ── */}
                            {tab === 'finance' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <MiniCard label="Tổng hoá đơn" value={detail.apSummary.totalInvoices} accent="#4A8FAB" />
                                        <MiniCard label="Tổng giá trị" value={fmtCurrency(detail.apSummary.totalAmount)} accent="#87CBB9" />
                                        <MiniCard label="Chưa thanh toán" value={fmtCurrency(detail.apSummary.unpaidAmount)} accent={detail.apSummary.unpaidAmount > 0 ? '#D4A853' : '#5BA88A'} />
                                    </div>
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Danh Sách AP Invoice</p>
                                    {!invoices ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                        invoices.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có hoá đơn</p> : (
                                            <div className="space-y-2">
                                                {invoices.map(inv => (
                                                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                        <div>
                                                            <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{inv.invoiceNo}</span>
                                                            <span className="text-xs ml-2" style={{ color: '#4A6A7A' }}>PO: {inv.poNo}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>Due: {fmtDate(inv.dueDate)}</span>
                                                            <span className="text-xs font-semibold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                                {fmtCurrency(inv.amount, inv.currency)}
                                                            </span>
                                                            <StatusBadge status={inv.status} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* ── CONTRACTS ── */}
                            {tab === 'contracts' && (
                                <div className="space-y-3">
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Hợp Đồng ({detail.contractCount})</p>
                                    {!contracts ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                        contracts.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có hợp đồng</p> : (
                                            contracts.map(c => (
                                                <div key={c.id} className="p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{c.contractNo}</span>
                                                        <StatusBadge status={c.status} />
                                                    </div>
                                                    <div className="flex gap-4 text-xs" style={{ color: '#8AAEBB' }}>
                                                        <span>Loại: <b>{c.type}</b></span>
                                                        <span>Giá trị: <b style={{ color: '#87CBB9' }}>{fmtCurrency(c.value, c.currency)}</b></span>
                                                        <span>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                </div>
                            )}

                            {/* ── SHIPMENTS ── */}
                            {tab === 'shipments' && (
                                <div className="space-y-3">
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Lô Hàng ({detail.shipmentCount})</p>
                                    {!shipments ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                        shipments.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có lô hàng</p> : (
                                            shipments.map(s => (
                                                <div key={s.id} className="p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div>
                                                            <span className="text-sm font-bold" style={{ color: '#E8F1F2' }}>🚢 {s.billOfLading}</span>
                                                            <span className="text-xs ml-2" style={{ color: '#4A6A7A' }}>PO: {s.poNo}</span>
                                                        </div>
                                                        <StatusBadge status={s.status} />
                                                    </div>
                                                    <div className="flex gap-4 text-xs" style={{ color: '#8AAEBB' }}>
                                                        {s.vesselName && <span>Tàu: {s.vesselName}</span>}
                                                        <span>ETA: {fmtDate(s.eta)}</span>
                                                        <span>CIF: <b style={{ color: '#87CBB9' }}>${s.cifAmount.toLocaleString()}</b></span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                </div>
                            )}

                            {/* ── REGULATED DOCS ── */}
                            {tab === 'docs' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Giấy Tờ Pháp Lý</p>
                                        <a href={`/dashboard/contracts`} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                            Quản lý →
                                        </a>
                                    </div>
                                    {!regDocs ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                        regDocs.length === 0 ? (
                                            <div className="text-center py-10">
                                                <Shield size={28} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có giấy tờ pháp lý nào gắn với NCC này</p>
                                                <p className="text-[10px] mt-1" style={{ color: '#4A6A7A' }}>Vào Trung tâm Pháp lý → Thêm Giấy Tờ → Phạm vi: Nhà cung cấp</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {regDocs.map((d: any) => {
                                                    const isExpired = d.status === 'EXPIRED' || d.status === 'REVOKED'
                                                    const isExpiring = d.daysRemaining !== null && d.daysRemaining <= 30 && d.daysRemaining > 0
                                                    const borderColor = isExpired ? '#E05252' : isExpiring ? '#D4A853' : '#2A4355'
                                                    const statusColor = isExpired ? '#E05252' : isExpiring ? '#D4A853' : d.status === 'ACTIVE' ? '#5BA88A' : '#4A6A7A'
                                                    return (
                                                        <div key={d.id} className="p-4 rounded-lg" style={{ background: '#142433', border: `1px solid ${borderColor}` }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    {(isExpired || isExpiring) && <AlertTriangle size={12} style={{ color: borderColor }} />}
                                                                    <span className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{d.name}</span>
                                                                </div>
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ color: statusColor, background: `${statusColor}18` }}>
                                                                    {REG_DOC_STATUS_LABELS[d.status] ?? d.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-4 text-xs" style={{ color: '#8AAEBB' }}>
                                                                <span>{REG_DOC_TYPE_LABELS[d.type] ?? d.type}</span>
                                                                <span style={{ fontFamily: '"DM Mono"', color: '#4A6A7A' }}>{d.docNo}</span>
                                                                {d.expiryDate && (
                                                                    <span style={{ color: statusColor, fontFamily: '"DM Mono"' }}>
                                                                        {d.daysRemaining !== null && d.daysRemaining <= 0
                                                                            ? `Quá hạn ${Math.abs(d.daysRemaining)}d`
                                                                            : d.daysRemaining !== null
                                                                                ? `Còn ${d.daysRemaining}d`
                                                                                : fmtDate(d.expiryDate)}
                                                                    </span>
                                                                )}
                                                                {d.issuingAuthority && <span style={{ color: '#4A6A7A' }}>{d.issuingAuthority}</span>}
                                                            </div>
                                                            {d.latestFile && (
                                                                <div className="mt-2">
                                                                    <a href={d.latestFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[10px] flex items-center gap-1" style={{ color: '#4A8FAB' }}>
                                                                        <ExternalLink size={10} /> {d.latestFile.name}
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* ── NOTES ── */}
                            {tab === 'notes' && (
                                <div className="space-y-4">
                                    {/* Add note form */}
                                    <div className="p-4 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <select value={noteType} onChange={e => setNoteType(e.target.value)}
                                                className="px-2 py-1.5 rounded-lg text-xs outline-none"
                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                                <option value="NOTE">📝 Ghi chú</option>
                                                <option value="CALL">📞 Cuộc gọi</option>
                                                <option value="EMAIL">✉️ Email</option>
                                                <option value="VISIT">🤝 Ghé thăm</option>
                                            </select>
                                        </div>
                                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', minHeight: 80 }}
                                            placeholder="Thêm ghi chú về NCC..." />
                                        <div className="flex justify-end mt-2">
                                            <button onClick={handleAddNote} disabled={!newNote.trim() || savingNote}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                                {savingNote ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                                                {savingNote ? 'Đang lưu...' : 'Thêm ghi chú'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Activity timeline */}
                                    {!activities ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /> :
                                        activities.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#4A6A7A' }}>Chưa có hoạt động</p> : (
                                            <div className="space-y-2">
                                                {activities.map((a: any) => (
                                                    <div key={a.id} className="flex gap-3 p-3 rounded-lg" style={{ background: '#142433' }}>
                                                        <span className="text-lg">{ACTIVITY_ICONS[a.type] ?? '📝'}</span>
                                                        <div className="flex-1">
                                                            <p className="text-xs" style={{ color: '#E8F1F2' }}>{a.description}</p>
                                                            <div className="flex gap-3 mt-1">
                                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{fmtDate(a.occurredAt)}</span>
                                                                {a.performedBy && <span className="text-[10px]" style={{ color: '#4A6A7A' }}>bởi {a.performedBy}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
