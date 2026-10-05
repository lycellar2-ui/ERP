'use client'

import { useState, useCallback } from 'react'
import {
    Plus, Target, TrendingUp, DollarSign, Percent,
    Trash2, MoveRight, Clock, Calendar, User, FileText,
    Filter, Edit3, Save, XCircle, AlertTriangle, ArrowRight
} from 'lucide-react'
import {
    PipelineRow, OppStage, getOpportunities, createOpportunity,
    moveOpportunityStage, deleteOpportunity, getOpportunityDetail,
    updateOpportunity, OpportunityDetail
} from './actions'
import { getCustomersForSO, getSalesReps } from '../sales/actions'
import { formatVND, cn } from '@/lib/utils'
import {
    Button, PageHeader, StatCard, StatGrid, Drawer, Modal,
    Field, Input, Select, Textarea, Toolbar, useConfirmDialog
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'

const STAGES: { key: OppStage; label: string; tone: Tone; color: string; border: string; bg: string; probability: number }[] = [
    { key: 'LEAD', label: 'Lead', tone: 'neutral', color: '#475569', border: '#CBD5E1', bg: 'bg-slate-50', probability: 10 },
    { key: 'QUALIFIED', label: 'Qualified', tone: 'warning', color: '#B45309', border: '#FDE68A', bg: 'bg-amber-50/50', probability: 30 },
    { key: 'PROPOSAL', label: 'Proposal', tone: 'info', color: '#0891B2', border: '#A5F3FC', bg: 'bg-cyan-50/50', probability: 50 },
    { key: 'NEGOTIATION', label: 'Negotiation', tone: 'warning', color: '#D97706', border: '#FED7AA', bg: 'bg-orange-50/50', probability: 70 },
    { key: 'WON', label: 'Won ✓', tone: 'success', color: '#15803D', border: '#BBF7D0', bg: 'bg-emerald-50/50', probability: 100 },
    { key: 'LOST', label: 'Lost ✗', tone: 'danger', color: '#B91C1C', border: '#FECACA', bg: 'bg-red-50/40', probability: 0 },
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
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
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

    const handleDelete = (id: string) => {
        confirm({
            title: 'Xóa Cơ Hội Kinh Doanh',
            message: 'Bạn có chắc chắn muốn xóa cơ hội kinh doanh này không?',
            confirmLabel: 'Xóa Cơ Hội',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                await deleteOpportunity(id)
                if (detail?.id === id) setDetail(null)
                await reload()
            }
        })
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

    const assignees = Array.from(new Set(rows.map(r => r.assigneeName))).sort()

    const filteredRows = rows.filter(r => {
        if (filterAssignee && r.assigneeName !== filterAssignee) return false
        return true
    })

    const filteredStats = {
        totalPipelineValue: filteredRows.filter(r => !['WON', 'LOST'].includes(r.stage)).reduce((s, r) => s + r.expectedValue, 0),
        weightedValue: filteredRows.filter(r => !['WON', 'LOST'].includes(r.stage)).reduce((s, r) => s + r.expectedValue * r.probability / 100, 0),
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                description="Lead → Qualified → Proposal → Negotiation → Won"
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setShowFilters(!showFilters)}
                            className={showFilters || filterAssignee ? 'border-lys-teal text-lys-teal-strong bg-lys-teal-soft' : undefined}
                        >
                            <Filter size={14} aria-hidden />
                            {filterAssignee ? filterAssignee : 'Lọc Sales Rep'}
                        </Button>
                        <Button onClick={openCreate}>
                            <Plus size={16} aria-hidden /> Thêm Cơ Hội
                        </Button>
                    </div>
                }
            />

            {/* Filter Bar */}
            {showFilters && (
                <Toolbar
                    left={
                        <div className="flex items-center gap-2">
                            <span className="type-caption font-semibold text-lys-secondary">Sales Rep:</span>
                            <Select
                                value={filterAssignee}
                                onChange={e => setFilterAssignee(e.target.value)}
                                className="w-48"
                            >
                                <option value="">Tất cả</option>
                                {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                            </Select>
                            {filterAssignee && (
                                <Button size="sm" variant="ghost" onClick={() => setFilterAssignee('')}>
                                    Xóa lọc
                                </Button>
                            )}
                        </div>
                    }
                />
            )}

            {/* Stats */}
            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={DollarSign}
                    tone="brand"
                    label="Pipeline Value"
                    value={formatVND(filterAssignee ? filteredStats.totalPipelineValue : stats.totalPipelineValue)}
                />
                <StatCard
                    icon={TrendingUp}
                    tone="warning"
                    label="Weighted Value"
                    value={formatVND(filterAssignee ? filteredStats.weightedValue : stats.weightedValue)}
                />
                <StatCard
                    icon={Percent}
                    tone="success"
                    label="Conversion Rate"
                    value={`${stats.conversionRate}%`}
                />
                <StatCard
                    icon={Target}
                    tone="info"
                    label="Tổng Cơ Hội"
                    value={filterAssignee ? filteredRows.length : stats.total}
                />
            </StatGrid>

            {/* Kanban Board */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 min-h-[480px]">
                {STAGES.map(stage => {
                    const stageRows = filteredRows.filter(r => r.stage === stage.key)
                    const stageValue = stageRows.reduce((s, r) => s + r.expectedValue, 0)
                    return (
                        <div
                            key={stage.key}
                            className={cn('flex flex-col rounded-lg border border-lys-border overflow-hidden shadow-2xs', stage.bg)}
                        >
                            {/* Column header */}
                            <div
                                className="px-3 py-2.5 flex items-center justify-between bg-white/80 border-b"
                                style={{ borderBottomColor: stage.border }}
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                                    <span className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: stage.color }}>
                                        {stage.label}
                                    </span>
                                </div>
                                <span
                                    className="type-number text-[11px] font-bold px-1.5 py-0.2 rounded shrink-0"
                                    style={{ background: `${stage.color}15`, color: stage.color }}
                                >
                                    {stageRows.length}
                                </span>
                            </div>
                            <div className="px-3 py-1 bg-white/40 border-b border-lys-border">
                                <p className="type-caption type-number text-right text-lys-muted font-medium">
                                    {formatVND(stageValue)}
                                </p>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {stageRows.map(row => {
                                    const next = getNextStage(row.stage)
                                    const isSelected = detail?.id === row.id
                                    return (
                                        <div
                                            key={row.id}
                                            onClick={() => openDetail(row.id)}
                                            className={cn(
                                                'p-2.5 rounded-md border transition-all cursor-pointer bg-white shadow-2xs',
                                                isSelected
                                                    ? 'border-lys-teal ring-1 ring-lys-teal shadow-xs'
                                                    : 'border-lys-border hover:border-lys-teal hover:shadow-xs'
                                            )}
                                        >
                                            <p className="text-xs font-semibold text-lys-primary truncate leading-tight">{row.name}</p>
                                            <p className="type-caption text-lys-muted mt-0.5 truncate">{row.customerName}</p>
                                            <p className="type-number text-xs font-bold text-tone-warning-fg mt-1.5">
                                                {formatVND(row.expectedValue)}
                                            </p>
                                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-lys-border text-[11px]">
                                                <span className="text-lys-secondary truncate max-w-[90px]">{row.assigneeName}</span>
                                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                    {next && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => handleMove(row.id, next)}
                                                            loading={actionLoading === row.id}
                                                            disabled={actionLoading === row.id}
                                                            title={`Chuyển sang ${next}`}
                                                        >
                                                            <MoveRight size={11} style={{ color: stage.color }} aria-hidden />
                                                        </Button>
                                                    )}
                                                    {!['WON', 'LOST'].includes(row.stage) && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 w-6 p-0 text-tone-danger-fg hover:bg-tone-danger-bg"
                                                            onClick={() => handleMarkLost(row.id, row.name)}
                                                            title="Đánh dấu Lost"
                                                        >
                                                            <XCircle size={11} aria-hidden />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-lys-muted hover:text-tone-danger-fg"
                                                        onClick={() => handleDelete(row.id)}
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={11} aria-hidden />
                                                    </Button>
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
            <Drawer
                open={Boolean(detail || detailLoading)}
                onClose={() => { setDetail(null); setEditing(false) }}
                title={detail ? (editing ? 'Chỉnh sửa cơ hội' : detail.name) : 'Đang tải cơ hội...'}
                description={detail ? `${detail.customerName} · ${detail.customerCode}` : undefined}
                size="md"
                actions={
                    detail && !editing && (
                        <Button size="sm" variant="secondary" onClick={startEdit}>
                            <Edit3 size={13} aria-hidden /> Sửa
                        </Button>
                    )
                }
                footer={
                    detail && !['WON', 'LOST'].includes(detail.stage) ? (
                        <div className="flex gap-2 w-full">
                            {getNextStage(detail.stage) && (
                                <Button
                                    className="flex-1"
                                    onClick={() => handleMove(detail.id, getNextStage(detail.stage)!)}
                                    loading={actionLoading === detail.id}
                                    disabled={actionLoading === detail.id}
                                >
                                    Chuyển sang {getNextStage(detail.stage)} <ArrowRight size={14} aria-hidden />
                                </Button>
                            )}
                            <Button
                                variant="danger-outline"
                                onClick={() => handleMarkLost(detail.id, detail.name)}
                            >
                                Đánh dấu Lost
                            </Button>
                        </div>
                    ) : undefined
                }
            >
                {detailLoading ? (
                    <div className="py-20 text-center type-caption">Đang tải chi tiết...</div>
                ) : detail && (
                    <div className="space-y-4">
                        {/* Stage Badge + Progress */}
                        <div className="p-3.5 bg-lys-subtle rounded-lg border border-lys-border space-y-2.5">
                            <div className="flex items-center justify-between">
                                {(() => {
                                    const cfg = getStageConfig(detail.stage)
                                    return cfg ? (
                                        <span
                                            className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                            style={{ background: `${cfg.color}15`, color: cfg.color }}
                                        >
                                            {cfg.label}
                                        </span>
                                    ) : null
                                })()}
                                {detail.previousStage && (
                                    <span className="type-caption flex items-center gap-1">
                                        <ArrowRight size={10} /> từ {detail.previousStage}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-1.5">
                                {['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].map(s => {
                                    const idx = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].indexOf(detail.stage)
                                    const sIdx = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'].indexOf(s)
                                    const isCompleted = detail.stage === 'LOST' ? false : sIdx <= idx
                                    return (
                                        <div
                                            key={s}
                                            className={cn('flex-1 h-1.5 rounded-full transition-all', isCompleted ? 'bg-lys-teal-strong' : 'bg-lys-border-strong')}
                                        />
                                    )
                                })}
                            </div>
                        </div>

                        {/* KPIs Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border border-lys-border bg-white text-center">
                                {editing ? (
                                    <Input
                                        type="number"
                                        value={editForm.expectedValue}
                                        onChange={e => setEditForm(f => ({ ...f, expectedValue: e.target.value }))}
                                        className="text-center font-bold"
                                    />
                                ) : (
                                    <p className="type-number text-sm font-bold text-tone-warning-fg">
                                        {formatVND(detail.expectedValue)}
                                    </p>
                                )}
                                <p className="type-caption mt-0.5">Giá Trị Kỳ Vọng</p>
                            </div>

                            <div className="p-3 rounded-lg border border-lys-border bg-white text-center">
                                <p className="type-number text-sm font-bold text-lys-teal-strong">{detail.probability}%</p>
                                <p className="type-caption mt-0.5">Xác suất thành công</p>
                            </div>

                            <div className="p-3 rounded-lg border border-lys-border bg-white text-center">
                                <p className={cn('type-number text-sm font-bold', detail.daysInStage > 14 && !['WON', 'LOST'].includes(detail.stage) ? 'text-tone-danger-fg' : 'text-lys-primary')}>
                                    {detail.daysInStage} ngày
                                </p>
                                <p className="type-caption mt-0.5 flex items-center justify-center gap-1">
                                    {detail.daysInStage > 14 && !['WON', 'LOST'].includes(detail.stage) && <AlertTriangle size={10} className="text-tone-danger-fg" />}
                                    Trong Stage
                                </p>
                            </div>

                            <div className="p-3 rounded-lg border border-lys-border bg-white text-center">
                                <p className="type-number text-sm font-bold text-lys-secondary">{detail.totalAge} ngày</p>
                                <p className="type-caption mt-0.5">Tổng Thời Gian</p>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between py-2 border-b border-lys-border">
                                <span className="type-caption flex items-center gap-1.5"><User size={13} /> Sales Rep</span>
                                {editing ? (
                                    <Select
                                        value={editForm.assignedTo}
                                        onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))}
                                        className="w-48"
                                    >
                                        {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </Select>
                                ) : (
                                    <span className="text-xs font-semibold text-lys-primary">{detail.assigneeName}</span>
                                )}
                            </div>

                            <div className="flex items-center justify-between py-2 border-b border-lys-border">
                                <span className="type-caption flex items-center gap-1.5"><Calendar size={13} /> Close Date</span>
                                {editing ? (
                                    <Input
                                        type="date"
                                        value={editForm.closeDate}
                                        onChange={e => setEditForm(f => ({ ...f, closeDate: e.target.value }))}
                                        className="w-48"
                                    />
                                ) : (
                                    <span className="type-number text-xs font-semibold text-lys-primary">
                                        {detail.closeDate ? new Date(detail.closeDate).toLocaleDateString('vi-VN') : '—'}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between py-2 border-b border-lys-border">
                                <span className="type-caption flex items-center gap-1.5"><Clock size={13} /> Ngày tạo</span>
                                <span className="type-caption">
                                    {new Date(detail.createdAt).toLocaleDateString('vi-VN')}
                                </span>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                                <FileText size={13} className="text-lys-muted" />
                                <span className="type-caption font-semibold">Ghi Chú</span>
                            </div>
                            {editing ? (
                                <Textarea
                                    value={editForm.notes}
                                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={3}
                                />
                            ) : (
                                <p className="text-xs leading-relaxed p-3 rounded-md bg-lys-subtle border border-lys-border text-lys-secondary">
                                    {detail.notes || 'Chưa có ghi chú'}
                                </p>
                            )}
                        </div>

                        {editing && (
                            <div className="flex gap-2 pt-2">
                                <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                                    Hủy
                                </Button>
                                <Button className="flex-1" onClick={saveEdit} loading={editSaving}>
                                    <Save size={14} aria-hidden /> Lưu thay đổi
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>

            {/* ═══ Lost Reason Modal ═══ */}
            {lostModal && (
                <Modal
                    open={Boolean(lostModal)}
                    onClose={() => setLostModal(null)}
                    title="Đánh dấu thất bại (Lost)"
                    className="max-w-sm"
                    footer={
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="secondary" onClick={() => setLostModal(null)}>
                                Hủy
                            </Button>
                            <Button variant="danger" onClick={confirmLost}>
                                Xác Nhận Lost
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-3">
                        <p className="type-caption">Cơ hội: <strong className="text-lys-primary">{lostModal.name}</strong></p>
                        <Textarea
                            value={lostReason}
                            onChange={e => setLostReason(e.target.value)}
                            rows={3}
                            placeholder="Lý do lost? (VD: Giá cao hơn đối thủ, Khách cắt ngân sách...)"
                            autoFocus
                        />
                    </div>
                </Modal>
            )}

            {/* ═══ Create Modal ═══ */}
            {createOpen && (
                <Modal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    title="Thêm Cơ Hội Mới"
                    className="max-w-md"
                    footer={
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                                Hủy
                            </Button>
                            <Button
                                onClick={handleCreate}
                                loading={saving}
                                disabled={saving || !formName || !formCustomerId || !formAssignee || !formValue}
                            >
                                Tạo Cơ Hội (→ Lead)
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-3">
                        <Field label="Tên cơ hội" required>
                            {id => (
                                <Input
                                    id={id}
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="VD: Park Hyatt Wine Program"
                                />
                            )}
                        </Field>

                        <Field label="Khách hàng" required>
                            {id => (
                                <Select
                                    id={id}
                                    value={formCustomerId}
                                    onChange={e => setFormCustomerId(e.target.value)}
                                >
                                    <option value="">Chọn khách hàng...</option>
                                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Assigned To" required>
                                {id => (
                                    <Select
                                        id={id}
                                        value={formAssignee}
                                        onChange={e => setFormAssignee(e.target.value)}
                                    >
                                        <option value="">Chọn Sales Rep...</option>
                                        {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </Select>
                                )}
                            </Field>

                            <Field label="Giá trị kỳ vọng (VND)" required>
                                {id => (
                                    <Input
                                        id={id}
                                        type="number"
                                        value={formValue}
                                        onChange={e => setFormValue(e.target.value)}
                                        placeholder="VD: 50000000"
                                        className="type-number"
                                    />
                                )}
                            </Field>
                        </div>

                        <Field label="Ngày dự kiến chốt">
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={formCloseDate}
                                    onChange={e => setFormCloseDate(e.target.value)}
                                />
                            )}
                        </Field>

                        <Field label="Ghi chú">
                            {id => (
                                <Textarea
                                    id={id}
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Ghi chú thêm..."
                                />
                            )}
                        </Field>
                    </div>
                </Modal>
            )}
            {confirmDialog}
        </div>
    )
}
