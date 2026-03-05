'use client'

import { useState, useCallback } from 'react'
import { Plus, Loader2, X, Target, TrendingUp, DollarSign, Percent, Trash2, ChevronRight, MoveRight } from 'lucide-react'
import { PipelineRow, OppStage, getOpportunities, createOpportunity, moveOpportunityStage, deleteOpportunity } from './actions'
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

    // Create form
    const [customers, setCustomers] = useState<any[]>([])
    const [reps, setReps] = useState<any[]>([])
    const [formName, setFormName] = useState('')
    const [formCustomerId, setFormCustomerId] = useState('')
    const [formAssignee, setFormAssignee] = useState('')
    const [formValue, setFormValue] = useState('')
    const [formCloseDate, setFormCloseDate] = useState('')
    const [formNotes, setFormNotes] = useState('')

    const reload = useCallback(async () => {
        const data = await getOpportunities()
        setRows(data)
    }, [])

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
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa cơ hội này?')) return
        await deleteOpportunity(id)
        await reload()
    }

    const getNextStage = (current: OppStage): OppStage | null => {
        const order: OppStage[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON']
        const idx = order.indexOf(current)
        if (idx === -1 || idx >= order.length - 1) return null
        return order[idx + 1]
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
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
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Thêm Cơ Hội
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Pipeline Value', value: formatVND(stats.totalPipelineValue), icon: DollarSign, color: '#87CBB9' },
                    { label: 'Weighted Value', value: formatVND(stats.weightedValue), icon: TrendingUp, color: '#D4A853' },
                    { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: Percent, color: '#5BA88A' },
                    { label: 'Tổng Cơ Hội', value: `${stats.total}`, icon: Target, color: '#8AAEBB' },
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
            <div className="grid grid-cols-6 gap-2" style={{ minHeight: '450px' }}>
                {STAGES.map(stage => {
                    const stageRows = rows.filter(r => r.stage === stage.key)
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
                                        <div key={row.id} className="p-2.5 rounded-md transition-all hover:shadow-lg"
                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <p className="text-xs font-semibold truncate" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                            <p className="text-[10px] mt-0.5 truncate" style={{ color: '#4A6A7A' }}>{row.customerName}</p>
                                            <p className="text-xs font-bold mt-1" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>
                                                {formatVND(row.expectedValue)}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{row.assigneeName}</span>
                                                <div className="flex gap-0.5">
                                                    {next && (
                                                        <button onClick={() => handleMove(row.id, next)} disabled={actionLoading === row.id}
                                                            className="p-1 rounded transition" title={`→ ${next}`}
                                                            style={{ background: `${stage.color}15` }}>
                                                            {actionLoading === row.id ? <Loader2 size={10} className="animate-spin" style={{ color: stage.color }} /> : <MoveRight size={10} style={{ color: stage.color }} />}
                                                        </button>
                                                    )}
                                                    {!['WON', 'LOST'].includes(row.stage) && (
                                                        <button onClick={() => handleMove(row.id, 'LOST')} className="p-1 rounded transition"
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

            {/* Create Modal */}
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
                                className="w-full px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                <option value="">Chọn khách hàng...</option>
                                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <select value={formAssignee} onChange={e => setFormAssignee(e.target.value)}
                                    className="px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}>
                                    <option value="">Assigned To...</option>
                                    {reps.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                                <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="Giá trị kỳ vọng"
                                    className="px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853', fontFamily: '"DM Mono"', borderRadius: '6px' }} />
                            </div>
                            <input type="date" value={formCloseDate} onChange={e => setFormCloseDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Ghi chú..."
                                className="w-full px-3 py-2 text-sm outline-none resize-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }} />
                            <button onClick={handleCreate} disabled={saving || !formName || !formCustomerId || !formAssignee || !formValue}
                                className="w-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Tạo Cơ Hội (→ Lead)'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
