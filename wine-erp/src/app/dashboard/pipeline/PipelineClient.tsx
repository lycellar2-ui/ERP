'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Plus, Loader2, X, Target, TrendingUp, DollarSign, Percent,
    Trash2, MoveRight, Clock, Calendar, User, FileText, ChevronDown,
    Filter, Edit3, Save, XCircle, AlertTriangle, ArrowRight
} from 'lucide-react'
import {
    PipelineRow, OppStage, getOpportunities, createOpportunity,
    moveOpportunityStage, deleteOpportunity, getOpportunityDetail,
    updateOpportunity, OpportunityDetail
} from './actions'
import { getCustomersForSO, getSalesReps } from '../sales/actions'
import { formatVND } from '@/lib/utils'

const STAGES: { key: OppStage; label: string; color: string; bg: string; probability: number }[] = [
    { key: 'LEAD', label: 'Lead', color: '#8AAEBB', bg: 'rgba(138,174,187,0.08)', probability: 10 },
    { key: 'QUALIFIED', label: 'Qualified', color: '#D4A853', bg: 'rgba(212,168,83,0.08)', probability: 30 },
    { key: 'PROPOSAL', label: 'Proposal', color: '#87CBB9', bg: 'rgba(135,203,185,0.08)', probability: 50 },
    { key: 'NEGOTIATION', label: 'Negotiation', color: '#A78BFA', bg: 'rgba(167,139,250,0.08)', probability: 70 },
    { key: 'WON', label: 'Won ✓', color: '#5BA88A', bg: 'rgba(91,168,138,0.1)', probability: 100 },
    { key: 'LOST', label: 'Lost ✗', color: '#8B1A2E', bg: 'rgba(139,26,46,0.08)', probability: 0 },
]

interface Props {
    initialRows: PipelineRow[]
    stats: {
        byStage: Record<string, { count: number; value: number }>
        totalPipelineValue: number
        weightedValue: number
        conversionRate: number
        total: number
    }
}

export function PipelineClient({ initialRows, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Filters
    const [filterAssignee, setFilterAssignee] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // Create form
    const [customers, setCustomers] = useState<any[]>([])
    const [reps, setReps] = useState<any[]>([])
    const [formName, setFormName] = useState('')
    const [formCustomerId, setFormCustomerId] = useState('')
    const [formAssignee, setFormAssignee] = useState('')
    const [formValue, setFormValue] = useState('')
    const [formCloseDate, setFormCloseDate] = useState('')
    const [formNotes, setFormNotes] = useState('')

    // Detail drawer
    const [detail, setDetail] = useState<OpportunityDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editForm, setEditForm] = useState<{
        name: string; expectedValue: string; closeDate: string; notes: string; assignedTo: string
    }>({ name: '', expectedValue: '', closeDate: '', notes: '', assignedTo: '' })
    const [editSaving, setEditSaving] = useState(false)

    // Lost reason modal
    const [lostModal, setLostModal] = useState<{ id: string; name: string } | null>(null)
    const [lostReason, setLostReason] = useState('')

    const reload = useCallback(async () => {
        const data = await getOpportunities()
        setRows(data)
    }, [])

    const loadReps = async () => {
        if (reps.length === 0) {
            const r = await getSalesReps()
            setReps(r)
        }
    }

    const openCreate = async () => {
        if (customers.length === 0) {
            const [c, r] = await Promise.all([getCustomersForSO(), getSalesReps()])
            setCustomers(c)
            setReps(r)
        }
        setCreateOpen(true)
    }

    const handleCreate = async () => {
        if (!formName || !formCustomerId || !formAssignee || !formValue) return
        setSaving(true)
        await createOpportunity({
            name: formName,
            customerId: formCustomerId,
            expectedValue: Number(formValue),
            assignedTo: formAssignee,
            closeDate: formCloseDate || undefined,
            notes: formNotes || undefined,
        })
        setCreateOpen(false)
        setFormName(''); setFormCustomerId(''); setFormAssignee(''); setFormValue(''); setFormCloseDate(''); setFormNotes('')
        await reload()
        setSaving(false)
    }

    const handleMove = async (id: string, stage: OppStage) => {
        setActionLoading(id)
        await moveOpportunityStage(id, stage)
        await reload()
        setActionLoading(null)
        // Refresh detail if open
        if (detail?.id === id) openDetail(id)
    }

    const handleMarkLost = (id: string, name: string) => {
        setLostModal({ id, name })
        setLostReason('')
    }

    const confirmLost = async () => {
        if (!lostModal) return
        setActionLoading(lostModal.id)
        await moveOpportunityStage(lostModal.id, 'LOST', lostReason || undefined)
        setLostModal(null)
        setLostReason('')
        await reload()
        setActionLoading(null)
        if (detail?.id === lostModal.id) openDetail(lostModal.id)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa cơ hội này?')) return
        await deleteOpportunity(id)
        if (detail?.id === id) setDetail(null)
        await reload()
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        setEditing(false)
        await loadReps()
        const d = await getOpportunityDetail(id)
        setDetail(d)
        setDetailLoading(false)
    }

    const startEdit = () => {
        if (!detail) return
        setEditForm({
            name: detail.name,
            expectedValue: String(detail.expectedValue),
            closeDate: detail.closeDate ? new Date(detail.closeDate).toISOString().split('T')[0] : '',
            notes: detail.notes || '',
            assignedTo: detail.assigneeId,
        })
        setEditing(true)
    }

    const saveEdit = async () => {
        if (!detail) return
        setEditSaving(true)
        await updateOpportunity(detail.id, {
            name: editForm.name || undefined,
            expectedValue: editForm.expectedValue ? Number(editForm.expectedValue) : undefined,
            closeDate: editForm.closeDate || null,
            notes: editForm.notes || null,
            assignedTo: editForm.assignedTo || undefined,
        })
        await reload()
        await openDetail(detail.id)
        setEditing(false)
        setEditSaving(false)
    }

    const getNextStage = (current: OppStage): OppStage | null => {
        const order: OppStage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON']
        const idx = order.indexOf(current)
        if (idx === -1 || idx >= order.length - 1) return null
        return order[idx + 1]
    }

    const getStageConfig = (stage: OppStage) => STAGES.find(s => s.key === stage)

    // Unique assignees for filter
    const assignees = Array.from(new Set(rows.map(r => r.assigneeName))).sort()

    // Apply filters
    const filteredRows = rows.filter(r => {
        if (filterAssignee && r.assigneeName !== filterAssignee) return false
        return true
    })

    // Compute stage stats from filtered rows
    const filteredStats = {
        totalPipelineValue: filteredRows.filter(r => !['WON', 'LOST'].includes(r.stage)).reduce((s, r) => s + r.expectedValue, 0),
        weightedValue: filteredRows.filter(r => !['WON', 'LOST'].includes(r.stage)).reduce((s, r) => s + r.expectedValue * r.probability / 100, 0),
    }

    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }

    return (
        <div className="space-y-5 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Sales Pipeline
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Lead → Qualified → Proposal → Negotiation → Won
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-all"
                        style={{
                            background: showFilters || filterAssignee ? 'rgba(212,168,83,0.15)' : '#1B2E3D',
                            color: showFilters || filterAssignee ? '#D4A853' : '#8AAEBB',
                            border: `1px solid ${showFilters || filterAssignee ? 'rgba(212,168,83,0.3)' : '#2A4355'}`,
                            borderRadius: '6px',
                        }}>
                        <Filter size={14} />
                        {filterAssignee ? `${filterAssignee}` : 'Filter'}
                    </button>
                    <button onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
                        style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                        <Plus size={16} /> Thêm Cơ Hội
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {showFilters && (
                <div className="flex gap-3 items-center p-3 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Sales Rep:</span>
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                        className="px-3 py-1.5 text-xs outline-none" style={inputStyle}>
                        <option value="">Tất cả</option>
                        {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    {filterAssignee && (
                        <button onClick={() => setFilterAssignee('')}
                            className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(224,82,82,0.1)', color: '#E05252' }}>
                            Xóa filter
                        </button>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Pipeline Value', value: formatVND(filterAssignee ? filteredStats.totalPipelineValue : stats.totalPipelineValue), icon: DollarSign, color: '#87CBB9' },
                    { label: 'Weighted Value', value: formatVND(filterAssignee ? filteredStats.weightedValue : stats.weightedValue), icon: TrendingUp, color: '#D4A853' },
                    { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: Percent, color: '#5BA88A' },
                    { label: 'Tổng Cơ Hội', value: `${filterAssignee ? filteredRows.length : stats.total}`, icon: Target, color: '#8AAEBB' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md flex items-center gap-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="p-2 rounded-md" style={{ background: `${s.color}15` }}>
                            <s.icon size={18} style={{ color: s.color }} />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-lg font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2" style={{ minHeight: '450px' }}>
                {STAGES.map(stage => {
                    const stageRows = filteredRows.filter(r => r.stage === stage.key)
                    const stageValue = stageRows.reduce((s, r) => s + r.expectedValue, 0)
                    return (
                        <div key={stage.key} className="flex flex-col rounded-md overflow-hidden" style={{ background: stage.bg, border: '1px solid #2A4355' }}>
                            {/* Column header */}
                            <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: `2px solid ${stage.color}30` }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${stage.color}20`, color: stage.color }}>
                                    {stageRows.length}
                                </span>
                            </div>
                            <div className="px-2 py-1">
                                <p className="text-[10px] text-right" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                    {formatVND(stageValue)}
                                </p>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                                {stageRows.map(row => {
                                    const next = getNextStage(row.stage)
                                    return (
                                        <div key={row.id}
                                            className="p-2.5 rounded-md transition-all hover:shadow-lg cursor-pointer group"
                                            style={{ background: detail?.id === row.id ? 'rgba(135,203,185,0.12)' : '#1B2E3D', border: `1px solid ${detail?.id === row.id ? '#87CBB9' : '#2A4355'}` }}
                                            onClick={() => openDetail(row.id)}>
                                            <p className="text-xs font-semibold truncate" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#4A6A7A' }}>{row.customerName}</p>
                                            <p className="text-xs font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                {formatVND(row.expectedValue)}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{row.assigneeName}</span>
                                                <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                                                    {next && (
                                                        <button onClick={() => handleMove(row.id, next)} disabled={actionLoading === row.id}
                                                            className="p-1 rounded transition" title={`→ ${next}`}
                                                            style={{ background: `${stage.color}15` }}>
                                                            {actionLoading === row.id ? <Loader2 size={10} className="animate-spin" style={{ color: stage.color }} /> : <MoveRight size={10} style={{ color: stage.color }} />}
                                                        </button>
                                                    )}
                                                    {!['WON', 'LOST'].includes(row.stage) && (
                                                        <button onClick={() => handleMarkLost(row.id, row.name)} className="p-1 rounded transition"
                                                            style={{ background: 'rgba(139,26,46,0.1)' }} title="Lost">
                                                            <X size={10} style={{ color: '#8B1A2E' }} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDelete(row.id)} className="p-1 rounded transition"
                                                        style={{ background: 'rgba(74,106,122,0.1)' }} title="Xóa">
                                                        <Trash2 size={10} style={{ color: '#4A6A7A' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ═══ Detail Drawer ═══ */}
            {(detail || detailLoading) && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.5)' }} onClick={() => { setDetail(null); setEditing(false) }} />
                    <div className="fixed top-0 right-0 h-full z-50 w-full max-w-lg overflow-y-auto"
                        style={{ background: '#0D1E2B', borderLeft: '1px solid #2A4355', animation: 'slideInRight 0.2s ease-out' }}>
                        {detailLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                            </div>
                        ) : detail && (
                            <div className="p-6 space-y-5">
                                {/* Drawer Header */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        {editing ? (
                                            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                className="w-full text-lg font-bold px-2 py-1 outline-none" style={{ ...inputStyle, fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }} />
                                        ) : (
                                            <h3 className="text-lg font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                                                {detail.name}
                                            </h3>
                                        )}
                                        <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>{detail.customerName} · {detail.customerCode}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {!editing ? (
                                            <button onClick={startEdit} className="p-1.5 rounded transition" style={{ background: 'rgba(212,168,83,0.12)' }}>
                                                <Edit3 size={14} style={{ color: '#D4A853' }} />
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={saveEdit} disabled={editSaving} className="p-1.5 rounded transition" style={{ background: 'rgba(91,168,138,0.15)' }}>
                                                    {editSaving ? <Loader2 size={14} className="animate-spin" style={{ color: '#5BA88A' }} /> : <Save size={14} style={{ color: '#5BA88A' }} />}
                                                </button>
                                                <button onClick={() => setEditing(false)} className="p-1.5 rounded transition" style={{ background: 'rgba(224,82,82,0.1)' }}>
                                                    <XCircle size={14} style={{ color: '#E05252' }} />
                                                </button>
                                            </>
                                        )}
                                        <button onClick={() => { setDetail(null); setEditing(false) }} className="p-1.5" style={{ color: '#4A6A7A' }}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Stage Badge + Progress */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        {(() => {
                                            const cfg = getStageConfig(detail.stage)
                                            return cfg ? (
                                                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                                                    {cfg.label}
                                                </span>
                                            ) : null
                                        })()}
                                        {detail.previousStage && (
                                            <span className="text-[10px] flex items-center gap-1" style={{ color: '#4A6A7A' }}>
                                                <ArrowRight size={10} /> từ {detail.previousStage}
                                            </span>
                                        )}
                                    </div>
                                    {/* Stage progress bar */}
                                    <div className="flex gap-1">
                                        {['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].map(s => {
                                            const idx = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].indexOf(detail.stage)
                                            const sIdx = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].indexOf(s)
                                            const isCompleted = detail.stage === 'LOST' ? false : sIdx <= idx
                                            return (
                                                <div key={s} className="flex-1 h-1.5 rounded-full transition-all" style={{
                                                    background: isCompleted ? '#87CBB9' : '#2A4355',
                                                }} />
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* KPIs Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-md text-center" style={{ background: '#142433' }}>
                                        {editing ? (
                                            <input type="number" value={editForm.expectedValue} onChange={e => setEditForm(f => ({ ...f, expectedValue: e.target.value }))}
                                                className="w-full text-center text-sm font-bold outline-none" style={{ ...inputStyle, fontFamily: '"DM Mono"', color: '#D4A853' }} />
                                        ) : (
                                            <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                {formatVND(detail.expectedValue)}
                                            </p>
                                        )}
                                        <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>Giá Trị</p>
                                    </div>
                                    <div className="p-3 rounded-md text-center" style={{ background: '#142433' }}>
                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>{detail.probability}%</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>Xác suất</p>
                                    </div>
                                    <div className="p-3 rounded-md text-center" style={{ background: detail.daysInStage > 14 && !['WON', 'LOST'].includes(detail.stage) ? 'rgba(224,82,82,0.06)' : '#142433' }}>
                                        <p className="text-sm font-bold" style={{
                                            fontFamily: '"DM Mono"',
                                            color: detail.daysInStage > 14 && !['WON', 'LOST'].includes(detail.stage) ? '#E05252' : '#8AAEBB'
                                        }}>
                                            {detail.daysInStage}d
                                        </p>
                                        <p className="text-[10px] mt-0.5 flex items-center justify-center gap-1" style={{ color: '#4A6A7A' }}>
                                            {detail.daysInStage > 14 && !['WON', 'LOST'].includes(detail.stage) && <AlertTriangle size={9} style={{ color: '#E05252' }} />}
                                            Trong Stage
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-md text-center" style={{ background: '#142433' }}>
                                        <p className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#8AAEBB' }}>{detail.totalAge}d</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>Tổng Thời Gian</p>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid #2A4355' }}>
                                        <User size={13} style={{ color: '#4A6A7A' }} />
                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>Sales Rep</span>
                                        <span className="text-xs font-semibold ml-auto" style={{ color: '#E8F1F2' }}>
                                            {editing ? (
                                                <select value={editForm.assignedTo} onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))}
                                                    className="px-2 py-1 text-xs outline-none" style={inputStyle}>
                                                    {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            ) : detail.assigneeName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid #2A4355' }}>
                                        <Calendar size={13} style={{ color: '#4A6A7A' }} />
                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>Close Date</span>
                                        {editing ? (
                                            <input type="date" value={editForm.closeDate} onChange={e => setEditForm(f => ({ ...f, closeDate: e.target.value }))}
                                                className="ml-auto px-2 py-1 text-xs outline-none" style={inputStyle} />
                                        ) : (
                                            <span className="text-xs font-semibold ml-auto" style={{ color: '#E8F1F2' }}>
                                                {detail.closeDate ? new Date(detail.closeDate).toLocaleDateString('vi-VN') : '—'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid #2A4355' }}>
                                        <Clock size={13} style={{ color: '#4A6A7A' }} />
                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>Ngày tạo</span>
                                        <span className="text-xs ml-auto" style={{ color: '#8AAEBB' }}>
                                            {new Date(detail.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText size={13} style={{ color: '#4A6A7A' }} />
                                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Ghi Chú</span>
                                    </div>
                                    {editing ? (
                                        <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                            rows={3} className="w-full px-3 py-2 text-xs outline-none resize-none" style={inputStyle} />
                                    ) : (
                                        <p className="text-xs leading-relaxed p-3 rounded-md" style={{ background: '#142433', color: detail.notes ? '#8AAEBB' : '#4A6A7A' }}>
                                            {detail.notes || 'Chưa có ghi chú'}
                                        </p>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {!['WON', 'LOST'].includes(detail.stage) && (
                                    <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        {getNextStage(detail.stage) && (
                                            <button onClick={() => handleMove(detail.id, getNextStage(detail.stage)!)}
                                                disabled={actionLoading === detail.id}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-md transition-all"
                                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                                {actionLoading === detail.id ? <Loader2 size={13} className="animate-spin" /> : <MoveRight size={13} />}
                                                Chuyển → {getNextStage(detail.stage)}
                                            </button>
                                        )}
                                        <button onClick={() => handleMarkLost(detail.id, detail.name)}
                                            className="px-4 py-2.5 text-xs font-semibold rounded-md transition-all"
                                            style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>
                                            Lost
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ═══ Lost Reason Modal ═══ */}
            {lostModal && (
                <>
                    <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setLostModal(null)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm p-6 rounded-lg"
                        style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'rgba(139,26,46,0.15)' }}>
                                <XCircle size={16} style={{ color: '#8B1A2E' }} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Đánh dấu Lost</h3>
                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{lostModal.name}</p>
                            </div>
                        </div>
                        <textarea value={lostReason} onChange={e => setLostReason(e.target.value)}
                            rows={3} placeholder="Lý do lost? (VD: Giá cao hơn đối thủ, Khách cắt ngân sách...)"
                            className="w-full px-3 py-2 text-sm outline-none resize-none mb-3" style={inputStyle}
                            autoFocus />
                        <div className="flex gap-2">
                            <button onClick={() => setLostModal(null)} className="flex-1 py-2 text-xs font-semibold rounded-md"
                                style={{ background: '#2A4355', color: '#8AAEBB' }}>
                                Hủy
                            </button>
                            <button onClick={confirmLost} className="flex-1 py-2 text-xs font-semibold rounded-md"
                                style={{ background: '#8B1A2E', color: '#E8F1F2' }}>
                                Xác Nhận Lost
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ═══ Create Modal ═══ */}
            {createOpen && (
                <>
                    <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={() => setCreateOpen(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 rounded-lg"
                        style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Thêm Cơ Hội Mới</h3>
                            <button onClick={() => setCreateOpen(false)} className="p-1" style={{ color: '#4A6A7A' }}><X size={16} /></button>
                        </div>
                        <div className="space-y-3">
                            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Tên cơ hội (VD: Park Hyatt Wine Program)"
                                className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                            <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={inputStyle}>
                                <option value="">Chọn khách hàng...</option>
                                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <select value={formAssignee} onChange={e => setFormAssignee(e.target.value)}
                                    className="px-3 py-2 text-sm outline-none" style={inputStyle}>
                                    <option value="">Assigned To...</option>
                                    {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="Giá trị kỳ vọng"
                                    className="px-3 py-2 text-sm outline-none" style={{ ...inputStyle, color: '#D4A853', fontFamily: '"DM Mono"' }} />
                            </div>
                            <input type="date" value={formCloseDate} onChange={e => setFormCloseDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={inputStyle} />
                            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Ghi chú..."
                                className="w-full px-3 py-2 text-sm outline-none resize-none" style={inputStyle} />
                            <button onClick={handleCreate} disabled={saving || !formName || !formCustomerId || !formAssignee || !formValue}
                                className="w-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Tạo Cơ Hội (→ Lead)'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Animation keyframe */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
