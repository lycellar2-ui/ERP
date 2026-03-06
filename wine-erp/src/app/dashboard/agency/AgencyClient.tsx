'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
    Globe, Package, FileText, CheckCircle2, Clock, Users, Plus, X, Loader2,
    AlertTriangle, ChevronRight, Ship, Eye, Check, XCircle, Send, UploadCloud
} from 'lucide-react'
import {
    AgencyPartnerRow, AgencySubmissionRow, AgencyDashboardStats, AgencyDocumentRow,
    getAgencyPartners, getAgencySubmissions, getAgencyDashboardStats,
    createAgencyPartner, createAgencySubmission, reviewAgencySubmission,
    getActiveShipments, uploadAgencyDocument, getSubmissionDocuments
} from './actions'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const card: React.CSSProperties = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px',
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    PENDING_REVIEW: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
    APPROVED: { label: 'Đã Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.12)' },
    REJECTED: { label: 'Từ Chối', color: '#E05252', bg: 'rgba(224,82,82,0.12)' },
}

const PARTNER_TYPE_MAP: Record<string, { label: string; color: string }> = {
    CUSTOMS_BROKER: { label: 'ĐL Hải Quan', color: '#D4A853' },
    FORWARDER: { label: 'Forwarding', color: '#4A8FAB' },
    SURVEYOR: { label: 'Giám Định', color: '#87CBB9' },
}

const SHIPMENT_MILESTONES = [
    { key: 'BOOKED', label: 'Đặt Chỗ', icon: '📦' },
    { key: 'ON_VESSEL', label: 'Trên Tàu', icon: '⛴️' },
    { key: 'ARRIVED_PORT', label: 'Đến Cảng', icon: '🏠' },
    { key: 'CUSTOMS_CLEARED', label: 'Thông Quan', icon: '✅' },
    { key: 'DELIVERED_TO_WAREHOUSE', label: 'Về Kho', icon: '🏭' },
] as const

const TABS = [
    { key: 'submissions', label: 'Submissions', icon: FileText },
    { key: 'partners', label: 'Đối Tác', icon: Users },
] as const

type TabKey = typeof TABS[number]['key']

export function AgencyClient() {
    const [tab, setTab] = useState<TabKey>('submissions')
    const [stats, setStats] = useState<AgencyDashboardStats | null>(null)

    // Submissions
    const [submissions, setSubmissions] = useState<AgencySubmissionRow[]>([])
    const [subsLoading, setSubsLoading] = useState(false)
    const [subsFilter, setSubsFilter] = useState('')

    // Partners
    const [partners, setPartners] = useState<AgencyPartnerRow[]>([])
    const [partnersLoading, setPartnersLoading] = useState(false)

    // Create partner drawer
    const [showCreatePartner, setShowCreatePartner] = useState(false)
    const [partnerForm, setPartnerForm] = useState({ code: '', name: '', type: 'CUSTOMS_BROKER' as const, email: '', password: '' })
    const [creatingPartner, setCreatingPartner] = useState(false)
    const [partnerError, setPartnerError] = useState('')

    // Create submission drawer
    const [showCreateSub, setShowCreateSub] = useState(false)
    const [shipments, setShipments] = useState<any[]>([])
    const [shipmentsLoading, setShipmentsLoading] = useState(false)
    const [subForm, setSubForm] = useState({ partnerId: '', shipmentId: '', declarationNo: '', eta: '', additionalCosts: '', notes: '' })
    const [creatingSub, setCreatingSub] = useState(false)
    const [subError, setSubError] = useState('')

    // Review
    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(null)

    // Document expansion
    const [expandedSubId, setExpandedSubId] = useState<string | null>(null)
    const [documents, setDocuments] = useState<AgencyDocumentRow[]>([])
    const [docsLoading, setDocsLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [selectedDocType, setSelectedDocType] = useState('OTHER')

    const loadStats = useCallback(async () => {
        const data = await getAgencyDashboardStats()
        setStats(data)
    }, [])

    const loadSubmissions = useCallback(async (status?: string) => {
        setSubsLoading(true)
        const data = await getAgencySubmissions({ status: status || undefined })
        setSubmissions(data)
        setSubsLoading(false)
    }, [])

    const loadPartners = useCallback(async () => {
        setPartnersLoading(true)
        const data = await getAgencyPartners()
        setPartners(data)
        setPartnersLoading(false)
    }, [])

    useEffect(() => {
        loadStats()
        loadSubmissions()
        loadPartners()
    }, [loadStats, loadSubmissions, loadPartners])

    // ── Create Partner ──────────────────────────
    const handleCreatePartner = async () => {
        if (!partnerForm.code || !partnerForm.name || !partnerForm.email) return
        setCreatingPartner(true)
        setPartnerError('')
        const result = await createAgencyPartner({
            ...partnerForm,
            type: partnerForm.type as any,
            passwordHash: partnerForm.password || 'temp_hash',
        })
        if (result.success) {
            setShowCreatePartner(false)
            setPartnerForm({ code: '', name: '', type: 'CUSTOMS_BROKER', email: '', password: '' })
            loadPartners()
            loadStats()
        } else {
            setPartnerError(result.error || 'Lỗi tạo đối tác')
        }
        setCreatingPartner(false)
    }

    // ── Create Submission ───────────────────────
    const openCreateSub = async () => {
        setShowCreateSub(true)
        setShipmentsLoading(true)
        setSubError('')
        const data = await getActiveShipments()
        setShipments(data)
        setShipmentsLoading(false)
    }

    const handleCreateSub = async () => {
        if (!subForm.partnerId || !subForm.shipmentId) return
        setCreatingSub(true)
        setSubError('')
        const result = await createAgencySubmission({
            partnerId: subForm.partnerId,
            shipmentId: subForm.shipmentId,
            declarationNo: subForm.declarationNo || undefined,
            eta: subForm.eta || undefined,
            additionalCosts: subForm.additionalCosts ? Number(subForm.additionalCosts) : undefined,
            notes: subForm.notes || undefined,
        })
        if (result.success) {
            setShowCreateSub(false)
            setSubForm({ partnerId: '', shipmentId: '', declarationNo: '', eta: '', additionalCosts: '', notes: '' })
            loadSubmissions()
            loadStats()
        } else {
            setSubError(result.error || 'Lỗi tạo submission')
        }
        setCreatingSub(false)
    }

    // ── Review Submission ───────────────────────
    const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
        setReviewingId(id)
        setReviewAction(decision)
        await reviewAgencySubmission(id, decision, 'system_admin')
        setReviewingId(null)
        setReviewAction(null)
        loadSubmissions(subsFilter)
        loadStats()
    }

    // ── Document Management ─────────────────────
    const toggleExpand = async (subId: string) => {
        if (expandedSubId === subId) { setExpandedSubId(null); return }
        setExpandedSubId(subId)
        setDocsLoading(true)
        const docs = await getSubmissionDocuments(subId)
        setDocuments(docs)
        setDocsLoading(false)
    }

    const handleUploadDoc = async (subId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadAgencyDocument(subId, formData, selectedDocType)
        if (res.success) {
            const docs = await getSubmissionDocuments(subId)
            setDocuments(docs)
            loadSubmissions(subsFilter)
        } else {
            toast.error(`Lỗi upload: ${res.error || ''}`)
        }
        setUploadingDoc(false)
        e.target.value = ''
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div>
                <h2 className="text-2xl font-bold"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                    Import Agency Portal (AGN)
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                    Cổng đối tác hải quan – Quản lý partners, submissions, review & confirm
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: Users, label: 'Đối Tác', value: stats?.totalPartners ?? 0, color: '#87CBB9' },
                    { icon: Clock, label: 'Chờ Duyệt', value: stats?.pendingSubmissions ?? 0, color: '#D4A853' },
                    { icon: CheckCircle2, label: 'Đã Duyệt Tháng Này', value: stats?.approvedThisMonth ?? 0, color: '#5BA88A' },
                    { icon: Ship, label: 'Lô Hàng Active', value: stats?.activeShipments ?? 0, color: '#4A8FAB' },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-4"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.color}` }}>
                            <Icon size={20} style={{ color: s.color }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#142433' }}>
                {TABS.map(t => {
                    const Icon = t.icon
                    const isActive = tab === t.key
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-all flex-1 justify-center"
                            style={{
                                background: isActive ? '#1B2E3D' : 'transparent',
                                color: isActive ? '#87CBB9' : '#4A6A7A',
                                border: isActive ? '1px solid #2A4355' : '1px solid transparent',
                            }}>
                            <Icon size={14} />
                            {t.label}
                            {t.key === 'submissions' && (stats?.pendingSubmissions ?? 0) > 0 && (
                                <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                                    style={{ background: '#D4A853', color: '#0A1926' }}>{stats?.pendingSubmissions}</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ═══ SUBMISSIONS TAB ═══ */}
            {tab === 'submissions' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <select value={subsFilter}
                                onChange={e => { setSubsFilter(e.target.value); loadSubmissions(e.target.value) }}
                                className="px-3 py-2 text-sm outline-none"
                                style={{ ...inputStyle, color: subsFilter ? '#E8F1F2' : '#4A6A7A' }}>
                                <option value="">Tất cả trạng thái</option>
                                {Object.entries(STATUS_MAP).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={openCreateSub}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={14} /> Tạo Submission
                        </button>
                    </div>

                    {/* Create Submission inline */}
                    {showCreateSub && (
                        <div className="p-5 rounded-md space-y-4" style={card}>
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Tạo Submission Mới</h4>
                                <button onClick={() => setShowCreateSub(false)} className="p-1 rounded" style={{ color: '#4A6A7A' }}><X size={16} /></button>
                            </div>

                            {shipmentsLoading ? (
                                <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                                            Đối tác <span style={{ color: '#8B1A2E' }}>*</span>
                                        </label>
                                        <select value={subForm.partnerId} onChange={e => setSubForm(f => ({ ...f, partnerId: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}>
                                            <option value="">— Chọn đối tác —</option>
                                            {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({PARTNER_TYPE_MAP[p.type]?.label})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>
                                            Lô hàng <span style={{ color: '#8B1A2E' }}>*</span>
                                        </label>
                                        <select value={subForm.shipmentId} onChange={e => setSubForm(f => ({ ...f, shipmentId: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}>
                                            <option value="">— Chọn lô hàng —</option>
                                            {shipments.map(s => (
                                                <option key={s.id} value={s.id}>{s.billOfLading} — {s.vesselName || 'N/A'}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Số Tờ Khai</label>
                                        <input type="text" value={subForm.declarationNo}
                                            onChange={e => setSubForm(f => ({ ...f, declarationNo: e.target.value }))}
                                            placeholder="VD: 305-2026-0123"
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>ETA</label>
                                        <input type="date" value={subForm.eta}
                                            onChange={e => setSubForm(f => ({ ...f, eta: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Chi phí phát sinh (VND)</label>
                                        <input type="number" value={subForm.additionalCosts}
                                            onChange={e => setSubForm(f => ({ ...f, additionalCosts: e.target.value }))}
                                            placeholder="VD: 5000000"
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Ghi chú</label>
                                        <input type="text" value={subForm.notes}
                                            onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="Ghi chú bổ sung..."
                                            className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                            onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                    </div>
                                </div>
                            )}

                            {subError && (
                                <p className="text-xs flex items-center gap-1" style={{ color: '#E05252' }}>
                                    <AlertTriangle size={12} /> {subError}
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowCreateSub(false)} className="px-3 py-1.5 text-xs rounded-md"
                                    style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                                <button onClick={handleCreateSub} disabled={creatingSub || !subForm.partnerId || !subForm.shipmentId}
                                    className="px-5 py-2 text-xs font-semibold rounded-md disabled:opacity-50"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                                    {creatingSub ? 'Đang tạo...' : 'Gửi Submission'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Submissions table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Đối Tác', 'Loại', 'B/L', 'Tờ Khai', 'Chứng Từ', 'Ngày Gửi', 'Trạng Thái', 'Hành Động'].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {subsLoading ? (
                                    <tr><td colSpan={8} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} /></td></tr>
                                ) : submissions.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                        <Globe size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                        <p>Chưa có submission nào</p>
                                    </td></tr>
                                ) : submissions.map(sub => {
                                    const st = STATUS_MAP[sub.status] ?? STATUS_MAP.PENDING_REVIEW
                                    const pt = PARTNER_TYPE_MAP[sub.partnerType] ?? { label: sub.partnerType, color: '#8AAEBB' }
                                    const isReviewing = reviewingId === sub.id
                                    const isExpanded = expandedSubId === sub.id

                                    return (
                                        <React.Fragment key={sub.id}>
                                            <tr
                                                className="cursor-pointer"
                                                style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                                onClick={() => toggleExpand(sub.id)}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td className="px-3 py-3 text-sm font-medium" style={{ color: '#E8F1F2' }}>{sub.partnerName}</td>
                                                <td className="px-3 py-3">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                                        style={{ color: pt.color, background: `${pt.color}18` }}>{pt.label}</span>
                                                </td>
                                                <td className="px-3 py-3 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                                    {sub.shipmentBol || '—'}
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>
                                                    {sub.declarationNo || '—'}
                                                </td>
                                                <td className="px-3 py-3 text-xs font-bold" style={{ color: sub.documentCount > 0 ? '#5BA88A' : '#4A6A7A' }}>
                                                    {sub.documentCount} file
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB' }}>
                                                    {formatDate(sub.submittedAt)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                        style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {sub.status === 'PENDING_REVIEW' && (
                                                        <div className="flex gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); handleReview(sub.id, 'APPROVED') }}
                                                                disabled={isReviewing}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded disabled:opacity-50"
                                                                style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.25)' }}>
                                                                {isReviewing && reviewAction === 'APPROVED'
                                                                    ? <Loader2 size={10} className="animate-spin" />
                                                                    : <Check size={10} />}
                                                                Duyệt
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleReview(sub.id, 'REJECTED') }}
                                                                disabled={isReviewing}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded disabled:opacity-50"
                                                                style={{ background: 'rgba(224,82,82,0.1)', color: '#E05252', border: '1px solid rgba(224,82,82,0.2)' }}>
                                                                {isReviewing && reviewAction === 'REJECTED'
                                                                    ? <Loader2 size={10} className="animate-spin" />
                                                                    : <XCircle size={10} />}
                                                                Từ chối
                                                            </button>
                                                        </div>
                                                    )}
                                                    {sub.status !== 'PENDING_REVIEW' && sub.reviewedAt && (
                                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                            {formatDate(sub.reviewedAt)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            {/* ── Document Expansion Row ── */}
                                            {isExpanded && (
                                                <tr style={{ background: '#142433' }}>
                                                    <td colSpan={8} className="px-6 py-4">
                                                        {docsLoading ? (
                                                            <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                                                                <Loader2 size={12} className="animate-spin" /> Đang tải chứng từ...
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {/* ── Tracking Milestones ── */}
                                                                {sub.shipmentStatus && (
                                                                    <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                                                        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#D4A853' }}>
                                                                            Tracking Lô Hàng {sub.vesselName && `— ${sub.vesselName}`}
                                                                            {sub.shipmentEta && <span style={{ color: '#4A6A7A' }}> · ETA: {formatDate(sub.shipmentEta)}</span>}
                                                                        </p>
                                                                        <div className="flex items-center gap-0">
                                                                            {SHIPMENT_MILESTONES.map((m, i) => {
                                                                                const currentIdx = SHIPMENT_MILESTONES.findIndex(ms => ms.key === sub.shipmentStatus)
                                                                                const isDone = i <= currentIdx
                                                                                const isCurrent = i === currentIdx
                                                                                return (
                                                                                    <React.Fragment key={m.key}>
                                                                                        <div className="flex flex-col items-center" style={{ minWidth: 70 }}>
                                                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 transition-all"
                                                                                                style={{
                                                                                                    background: isDone ? (isCurrent ? 'rgba(135,203,185,0.2)' : 'rgba(91,168,138,0.15)') : '#1B2E3D',
                                                                                                    border: `2px solid ${isDone ? (isCurrent ? '#87CBB9' : '#5BA88A') : '#2A4355'}`,
                                                                                                    boxShadow: isCurrent ? '0 0 12px rgba(135,203,185,0.3)' : 'none',
                                                                                                }}>
                                                                                                {m.icon}
                                                                                            </div>
                                                                                            <span className="text-[10px] font-semibold text-center leading-tight"
                                                                                                style={{ color: isDone ? (isCurrent ? '#87CBB9' : '#5BA88A') : '#4A6A7A' }}>
                                                                                                {m.label}
                                                                                            </span>
                                                                                        </div>
                                                                                        {i < SHIPMENT_MILESTONES.length - 1 && (
                                                                                            <div className="flex-1 h-0.5 -mt-4" style={{
                                                                                                background: i < currentIdx ? '#5BA88A' : '#2A4355',
                                                                                                minWidth: 16,
                                                                                            }} />
                                                                                        )}
                                                                                    </React.Fragment>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* ── Documents Section ── */}
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#87CBB9' }}>
                                                                        Chứng từ đính kèm ({documents.length})
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <select value={selectedDocType}
                                                                            onChange={e => setSelectedDocType(e.target.value)}
                                                                            onClick={e => e.stopPropagation()}
                                                                            className="px-2 py-1 text-xs outline-none rounded"
                                                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }}>
                                                                            <option value="CUSTOMS_DECLARATION">Tờ Khai HQ</option>
                                                                            <option value="LOGISTICS_INVOICE">Invoice Logistics</option>
                                                                            <option value="INSPECTION_CERT">Chứng Nhận GĐ</option>
                                                                            <option value="OTHER">Khác</option>
                                                                        </select>
                                                                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                                                                            style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}
                                                                            onClick={e => e.stopPropagation()}>
                                                                            {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                                            {uploadingDoc ? 'Đang tải...' : 'Upload File'}
                                                                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png,.xlsx"
                                                                                onChange={e => handleUploadDoc(sub.id, e)} disabled={uploadingDoc} />
                                                                        </label>
                                                                    </div>
                                                                </div>

                                                                {documents.length > 0 ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                        {documents.map(doc => (
                                                                            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noreferrer"
                                                                                onClick={e => e.stopPropagation()}
                                                                                className="flex items-center gap-3 p-3 rounded transition-colors"
                                                                                style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                                                                                onMouseEnter={e => e.currentTarget.style.background = '#2A4355'}
                                                                                onMouseLeave={e => e.currentTarget.style.background = '#1B2E3D'}>
                                                                                <FileText size={18} style={{ color: '#8AAEBB', flexShrink: 0 }} />
                                                                                <div className="overflow-hidden flex-1">
                                                                                    <p className="text-xs font-semibold" style={{ color: '#D4A853' }}>{doc.typeLabel}</p>
                                                                                    <p className="text-[10px] truncate" style={{ color: '#4A6A7A' }}>{formatDate(doc.uploadedAt)}</p>
                                                                                </div>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs italic" style={{ color: '#4A6A7A' }}>Chưa có chứng từ nào. Nhấn "Upload File" để thêm.</p>
                                                                )}

                                                                {sub.notes && (
                                                                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                                                                        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: '#4A6A7A' }}>Ghi chú</p>
                                                                        <p className="text-xs" style={{ color: '#8AAEBB' }}>{sub.notes}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══ PARTNERS TAB ═══ */}
            {tab === 'partners' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: '#8AAEBB' }}>
                            <Users size={14} className="inline mr-1.5" />
                            {partners.length} đối tác
                        </p>
                        <button onClick={() => { setShowCreatePartner(true); setPartnerError('') }}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={14} /> Thêm Đối Tác
                        </button>
                    </div>

                    {/* Create Partner inline */}
                    {showCreatePartner && (
                        <div className="p-5 rounded-md space-y-4" style={card}>
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Thêm Đối Tác Mới</h4>
                                <button onClick={() => setShowCreatePartner(false)} className="p-1" style={{ color: '#4A6A7A' }}><X size={16} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Mã <span style={{ color: '#8B1A2E' }}>*</span></label>
                                    <input type="text" value={partnerForm.code}
                                        onChange={e => setPartnerForm(f => ({ ...f, code: e.target.value }))}
                                        placeholder="VD: AGN-001" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                        onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Tên <span style={{ color: '#8B1A2E' }}>*</span></label>
                                    <input type="text" value={partnerForm.name}
                                        onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Tên đối tác" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                        onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Loại</label>
                                    <select value={partnerForm.type}
                                        onChange={e => setPartnerForm(f => ({ ...f, type: e.target.value as any }))}
                                        className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}>
                                        {Object.entries(PARTNER_TYPE_MAP).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: '#4A6A7A' }}>Email <span style={{ color: '#8B1A2E' }}>*</span></label>
                                    <input type="email" value={partnerForm.email}
                                        onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="email@partner.com" className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}
                                        onFocus={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#2A4355'} />
                                </div>
                            </div>
                            {partnerError && (
                                <p className="text-xs flex items-center gap-1" style={{ color: '#E05252' }}>
                                    <AlertTriangle size={12} /> {partnerError}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowCreatePartner(false)} className="px-3 py-1.5 text-xs rounded-md"
                                    style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Huỷ</button>
                                <button onClick={handleCreatePartner} disabled={creatingPartner}
                                    className="px-5 py-2 text-xs font-semibold rounded-md disabled:opacity-50"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                                    {creatingPartner ? 'Đang tạo...' : 'Thêm Đối Tác'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Partners grid */}
                    {partnersLoading ? (
                        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                    ) : partners.length === 0 ? (
                        <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                            <Users size={36} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có đối tác nào</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {partners.map(p => {
                                const pt = PARTNER_TYPE_MAP[p.type] ?? { label: p.type, color: '#8AAEBB' }
                                return (
                                    <div key={p.id} className="p-4 rounded-md" style={card}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{p.name}</p>
                                                <p className="text-xs" style={{ fontFamily: '"DM Mono"', color: '#4A6A7A' }}>{p.code}</p>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                                style={{ color: pt.color, background: `${pt.color}18` }}>{pt.label}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-xs" style={{ color: '#8AAEBB' }}>✉ {p.email}</p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                    {p.submissionCount} hồ sơ
                                                </span>
                                                {p.pendingCount > 0 && (
                                                    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>
                                                        {p.pendingCount} chờ duyệt
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                style={{
                                                    color: p.status === 'ACTIVE' ? '#5BA88A' : '#D4A853',
                                                    background: p.status === 'ACTIVE' ? 'rgba(91,168,138,0.12)' : 'rgba(212,168,83,0.12)',
                                                }}>
                                                {p.status === 'ACTIVE' ? 'Active' : p.status}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
