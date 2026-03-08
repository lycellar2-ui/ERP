'use client'

import React, { useState, useCallback } from 'react'
import {
    FileText, Plus, X, Search, Send, CheckCircle2, XCircle, RotateCcw,
    Clock, AlertCircle, Loader2, MessageSquare, Paperclip, ChevronDown,
    Filter, Eye, ArrowRight, ClipboardCheck,
} from 'lucide-react'
import {
    createProposal, submitProposal, processProposalApproval, addProposalComment,
    getProposalDetail, updateProposalStatus,
} from './actions'
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './constants'
import { formatVND } from '@/lib/utils'

type Proposal = Awaited<ReturnType<typeof import('./actions').getProposals>>[number]
type ProposalDetail = NonNullable<Awaited<ReturnType<typeof import('./actions').getProposalDetail>>>

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2',
    fontSize: '14px', outline: 'none',
}

interface Props {
    initialProposals: Proposal[]
    stats: { total: number; pending: number; approved: number; rejected: number; draft: number }
    userId: string
    userName: string
    userRoles: string[]
}

export default function ProposalsClient({ initialProposals, stats, userId, userName, userRoles }: Props) {
    const [proposals, setProposals] = useState(initialProposals)
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DRAFT' | 'APPROVED' | 'REJECTED'>('ALL')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ProposalDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const isCEO = userRoles.includes('CEO')

    const filtered = proposals.filter(p => {
        if (filter === 'PENDING' && !['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)) return false
        if (filter === 'DRAFT' && p.status !== 'DRAFT') return false
        if (filter === 'APPROVED' && !['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(p.status)) return false
        if (filter === 'REJECTED' && p.status !== 'REJECTED') return false
        if (search) {
            const s = search.toLowerCase()
            return p.proposalNo.toLowerCase().includes(s) ||
                p.title.toLowerCase().includes(s) ||
                p.creatorName.toLowerCase().includes(s)
        }
        return true
    })

    const refreshList = useCallback(async () => {
        const { getProposals } = await import('./actions')
        const data = await getProposals()
        setProposals(data)
    }, [])

    const openDetail = useCallback(async (id: string) => {
        setDetailId(id)
        setLoading(true)
        const d = await getProposalDetail(id)
        setDetail(d)
        setLoading(false)
    }, [])

    const handleApproval = useCallback(async (proposalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => {
        setActionLoading(proposalId)
        const result = await processProposalApproval({
            proposalId,
            action,
            approverId: userId,
            comment,
        })
        if (result.success) {
            await refreshList()
            if (detailId === proposalId) await openDetail(proposalId)
        }
        setActionLoading(null)
    }, [userId, refreshList, detailId, openDetail])

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display), Georgia, serif', color: '#E8F1F2' }}>
                        Tờ Trình & Đề Xuất
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý tờ trình phê duyệt — Proposals & Submissions
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-md transition-all"
                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                >
                    <Plus size={16} /> Tạo Tờ Trình
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Tổng', value: stats.total, accent: '#8AAEBB' },
                    { label: 'Chờ Duyệt', value: stats.pending, accent: '#D4A853' },
                    { label: 'Bản Nháp', value: stats.draft, accent: '#4A6A7A' },
                    { label: 'Đã Duyệt', value: stats.approved, accent: '#5BA88A' },
                    { label: 'Từ Chối', value: stats.rejected, accent: '#8B1A2E' },
                ].map(s => (
                    <div key={s.label} className="rounded-md p-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.accent}` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter + Search Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    {(['ALL', 'PENDING', 'DRAFT', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="px-4 py-2 text-xs font-semibold transition-all"
                            style={{
                                background: filter === f ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                color: filter === f ? '#87CBB9' : '#4A6A7A',
                                borderRight: '1px solid #2A4355',
                            }}
                        >
                            {f === 'ALL' ? 'Tất cả' : f === 'PENDING' ? 'Chờ duyệt' : f === 'DRAFT' ? 'Nháp' : f === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                        </button>
                    ))}
                </div>
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm theo mã, tiêu đề, người trình..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Proposals Table */}
            <div className="rounded-md overflow-hidden" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#4A6A7A', borderBottom: '1px solid #2A4355' }}>
                    <div className="col-span-1">Mã</div>
                    <div className="col-span-3">Tiêu đề</div>
                    <div className="col-span-1">Loại</div>
                    <div className="col-span-1">Ưu tiên</div>
                    <div className="col-span-1 text-right">Giá trị</div>
                    <div className="col-span-1">Người trình</div>
                    <div className="col-span-1">Trạng thái</div>
                    <div className="col-span-1">Ngày trình</div>
                    <div className="col-span-2 text-right">Thao tác</div>
                </div>

                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2">
                        <FileText size={32} style={{ color: '#2A4355' }} />
                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tờ trình nào</p>
                    </div>
                ) : (
                    filtered.map(p => {
                        const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.DRAFT
                        const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                        const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                        const isCEOLevel = p.currentLevel === 3

                        return (
                            <div key={p.id}
                                className="grid grid-cols-12 gap-2 px-4 py-3 items-center transition-all"
                                style={{
                                    borderBottom: '1px solid #2A4355',
                                    background: isPending && isCEOLevel ? 'rgba(212,168,83,0.03)' : 'transparent',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = isPending && isCEOLevel ? 'rgba(212,168,83,0.03)' : 'transparent'}
                            >
                                <div className="col-span-1">
                                    <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>
                                        {p.proposalNo}
                                    </span>
                                </div>
                                <div className="col-span-3">
                                    <p className="text-sm font-medium truncate" style={{ color: '#E8F1F2' }}>{p.title}</p>
                                    {p.attachmentCount > 0 && (
                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                            <Paperclip size={10} className="inline mr-1" />{p.attachmentCount} file
                                        </span>
                                    )}
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                        {CATEGORY_LABELS[p.category]?.substring(0, 12) ?? p.category}
                                    </span>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                        style={{ background: prioCfg.bg, color: prioCfg.color }}>
                                        {prioCfg.label}
                                    </span>
                                </div>
                                <div className="col-span-1 text-right">
                                    <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#E8F1F2' }}>
                                        {p.estimatedAmount ? formatVND(p.estimatedAmount) : '—'}
                                    </span>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs" style={{ color: '#8AAEBB' }}>{p.creatorName}</span>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        {statusCfg.label}
                                    </span>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('vi-VN') : '—'}
                                    </span>
                                </div>
                                <div className="col-span-2 flex justify-end gap-2">
                                    <button onClick={() => openDetail(p.id)}
                                        className="px-2.5 py-1.5 text-xs font-medium rounded transition-all"
                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                        <Eye size={12} className="inline mr-1" />Chi tiết
                                    </button>
                                    {isPending && isCEOLevel && isCEO && (
                                        <>
                                            <button
                                                onClick={() => handleApproval(p.id, 'APPROVE')}
                                                disabled={actionLoading === p.id}
                                                className="px-2.5 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                Duyệt
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const reason = prompt('Lý do từ chối:')
                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                }}
                                                className="px-2.5 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                                <XCircle size={12} className="inline mr-1" />Từ chối
                                            </button>
                                        </>
                                    )}
                                    {p.status === 'DRAFT' && p.creatorName && (
                                        <button
                                            onClick={async () => {
                                                setActionLoading(p.id)
                                                await submitProposal(p.id, userId)
                                                await refreshList()
                                                setActionLoading(null)
                                            }}
                                            disabled={actionLoading === p.id}
                                            className="px-2.5 py-1.5 text-xs font-semibold rounded transition-all"
                                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}>
                                            {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} className="inline mr-1" />}
                                            Trình
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Create Proposal Drawer */}
            {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} userId={userId} onCreated={async () => { await refreshList(); setShowCreate(false) }} />}

            {/* Detail Drawer */}
            {detailId && (
                <DetailDrawer
                    detail={detail}
                    loading={loading}
                    onClose={() => { setDetailId(null); setDetail(null) }}
                    userId={userId}
                    isCEO={isCEO}
                    onApproval={async (action, comment) => { await handleApproval(detailId, action, comment); }}
                    onRefresh={async () => { await refreshList(); await openDetail(detailId) }}
                />
            )}
        </div>
    )
}

// ─── Create Drawer ───────────────────────────────
function CreateDrawer({ onClose, userId, onCreated }: {
    onClose: () => void
    userId: string
    onCreated: () => void
}) {
    const [form, setForm] = useState({
        category: 'BUDGET_REQUEST',
        priority: 'NORMAL',
        title: '',
        content: '',
        justification: '',
        expectedOutcome: '',
        estimatedAmount: '',
        deadline: '',
    })
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!form.title || !form.content) return alert('Vui lòng nhập tiêu đề và nội dung')
        setSaving(true)
        const result = await createProposal({
            ...form,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            createdBy: userId,
        })
        if (result.success) onCreated()
        else alert(result.error)
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-xl h-full overflow-y-auto" style={{ background: '#142433', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                        <FileText size={18} className="inline mr-2" style={{ color: '#87CBB9' }} />
                        Tạo Tờ Trình Mới
                    </h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Category */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Loại tờ trình *</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Mức ưu tiên</label>
                        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Tiêu đề *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="VD: Đề xuất nhập NCC mới — Château Latour"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Nội dung chi tiết *</label>
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            rows={5} placeholder="Mô tả chi tiết đề xuất..."
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Justification */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Lý do & phân tích</label>
                        <textarea value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                            rows={3} placeholder="Căn cứ và phân tích chi phí/lợi ích..."
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Expected Outcome */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Kết quả kỳ vọng</label>
                        <input value={form.expectedOutcome} onChange={e => setForm(f => ({ ...f, expectedOutcome: e.target.value }))}
                            placeholder="VD: Mở rộng danh mục 15 SKU mới, tăng doanh thu 20%"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Amount + Deadline row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Giá trị ước tính (VND)</label>
                            <input type="number" value={form.estimatedAmount}
                                onChange={e => setForm(f => ({ ...f, estimatedAmount: e.target.value }))}
                                placeholder="0" style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                onBlur={e => e.target.style.borderColor = '#2A4355'} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Hạn xử lý</label>
                            <input type="date" value={form.deadline}
                                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                onBlur={e => e.target.style.borderColor = '#2A4355'} />
                        </div>
                    </div>

                    {/* Submit buttons */}
                    <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #2A4355' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                            Lưu Bản Nháp
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-3 text-sm font-medium rounded-md"
                            style={{ background: '#1B2E3D', color: '#4A6A7A', border: '1px solid #2A4355' }}
                        >
                            Huỷ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Detail Drawer ───────────────────────────────
function DetailDrawer({ detail, loading, onClose, userId, isCEO, onApproval, onRefresh }: {
    detail: ProposalDetail | null
    loading: boolean
    onClose: () => void
    userId: string
    isCEO: boolean
    onApproval: (action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => void
    onRefresh: () => void
}) {
    const [comment, setComment] = useState('')
    const [sendingComment, setSendingComment] = useState(false)

    const handleComment = async () => {
        if (!comment.trim() || !detail) return
        setSendingComment(true)
        await addProposalComment({
            proposalId: detail.id,
            authorId: userId,
            content: comment,
        })
        setComment('')
        setSendingComment(false)
        onRefresh()
    }

    const isPending = detail && ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(detail.status)
    const isCEOLevel = detail?.currentLevel === 3

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-2xl h-full overflow-y-auto" style={{ background: '#142433', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                        <ClipboardCheck size={18} className="inline mr-2" style={{ color: '#87CBB9' }} />
                        Chi Tiết Tờ Trình
                    </h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                {loading || !detail ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Title + Meta */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: '#87CBB9' }}>
                                    {detail.proposalNo}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{ ...PRIORITY_LABELS[detail.priority] ? { background: PRIORITY_LABELS[detail.priority].bg, color: PRIORITY_LABELS[detail.priority].color } : {} }}>
                                    {PRIORITY_LABELS[detail.priority]?.label}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: STATUS_LABELS[detail.status]?.bg, color: STATUS_LABELS[detail.status]?.color }}>
                                    {STATUS_LABELS[detail.status]?.label}
                                </span>
                            </div>
                            <h4 className="text-xl font-bold mb-1" style={{ color: '#E8F1F2' }}>{detail.title}</h4>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {detail.creator.name} · {CATEGORY_LABELS[detail.category]} ·
                                {detail.estimatedAmount ? ` ${formatVND(detail.estimatedAmount)}` : ' Không có giá trị'} ·
                                {detail.submittedAt ? ` Trình ${new Date(detail.submittedAt).toLocaleDateString('vi-VN')}` : ' Chưa trình'}
                            </p>
                        </div>

                        {/* Approval Progress */}
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>Tiến Trình Phê Duyệt</p>
                            <div className="flex items-center gap-2">
                                {detail.requiredLevels.map((level, i) => {
                                    const log = detail.approvalLogs.find(l => l.level === level)
                                    const isCurrent = detail.currentLevel === level && isPending
                                    const isDone = log?.action === 'APPROVE'
                                    const isRejected = log?.action === 'REJECT'
                                    const levelLabel = level === 1 ? 'TP Bộ phận' : level === 2 ? 'KT Trưởng' : 'CEO'

                                    return (
                                        <React.Fragment key={level}>
                                            {i > 0 && <div className="flex-1 h-0.5 rounded" style={{ background: isDone ? '#5BA88A' : '#2A4355' }} />}
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                                    style={{
                                                        background: isDone ? 'rgba(91,168,138,0.2)' : isRejected ? 'rgba(139,26,46,0.2)' : isCurrent ? 'rgba(212,168,83,0.2)' : '#1B2E3D',
                                                        border: `2px solid ${isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#2A4355'}`,
                                                        color: isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#4A6A7A',
                                                    }}>
                                                    {isDone ? '✓' : isRejected ? '✗' : level}
                                                </div>
                                                <span className="text-xs font-medium" style={{ color: isCurrent ? '#D4A853' : '#4A6A7A' }}>
                                                    {levelLabel}
                                                </span>
                                                {log && (
                                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                        {log.approver.name}
                                                    </span>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Content sections */}
                        <div className="space-y-3">
                            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#87CBB9' }}>Nội dung</p>
                                <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F1F2', lineHeight: 1.6 }}>{detail.content}</p>
                            </div>
                            {detail.justification && (
                                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#D4A853' }}>Lý do & Phân tích</p>
                                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F1F2', lineHeight: 1.6 }}>{detail.justification}</p>
                                </div>
                            )}
                            {detail.expectedOutcome && (
                                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#5BA88A' }}>Kết quả kỳ vọng</p>
                                    <p className="text-sm" style={{ color: '#E8F1F2' }}>{detail.expectedOutcome}</p>
                                </div>
                            )}
                        </div>

                        {/* Approval Logs */}
                        {detail.approvalLogs.length > 0 && (
                            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>Lịch Sử Phê Duyệt</p>
                                <div className="space-y-2">
                                    {detail.approvalLogs.map(log => (
                                        <div key={log.id} className="flex items-start gap-3 p-2 rounded" style={{ background: '#142433' }}>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{
                                                    background: log.action === 'APPROVE' ? 'rgba(91,168,138,0.2)' : 'rgba(139,26,46,0.2)',
                                                    color: log.action === 'APPROVE' ? '#5BA88A' : '#8B1A2E',
                                                }}>
                                                {log.action === 'APPROVE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs">
                                                    <span className="font-semibold" style={{ color: '#E8F1F2' }}>{log.approver.name}</span>
                                                    <span style={{ color: log.action === 'APPROVE' ? '#5BA88A' : '#8B1A2E' }}> đã {log.action === 'APPROVE' ? 'duyệt' : 'từ chối'}</span>
                                                    <span style={{ color: '#4A6A7A' }}> · Cấp {log.level === 1 ? 'TP' : log.level === 2 ? 'KT' : 'CEO'}</span>
                                                </p>
                                                {log.comment && <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>"{log.comment}"</p>}
                                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comments */}
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>
                                <MessageSquare size={12} className="inline mr-1" />
                                Thảo Luận ({detail.comments.length})
                            </p>
                            <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                                {detail.comments.map(c => (
                                    <div key={c.id} className="p-2.5 rounded" style={{ background: '#142433' }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold" style={{ color: '#87CBB9' }}>{c.author.name}</span>
                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <p className="text-sm" style={{ color: '#E8F1F2' }}>{c.content}</p>
                                    </div>
                                ))}
                                {detail.comments.length === 0 && (
                                    <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Chưa có thảo luận</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder="Nhập bình luận..."
                                    className="flex-1 px-3 py-2 text-sm rounded-md"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', outline: 'none' }}
                                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                                    onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                    onBlur={e => e.target.style.borderColor = '#2A4355'} />
                                <button onClick={handleComment} disabled={sendingComment}
                                    className="px-3 py-2 rounded-md transition-all"
                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                    {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* CEO Action Bar */}
                        {isPending && isCEOLevel && isCEO && (
                            <div className="flex gap-3 p-4 rounded-md" style={{ background: 'rgba(212,168,83,0.05)', border: '2px solid rgba(212,168,83,0.2)' }}>
                                <button
                                    onClick={() => onApproval('APPROVE')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-md transition-all"
                                    style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)' }}>
                                    <CheckCircle2 size={16} /> Duyệt Tờ Trình
                                </button>
                                <button
                                    onClick={() => {
                                        const reason = prompt('Ghi chú khi trả lại:')
                                        if (reason) onApproval('RETURN', reason)
                                    }}
                                    className="px-5 py-3 text-sm font-medium rounded-md transition-all"
                                    style={{ background: 'rgba(196,90,42,0.1)', color: '#C45A2A', border: '1px solid rgba(196,90,42,0.2)' }}>
                                    <RotateCcw size={14} className="inline mr-1" /> Trả Lại
                                </button>
                                <button
                                    onClick={() => {
                                        const reason = prompt('Lý do từ chối:')
                                        if (reason) onApproval('REJECT', reason)
                                    }}
                                    className="px-5 py-3 text-sm font-medium rounded-md transition-all"
                                    style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                    <XCircle size={14} className="inline mr-1" /> Từ Chối
                                </button>
                            </div>
                        )}

                        {/* Post-approval actions */}
                        {detail.status === 'APPROVED' && isCEO && (
                            <div className="flex gap-3">
                                <button onClick={async () => { await updateProposalStatus(detail.id, 'IN_PROGRESS', userId); onRefresh() }}
                                    className="flex-1 py-2.5 text-sm font-semibold rounded-md"
                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                    <ArrowRight size={14} className="inline mr-1" /> Chuyển "Đang thực hiện"
                                </button>
                            </div>
                        )}
                        {detail.status === 'IN_PROGRESS' && isCEO && (
                            <button onClick={async () => { await updateProposalStatus(detail.id, 'CLOSED', userId); onRefresh() }}
                                className="w-full py-2.5 text-sm font-semibold rounded-md"
                                style={{ background: 'rgba(74,106,122,0.15)', color: '#4A6A7A', border: '1px solid rgba(74,106,122,0.3)' }}>
                                <CheckCircle2 size={14} className="inline mr-1" /> Đánh dấu Hoàn tất
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
